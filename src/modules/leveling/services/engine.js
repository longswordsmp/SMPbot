'use strict';

const crypto = require('node:crypto');
const { PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { isSnowflake, clamp } = require('../../../core/utils');

const NAMESPACE = 'leveling';
const LOG_TYPE = 'leveling';

/** Hard ceiling so the level loop can never spin unbounded on absurd XP totals. */
const MAX_LEVEL = 1000;

/**
 * Config defaults for the `leveling` namespace (referenced by /setup + templates).
 * Every durable setting lives here; the per-user XP state lives in SQLite.
 */
const DEFAULTS = {
  enabled: true,
  cooldownSeconds: 60, // per-user XP cooldown between earning messages
  minXp: 15, // minimum XP granted per qualifying message
  maxXp: 25, // maximum XP granted per qualifying message
  dailyCap: 2000, // max XP a user can earn per UTC day (0 disables the cap)
  minMessageLength: 4, // ignore messages shorter than this after stripping emoji/whitespace
  boosterMultiplier: 1.5, // XP multiplier for server boosters (0 disables)
  roleMultipliers: {}, // roleId -> multiplier (float); stacking uses the max, never the product
  noXpChannels: [], // channel ids (or their category ids) that never earn XP
  noXpRoles: [], // role ids whose members never earn XP
  roleMode: 'stack', // 'stack' (keep all earned roles) | 'replace' (only the highest earned role)
  announce: {
    enabled: true,
    channelId: null, // null => announce in the channel the level-up happened in
  },
};

// Bounds used by both the engine and the admin commands so validation stays consistent.
const LIMITS = {
  cooldownSeconds: [0, 86400],
  perMessageXp: [0, 10000],
  dailyCap: [0, 100000000],
  minMessageLength: [0, 200],
  multiplier: [0, 100],
  maxNoXpEntries: 200,
  maxRoleMultipliers: 100,
  maxLevelRoles: 200,
  maxLevel: 5000,
};

function config(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

/**
 * XP required to advance FROM level `n` TO level `n + 1`.
 * The standard MEE6-style curve: xpForLevel(n) = 5n² + 50n + 100.
 * Cumulative XP to *be* level L is the sum of this over n = 0..L-1.
 */
function xpForLevel(n) {
  const lvl = Math.max(0, Math.floor(Number(n) || 0));
  return 5 * lvl * lvl + 50 * lvl + 100;
}

/** Cumulative XP required to reach (be at) a given level. */
function totalXpForLevel(level) {
  const target = clamp(Math.floor(Number(level) || 0), 0, MAX_LEVEL);
  let sum = 0;
  for (let n = 0; n < target; n += 1) sum += xpForLevel(n);
  return sum;
}

/**
 * Break a stored total-XP value into level + progress:
 * { level, totalXp, xpIntoLevel, xpForNext, cumulativeForLevel }.
 */
function describe(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 0;
  let cumulative = 0;
  while (level < MAX_LEVEL) {
    const step = xpForLevel(level);
    if (xp < cumulative + step) break;
    cumulative += step;
    level += 1;
  }
  return {
    level,
    totalXp: xp,
    xpIntoLevel: xp - cumulative,
    xpForNext: xpForLevel(level),
    cumulativeForLevel: cumulative,
  };
}

/** Current level for a stored total-XP value. */
function levelForXp(totalXp) {
  return describe(totalXp).level;
}

// ---------------------------------------------------------------------------
// Per-user state (SQLite)
// ---------------------------------------------------------------------------

function getUser(client, guildId, userId) {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return null;
  return (
    client.db.get('SELECT * FROM leveling_users WHERE guild_id = ? AND user_id = ?', guildId, userId) ?? null
  );
}

/** Leaderboard rank (1-based) for a user, plus the total number of ranked users. */
function getRank(client, guildId, userId) {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return { rank: 0, total: 0 };
  const row = getUser(client, guildId, userId);
  const totalRow = client.db.get('SELECT COUNT(*) AS n FROM leveling_users WHERE guild_id = ? AND xp > 0', guildId);
  const total = Number(totalRow?.n ?? 0);
  if (!row || row.xp <= 0) return { rank: 0, total };
  const higher = client.db.get(
    'SELECT COUNT(*) AS n FROM leveling_users WHERE guild_id = ? AND (xp > ? OR (xp = ? AND user_id < ?))',
    guildId,
    row.xp,
    row.xp,
    userId,
  );
  return { rank: Number(higher?.n ?? 0) + 1, total };
}

/**
 * Cross-module profile. Per the architecture contract:
 * { xp, level, totalXp, rank } — `xp` is progress into the current level,
 * `totalXp` is the all-time accumulated XP, level is 0 when unknown.
 */
function getProfile(client, guildId, userId) {
  const row = getUser(client, guildId, userId);
  const totalXp = Number(row?.xp ?? 0);
  const d = describe(totalXp);
  const { rank, total } = getRank(client, guildId, userId);
  return {
    xp: d.xpIntoLevel,
    level: d.level,
    totalXp,
    rank,
    rankTotal: total,
    xpForNext: d.xpForNext,
    messages: Number(row?.messages ?? 0),
  };
}

function getLevel(client, guildId, userId) {
  return levelForXp(getUser(client, guildId, userId)?.xp ?? 0);
}

/** Top users by total XP (descending), tie-broken by user id. */
function topLeaderboard(client, guildId, limit = 15) {
  if (!isSnowflake(guildId)) return [];
  const lim = clamp(Number.isInteger(Number(limit)) ? Number(limit) : 15, 1, 100);
  return client.db
    .all(
      'SELECT user_id, xp, messages FROM leveling_users WHERE guild_id = ? AND xp > 0 ORDER BY xp DESC, user_id ASC LIMIT ?',
      guildId,
      lim,
    )
    .map((r) => {
      const d = describe(r.xp);
      return { userId: r.user_id, totalXp: Number(r.xp), level: d.level, messages: Number(r.messages ?? 0) };
    });
}

const UPSERT_SQL = `
INSERT INTO leveling_users (guild_id, user_id, xp, daily_xp, last_daily_date, last_message_at, messages, last_hash)
VALUES (?, ?, ?, ?, ?, ?, 1, ?)
ON CONFLICT (guild_id, user_id) DO UPDATE SET
  xp = xp + excluded.xp,
  daily_xp = excluded.daily_xp,
  last_daily_date = excluded.last_daily_date,
  last_message_at = excluded.last_message_at,
  messages = messages + 1,
  last_hash = excluded.last_hash`;

/**
 * Grant a message's XP in a single UPDATE (upsert). Callers pass the already
 * computed post-reset daily total and (to avoid a redundant read) the known
 * current XP. Returns { oldXp, newXp }.
 */
function grantMessageXp(client, guildId, userId, { gain, newDaily, today, now, hash, oldXp = null }) {
  const currentXp = oldXp === null ? Number(getUser(client, guildId, userId)?.xp ?? 0) : Number(oldXp);
  client.db.run(UPSERT_SQL, guildId, userId, gain, newDaily, today, now, hash ?? null);
  return { oldXp: currentXp, newXp: currentXp + gain };
}

/** Directly set a user's total XP (never below 0). Returns the new profile. */
function setXp(client, guildId, userId, value) {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return null;
  const xp = clamp(Math.floor(Number(value) || 0), 0, Number.MAX_SAFE_INTEGER);
  client.db.run(
    `INSERT INTO leveling_users (guild_id, user_id, xp, last_message_at) VALUES (?, ?, ?, 0)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = excluded.xp`,
    guildId,
    userId,
    xp,
  );
  return getProfile(client, guildId, userId);
}

/** Add (or with a negative amount, subtract) XP. Floors at 0. Returns { oldXp, newXp, oldLevel, newLevel, profile }. */
function addXp(client, guildId, userId, amount) {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return null;
  const delta = Math.floor(Number(amount) || 0);
  if (!Number.isFinite(delta) || delta === 0) {
    const p = getProfile(client, guildId, userId);
    return { oldXp: p.totalXp, newXp: p.totalXp, oldLevel: p.level, newLevel: p.level, profile: p };
  }
  const before = getUser(client, guildId, userId);
  const oldXp = Number(before?.xp ?? 0);
  const newXp = clamp(oldXp + delta, 0, Number.MAX_SAFE_INTEGER);
  client.db.run(
    `INSERT INTO leveling_users (guild_id, user_id, xp, last_message_at) VALUES (?, ?, ?, 0)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = excluded.xp`,
    guildId,
    userId,
    newXp,
  );
  return {
    oldXp,
    newXp,
    oldLevel: levelForXp(oldXp),
    newLevel: levelForXp(newXp),
    profile: getProfile(client, guildId, userId),
  };
}

function resetUser(client, guildId, userId) {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return;
  client.db.run('DELETE FROM leveling_users WHERE guild_id = ? AND user_id = ?', guildId, userId);
}

function resetGuild(client, guildId) {
  if (!isSnowflake(guildId)) return;
  client.db.run('DELETE FROM leveling_users WHERE guild_id = ?', guildId);
}

// ---------------------------------------------------------------------------
// Level roles (SQLite: leveling_roles)
// ---------------------------------------------------------------------------

function listLevelRoles(client, guildId) {
  if (!isSnowflake(guildId)) return [];
  return client.db.all(
    'SELECT level, role_id FROM leveling_roles WHERE guild_id = ? ORDER BY level ASC',
    guildId,
  );
}

function setLevelRole(client, guildId, level, roleId) {
  if (!isSnowflake(guildId) || !isSnowflake(roleId)) return false;
  const lvl = clamp(Math.floor(Number(level) || 0), 1, LIMITS.maxLevel);
  const count = Number(
    client.db.get('SELECT COUNT(*) AS n FROM leveling_roles WHERE guild_id = ?', guildId)?.n ?? 0,
  );
  const existing = client.db.get('SELECT level FROM leveling_roles WHERE guild_id = ? AND level = ?', guildId, lvl);
  if (!existing && count >= LIMITS.maxLevelRoles) return false;
  client.db.run(
    `INSERT INTO leveling_roles (guild_id, level, role_id) VALUES (?, ?, ?)
     ON CONFLICT (guild_id, level) DO UPDATE SET role_id = excluded.role_id`,
    guildId,
    lvl,
    roleId,
  );
  return true;
}

function removeLevelRole(client, guildId, level) {
  if (!isSnowflake(guildId)) return false;
  const lvl = Math.floor(Number(level) || 0);
  const result = client.db.run('DELETE FROM leveling_roles WHERE guild_id = ? AND level = ?', guildId, lvl);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Multipliers
// ---------------------------------------------------------------------------

/** Best applicable XP multiplier for a member. Stacking takes the max, never the product. */
function multiplierFor(cfg, member) {
  let mult = 1;
  if (!member) return mult;
  const booster = Number(cfg.boosterMultiplier) || 0;
  if (booster > 0 && member.premiumSince) mult = Math.max(mult, booster);
  const roleMultipliers = cfg.roleMultipliers || {};
  for (const [roleId, raw] of Object.entries(roleMultipliers)) {
    const m = Number(raw) || 0;
    if (m > 0 && member.roles?.cache?.has(roleId)) mult = Math.max(mult, m);
  }
  return mult;
}

// ---------------------------------------------------------------------------
// Anti-farming helpers
// ---------------------------------------------------------------------------

/** UTC date string (YYYY-MM-DD) used for the daily-cap reset comparison. */
function utcDateString(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Length of a message after stripping custom + unicode emoji and whitespace. */
function meaningfulLength(content) {
  let s = String(content ?? '');
  s = s.replace(/<a?:\w+:\d+>/g, ''); // custom emoji
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, ''); // unicode emoji
  } catch {
    // Unicode property escapes unsupported — fall back to whitespace-only stripping.
  }
  s = s.replace(/[\u200d\ufe0f\u20e3]/g, ''); // ZWJ, VS16, combining keycap
  s = s.replace(/\s+/g, '');
  return s.length;
}

/** Stable short hash of normalized content, used to reject identical consecutive messages. */
function contentHash(content) {
  const norm = String(content ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

function randomInt(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

// ---------------------------------------------------------------------------
// Role reconciliation
// ---------------------------------------------------------------------------

/**
 * Reconcile a member's level roles against the configured mapping.
 * Missing roles, hierarchy limits, and missing permissions all degrade
 * gracefully (logged, never thrown). Returns { added, removed }.
 */
async function syncMemberRoles(client, guild, member, level) {
  const result = { added: [], removed: [] };
  try {
    if (!guild || !member) return result;
    const mapping = listLevelRoles(client, guild.id);
    if (!mapping.length) return result;

    const me = guild.members?.me;
    if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return result;

    const cfg = config(client, guild.id);
    const managedIds = new Set(mapping.map((m) => m.role_id));
    const earned = mapping.filter((m) => level >= Number(m.level));

    const assignable = (roleId) => {
      const role = guild.roles.cache.get(roleId);
      if (!role || role.managed || role.id === guild.id) return false;
      return me.roles.highest.comparePositionTo(role) > 0;
    };

    let toAdd = [];
    const toRemove = [];

    if (cfg.roleMode === 'replace') {
      const highest = earned.length ? earned[earned.length - 1].role_id : null;
      for (const m of mapping) {
        const has = member.roles.cache.has(m.role_id);
        if (m.role_id === highest) {
          if (!has) toAdd.push(m.role_id);
        } else if (has && managedIds.has(m.role_id)) {
          toRemove.push(m.role_id);
        }
      }
    } else {
      // stack: ensure every earned role is present; never strip earned roles.
      for (const m of earned) {
        if (!member.roles.cache.has(m.role_id)) toAdd.push(m.role_id);
      }
    }

    toAdd = [...new Set(toAdd)].filter(assignable);
    const removeList = [...new Set(toRemove)].filter(assignable);

    if (toAdd.length) {
      await member.roles.add(toAdd, 'Leveling: level role reward').catch((err) => {
        log.debug(`leveling: failed to add level roles for ${member.id}:`, err?.message ?? err);
      });
      result.added = toAdd;
    }
    if (removeList.length) {
      await member.roles.remove(removeList, 'Leveling: level role update').catch((err) => {
        log.debug(`leveling: failed to remove level roles for ${member.id}:`, err?.message ?? err);
      });
      result.removed = removeList;
    }
  } catch (err) {
    log.debug(`leveling: syncMemberRoles failed for guild ${guild?.id}:`, err?.message ?? err);
  }
  return result;
}

/**
 * Post a branded level-up announcement through the webhook pipeline, in the
 * configured announce channel or the fallback channel. Never throws.
 */
async function announceLevelUp(client, guild, fallbackChannel, user, oldLevel, newLevel) {
  try {
    if (!guild || !user) return;
    const cfg = config(client, guild.id);
    if (!cfg.announce?.enabled) return;

    let channel = fallbackChannel ?? null;
    const configuredId = cfg.announce?.channelId;
    if (configuredId) {
      channel =
        guild.channels.cache.get(configuredId) ?? (await guild.channels.fetch(configuredId).catch(() => null));
    }
    if (!channel || typeof channel.send !== 'function') return;

    const embed = client.brand
      .embed(guild, { color: 'accent' })
      .setTitle('📈 Level up!')
      .setDescription(`<@${user.id}> just reached **level ${newLevel}**! (was level ${oldLevel})`);
    if (user.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL({ size: 128 }));

    await client.hooks.send(channel, {
      content: `<@${user.id}>`,
      embeds: [embed],
      allowedMentions: { users: [user.id] },
    });
  } catch (err) {
    log.debug(`leveling: level-up announcement failed for guild ${guild?.id}:`, err?.message ?? err);
  }
}

module.exports = {
  NAMESPACE,
  LOG_TYPE,
  DEFAULTS,
  LIMITS,
  MAX_LEVEL,
  config,
  xpForLevel,
  totalXpForLevel,
  describe,
  levelForXp,
  getUser,
  getRank,
  getProfile,
  getLevel,
  topLeaderboard,
  grantMessageXp,
  setXp,
  addXp,
  resetUser,
  resetGuild,
  listLevelRoles,
  setLevelRole,
  removeLevelRole,
  multiplierFor,
  utcDateString,
  meaningfulLength,
  contentHash,
  randomInt,
  syncMemberRoles,
  announceLevelUp,
};
