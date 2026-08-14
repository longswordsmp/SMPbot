'use strict';

const { boundedAction, bounded } = require('./settings');
const { tinyHash } = require('./links');

/**
 * Anti-spam checks. Each is individually togglable with its own thresholds and
 * action (read from the `automod.spam.<key>` config node). Every check returns
 * the first violation it finds as `{ key, rule, label, action, reason }`, or
 * null. `mass reactions` and `excessive pins` are event-driven (reactions /
 * channelPinsUpdate) and are intentionally NOT part of this per-message pass.
 *
 * Ordering matters: sliding-window counters are only advanced when their check
 * is reached, and the first violation short-circuits the rest. `flood` runs
 * first so every message is counted toward the flood window before any earlier
 * short-circuit could skip it.
 */
function mkViolation(key, node, label, reason) {
  return { key, rule: `spam.${key}`, label, action: boundedAction(node.action), reason };
}

function checkSpam(client, cfg, message) {
  const s = cfg.spam ?? {};
  const guildId = message.guild.id;
  const userId = message.author.id;
  const content = message.content ?? '';

  // 1) Message flooding — N messages / T seconds (per author).
  const flood = s.flood ?? {};
  if (flood.enabled) {
    const windowMs = bounded(flood.windowSeconds, 5, 1, 300) * 1000;
    const max = bounded(flood.maxMessages, 6, 2, 100);
    const n = client.cooldowns.count(`automod:flood:${guildId}:${userId}`, windowMs);
    if (n > max) {
      return mkViolation('flood', flood, 'Message flooding', `${n} messages in ${Math.round(windowMs / 1000)}s (limit ${max})`);
    }
  }

  // 2) Repeated identical messages.
  const dup = s.duplicates ?? {};
  if (dup.enabled) {
    const norm = content.trim().toLowerCase();
    if (norm.length >= 3) {
      const windowMs = bounded(dup.windowSeconds, 30, 2, 600) * 1000;
      const max = bounded(dup.maxRepeats, 3, 2, 20);
      const n = client.cooldowns.count(`automod:dup:${guildId}:${userId}:${tinyHash(norm)}`, windowMs);
      if (n >= max) {
        return mkViolation('duplicates', dup, 'Repeated messages', `sent the same message ${n}× in ${Math.round(windowMs / 1000)}s`);
      }
    }
  }

  // 3) Mention spam — per message and per sliding window (user + role mentions).
  const men = s.mentions ?? {};
  if (men.enabled) {
    const perMsg = (message.mentions?.users?.size ?? 0) + (message.mentions?.roles?.size ?? 0);
    const maxPerMessage = bounded(men.maxPerMessage, 6, 1, 50);
    if (perMsg > maxPerMessage) {
      return mkViolation('mentions', men, 'Mention spam', `${perMsg} mentions in one message (limit ${maxPerMessage})`);
    }
    if (perMsg > 0) {
      const windowMs = bounded(men.windowSeconds, 30, 2, 600) * 1000;
      const maxPerWindow = bounded(men.maxPerWindow, 12, 1, 200);
      let total = 0;
      for (let i = 0; i < perMsg; i++) total = client.cooldowns.count(`automod:mentions:${guildId}:${userId}`, windowMs);
      if (total > maxPerWindow) {
        return mkViolation('mentions', men, 'Mention spam', `${total} mentions in ${Math.round(windowMs / 1000)}s (limit ${maxPerWindow})`);
      }
    }
  }

  // 4) Emoji spam — unicode + custom emoji per message.
  const emo = s.emoji ?? {};
  if (emo.enabled) {
    const custom = (content.match(/<a?:\w{2,32}:\d{17,20}>/g) ?? []).length;
    let unicode = 0;
    try {
      unicode = (content.match(/\p{Extended_Pictographic}/gu) ?? []).length;
    } catch {
      unicode = 0;
    }
    const total = custom + unicode;
    const max = bounded(emo.maxPerMessage, 12, 1, 100);
    if (total > max) {
      return mkViolation('emoji', emo, 'Emoji spam', `${total} emoji in one message (limit ${max})`);
    }
  }

  // 5) Caps spam — uppercase ratio over a minimum letter count.
  const caps = s.caps ?? {};
  if (caps.enabled) {
    let letters = [];
    try {
      letters = content.match(/\p{L}/gu) ?? [];
    } catch {
      letters = content.match(/[a-zA-Z]/g) ?? [];
    }
    const minLength = bounded(caps.minLength, 15, 4, 500);
    if (letters.length >= minLength) {
      let upper = 0;
      for (const ch of letters) if (ch !== ch.toLowerCase() && ch === ch.toUpperCase()) upper++;
      const pct = Math.round((upper / letters.length) * 100);
      const maxPercent = bounded(caps.maxPercent, 75, 40, 100);
      if (pct > maxPercent) {
        return mkViolation('caps', caps, 'Caps spam', `${pct}% caps over ${letters.length} letters (limit ${maxPercent}%)`);
      }
    }
  }

  // 6) Character / newline spam — long same-character runs and newline floods.
  const chars = s.characters ?? {};
  if (chars.enabled) {
    const maxRepeated = bounded(chars.maxRepeated, 12, 3, 200);
    const maxNewlines = bounded(chars.maxNewlines, 15, 2, 200);
    const newlines = (content.match(/\n/g) ?? []).length;
    if (newlines > maxNewlines) {
      return mkViolation('characters', chars, 'Newline spam', `${newlines} newlines in one message (limit ${maxNewlines})`);
    }
    let run = 1;
    let maxRun = content.length ? 1 : 0;
    for (let i = 1; i < content.length; i++) {
      if (content[i] === content[i - 1] && !/\s/.test(content[i])) {
        run++;
        if (run > maxRun) maxRun = run;
      } else {
        run = 1;
      }
    }
    if (maxRun > maxRepeated) {
      return mkViolation('characters', chars, 'Character spam', `${maxRun} repeated characters in a row (limit ${maxRepeated})`);
    }
  }

  return null;
}

module.exports = { checkSpam };
