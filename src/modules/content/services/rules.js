'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');

const RULES_NS = 'rules';
const MINECRAFT_NS = 'minecraft';

const LIMITS = { title: 200, body: 3800, emoji: 32, maxSections: 25 };

const DEFAULTS = {
  sections: [], // [{ id, emoji, title, body }]
  channelId: null,
  messages: [], // [{ channelId, messageId }] of the last published rule messages
  setupDone: false,
};

/**
 * Prewritten, themed starter rule packs offered on first `/rules setup`. Each
 * pack contributes one editable section the owner can tweak afterwards.
 */
const STARTER_PACKS = {
  discord: {
    label: 'Discord Rules',
    emoji: '💬',
    description: 'Core server conduct rules.',
    sections: [
      {
        emoji: '💬',
        title: 'Discord Rules',
        body: [
          '**1.** Treat everyone with respect. No harassment, hate speech, or discrimination.',
          '**2.** No NSFW, gore, or otherwise inappropriate content anywhere.',
          '**3.** Keep discussions in the correct channels.',
          '**4.** No spam, mass mentions, or excessive caps.',
          '**5.** Do not share personal information — yours or anyone else\'s.',
          '**6.** Follow the Discord Community Guidelines and Terms of Service at all times.',
        ].join('\n'),
      },
    ],
  },
  minecraft: {
    label: 'Minecraft Rules',
    emoji: '⛏️',
    description: 'In-game conduct for the SMP world.',
    sections: [
      {
        emoji: '⛏️',
        title: 'Minecraft Rules',
        body: [
          '**1.** No hacked clients, x-ray, or unfair mods.',
          '**2.** No griefing, stealing, or destroying other players\' builds.',
          '**3.** Keep builds appropriate — no offensive structures.',
          '**4.** Respect claimed land and player boundaries.',
          '**5.** Report bugs and exploits to staff instead of abusing them.',
        ].join('\n'),
      },
    ],
  },
  smp: {
    label: 'SMP Rules',
    emoji: '🌍',
    description: 'Survival-multiplayer community expectations.',
    sections: [
      {
        emoji: '🌍',
        title: 'SMP Guidelines',
        body: [
          '**1.** Be a good neighbor — cooperation makes the SMP thrive.',
          '**2.** PvP is only allowed by mutual agreement unless in designated zones.',
          '**3.** Trades and deals should be honored. Scamming is not tolerated.',
          '**4.** Keep the world clean — light up caves, fill holes, and manage mob farms responsibly.',
          '**5.** Have fun and help newcomers settle in!',
        ].join('\n'),
      },
    ],
  },
  chat: {
    label: 'Chat Rules',
    emoji: '🗣️',
    description: 'Text & voice channel etiquette.',
    sections: [
      {
        emoji: '🗣️',
        title: 'Chat & Voice Rules',
        body: [
          '**1.** English in main channels so staff can moderate (use language-specific channels otherwise).',
          '**2.** No advertising or self-promotion without permission.',
          '**3.** No mic spam, earrape, or soundboard abuse in voice.',
          '**4.** Keep drama and arguments out of public channels — open a ticket instead.',
          '**5.** Staff decisions are final; discuss concerns privately and respectfully.',
        ].join('\n'),
      },
    ],
  },
  staff: {
    label: 'Staff Rules',
    emoji: '🛡️',
    description: 'Expectations for the staff team.',
    sections: [
      {
        emoji: '🛡️',
        title: 'Staff Conduct',
        body: [
          '**1.** Lead by example — staff are held to the highest standard.',
          '**2.** Never abuse permissions for personal gain.',
          '**3.** Stay impartial; escalate conflicts you are involved in.',
          '**4.** Keep staff discussions confidential.',
          '**5.** Document moderation actions and be ready to justify them.',
        ].join('\n'),
      },
    ],
  },
  punishment: {
    label: 'Punishment Ladder',
    emoji: '⚖️',
    description: 'How rule-breaking is handled.',
    sections: [
      {
        emoji: '⚖️',
        title: 'Punishment Ladder',
        body: [
          'Rule violations are handled progressively based on severity:',
          '',
          '**1st offense** — Verbal warning',
          '**2nd offense** — Formal warning (logged)',
          '**3rd offense** — Temporary mute / timeout',
          '**4th offense** — Temporary ban',
          '**5th offense** — Permanent ban',
          '',
          '_Severe violations (cheating, doxxing, threats) may skip straight to a ban._',
        ].join('\n'),
      },
    ],
  },
};

