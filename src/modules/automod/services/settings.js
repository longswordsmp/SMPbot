'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { formatDuration, clamp } = require('../../../core/utils');

const NAMESPACE = 'automod';

/** Moderation actions AutoMod can apply, ordered mildest → harshest. */
const ACTIONS = ['delete', 'warn', 'timeout', 'kick', 'ban'];

/** Valid strike-escalation targets. */
const ESCALATION_ACTIONS = ['timeout', 'kick', 'ban'];

const SENSITIVITIES = ['strict', 'normal', 'relaxed'];

const RAID_RESPONSES = ['alert', 'lockdown', 'kick', 'lockdown-kick'];

/** Config defaults for the `automod` namespace (referenced by /setup + templates). */
const DEFAULTS = {
  enabled: true,
  timeoutMinutes: 10, // duration applied by the 'timeout' action
  bypassRoles: [], // roles that bypass every check (staff bypass)
  whitelistChannels: [], // channels (or categories) where AutoMod never runs
  whitelistRoles: [], // roles that are exempt from every check
  strikes: { enabled: true, threshold: 4, windowMinutes: 10, action: 'timeout' },
  spam: {
    flood: { enabled: true, action: 'delete', maxMessages: 6, windowSeconds: 5 },
    duplicates: { enabled: true, action: 'delete', maxRepeats: 3, windowSeconds: 30 },
    mentions: { enabled: true, action: 'delete', maxPerMessage: 6, maxPerWindow: 12, windowSeconds: 30 },
    emoji: { enabled: true, action: 'delete', maxPerMessage: 12 },
    caps: { enabled: true, action: 'delete', minLength: 15, maxPercent: 75 },
    characters: { enabled: true, action: 'delete', maxRepeated: 12, maxNewlines: 15 },
    reactions: { enabled: false, action: 'warn', maxReactions: 15, windowSeconds: 10 },
    pins: { enabled: true, maxPins: 4, windowSeconds: 60 }, // alert-only
  },
  links: {
    whitelistDomains: [], // domains exempt from all link checks (except invites)
    invites: { enabled: true, action: 'delete', allowOwnGuild: true },
    minecraft: { enabled: false, action: 'delete', allowedIps: [] },
    urlflood: { enabled: true, action: 'delete', maxPerMessage: 4, maxPerWindow: 8, windowSeconds: 60 },
    repeatedlink: { enabled: true, action: 'delete', maxRepeats: 3, windowSeconds: 120 },
    shorteners: { enabled: true, action: 'delete' },
    phishing: { enabled: true, action: 'delete' },
  },
  nsfw: {
    enabled: false,
    action: 'delete',
    sensitivity: 'normal', // strict (substring) | normal (word boundary) | relaxed (raw word boundary)
    customWords: [],
    removedWords: [],
    exemptChannels: [],
    exemptRoles: [],
  },
  raid: {
    enabled: true,
    joinThreshold: 10,
    windowSeconds: 60,
    response: 'alert', // alert | lockdown | kick | lockdown-kick
    durationMinutes: 10, // how long raid mode stays active
    minAccountAgeDays: 7, // accounts younger than this get kicked in raid mode (kick responses)
  },
};

/** Bounded number read — protects checks from corrupt/hand-edited config. */
function bounded(value, fallback, min, max) {
  const n = Number(value);
  return clamp(Number.isFinite(n) ? Math.floor(n) : fallback, min, max);
}

/** Valid action read with fallback. */
function boundedAction(value, fallback = 'delete') {
  return ACTIONS.includes(value) ? value : fallback;
}

/**
 * Registry of every togglable AutoMod system. `path` locates the system's
 * config node inside the namespace; `describe` renders a one-line summary.
 */
