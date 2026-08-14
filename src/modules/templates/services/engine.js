'use strict';

const { ChannelType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const log = require('../../../core/logger');
const { truncate, clamp, intToHex } = require('../../../core/utils');
const definitions = require('./definitions');
const { decorateName } = require('./definitions/_common');
const customize = require('./customize');

const { get, counts, list } = definitions;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHANNEL_TYPE = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  stage: ChannelType.GuildStageVoice,
};

const TYPE_GLYPH = { text: '#', voice: '🔊', announcement: '📣', forum: '🗂️', stage: '🎤' };

// Markers that map straight onto the `logging.channels` config.
const LOG_MARKERS = {
  'logs-default': 'default',
  'logs-security': 'security',
  'logs-moderation': 'moderation',
  'logs-members': 'members',
  'logs-messages': 'messages',
};

// ---- permission helpers ----------------------------------------------------

/** Resolve an array of PermissionFlagsBits names to bit values, skipping unknowns. */
function permBits(names) {
  const out = [];
  if (!Array.isArray(names)) return out;
  for (const name of names) {
    const bit = PermissionFlagsBits[name];
    if (bit === undefined) {
      log.debug(`templates: unknown permission name '${name}' skipped.`);
      continue;
    }
    out.push(bit);
  }
  return out;
}

/**
 * Resolve a template overwrite spec to discord.js permissionOverwrites entries.
 * Returns undefined when there is nothing to apply (channel inherits defaults).
 */
function resolveOverwrites(entries, roleMap, staffKeys, guild) {
  if (!Array.isArray(entries) || !entries.length) return undefined;
  const out = [];
  for (const entry of entries) {
    const keys = entry.roleKey === 'STAFF_GROUP' ? staffKeys : [entry.roleKey];
    for (const key of keys) {
      let id;
      if (key === '@everyone') id = guild.roles.everyone.id;
      else {
        const role = roleMap.get(key);
        if (!role) continue; // role missing (creation failed) — skip defensively
        id = role.id;
      }
      const allow = permBits(entry.allow);
      const deny = permBits(entry.deny);
      const existing = out.find((o) => o.id === id);
      if (existing) {
        if (allow.length) existing.allow = (existing.allow || []).concat(allow);
        if (deny.length) existing.deny = (existing.deny || []).concat(deny);
      } else {
        const o = { id };
        if (allow.length) o.allow = allow;
        if (deny.length) o.deny = deny;
        out.push(o);
      }
    }
  }
  return out.length ? out : undefined;
}

// ---- naming ----------------------------------------------------------------

// ---- creation --------------------------------------------------------------

/** Create a channel, falling back to a universally-available type on failure. */
async function createChannel(guild, payload, requestedType) {
  try {
    return await guild.channels.create(payload);
  } catch (err) {
    const fallbackType = requestedType === 'stage' ? ChannelType.GuildVoice : ChannelType.GuildText;
    if (payload.type !== fallbackType) {
      const p2 = { ...payload, type: fallbackType };
      if (fallbackType === ChannelType.GuildVoice) {
        delete p2.topic;
        delete p2.rateLimitPerUser;
        delete p2.nsfw;
      }
      try {
        log.debug(`templates: '${payload.name}' (${requestedType}) failed, retrying as fallback type.`);
        return await guild.channels.create(p2);
      } catch (err2) {
        log.warn(`templates: failed to create channel '${payload.name}':`, err2?.message ?? err2);
        return null;
      }
    }
    log.warn(`templates: failed to create channel '${payload.name}':`, err?.message ?? err);
    return null;
  }
}

/** Best-effort role ladder ordering below the bot's highest role. */
async function orderRoles(guild, me, tpl, roleMap) {
  const botTop = me.roles.highest.position;
  const positions = [];
  let pos = botTop - 1;
  for (const roleDef of tpl.roles) {
    const role = roleMap.get(roleDef.key);
    if (!role || role.id === guild.roles.everyone.id) continue;
    if (role.position >= botTop) continue; // cannot move a role above the bot
    if (pos < 1) break;
    positions.push({ role: role.id, position: pos });
    pos -= 1;
  }
  if (positions.length) await guild.roles.setPositions(positions);
}

