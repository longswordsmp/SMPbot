'use strict';

const { PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { isSnowflake, clamp } = require('../../../core/utils');

const NAMESPACE = 'invites';

/** Config defaults for the `invites` namespace (referenced by /setup + templates). */
const DEFAULTS = {
  fakeAccountAgeDays: 7, // accounts younger than this count as fake (0 disables the check)
  logJoins: true, // append join-attribution entries to the 'invites' guild log
};

const VANITY_CODE = 'vanity';
const DELETED_GRACE_MS = 60 * 1000; // how long a deleted invite stays eligible for attribution
const MAX_BONUS_PER_OP = 100000;
const MAX_LEADERBOARD = 50;

/**
 * In-memory invite-use cache, rebuilt from the Discord API on boot
 * (clientReady) and kept in sync via inviteCreate/inviteDelete/guildCreate.
 * Durable attribution state lives in SQLite (invite_joins / invite_bonus) —
 * this cache only holds the per-code use counters needed to diff a join.
 *
 * guildId -> { codes: Map<code, { uses, maxUses, inviterId }>, vanityUses: number|null }
 */
const cache = new Map();

/**
 * Invites deleted moments before the join event lands (Discord auto-deletes
 * invites that hit max uses, and the inviteDelete gateway event can arrive
 * before guildMemberAdd). guildId -> Map<code, { uses, maxUses, inviterId, deletedAt }>
 */
const recentlyDeleted = new Map();

/** Guilds we've already warned about missing Manage Server (one log per boot). */
const warnedGuilds = new Set();

function config(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

/** Invite tracking needs Manage Server to list the guild's invites. */
function canTrack(guild) {
  return guild?.members?.me?.permissions?.has?.(PermissionFlagsBits.ManageGuild) ?? false;
}

/** True once a guild's invite uses are cached (i.e. joins can be diffed). */
function isCached(guildId) {
  return cache.has(guildId);
}

function warnMissingPermission(guild) {
  if (!guild?.id || warnedGuilds.has(guild.id)) return;
  warnedGuilds.add(guild.id);
  log.warn(
    `invites: missing Manage Server in guild ${guild.name ?? guild.id} (${guild.id}) — invite attribution is disabled until it is granted.`,
  );
}

function snapshotInvite(invite) {
  return {
    uses: invite.uses ?? 0,
    maxUses: invite.maxUses ?? 0,
    inviterId: invite.inviterId ?? invite.inviter?.id ?? null,
  };
}

/** Fetch and cache every invite (and vanity uses) for a guild. Returns true on success. */
async function refreshGuild(client, guild) {
  if (!guild?.id) return false;
  if (!canTrack(guild)) {
    warnMissingPermission(guild);
    cache.delete(guild.id);
    return false;
  }
  try {
    const fetched = await guild.invites.fetch();
    const codes = new Map();
    for (const invite of fetched.values()) codes.set(invite.code, snapshotInvite(invite));
    const vanityUses = await fetchVanityUses(guild);
    cache.set(guild.id, { codes, vanityUses });
    warnedGuilds.delete(guild.id);
    return true;
  } catch (err) {
    log.warn(`invites: failed to cache invites for guild ${guild.id}:`, err?.message ?? err);
    return false;
  }
}

async function fetchVanityUses(guild) {
  if (!guild.features?.includes?.('VANITY_URL')) return null;
  try {
    const vanity = await guild.fetchVanityData();
    return typeof vanity?.uses === 'number' ? vanity.uses : null;
  } catch (err) {
    log.debug(`invites: vanity fetch failed for guild ${guild.id}:`, err?.message ?? err);
    return null;
  }
}

/** Cache every guild's invites on boot. Returns how many guilds were cached. */
async function refreshAll(client) {
  let cached = 0;
  for (const guild of client.guilds.cache.values()) {
    if (await refreshGuild(client, guild)) cached += 1;
  }
  return cached;
}

/** Keep the cache in sync when an invite is created. */
function applyInviteCreate(invite) {
  const guildId = invite?.guild?.id;
  if (!guildId || !invite.code) return;
  const entry = cache.get(guildId);
  if (!entry) return; // guild not tracked (no perms / not cached yet)
  entry.codes.set(invite.code, snapshotInvite(invite));
}

/**
 * Keep the cache in sync when an invite is deleted, parking the cached
 * counters in a short-lived grace store so a max-uses invite consumed by the
 * very join that deleted it can still be attributed.
 */
function applyInviteDelete(invite) {
  const guildId = invite?.guild?.id;
  if (!guildId || !invite.code) return;
  const entry = cache.get(guildId);
  const known = entry?.codes.get(invite.code);
  if (entry) entry.codes.delete(invite.code);
  if (!known) return;
  let graced = recentlyDeleted.get(guildId);
  if (!graced) {
    graced = new Map();
    recentlyDeleted.set(guildId, graced);
  }
  pruneRecentlyDeleted(graced);
  graced.set(invite.code, { ...known, deletedAt: Date.now() });
}

function pruneRecentlyDeleted(graced) {
  const cutoff = Date.now() - DELETED_GRACE_MS;
  for (const [code, entry] of graced) {
    if (entry.deletedAt < cutoff) graced.delete(code);
  }
}

/** Drop all in-memory state for a guild (bot removed). */
function dropGuild(guildId) {
  cache.delete(guildId);
  recentlyDeleted.delete(guildId);
  warnedGuilds.delete(guildId);
}

/**
 * Work out which invite a new member used by diffing cached vs fresh uses.
 * Always refreshes the cache to the fresh state. Returns
 * `{ code, inviterId, vanity }` — code/inviterId are null when unattributable.
 */
async function attributeJoin(client, member) {
  const unknown = { code: null, inviterId: null, vanity: false };
  const guild = member.guild;
  if (!guild?.id) return unknown;
  if (!canTrack(guild)) {
    warnMissingPermission(guild);
    return unknown;
  }

  let fetched;
  try {
    fetched = await guild.invites.fetch();
  } catch (err) {
    log.debug(`invites: invite fetch failed during join in guild ${guild.id}:`, err?.message ?? err);
    return unknown;
  }

  const fresh = new Map();
  for (const invite of fetched.values()) fresh.set(invite.code, snapshotInvite(invite));

  const entry = cache.get(guild.id);
  let used = null;

  if (entry) {
    // 1) A cached (or known-created) invite whose use count went up.
    const candidates = [];
    for (const [code, inv] of fresh) {
      const before = entry.codes.get(code);
      if (before && inv.uses > before.uses) candidates.push({ code, inviterId: inv.inviterId, delta: inv.uses - before.uses });
    }
    if (candidates.length) {
      candidates.sort((a, b) => b.delta - a.delta);
      used = { code: candidates[0].code, inviterId: candidates[0].inviterId, vanity: false };
    }

    // 2) A limited-use invite that vanished because this join consumed its last use.
    if (!used) {
      for (const [code, before] of entry.codes) {
        if (!fresh.has(code) && before.maxUses > 0 && before.uses >= before.maxUses - 1) {
          used = { code, inviterId: before.inviterId, vanity: false };
          break;
        }
      }
    }

    // 3) Same case, but the inviteDelete gateway event beat us to the cache.
    if (!used) {
      const graced = recentlyDeleted.get(guild.id);
      if (graced) {
        pruneRecentlyDeleted(graced);
        for (const [code, gone] of graced) {
          if (gone.maxUses > 0 && gone.uses >= gone.maxUses - 1) {
            used = { code, inviterId: gone.inviterId, vanity: false };
            graced.delete(code);
            break;
          }
        }
      }
    }
  }

  // 4) Vanity URL — its counter lives outside the invite list.
  let vanityUses = entry ? entry.vanityUses : null;
  if (guild.features?.includes?.('VANITY_URL')) {
    const freshVanity = await fetchVanityUses(guild);
    if (freshVanity !== null) {
      if (!used && vanityUses !== null && freshVanity > vanityUses) {
        used = { code: VANITY_CODE, inviterId: null, vanity: true };
      }
      vanityUses = freshVanity;
    }
  }

  cache.set(guild.id, { codes: fresh, vanityUses });
  return used ?? unknown;
}

/**
 * Persist a join and apply the fake heuristics:
 *  - account younger than `fakeAccountAgeDays` days
 *  - re-join already credited to the same inviter (no double credit)
 * Returns `{ fake, reason }`.
 */
function recordJoin(client, member, attribution, cfg) {
  const guildId = member.guild.id;
  let fake = 0;
  let reason = null;

  const ageDays = clamp(Number(cfg?.fakeAccountAgeDays ?? DEFAULTS.fakeAccountAgeDays) || 0, 0, 3650);
  const createdAt = member.user?.createdTimestamp;
  if (!member.user?.bot && ageDays > 0 && Number.isFinite(createdAt) && Date.now() - createdAt < ageDays * 86400000) {
    fake = 1;
    reason = `account younger than ${ageDays}d`;
  }

  if (!fake && attribution.inviterId) {
    const prior = client.db.get(
      'SELECT 1 AS ok FROM invite_joins WHERE guild_id = ? AND member_id = ? AND inviter_id = ? LIMIT 1',
      guildId,
      member.id,
      attribution.inviterId,
    );
    if (prior) {
      fake = 1;
      reason = 'rejoin already credited to this inviter';
    }
  }

  client.db.run(
    'INSERT INTO invite_joins (guild_id, member_id, inviter_id, code, joined_at, fake) VALUES (?, ?, ?, ?, ?, ?)',
    guildId,
    member.id,
    attribution.inviterId ?? null,
    attribution.code ?? null,
    Date.now(),
    fake,
  );
  return { fake: Boolean(fake), reason };
}

/** Mark the member's open join rows as left so inviter "left" counts adjust. */
function markLeft(client, guildId, memberId) {
  if (!isSnowflake(guildId) || !isSnowflake(memberId)) return;
  client.db.run(
    'UPDATE invite_joins SET left_at = ? WHERE guild_id = ? AND member_id = ? AND left_at IS NULL',
    Date.now(),
    guildId,
    memberId,
  );
}

/** Invite stats for one user. total = regular + bonus - fake - left (raw; may be negative). */
function getStats(client, guildId, userId) {
  const empty = { regular: 0, bonus: 0, fake: 0, left: 0, total: 0 };
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return empty;
  const row = client.db.get(
    `SELECT
       COALESCE(SUM(CASE WHEN fake = 0 AND left_at IS NULL THEN 1 ELSE 0 END), 0) AS regular,
       COALESCE(SUM(CASE WHEN fake = 1 THEN 1 ELSE 0 END), 0) AS fake,
       COALESCE(SUM(CASE WHEN fake = 0 AND left_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS left_count
     FROM invite_joins WHERE guild_id = ? AND inviter_id = ?`,
    guildId,
    userId,
  );
  const bonusRow = client.db.get('SELECT bonus FROM invite_bonus WHERE guild_id = ? AND user_id = ?', guildId, userId);
  const regular = Number(row?.regular ?? 0);
  const fake = Number(row?.fake ?? 0);
  const left = Number(row?.left_count ?? 0);
  const bonus = Number(bonusRow?.bonus ?? 0);
  return { regular, bonus, fake, left, total: regular + bonus - fake - left };
}

/** Grant (or with a negative amount, revoke) bonus invites. Returns the new stats, or null on bad input. */
function addBonus(client, guildId, userId, amount) {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return null;
  const value = Number(amount);
  if (!Number.isInteger(value) || value === 0 || Math.abs(value) > MAX_BONUS_PER_OP) return null;
  client.db.run(
    `INSERT INTO invite_bonus (guild_id, user_id, bonus, updated_at) VALUES (?, ?, ?, unixepoch())
     ON CONFLICT (guild_id, user_id) DO UPDATE SET bonus = bonus + excluded.bonus, updated_at = unixepoch()`,
    guildId,
    userId,
    value,
  );
  return getStats(client, guildId, userId);
}

/** Wipe one user's inviter stats (attributed joins + bonus). Their own join record stays. */
function resetUser(client, guildId, userId) {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) return;
  const wipe = client.db.transaction(() => {
    client.db.run('DELETE FROM invite_joins WHERE guild_id = ? AND inviter_id = ?', guildId, userId);
    client.db.run('DELETE FROM invite_bonus WHERE guild_id = ? AND user_id = ?', guildId, userId);
  });
  wipe();
}

/** Wipe every join record and bonus for a guild. */
function resetGuild(client, guildId) {
  if (!isSnowflake(guildId)) return;
  const wipe = client.db.transaction(() => {
    client.db.run('DELETE FROM invite_joins WHERE guild_id = ?', guildId);
    client.db.run('DELETE FROM invite_bonus WHERE guild_id = ?', guildId);
  });
  wipe();
}

/** Top inviters: [{ userId, regular, bonus, fake, left, total }] ordered by total. */
function leaderboard(client, guildId, limit = 15) {
  if (!isSnowflake(guildId)) return [];
  const lim = clamp(Number.isInteger(Number(limit)) ? Number(limit) : 15, 1, MAX_LEADERBOARD);
  const rows = client.db.all(
    `SELECT user_id,
            SUM(regular) AS regular,
            SUM(bonus) AS bonus,
            SUM(fake) AS fake,
            SUM(left_count) AS left_count
     FROM (
       SELECT inviter_id AS user_id,
              CASE WHEN fake = 0 AND left_at IS NULL THEN 1 ELSE 0 END AS regular,
              0 AS bonus,
              CASE WHEN fake = 1 THEN 1 ELSE 0 END AS fake,
              CASE WHEN fake = 0 AND left_at IS NOT NULL THEN 1 ELSE 0 END AS left_count
       FROM invite_joins WHERE guild_id = ? AND inviter_id IS NOT NULL
       UNION ALL
       SELECT user_id, 0 AS regular, bonus AS bonus, 0 AS fake, 0 AS left_count
       FROM invite_bonus WHERE guild_id = ?
     )
     GROUP BY user_id
     ORDER BY (SUM(regular) + SUM(bonus) - SUM(fake) - SUM(left_count)) DESC, user_id ASC
     LIMIT ?`,
    guildId,
    guildId,
    lim,
  );
  return rows.map((r) => {
    const regular = Number(r.regular ?? 0);
    const bonus = Number(r.bonus ?? 0);
    const fake = Number(r.fake ?? 0);
    const left = Number(r.left_count ?? 0);
    return { userId: r.user_id, regular, bonus, fake, left, total: regular + bonus - fake - left };
  });
}

/** Most recent join record for a member (who invited them). */
function latestJoin(client, guildId, memberId) {
  if (!isSnowflake(guildId) || !isSnowflake(memberId)) return null;
  return (
    client.db.get(
      'SELECT inviter_id, code, joined_at, fake, left_at FROM invite_joins WHERE guild_id = ? AND member_id = ? ORDER BY joined_at DESC LIMIT 1',
      guildId,
      memberId,
    ) ?? null
  );
}

/** Joins attributed to an inviter, newest first, plus the full count. */
function invitedMembers(client, guildId, inviterId, limit = 90) {
  if (!isSnowflake(guildId) || !isSnowflake(inviterId)) return { rows: [], count: 0 };
  const lim = clamp(Number.isInteger(Number(limit)) ? Number(limit) : 90, 1, 200);
  const rows = client.db.all(
    'SELECT member_id, code, joined_at, fake, left_at FROM invite_joins WHERE guild_id = ? AND inviter_id = ? ORDER BY joined_at DESC LIMIT ?',
    guildId,
    inviterId,
    lim,
  );
  const countRow = client.db.get(
    'SELECT COUNT(*) AS n FROM invite_joins WHERE guild_id = ? AND inviter_id = ?',
    guildId,
    inviterId,
  );
  return { rows, count: Number(countRow?.n ?? rows.length) };
}

module.exports = {
  NAMESPACE,
  DEFAULTS,
  VANITY_CODE,
  config,
  canTrack,
  isCached,
  refreshGuild,
  refreshAll,
  applyInviteCreate,
  applyInviteDelete,
  dropGuild,
  attributeJoin,
  recordJoin,
  markLeft,
  getStats,
  addBonus,
  resetUser,
  resetGuild,
  leaderboard,
  latestJoin,
  invitedMembers,
};