function starterList() {
  return Object.entries(STARTER_PACKS).map(([key, pack]) => ({
    key,
    label: pack.label,
    emoji: pack.emoji,
    description: pack.description,
  }));
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getConfig(client, guildId) {
  return client.config.get(guildId, RULES_NS, DEFAULTS);
}

function saveConfig(client, guildId, config) {
  client.config.set(guildId, RULES_NS, config);
}

function slugify(input) {
  const base = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base || 'section';
}

function uniqueId(config, base) {
  const existing = new Set((config.sections ?? []).map((s) => s.id));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function listSections(client, guildId) {
  return getConfig(client, guildId).sections ?? [];
}

function getSection(client, guildId, sectionId) {
  return listSections(client, guildId).find((s) => s.id === sectionId) ?? null;
}

function addSection(client, guildId, { emoji, title, body }) {
  const config = getConfig(client, guildId);
  const sections = [...(config.sections ?? [])];
  if (sections.length >= LIMITS.maxSections) return { ok: false, error: `You can have at most ${LIMITS.maxSections} rule sections.` };
  const cleanTitle = truncate(String(title || '').trim(), LIMITS.title);
  if (!cleanTitle) return { ok: false, error: 'A section needs a title.' };
  const id = uniqueId(config, slugify(cleanTitle));
  const section = {
    id,
    emoji: normalizeEmoji(emoji),
    title: cleanTitle,
    body: truncate(String(body || '').trim(), LIMITS.body),
  };
  sections.push(section);
  saveConfig(client, guildId, { ...config, sections });
  return { ok: true, section };
}

function editSection(client, guildId, sectionId, { emoji, title, body }) {
  const config = getConfig(client, guildId);
  const sections = [...(config.sections ?? [])];
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx === -1) return { ok: false, error: 'That section does not exist.' };
  const cleanTitle = truncate(String(title || '').trim(), LIMITS.title);
  if (!cleanTitle) return { ok: false, error: 'A section needs a title.' };
  sections[idx] = {
    ...sections[idx],
    emoji: normalizeEmoji(emoji),
    title: cleanTitle,
    body: truncate(String(body || '').trim(), LIMITS.body),
  };
  saveConfig(client, guildId, { ...config, sections });
  return { ok: true, section: sections[idx] };
}

function removeSection(client, guildId, sectionId) {
  const config = getConfig(client, guildId);
  const sections = (config.sections ?? []).filter((s) => s.id !== sectionId);
  if (sections.length === (config.sections ?? []).length) return { ok: false, error: 'That section does not exist.' };
  saveConfig(client, guildId, { ...config, sections });
  return { ok: true };
}

/** Append starter packs' sections, skipping any whose title already exists. */
function applyStarters(client, guildId, packKeys) {
  const config = getConfig(client, guildId);
  let sections = [...(config.sections ?? [])];
  const existingTitles = new Set(sections.map((s) => s.title.toLowerCase()));
  const added = [];
  for (const key of packKeys) {
    const pack = STARTER_PACKS[key];
    if (!pack) continue;
    for (const s of pack.sections) {
      if (sections.length >= LIMITS.maxSections) break;
      if (existingTitles.has(s.title.toLowerCase())) continue;
      const id = uniqueId({ sections }, slugify(s.title));
      const section = { id, emoji: normalizeEmoji(s.emoji), title: truncate(s.title, LIMITS.title), body: truncate(s.body, LIMITS.body) };
      sections.push(section);
      existingTitles.add(s.title.toLowerCase());
      added.push(section);
    }
  }
  saveConfig(client, guildId, { ...config, sections, setupDone: true });
  return added;
}

function normalizeEmoji(emoji) {
  const raw = String(emoji ?? '').trim();
  if (!raw) return null;
  return truncate(raw, LIMITS.emoji);
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

function serverName(client, guild) {
  const brand = client.brand.branding(guild.id);
  const mc = client.config.get(guild.id, MINECRAFT_NS, {});
  return (mc.serverName && String(mc.serverName).trim()) || brand.name || guild.name;
}

/** Header + per-section embeds. */
function buildRulesEmbeds(client, guild, config) {
  const sections = config.sections ?? [];
  const brand = client.brand.branding(guild.id);
  const header = client.brand
    .embed(guild)
    .setTitle(`📜 ${truncate(serverName(client, guild), 240)} — Server Rules`)
    .setDescription(
      [
        'By being part of this community you agree to follow the rules below.',
        'Breaking them may lead to warnings, mutes, kicks, or bans.',
        '',
        'Please read every section carefully. Ignorance of the rules is not an excuse.',
      ].join('\n'),
    );
  if (brand.bannerUrl) header.setImage(brand.bannerUrl);

  const sectionEmbeds = sections.map((s, i) =>
    client.brand
      .embed(guild)
      .setTitle(truncate(`#${i + 1} • ${s.emoji ? `${s.emoji} ` : ''}${s.title}`, 256))
      .setDescription(truncate(s.body || '_No details provided._', 4000)),
  );

  return [header, ...sectionEmbeds];
}

/**
 * Publish (or republish) the rules to a channel via the branded webhook
 * pipeline. Deletes the previously published messages first, then posts a
 * fresh header + one message per section, and records the new message ids.
 * Returns { ok, count?, error? }.
 */
async function publish(client, guild, channel) {
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    return { ok: false, error: 'Rules can only be published to a text or announcement channel.' };
  }
  if (channel.guildId !== guild.id) return { ok: false, error: 'That channel is not in this server.' };
  const me = guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
    return { ok: false, error: `I cannot send messages in ${channel}. Check my channel permissions.` };
  }

  const config = getConfig(client, guild.id);
  const sections = config.sections ?? [];
  if (!sections.length) {
    return { ok: false, error: 'There are no rule sections yet. Add some with `/rules add` or `/rules setup`.' };
  }

  // Remove the previously published messages so republishing stays clean.
  await deletePublished(client, guild, config);

  const embeds = buildRulesEmbeds(client, guild, config);
  const posted = [];
  for (const embed of embeds) {
    // One message per embed keeps each section cleanly separated and editable.
    // eslint-disable-next-line no-await-in-loop
    const message = await client.hooks.send(channel, { embeds: [embed], allowedMentions: { parse: [] } });
    if (message?.id) posted.push({ channelId: channel.id, messageId: message.id });
  }

  if (!posted.length) {
    return { ok: false, error: `I could not post the rules in ${channel}. Check my permissions there.` };
  }

  saveConfig(client, guild.id, { ...config, channelId: channel.id, messages: posted });

  try {
    await client.logs.send(guild, 'server', {
      embeds: [
        client.brand
          .embed(guild, { color: 'info' })
          .setTitle('📜 Rules published')
          .setDescription(`**${sections.length}** rule section(s) published in <#${channel.id}>.`),
      ],
    });
  } catch (err) {
    log.debug('Rules publish log failed:', err?.message ?? err);
  }

  return { ok: true, count: sections.length };
}

async function deletePublished(client, guild, config) {
  const messages = config.messages ?? [];
  for (const ref of messages) {
    try {
      const channel =
        guild.channels.cache.get(ref.channelId) ?? (await guild.channels.fetch(ref.channelId).catch(() => null));
      const message = channel?.messages ? await channel.messages.fetch(ref.messageId).catch(() => null) : null;
      if (message) await message.delete().catch(() => null);
    } catch (err) {
      log.debug(`Could not delete old rules message ${ref.messageId}:`, err?.message ?? err);
    }
  }
}

module.exports = {
  RULES_NS,
  LIMITS,
  DEFAULTS,
  STARTER_PACKS,
  starterList,
  getConfig,
  saveConfig,
  listSections,
  getSection,
  addSection,
  editSection,
  removeSection,
  applyStarters,
  buildRulesEmbeds,
  publish,
};