/** Delete existing non-essential channels/categories (replace mode). */
async function purge(guild, protectChannelId) {
  const communityRequired = new Set(
    [guild.rulesChannelId, guild.publicUpdatesChannelId, guild.safetyAlertsChannelId, guild.widgetChannelId].filter(Boolean),
  );
  const all = [...guild.channels.cache.values()];
  const categories = all.filter((c) => c.type === ChannelType.GuildCategory);
  const nonCategories = all.filter((c) => c.type !== ChannelType.GuildCategory);
  let n = 0;
  const remove = async (c) => {
    if (!c || c.id === protectChannelId) return;
    if (communityRequired.has(c.id)) return;
    if (!c.deletable) return;
    try {
      await c.delete('SMPbot template: replace mode');
      if (++n % 5 === 0) await sleep(1500);
    } catch (err) {
      log.warn(`templates: could not delete #${c?.name}:`, err?.message ?? err);
    }
  };
  for (const c of nonCategories) await remove(c);
  for (const c of categories) await remove(c);
  // The channel the confirmation lives in is deleted last, and only if allowed.
  if (protectChannelId) {
    const c = guild.channels.cache.get(protectChannelId);
    if (c && c.deletable && !communityRequired.has(c.id)) {
      try {
        await c.delete('SMPbot template: replace mode');
      } catch (err) {
        log.debug(`templates: protected channel not deleted:`, err?.message ?? err);
      }
    }
  }
}

function summarize(created) {
  return {
    createdRoles: created.roles,
    createdChannels: created.channels,
    createdCategories: created.categories,
    roleIds: created.roleIds,
    channelIds: created.channelIds,
    categoryIds: created.categoryIds,
  };
}

/**
 * Build the server from a template.
 * options: { mode: 'add'|'replace', prefixEmoji, roleOverrides, onProgress, protectChannelId }
 * Returns { createdRoles, createdChannels, createdCategories, roleIds, channelIds, categoryIds }.
 * On a fatal error mid-way it throws, attaching `.created` describing what exists.
 */
async function apply(guild, id, options = {}) {
  const client = guild.client;
  const tpl = get(id);
  if (!tpl) throw new Error(`Unknown template: ${id}`);

  const mode = options.mode === 'replace' ? 'replace' : 'add';
  const roleOverrides = options.roleOverrides && typeof options.roleOverrides === 'object' ? options.roleOverrides : {};
  const prefixEmoji = options.prefixEmoji ?? tpl.defaultPrefixEmoji ?? false;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const protectChannelId = options.protectChannelId || null;

  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels) || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    const err = new Error('MISSING_BOT_PERMISSIONS');
    err.code = 'MISSING_BOT_PERMISSIONS';
    throw err;
  }

  const staffKeys = tpl.roles.filter((r) => r.staff).map((r) => r.key);
  const created = { roles: 0, channels: 0, categories: 0, roleIds: [], channelIds: [], categoryIds: [] };
  const channelMeta = []; // [{ id, base, emoji }] for post-apply emoji toggling
  const roleMap = new Map();
  roleMap.set('@everyone', guild.roles.everyone);
  const markers = {};

  const total = tpl.roles.length + tpl.categories.reduce((n, c) => n + 1 + c.channels.length, 0);
  let done = 0;
  let sinceDelay = 0;
  const tick = async () => {
    done += 1;
    if (onProgress) {
      try {
        await onProgress(done, total);
      } catch {
        /* progress reporting must never break the build */
      }
    }
    sinceDelay += 1;
    if (sinceDelay >= 5) {
      sinceDelay = 0;
      await sleep(1500); // pacing only — not future-scheduled work
    }
  };

  try {
    if (mode === 'replace') await purge(guild, protectChannelId);

    // 1) Roles — highest ladder rung first, reusing any same-name role.
    for (const roleDef of tpl.roles) {
      const name = roleOverrides[roleDef.key] || roleDef.name;
      const existing = guild.roles.cache.find((r) => r.name === name && r.id !== guild.roles.everyone.id);
      if (existing) {
        roleMap.set(roleDef.key, existing);
      } else {
        try {
          const role = await guild.roles.create({
            name,
            color: Number.isInteger(roleDef.color) ? roleDef.color : undefined,
            hoist: Boolean(roleDef.hoist),
            mentionable: Boolean(roleDef.mentionable),
            permissions: new PermissionsBitField(permBits(roleDef.permissions)),
            reason: `SMPbot template: ${tpl.name}`,
          });
          roleMap.set(roleDef.key, role);
          created.roleIds.push(role.id);
          created.roles += 1;
        } catch (err) {
          log.warn(`templates: failed to create role '${name}':`, err?.message ?? err);
        }
      }
      await tick();
    }

    await orderRoles(guild, me, tpl, roleMap).catch((err) => log.debug('templates: role ordering skipped:', err?.message ?? err));

    // 2) Categories + channels.
    for (const catDef of tpl.categories) {
      let category = null;
      try {
        category = await guild.channels.create({
          name: catDef.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: resolveOverwrites(catDef.overwrites, roleMap, staffKeys, guild),
          reason: `SMPbot template: ${tpl.name}`,
        });
        created.channelIds.push(category.id);
        created.categoryIds.push(category.id);
        created.categories += 1;
      } catch (err) {
        log.warn(`templates: failed to create category '${catDef.name}':`, err?.message ?? err);
      }
      await tick();

      for (const chDef of catDef.channels) {
        const requestedType = chDef.type;
        const type = CHANNEL_TYPE[requestedType] ?? ChannelType.GuildText;
        const payload = {
          name: decorateName(chDef.name, chDef.emoji, prefixEmoji),
          type,
          reason: `SMPbot template: ${tpl.name}`,
          permissionOverwrites: resolveOverwrites(chDef.overwrites, roleMap, staffKeys, guild),
        };
        if (category) payload.parent = category.id;
        const textLike = requestedType === 'text' || requestedType === 'announcement' || requestedType === 'forum';
        if (textLike && chDef.topic) payload.topic = truncate(String(chDef.topic), 1024);
        if (requestedType === 'text' && Number.isInteger(chDef.slowmode)) payload.rateLimitPerUser = clamp(chDef.slowmode, 0, 21600);
        if (textLike && chDef.nsfw) payload.nsfw = true;

        const channel = await createChannel(guild, payload, requestedType);
        if (channel) {
          created.channelIds.push(channel.id);
          created.channels += 1;
          channelMeta.push({ id: channel.id, base: chDef.name, emoji: chDef.emoji || null });
          if (chDef.marker) markers[chDef.marker] = channel;
        }
        await tick();
      }
    }
  } catch (err) {
    err.created = summarize(created);
    throw err;
  }

  // Record the application so /template customize can operate precisely.
  customize.record(client, guild, tpl, roleMap, channelMeta, prefixEmoji);

  await wireAndSeed(client, guild, tpl, markers).catch((err) =>
    log.warn('templates: post-build wiring failed:', err?.message ?? err),
  );

  return summarize(created);
}

