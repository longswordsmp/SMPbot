'use strict';

const { extractUrls, escapeRegex } = require('./links');
const { BUILTIN_WORDS } = require('./nsfw-words');
const { boundedAction, SENSITIVITIES } = require('./settings');

/**
 * Text-based NSFW filter. HONEST LIMITS: this is a wordlist matcher over
 * message text and URL host/path only — there is NO image, embed, or attachment
 * scanning, and word lists can never fully understand context. Sensitivity
 * levels trade false positives for false negatives:
 *   - strict  → substring match anywhere (catches obfuscation inside words,
 *               but also over-matches, e.g. inside unrelated words)
 *   - normal  → `\bword\b` word-boundary match (balanced default)
 *   - relaxed → whitespace-delimited whole words only (fewest false positives,
 *               misses punctuation-joined or compound forms)
 * NSFW-marked channels and configured exempt channels/roles are skipped.
 */
function effectiveWords(node) {
  const removed = new Set((node.removedWords ?? []).map((w) => String(w).toLowerCase().trim()).filter(Boolean));
  const set = new Set();
  for (const w of BUILTIN_WORDS) {
    const lw = String(w).toLowerCase().trim();
    if (lw && !removed.has(lw)) set.add(lw);
  }
  for (const w of node.customWords ?? []) {
    const lw = String(w).toLowerCase().trim();
    if (lw && !removed.has(lw)) set.add(lw);
  }
  return [...set];
}

function decodePathSafe(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Lowercased haystack: message content plus each URL's host and path. */
function buildHaystack(message) {
  let text = ` ${(message.content ?? '').toLowerCase()} `;
  for (const u of extractUrls(message.content ?? '')) {
    text += ` ${u.host.toLowerCase()} ${decodePathSafe(u.url.pathname).toLowerCase()} `;
  }
  return text;
}

function matchWord(haystack, word, sensitivity) {
  if (!word) return false;
  if (sensitivity === 'strict') return haystack.includes(word);
  const esc = escapeRegex(word);
  try {
    if (sensitivity === 'relaxed') return new RegExp(`(?:^|\\s)${esc}(?:\\s|$)`, 'i').test(haystack);
    return new RegExp(`\\b${esc}\\b`, 'i').test(haystack); // normal
  } catch {
    return haystack.includes(word);
  }
}

/**
 * Run the NSFW filter. `member` is used for role exemptions (may be null).
 * Returns a violation `{ key, rule, label, action, reason }` or null.
 */
function checkNsfw(client, cfg, message, member) {
  const node = cfg.nsfw ?? {};
  if (!node.enabled) return null;

  const channel = message.channel ?? null;
  const parent = channel?.parent ?? null;
  // NSFW-flagged channels (or NSFW parent) are exempt by design.
  if (channel?.nsfw || parent?.nsfw) return null;

  const exemptChannels = Array.isArray(node.exemptChannels) ? node.exemptChannels : [];
  if (channel && (exemptChannels.includes(channel.id) || (channel.parentId && exemptChannels.includes(channel.parentId)))) {
    return null;
  }

  const exemptRoles = Array.isArray(node.exemptRoles) ? node.exemptRoles : [];
  if (member && exemptRoles.length && member.roles.cache.some((r) => exemptRoles.includes(r.id))) return null;

  const haystack = buildHaystack(message);
  if (!haystack.trim()) return null;

  const sensitivity = SENSITIVITIES.includes(node.sensitivity) ? node.sensitivity : 'normal';
  for (const word of effectiveWords(node)) {
    if (matchWord(haystack, word, sensitivity)) {
      return {
        key: 'nsfw',
        rule: 'nsfw',
        label: 'NSFW content',
        action: boundedAction(node.action),
        reason: `matched blocked term \`${word}\` (${sensitivity} matching)`,
      };
    }
  }
  return null;
}

module.exports = { checkNsfw, effectiveWords };