const SYSTEMS = {
  flood: {
    label: 'Message flooding',
    emoji: '🌊',
    group: 'spam',
    path: ['spam', 'flood'],
    describe: (n) => `${n.maxMessages} msgs / ${n.windowSeconds}s → ${n.action}`,
  },
  duplicates: {
    label: 'Repeated messages',
    emoji: '🔁',
    group: 'spam',
    path: ['spam', 'duplicates'],
    describe: (n) => `${n.maxRepeats}× identical / ${n.windowSeconds}s → ${n.action}`,
  },
  mentions: {
    label: 'Mention spam',
    emoji: '📣',
    group: 'spam',
    path: ['spam', 'mentions'],
    describe: (n) => `${n.maxPerMessage}/msg · ${n.maxPerWindow}/${n.windowSeconds}s → ${n.action}`,
  },
  emoji: {
    label: 'Emoji spam',
    emoji: '😵',
    group: 'spam',
    path: ['spam', 'emoji'],
    describe: (n) => `${n.maxPerMessage} emoji/msg → ${n.action}`,
  },
  caps: {
    label: 'Caps spam',
    emoji: '🔠',
    group: 'spam',
    path: ['spam', 'caps'],
    describe: (n) => `>${n.maxPercent}% caps over ${n.minLength}+ letters → ${n.action}`,
  },
  characters: {
    label: 'Character/newline spam',
    emoji: '📏',
    group: 'spam',
    path: ['spam', 'characters'],
    describe: (n) => `${n.maxRepeated}× same char · ${n.maxNewlines} newlines → ${n.action}`,
  },
  reactions: {
    label: 'Mass reactions',
    emoji: '💥',
    group: 'spam',
    path: ['spam', 'reactions'],
    describe: (n) => `${n.maxReactions} reactions / ${n.windowSeconds}s → ${n.action}`,
  },
  pins: {
    label: 'Excessive pins',
    emoji: '📌',
    group: 'spam',
    path: ['spam', 'pins'],
    describe: (n) => `${n.maxPins} pin updates / ${n.windowSeconds}s → alert staff`,
  },
  invites: {
    label: 'Discord invites',
    emoji: '✉️',
    group: 'links',
    path: ['links', 'invites'],
    describe: (n) => `own-guild invites ${n.allowOwnGuild !== false ? 'allowed' : 'blocked too'} → ${n.action}`,
  },
  minecraft: {
    label: 'MC server ads',
    emoji: '⛏️',
    group: 'links',
    path: ['links', 'minecraft'],
    describe: (n) => `${(n.allowedIps ?? []).length} allowed IP(s) + own server → ${n.action}`,
  },
  urlflood: {
    label: 'URL flooding',
    emoji: '🔗',
    group: 'links',
    path: ['links', 'urlflood'],
    describe: (n) => `${n.maxPerMessage}/msg · ${n.maxPerWindow}/${n.windowSeconds}s → ${n.action}`,
  },
  repeatedlink: {
    label: 'Repeated links',
    emoji: '♻️',
    group: 'links',
    path: ['links', 'repeatedlink'],
    describe: (n) => `${n.maxRepeats}× same link / ${n.windowSeconds}s → ${n.action}`,
  },
  shorteners: {
    label: 'Link shorteners',
    emoji: '✂️',
    group: 'links',
    path: ['links', 'shorteners'],
    describe: (n) => `bit.ly, tinyurl, t.co, … → ${n.action}`,
  },
  phishing: {
    label: 'Phishing links',
    emoji: '🎣',
    group: 'links',
    path: ['links', 'phishing'],
    describe: (n) => `lookalike/suspicious domains (heuristic) → ${n.action}`,
  },
  nsfw: {
    label: 'NSFW text filter',
    emoji: '🔞',
    group: 'nsfw',
    path: ['nsfw'],
    describe: (n) => `${n.sensitivity} matching · +${(n.customWords ?? []).length} custom word(s) → ${n.action}`,
  },
  raid: {
    label: 'Raid detection',
    emoji: '🛡️',
    group: 'raid',
    path: ['raid'],
    describe: (n) => `${n.joinThreshold} joins / ${n.windowSeconds}s → ${n.response} (${n.durationMinutes}m)`,
  },
};

const GROUP_LABELS = {
  spam: '🌊 Anti-Spam',
  links: '🔗 Anti-Link',
  nsfw: '🔞 Anti-NSFW',
  raid: '🛡️ Raid Protection',
};

