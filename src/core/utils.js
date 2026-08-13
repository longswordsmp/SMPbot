'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const log = require('./logger');

const DURATION_UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/** Parse "1d12h30m" / "45m" / "2 h" style durations into milliseconds. Returns null on failure. */
function parseDuration(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!cleaned) return null;
  const re = /(\d+)([smhdw])/g;
  let total = 0;
  let matchedLength = 0;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    total += Number(m[1]) * DURATION_UNITS[m[2]];
    matchedLength += m[0].length;
  }
  if (matchedLength !== cleaned.length || total <= 0) return null;
  return total;
}

/** Format milliseconds as "1d 2h 3m". */
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 1000) return '0s';
  const parts = [];
  const units = [
    ['d', 86400000],
    ['h', 3600000],
    ['m', 60000],
    ['s', 1000],
  ];
  let rest = Math.floor(ms);
  for (const [label, size] of units) {
    const v = Math.floor(rest / size);
    if (v > 0) {
      parts.push(`${v}${label}`);
      rest -= v * size;
    }
    if (parts.length >= 3) break;
  }
  return parts.join(' ') || '0s';
}

/** Deep-merge override into base without mutating either. Arrays are replaced, not merged. */
function deepMerge(base, override) {
  if (override === undefined) return structuredCloneSafe(base);
  if (base === undefined || base === null) return structuredCloneSafe(override);
  if (Array.isArray(base) || Array.isArray(override)) return structuredCloneSafe(override);
  if (typeof base !== 'object' || typeof override !== 'object') return structuredCloneSafe(override);
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(override)])) {
    out[key] = key in override ? deepMerge(base[key], override[key]) : structuredCloneSafe(base[key]);
  }
  return out;
}

function structuredCloneSafe(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function isSnowflake(value) {
  return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

/** Parse "#RRGGBB" / "RRGGBB" / "0xRRGGBB" into an integer color, or null. */
function parseColor(input) {
  if (typeof input === 'number' && Number.isInteger(input) && input >= 0 && input <= 0xffffff) return input;
  if (typeof input !== 'string') return null;
  const m = input.trim().match(/^(?:#|0x)?([0-9a-f]{6})$/i);
  return m ? parseInt(m[1], 16) : null;
}

function intToHex(color) {
  return `#${Number(color ?? 0).toString(16).padStart(6, '0').toUpperCase()}`;
}

function truncate(str, max = 1024) {
  if (typeof str !== 'string') return str;
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Discord relative timestamp for a ms-epoch value. */
function relativeTime(msEpoch) {
  return `<t:${Math.floor(msEpoch / 1000)}:R>`;
}

function absoluteTime(msEpoch, style = 'f') {
  return `<t:${Math.floor(msEpoch / 1000)}:${style}>`;
}

/**
 * Reply safely regardless of the interaction's replied/deferred state.
 * Never throws — a failed reply is logged and swallowed.
 */
async function safeReply(interaction, payload) {
  try {
    if (typeof payload === 'string') payload = { content: payload };
    if (interaction.deferred && !interaction.replied) return await interaction.editReply(payload);
    if (interaction.replied || interaction.deferred) return await interaction.followUp(payload);
    return await interaction.reply(payload);
  } catch (err) {
    log.warn('safeReply failed:', err?.message ?? err);
    return null;
  }
}

/**
 * Show a themed confirm/cancel button prompt on an interaction and resolve
 * to true/false. Used before destructive actions (restores, resets, deletes).
 */
async function confirm(interaction, { embed, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = true, timeoutMs = 60000 }) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('core:confirm:yes')
      .setLabel(confirmLabel)
      .setStyle(danger ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('core:confirm:no').setLabel(cancelLabel).setStyle(ButtonStyle.Secondary),
  );
  const payload = { embeds: embed ? [embed] : [], components: [row], flags: MessageFlags.Ephemeral };
  const message = await safeReply(interaction, { ...payload, withResponse: true });
  let target;
  try {
    target = message?.resource?.message ?? message ?? (await interaction.fetchReply());
  } catch {
    return false;
  }
  try {
    const click = await target.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('core:confirm:'),
      time: timeoutMs,
    });
    const confirmed = click.customId === 'core:confirm:yes';
    await click.deferUpdate().catch(() => null);
    await interaction.editReply({ components: [] }).catch(() => null);
    return confirmed;
  } catch {
    await interaction.editReply({ components: [] }).catch(() => null);
    return false;
  }
}

/**
 * Paginate an array of EmbedBuilders on an interaction with prev/next buttons.
 * Handles single-page arrays gracefully.
 */
async function paginate(interaction, embeds, { ephemeral = false, timeoutMs = 180000 } = {}) {
  if (!embeds.length) return;
  let page = 0;
  const buildRow = () =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('core:page:prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('core:page:label')
        .setLabel(`${page + 1} / ${embeds.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('core:page:next')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === embeds.length - 1),
    );
  const payload = {
    embeds: [embeds[0]],
    components: embeds.length > 1 ? [buildRow()] : [],
    ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
  };
  await safeReply(interaction, payload);
  if (embeds.length <= 1) return;
  let target;
  try {
    target = await interaction.fetchReply();
  } catch {
    return;
  }
  const collector = target.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('core:page:'),
    time: timeoutMs,
  });
  collector.on('collect', async (i) => {
    page = i.customId === 'core:page:next' ? Math.min(page + 1, embeds.length - 1) : Math.max(page - 1, 0);
    await i.update({ embeds: [embeds[page]], components: [buildRow()] }).catch(() => null);
  });
  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => null);
  });
}

module.exports = {
  parseDuration,
  formatDuration,
  deepMerge,
  isSnowflake,
  parseColor,
  intToHex,
  truncate,
  chunkArray,
  clamp,
  relativeTime,
  absoluteTime,
  safeReply,
  confirm,
  paginate,
};
