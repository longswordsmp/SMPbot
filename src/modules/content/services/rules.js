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
          '**1.** Treat everyone with respect. No harassment, bullying, hate speech, or discrimination of any kind.',
          '**2.** No NSFW, gore, shock, or otherwise inappropriate content anywhere on the server.',
          '**3.** Keep every discussion in the correct channel — check the topic if you are unsure.',
          '**4.** No spam, flooding, mass mentions, excessive caps, or emoji/reaction spam.',
          '**5.** No advertising or DM self-promotion. Do not solicit members for other servers.',
          "**6.** Do not share personal information — yours or anyone else's (doxxing = instant ban).",
          '**7.** No malicious links, IP grabbers, scams, phishing, or crack/cheat links.',
          '**8.** Use one account. Alt accounts made to evade punishment will be banned.',
          '**9.** Impersonating staff or other members is not allowed.',
          '**10.** Follow the [Discord Community Guidelines](https://discord.com/guidelines) and Terms of Service at all times.',
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
          '**1.** No hacked clients, x-ray, cheat mods, macros, or unfair advantages of any kind.',
          "**2.** No griefing, stealing, or destroying other players' builds or items.",
          '**3.** Keep builds appropriate — no offensive, hateful, or NSFW structures.',
          '**4.** Respect claimed land and player boundaries. Build a reasonable distance from others.',
          '**5.** No lag machines, world-corrupting redstone, or intentionally crashing the server.',
          '**6.** Report bugs and exploits to staff — abusing them is bannable.',
          '**7.** Duping items, unless explicitly allowed, is not permitted.',
          '**8.** No AFK machines/farms left running to gain an unfair advantage while offline (server-dependent).',
          '**9.** Keep chat clean in-game too — the Discord rules apply on the server.',
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
          '**2.** PvP is only allowed by mutual agreement unless you are in a designated PvP zone.',
          '**3.** Trades and deals must be honored. Scamming and backstabbing are not tolerated.',
          '**4.** No stealing from communal builds, farms, or the spawn area.',
          '**5.** Keep the world clean — light up caves, fill holes, and leash/limit mob farms responsibly.',
          '**6.** Respect the spawn area and any community projects.',
          '**7.** Ask before joining or expanding onto someone else\'s base or town.',
          '**8.** Have fun, help newcomers settle in, and keep the SMP welcoming for everyone! 🌱',
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
          '**1.** Speak English in main channels so staff can moderate (use language-specific channels otherwise).',
          '**2.** No advertising or self-promotion without staff permission.',
          '**3.** No mic spam, earrape, soundboard abuse, or voice-changers used to annoy others.',
          '**4.** No channel hopping to disrupt voice chats.',
          '**5.** Keep drama and arguments out of public channels — open a ticket instead.',
          '**6.** Do not backseat-moderate. Ping staff or open a ticket and let them handle it.',
          '**7.** Staff decisions are final; discuss concerns privately and respectfully.',
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

/** The curated default rule set applied when a server has none (templates/setup). */
const DEFAULT_PACKS = ['discord', 'minecraft', 'smp', 'chat', 'punishment'];

/**
 * Seed a full, sensible rule set when the guild has no rules yet. Idempotent —
 * does nothing if any sections already exist. Returns the sections added.
 */
function ensureDefaults(client, guildId) {
  const config = getConfig(client, guildId);
  if ((config.sections ?? []).length) return [];
  return applyStarters(client, guildId, DEFAULT_PACKS);
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

function serverName(client, guild) {
  const brand = client.brand.branding(guild.id);
  const mc = client.config.get(guild.id, MINECRAFT_NS, {});
  return (mc.serverName && String(mc.serverName).trim()) || brand.name || guild.name;
}

/**
 * Build the rules as ONE cohesive message: a single branded embed with the
 * intro as its description and every rule section as a field, spilling into
 * additional embeds (all sent in the same message) only when Discord's 6000-
 * character / 25-field embed limits are reached.
 */
function buildRulesEmbeds(client, guild, config) {
  const sections = config.sections ?? [];
  const brand = client.brand.branding(guild.id);
  const name = truncate(serverName(client, guild), 240);
  const intro = [
    `Welcome to **${name}**! By being part of this community you agree to follow the rules below.`,
    'Breaking them may lead to warnings, mutes, kicks, or bans. 🔨',
    '',
    '_Please read every section carefully — ignorance of the rules is not an excuse._',
  ].join('\n');

  const MAX_FIELDS = 20;
  const MAX_CHARS = 5600; // headroom under the 6000 hard limit
  const embeds = [];

  let current = client.brand.embed(guild).setTitle(`📜 ${name} — Server Rules`).setDescription(intro);
  if (brand.bannerUrl) current.setImage(brand.bannerUrl);
  let used = `📜 ${name} — Server Rules`.length + intro.length;
  let fields = 0;

  const startContinuation = () => {
    embeds.push(current);
    current = client.brand.embed(guild, { footer: embeds.length === 0 }).setTitle('📜 Server Rules (continued)');
    used = 24;
    fields = 0;
  };

  sections.forEach((s, i) => {
    const fname = truncate(`${i + 1}.  ${s.emoji ? `${s.emoji} ` : ''}${s.title}`, 256);
    const fvalue = truncate(s.body && s.body.trim() ? s.body : '_No details provided._', 1024);
    if (fields >= MAX_FIELDS || used + fname.length + fvalue.length > MAX_CHARS) startContinuation();
    current.addFields({ name: fname, value: fvalue });
    used += fname.length + fvalue.length;
    fields += 1;
  });

  // A closing note on the last embed.
  const closing = '✅ Thanks for keeping our community safe and fun. Questions? Open a ticket and staff will help.';
  if (used + closing.length <= MAX_CHARS) current.addFields({ name: '​', value: closing });
  embeds.push(current);

  return embeds;
}

/** Count the characters Discord counts toward the 6000-per-message embed cap. */
function embedChars(embed) {
  const d = embed.data ?? {};
  let n = (d.title?.length ?? 0) + (d.description?.length ?? 0) + (d.footer?.text?.length ?? 0) + (d.author?.name?.length ?? 0);
  for (const f of d.fields ?? []) n += (f.name?.length ?? 0) + (f.value?.length ?? 0);
  return n;
}

/**
 * Publish (or republish) the rules to a channel via the branded webhook
 * pipeline. Deletes the previously published message(s) first, then posts the
 * rules as a single cohesive message (spilling to as few extra messages as
 * Discord's limits require), and records the new message ids.
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

  // Rules read as one cohesive block: all embeds in a single message when they
  // fit, spilling into as few extra messages as possible. Discord caps a single
  // message's COMBINED embed text at 6000 chars (and 10 embeds), so group by a
  // safe combined budget rather than assuming everything fits in one message.
  const allEmbeds = buildRulesEmbeds(client, guild, config);
  const groups = [];
  let group = [];
  let groupChars = 0;
  for (const embed of allEmbeds) {
    const chars = embedChars(embed);
    if (group.length && (groupChars + chars > 5800 || group.length >= 10)) {
      groups.push(group);
      group = [];
      groupChars = 0;
    }
    group.push(embed);
    groupChars += chars;
  }
  if (group.length) groups.push(group);

  const posted = [];
  for (const g of groups) {
    // eslint-disable-next-line no-await-in-loop
    const message = await client.hooks.send(channel, { embeds: g, allowedMentions: { parse: [] } });
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
  ensureDefaults,
  buildRulesEmbeds,
  publish,
};