/** Wire marker channels into other modules' config, and post starter content. */
async function wireAndSeed(client, guild, tpl, markers) {
  const gid = guild.id;

  // Logging channels.
  try {
    const channels = {};
    for (const [marker, key] of Object.entries(LOG_MARKERS)) {
      if (markers[marker]) channels[key] = markers[marker].id;
    }
    if (Object.keys(channels).length) client.config.update(gid, 'logging', { enabled: true, channels });
  } catch (err) {
    log.warn('templates: logging wiring failed:', err?.message ?? err);
  }

  // Welcome channel.
  try {
    if (markers.welcome) client.config.update(gid, 'welcome', { enabled: true, channelId: markers.welcome.id });
  } catch (err) {
    log.warn('templates: welcome wiring failed:', err?.message ?? err);
  }

  // Rules channel + published rules.
  try {
    if (markers.rules) client.config.update(gid, 'rules', { channelId: markers.rules.id });
  } catch (err) {
    log.warn('templates: rules wiring failed:', err?.message ?? err);
  }

  // Verification channel.
  try {
    if (markers.verification) client.config.update(gid, 'verification', { channelId: markers.verification.id });
  } catch (err) {
    log.warn('templates: verification wiring failed:', err?.message ?? err);
  }

  // Tickets default parent (the tickets module stores per-category parents in
  // its own table; this records a sensible default for it to pick up).
  try {
    if (markers['tickets-panel']?.parentId) {
      client.config.update(gid, 'tickets', { defaultParentId: markers['tickets-panel'].parentId });
    }
  } catch (err) {
    log.warn('templates: tickets wiring failed:', err?.message ?? err);
  }

  // Minecraft server name — only fill it in when unset.
  try {
    const mc = client.config.get(gid, 'minecraft', { serverName: '' });
    if (!mc.serverName) client.config.update(gid, 'minecraft', { serverName: truncate(guild.name, 100) });
  } catch (err) {
    log.warn('templates: minecraft wiring failed:', err?.message ?? err);
  }

  // Remember which template was applied.
  try {
    client.config.update(gid, 'setup', { template: tpl.id });
  } catch (err) {
    log.warn('templates: setup wiring failed:', err?.message ?? err);
  }

  // Starter content via cross-module services (all optional / defensive).
  if (markers.rules) {
    try {
      await client.services.rules?.publish?.(guild, markers.rules);
    } catch (err) {
      log.debug('templates: rules publish skipped:', err?.message ?? err);
    }
  }
  if (markers.verification) {
    try {
      await client.services.verification?.publishPanel?.(guild, markers.verification);
    } catch (err) {
      log.debug('templates: verify panel skipped:', err?.message ?? err);
    }
  }
  if (markers['server-ip']) {
    try {
      await client.services.serverinfo?.publishGuide?.(guild, markers['server-ip']);
    } catch (err) {
      log.debug('templates: connection guide skipped:', err?.message ?? err);
    }
  }

  // Branded "built by SMPbot" welcome message in the general channel.
  if (markers.general) {
    try {
      const embed = client.brand
        .embed(guild)
        .setTitle(`${tpl.emoji} Welcome to ${truncate(guild.name, 200)}!`)
        .setDescription(
          [
            `This server was built with the **${tpl.name}** template by **SMPbot**.`,
            '',
            'Staff can fine-tune everything with `/template customize`, and run `/setup` to configure the rest of the bot.',
            '',
            'Have fun, and welcome aboard! 🎉',
          ].join('\n'),
        );
      await client.hooks.send(markers.general, { embeds: [embed] });
    } catch (err) {
      log.debug('templates: welcome message skipped:', err?.message ?? err);
    }
  }
}

