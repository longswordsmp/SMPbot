'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const { decorateName } = require('./definitions/_common');
const definitions = require('./definitions');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Persistence + operations for post-apply customization. The most recent
 * template application per guild is recorded so `/template customize` can
 * rename the exact roles it created and toggle emoji prefixes on the exact
 * channels it created — all durable state lives in `template_applications`.
 */

function record(client, guild, tpl, roleMap, channelMeta, prefixEmoji) {
  try {
    const roles = {};
    for (const roleDef of tpl.roles) {
      const role = roleMap.get(roleDef.key);
      if (role && role.id !== guild.roles.everyone.id) roles[roleDef.key] = role.id;
    }
    client.db.run(
      `INSERT INTO template_applications (guild_id, template_id, prefix_emoji, roles, channels, applied_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())
       ON CONFLICT (guild_id) DO UPDATE SET
         template_id = excluded.template_id,
         prefix_emoji = excluded.prefix_emoji,
         roles = excluded.roles,
         channels = excluded.channels,
         applied_at = excluded.applied_at`,
      guild.id,
      tpl.id,
      prefixEmoji ? 1 : 0,
      JSON.stringify(roles),
      JSON.stringify(Array.isArray(channelMeta) ? channelMeta : []),
    );
  } catch (err) {
    log.warn('templates: failed to record application:', err?.message ?? err);
  }
}

/** The most recent application for a guild, or null. */
function get(client, guildId) {
  try {
    const row = client.db.get('SELECT * FROM template_applications WHERE guild_id = ?', guildId);
    if (!row) return null;
    return {
      templateId: row.template_id,
      prefixEmoji: Boolean(row.prefix_emoji),
      roles: safeParse(row.roles, {}),
      channels: safeParse(row.channels, []),
      appliedAt: row.applied_at,
    };
  } catch (err) {
    log.warn('templates: failed to read application:', err?.message ?? err);
    return null;
  }
}

/** Resolve stored role ids to { key, name, role } entries that still exist. */
function resolveRoles(guild, application) {
  const tpl = definitions.get(application?.templateId);
  const out = [];
  if (!tpl || !application) return out;
  for (const roleDef of tpl.roles) {
    const id = application.roles?.[roleDef.key];
    if (!id) continue;
    const role = guild.roles.cache.get(id);
    if (!role) continue;
    out.push({ key: roleDef.key, defaultName: roleDef.name, role });
  }
  return out;
}

/** Rename a stored role. Returns { ok, error? }. */
async function renameRole(client, guild, application, roleKey, newName) {
  const id = application?.roles?.[roleKey];
  if (!id) return { ok: false, error: 'That role is no longer tracked.' };
  const role = guild.roles.cache.get(id);
  if (!role) return { ok: false, error: 'That role no longer exists.' };
  const me = guild.members.me;
  if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
    return { ok: false, error: `I cannot edit **${role.name}** — it is above my highest role.` };
  }
  const name = String(newName || '').trim().slice(0, 100);
  if (!name) return { ok: false, error: 'The new name cannot be empty.' };
  try {
    await role.setName(name, 'SMPbot template customize');
    return { ok: true, name };
  } catch (err) {
    log.warn('templates: role rename failed:', err?.message ?? err);
    return { ok: false, error: 'Discord rejected that rename. Check my permissions and try a different name.' };
  }
}

/**
 * Toggle emoji prefixes across the tracked channels. Returns
 * { enabled, renamed, failed }.
 */
async function toggleEmojiPrefixes(client, guild, application) {
  const enabled = !application.prefixEmoji;
  let renamed = 0;
  let failed = 0;
  let n = 0;
  for (const meta of application.channels || []) {
    if (!meta?.id || !meta.emoji) continue; // only channels that carry an emoji
    const channel = guild.channels.cache.get(meta.id);
    if (!channel) continue;
    const target = decorateName(meta.base, meta.emoji, enabled);
    if (channel.name === target) continue;
    try {
      await channel.setName(target, 'SMPbot template customize');
      renamed += 1;
      if (++n % 5 === 0) await sleep(1500);
    } catch (err) {
      failed += 1;
      log.debug(`templates: could not rename channel ${meta.id}:`, err?.message ?? err);
    }
  }
  try {
    client.db.run('UPDATE template_applications SET prefix_emoji = ? WHERE guild_id = ?', enabled ? 1 : 0, guild.id);
  } catch (err) {
    log.warn('templates: failed to persist prefix toggle:', err?.message ?? err);
  }
  return { enabled, renamed, failed };
}

/** Build the ephemeral customize panel (role rename select + emoji toggle). */
function buildPanel(client, guild, application) {
  const tpl = definitions.get(application.templateId);
  const roles = resolveRoles(guild, application);
  const embed = client.brand
    .embed(guild)
    .setTitle('🛠️ Customize template')
    .setDescription(
      [
        `Applied template: **${tpl ? `${tpl.emoji} ${tpl.name}` : application.templateId}**`,
        '',
        'Use the menu to **rename a role**, or the button to **toggle emoji prefixes** on the channels this template created.',
        `Emoji prefixes are currently **${application.prefixEmoji ? 'on' : 'off'}**.`,
      ].join('\n'),
    );

  const components = [];
  if (roles.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('template:rrole')
      .setPlaceholder('Rename a role…')
      .addOptions(
        roles.slice(0, 25).map((r) => ({
          label: truncate(r.role.name, 100),
          value: r.key,
          description: truncate(`Rename “${r.role.name}”`, 100),
        })),
      );
    components.push(new ActionRowBuilder().addComponents(menu));
  }
  const toggle = new ButtonBuilder()
    .setCustomId('template:emoji')
    .setLabel(application.prefixEmoji ? 'Remove emoji prefixes' : 'Add emoji prefixes')
    .setEmoji('🔤')
    .setStyle(ButtonStyle.Secondary);
  components.push(new ActionRowBuilder().addComponents(toggle));

  return { embeds: [embed], components };
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json ?? '');
  } catch {
    return fallback;
  }
}

module.exports = { record, get, resolveRoles, renameRole, toggleEmojiPrefixes, buildPanel };