function getConfig(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

/** Resolve a system's config node inside a full config object. */
function nodeFor(cfg, systemKey) {
  const def = SYSTEMS[systemKey];
  if (!def) return null;
  return def.path.reduce((obj, key) => obj?.[key], cfg) ?? null;
}

/** Build a nested patch object for a system path, e.g. ['spam','flood'] + {enabled:true}. */
function patchFor(path, patch) {
  return path.reduceRight((acc, key) => ({ [key]: acc }), patch);
}

/** Toggle or set one system's enabled flag. Returns the new value. */
function setSystemEnabled(client, guildId, systemKey, enabled) {
  const def = SYSTEMS[systemKey];
  if (!def) return null;
  client.config.update(guildId, NAMESPACE, patchFor(def.path, { enabled: Boolean(enabled) }));
  return Boolean(enabled);
}

/** Render the /automod status overview (embed + interactive components). */
function buildStatusView(client, guild, { raidActive = false } = {}) {
  const cfg = getConfig(client, guild.id);
  const embed = client.brand
    .embed(guild)
    .setTitle('🚫 AutoMod')
    .setDescription(
      [
        `AutoMod is ${cfg.enabled ? '**enabled** ✅' : '**disabled** ❌'} in this server.`,
        raidActive ? '🚨 **Raid mode is currently ACTIVE.**' : null,
        'Toggle systems with the menu below, or fine-tune thresholds with `/automod` subcommands.',
      ]
        .filter(Boolean)
        .join('\n'),
    );

  const byGroup = new Map();
  for (const [key, def] of Object.entries(SYSTEMS)) {
    const node = nodeFor(cfg, key) ?? {};
    const line = `${node.enabled ? '🟢' : '⚫'} **${def.label}** — ${def.describe(node)}`;
    if (!byGroup.has(def.group)) byGroup.set(def.group, []);
    byGroup.get(def.group).push(line);
  }
  for (const [group, lines] of byGroup) {
    embed.addFields({ name: GROUP_LABELS[group] ?? group, value: lines.join('\n').slice(0, 1024) });
  }

  const strikes = cfg.strikes ?? {};
  embed.addFields(
    {
      name: '⚖️ Strike escalation',
      value: strikes.enabled
        ? `${strikes.threshold} violations / ${strikes.windowMinutes}m → **${strikes.action}**`
        : 'Disabled',
      inline: true,
    },
    {
      name: '⏱️ Timeout duration',
      value: formatDuration(bounded(cfg.timeoutMinutes, 10, 1, 40320) * 60000),
      inline: true,
    },
    {
      name: '📋 Whitelists',
      value:
        `${(cfg.links?.whitelistDomains ?? []).length} domain(s) · ${(cfg.whitelistChannels ?? []).length} channel(s)\n` +
        `${(cfg.whitelistRoles ?? []).length} role(s) · ${(cfg.bypassRoles ?? []).length} bypass role(s)`,
      inline: true,
    },
  );

  const masterRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('automod:master')
      .setLabel(cfg.enabled ? 'Disable AutoMod' : 'Enable AutoMod')
      .setEmoji(cfg.enabled ? '⏸️' : '▶️')
      .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
  );
  const menu = new StringSelectMenuBuilder()
    .setCustomId('automod:system')
    .setPlaceholder('Toggle a system on/off…')
    .addOptions(
      Object.entries(SYSTEMS).map(([key, def]) => {
        const node = nodeFor(cfg, key) ?? {};
        return {
          label: def.label,
          value: key,
          emoji: def.emoji,
          description: `Currently ${node.enabled ? 'ON' : 'OFF'} — select to toggle`,
        };
      }),
    );
  const menuRow = new ActionRowBuilder().addComponents(menu);

  return { embeds: [embed], components: [masterRow, menuRow] };
}

module.exports = {
  NAMESPACE,
  ACTIONS,
  ESCALATION_ACTIONS,
  SENSITIVITIES,
  RAID_RESPONSES,
  DEFAULTS,
  SYSTEMS,
  GROUP_LABELS,
  getConfig,
  nodeFor,
  patchFor,
  setSystemEnabled,
  buildStatusView,
  bounded,
  boundedAction,
};