// ---- preview ---------------------------------------------------------------

function isHidden(overwrites) {
  return Array.isArray(overwrites) && overwrites.some((o) => o.roleKey === '@everyone' && Array.isArray(o.deny) && o.deny.includes('ViewChannel'));
}

/** Build preview embeds that describe a template without creating anything. */
function preview(guild, id) {
  const client = guild.client;
  const tpl = get(id);
  if (!tpl) return [client.brand.error(guild, 'Unknown template', `There is no template with id \`${id}\`.`)];

  const c = counts(tpl);
  const overview = client.brand
    .embed(guild)
    .setTitle(`${tpl.emoji} ${tpl.name}`)
    .setDescription(tpl.description)
    .addFields(
      { name: 'Roles', value: String(c.roles), inline: true },
      { name: 'Categories', value: String(c.categories), inline: true },
      { name: 'Channels', value: String(c.channels), inline: true },
    );
  const roleLines = tpl.roles
    .map((r) => `**${r.name}** · \`${intToHex(r.color)}\`${r.staff ? ' · 🛡️ staff' : ''}${r.hoist ? ' · hoisted' : ''}`)
    .join('\n');
  overview.addFields({ name: 'Role ladder (top → bottom)', value: truncate(roleLines, 1024) });
  if (tpl.defaultPrefixEmoji) {
    overview.addFields({ name: 'Naming', value: 'Channels use emoji-prefixed names by default.' });
  }

  const embeds = [overview];

  // Category tree, chunked so no single embed description exceeds the limit.
  const blocks = tpl.categories.map((cat) => {
    const header = `**📂 ${cat.name}**${isHidden(cat.overwrites) ? ' 🔒' : ''}`;
    const lines = cat.channels.map((ch) => {
      const glyph = TYPE_GLYPH[ch.type] ?? '#';
      const emoji = ch.emoji ? `${ch.emoji} ` : '';
      const lock = isHidden(ch.overwrites) ? ' 🔒' : '';
      const mark = ch.marker ? ` · \`${ch.marker}\`` : '';
      return ` ${glyph} ${emoji}${ch.name}${lock}${mark}`;
    });
    return [header, ...lines].join('\n');
  });

  let current = [];
  let length = 0;
  const flush = () => {
    if (!current.length) return;
    embeds.push(
      client.brand
        .embed(guild, { footer: false })
        .setTitle(`${tpl.emoji} ${tpl.name} — structure`)
        .setDescription(current.join('\n\n')),
    );
    current = [];
    length = 0;
  };
  for (const block of blocks) {
    if (length + block.length + 2 > 3800 && current.length) flush();
    current.push(block);
    length += block.length + 2;
  }
  flush();

  return embeds;
}

module.exports = { list, get, counts, preview, apply };
