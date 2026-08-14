'use strict';

const { randomBytes } = require('node:crypto');
const { ChannelType, OverwriteType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const log = require('../../../core/logger');
const { truncate, clamp } = require('../../../core/utils');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAMESPACE = 'backup';
const JOB_TYPE = 'backup:auto';
const SNAPSHOT_VERSION = 1;

const DEFAULTS = { auto: { enabled: false, intervalHours: 24, keep: 10 } };

const MIN_INTERVAL_HOURS = 6;
const MAX_INTERVAL_HOURS = 168;
const MIN_KEEP = 1;
const MAX_KEEP = 25;
const HARD_CAP = 25; // absolute maximum backups per guild (manual included)

// Defensive ceiling so a pathological guild can never build a runaway payload.
const MAX_STRUCTURE = 1000;

// Channel types SMPbot snapshots (threads and non-guild types are skipped).
const BACKUP_CHANNEL_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

const TEXT_LIKE = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
]);

const VOICE_LIKE = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Snapshot construction
// ---------------------------------------------------------------------------

function genId() {
  return `bk_${randomBytes(4).toString('hex')}`;
}

function bitStr(bitfieldHolder) {
  try {
    return (bitfieldHolder?.bitfield ?? 0n).toString();
  } catch {
    return '0';
  }
}

/** Build the roles portion of a snapshot (skips @everyone and managed/bot roles). */
function snapshotRoles(guild) {
  const out = [];
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue; // @everyone — cannot be recreated
    if (role.managed) continue; // bot / integration / booster roles
    out.push({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: Boolean(role.hoist),
      position: role.rawPosition ?? role.position ?? 0,
      permissions: bitStr(role.permissions),
      mentionable: Boolean(role.mentionable),
    });
    if (out.length >= MAX_STRUCTURE) {
      log.warn(`backup: guild ${guild.id} exceeds ${MAX_STRUCTURE} roles — snapshot truncated.`);
      break;
    }
  }
  return out;
}

/** Serialize a channel's permission overwrites, remembering role names for later remapping. */
function snapshotOverwrites(guild, channel) {
  const out = [];
  const cache = channel.permissionOverwrites?.cache;
  if (!cache) return out;
  for (const ow of cache.values()) {
    const entry = {
      id: ow.id,
      type: ow.type,
      allow: bitStr(ow.allow),
      deny: bitStr(ow.deny),
    };
    // Remember the role's name so restores can remap by name if the id is gone.
    if (ow.type === OverwriteType.Role) {
      entry.name = ow.id === guild.id ? '@everyone' : guild.roles.cache.get(ow.id)?.name ?? null;
    }
    out.push(entry);
  }
  return out;
}

/** Build the channels portion of a snapshot (categories included). */
function snapshotChannels(guild) {
  const out = [];
  for (const channel of guild.channels.cache.values()) {
    if (!BACKUP_CHANNEL_TYPES.has(channel.type)) continue;
    const parent = channel.parentId ? guild.channels.cache.get(channel.parentId) : null;
    const snap = {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId ?? null,
      parentName: parent?.name ?? null,
      topic: channel.topic ?? null,
      position: channel.rawPosition ?? channel.position ?? 0,
      nsfw: Boolean(channel.nsfw),
      rateLimitPerUser: Number.isInteger(channel.rateLimitPerUser) ? channel.rateLimitPerUser : null,
      permissionOverwrites: snapshotOverwrites(guild, channel),
    };
    if (VOICE_LIKE.has(channel.type)) {
      snap.bitrate = Number.isInteger(channel.bitrate) ? channel.bitrate : null;
      snap.userLimit = Number.isInteger(channel.userLimit) ? channel.userLimit : null;
    }
    out.push(snap);
    if (out.length >= MAX_STRUCTURE) {
      log.warn(`backup: guild ${guild.id} exceeds ${MAX_STRUCTURE} channels — snapshot truncated.`);
      break;
    }
  }
  return out;
}

function snapshotMeta(guild) {
  return {
    name: guild.name,
    iconURL: (() => {
      try {
        return guild.iconURL({ size: 256 }) ?? null;
      } catch {
        return null;
      }
    })(),
    description: guild.description ?? null,
    systemChannelId: guild.systemChannelId ?? null,
    afkChannelId: guild.afkChannelId ?? null,
    afkTimeout: guild.afkTimeout ?? null,
    rulesChannelId: guild.rulesChannelId ?? null,
    publicUpdatesChannelId: guild.publicUpdatesChannelId ?? null,
    verificationLevel: guild.verificationLevel ?? null,
    explicitContentFilter: guild.explicitContentFilter ?? null,
    defaultMessageNotifications: guild.defaultMessageNotifications ?? null,
    preferredLocale: guild.preferredLocale ?? null,
    premiumTier: guild.premiumTier ?? null,
  };
}

/**
 * Build a full snapshot object for a guild. Everything durable — structure and
 * ALL SMPbot config namespaces — is captured so it can power anti-nuke recovery.
 */
function buildSnapshot(client, guild, { reason, auto } = {}) {
  const roles = snapshotRoles(guild);
  const channels = snapshotChannels(guild);
  let config = {};
  try {
    config = client.config.allForGuild(guild.id) ?? {};
  } catch (err) {
    log.warn(`backup: could not read config for guild ${guild.id}:`, err?.message ?? err);
  }
  return {
    version: SNAPSHOT_VERSION,
    guildId: guild.id,
    createdAt: Date.now(),
    reason: reason ? truncate(String(reason), 300) : null,
    auto: Boolean(auto),
    meta: snapshotMeta(guild),
    roles,
    channels,
    config,
  };
}

// ---------------------------------------------------------------------------
// Persistence + retention
// ---------------------------------------------------------------------------

function countCategories(snapshot) {
  return (snapshot.channels ?? []).filter((c) => c.type === ChannelType.GuildCategory).length;
}

/**
 * Retention: keep at most `keepN` backups per guild, deleting the OLDEST auto
 * backups first. Manual backups are only ever deleted once the guild exceeds
 * the hard cap of 25, oldest-first.
 */
function enforceRetention(client, guildId, keepN) {
  const keep = clamp(Number(keepN) || DEFAULTS.auto.keep, MIN_KEEP, MAX_KEEP);
  const rows = client.db.all(
    'SELECT id, auto FROM backups WHERE guild_id = ? ORDER BY created_at ASC, rowid ASC',
    guildId,
  );
  let total = rows.length;
  const deleted = new Set();

  // 1) Trim oldest AUTO backups down to the keep target.
  if (total > keep) {
    for (const row of rows) {
      if (total <= keep) break;
      if (row.auto) {
        client.db.run('DELETE FROM backups WHERE id = ?', row.id);
        deleted.add(row.id);
        total -= 1;
      }
    }
  }

  // 2) Hard cap (manual backups included) — oldest-first.
  if (total > HARD_CAP) {
    for (const row of rows) {
      if (total <= HARD_CAP) break;
      if (deleted.has(row.id)) continue;
      client.db.run('DELETE FROM backups WHERE id = ?', row.id);
      deleted.add(row.id);
      total -= 1;
    }
  }
  return deleted.size;
}

/**
 * Create and persist a backup. Returns the backup id (string).
 * `services.backup.create(guild, { reason, auto })` — thin wrappers call this.
 */
async function create(client, guild, { reason, auto } = {}) {
  if (!guild) throw new Error('backup.create requires a guild');
  const snapshot = buildSnapshot(client, guild, { reason, auto });

  let json;
  try {
    json = JSON.stringify(snapshot); // stringify exactly once
  } catch (err) {
    log.error(`backup: failed to serialize snapshot for guild ${guild.id}:`, err?.message ?? err);
    throw new Error('Failed to serialize the server snapshot.');
  }

  // Guarantee a unique id even in the astronomically unlikely event of a clash.
  let id = genId();
  for (let i = 0; i < 5 && client.db.get('SELECT 1 AS ok FROM backups WHERE id = ?', id); i++) id = genId();

  client.db.run(
    `INSERT INTO backups (id, guild_id, created_at, reason, auto, channel_count, role_count, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    guild.id,
    snapshot.createdAt,
    snapshot.reason,
    auto ? 1 : 0,
    snapshot.channels.length,
    snapshot.roles.length,
    json,
  );

  try {
    const cfg = client.config.get(guild.id, NAMESPACE, DEFAULTS);
    enforceRetention(client, guild.id, cfg.auto?.keep);
  } catch (err) {
    log.warn(`backup: retention sweep failed for guild ${guild.id}:`, err?.message ?? err);
  }

  return id;
}

function parseSnapshot(row) {
  if (!row) return null;
  try {
    const data = JSON.parse(row.data);
    // Trust cached columns for id/createdAt so callers always see them.
    data.id = row.id;
    if (!data.createdAt) data.createdAt = row.created_at;
    data.auto = Boolean(row.auto);
    return data;
  } catch (err) {
    log.warn(`backup: corrupt snapshot ${row.id}:`, err?.message ?? err);
    return null;
  }
}

function getRow(client, guildId, backupId) {
  return client.db.get('SELECT * FROM backups WHERE guild_id = ? AND id = ?', guildId, backupId);
}

/** Metadata rows for a guild, newest first. */
function listRows(client, guildId) {
  return client.db.all(
    'SELECT id, created_at, reason, auto, channel_count, role_count FROM backups WHERE guild_id = ? ORDER BY created_at DESC, rowid DESC',
    guildId,
  );
}

function list(client, guildId) {
  return listRows(client, guildId).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    reason: row.reason,
    auto: Boolean(row.auto),
    counts: { channels: row.channel_count, roles: row.role_count },
  }));
}

function getBackup(client, guildId, backupId) {
  return parseSnapshot(getRow(client, guildId, backupId));
}

function latest(client, guildId) {
  const row = client.db.get(
    'SELECT * FROM backups WHERE guild_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    guildId,
  );
  return parseSnapshot(row);
}

function deleteBackup(client, guildId, backupId) {
  const info = client.db.run('DELETE FROM backups WHERE guild_id = ? AND id = ?', guildId, backupId);
  return info.changes > 0;
}

// ---------------------------------------------------------------------------
// Restore helpers
// ---------------------------------------------------------------------------

/** Map a snapshot's overwrites onto the live guild, remapping deleted roles by name. */
function mapOverwrites(guild, snap) {
  const out = [];
  for (const ow of snap.permissionOverwrites ?? []) {
    let targetId = ow.id;
    if (ow.type === OverwriteType.Role) {
      // @everyone always resolves to the current guild id.
      if (ow.name === '@everyone' || ow.id === guild.id) {
        targetId = guild.id;
      } else if (!guild.roles.cache.has(targetId)) {
        const byName = ow.name ? guild.roles.cache.find((r) => r.name === ow.name && r.id !== guild.id) : null;
        if (!byName) continue; // unmappable — skip defensively
        targetId = byName.id;
      }
    } else if (ow.type === OverwriteType.Member) {
      // Skip overwrites for members that are no longer present to avoid API errors.
      if (!guild.members.cache.has(targetId)) continue;
    }
    let allow;
    let deny;
    try {
      allow = BigInt(ow.allow || '0');
      deny = BigInt(ow.deny || '0');
    } catch {
      continue;
    }
    out.push({ id: targetId, type: ow.type, allow, deny });
  }
  return out;
}

/** Resolve the parent category for a channel snapshot (by id, else by name). */
function resolveParent(guild, snap) {
  if (snap.type === ChannelType.GuildCategory) return null;
  if (snap.parentId) {
    const byId = guild.channels.cache.get(snap.parentId);
    if (byId && byId.type === ChannelType.GuildCategory) return byId.id;
  }
  if (snap.parentName) {
    const byName = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === snap.parentName,
    );
    if (byName) return byName.id;
  }
  return null;
}

function buildChannelPayload(guild, snap) {
  const payload = { name: truncate(String(snap.name ?? 'channel'), 100), type: snap.type, reason: 'SMPbot backup restore' };
  const parentId = resolveParent(guild, snap);
  if (parentId) payload.parent = parentId;
  if (TEXT_LIKE.has(snap.type) && snap.topic) payload.topic = truncate(String(snap.topic), 1024);
  if (TEXT_LIKE.has(snap.type) && Number.isInteger(snap.rateLimitPerUser)) {
    payload.rateLimitPerUser = clamp(snap.rateLimitPerUser, 0, 21600);
  }
  if (TEXT_LIKE.has(snap.type) && snap.nsfw) payload.nsfw = true;
  if (VOICE_LIKE.has(snap.type)) {
    if (Number.isInteger(snap.bitrate) && snap.bitrate > 0) payload.bitrate = snap.bitrate;
    if (Number.isInteger(snap.userLimit) && snap.userLimit >= 0) payload.userLimit = snap.userLimit;
  }
  const overwrites = mapOverwrites(guild, snap);
  if (overwrites.length) payload.permissionOverwrites = overwrites;
  return payload;
}

/**
 * Recreate one channel from its snapshot. Falls back to a plain text channel if
 * the original type is unavailable (e.g. announcement/forum without Community),
 * and to a no-overwrites create if the mapped overwrites are rejected.
 */
async function restoreChannel(client, guild, snap) {
  if (!snap) return null;
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('Missing Manage Channels permission');
  }
  const payload = buildChannelPayload(guild, snap);
  try {
    const created = await guild.channels.create(payload);
    await applyChannelPosition(created, snap);
    return created;
  } catch (err) {
    log.debug(`backup: channel '${payload.name}' create failed, retrying:`, err?.message ?? err);
  }
  // Retry without overwrites (a bad overwrite is the most common failure).
  if (payload.permissionOverwrites) {
    const p2 = { ...payload };
    delete p2.permissionOverwrites;
    try {
      const created = await guild.channels.create(p2);
      await applyChannelPosition(created, snap);
      return created;
    } catch (err) {
      log.debug(`backup: channel '${payload.name}' retry (no overwrites) failed:`, err?.message ?? err);
    }
  }
  // Final fallback: plain text channel keeping only name + parent.
  if (snap.type !== ChannelType.GuildCategory && snap.type !== ChannelType.GuildText) {
    const p3 = { name: payload.name, type: ChannelType.GuildText, reason: 'SMPbot backup restore (fallback)' };
    if (payload.parent) p3.parent = payload.parent;
    try {
      return await guild.channels.create(p3);
    } catch (err) {
      log.warn(`backup: could not restore channel '${payload.name}':`, err?.message ?? err);
      return null;
    }
  }
  return null;
}

async function applyChannelPosition(channel, snap) {
  if (!channel || !Number.isInteger(snap.position)) return;
  try {
    await channel.setPosition(clamp(snap.position, 0, 500));
  } catch {
    /* positioning is best-effort */
  }
}

/**
 * Recreate one role from its snapshot. Member assignments cannot be restored —
 * only the role definition (name, color, hoist, mentionable, permissions).
 */
async function restoreRole(client, guild, snap) {
  if (!snap) return null;
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('Missing Manage Roles permission');
  }
  let perms = 0n;
  try {
    perms = BigInt(snap.permissions || '0');
  } catch {
    perms = 0n;
  }
  const base = {
    name: truncate(String(snap.name ?? 'role'), 100),
    color: Number.isInteger(snap.color) ? snap.color : undefined,
    hoist: Boolean(snap.hoist),
    mentionable: Boolean(snap.mentionable),
    reason: 'SMPbot backup restore',
  };
  try {
    return await guild.roles.create({ ...base, permissions: new PermissionsBitField(perms) });
  } catch (err) {
    log.debug(`backup: role '${base.name}' create failed, retrying with reduced perms:`, err?.message ?? err);
  }
  // Retry with only the permissions the bot itself holds (Discord rejects escalation).
  try {
    const safePerms = perms & (me.permissions?.bitfield ?? 0n);
    return await guild.roles.create({ ...base, permissions: new PermissionsBitField(safePerms) });
  } catch (err) {
    log.debug(`backup: role '${base.name}' reduced-perms retry failed:`, err?.message ?? err);
  }
  // Last resort: no permissions at all.
  try {
    return await guild.roles.create({ ...base, permissions: new PermissionsBitField(0n) });
  } catch (err) {
    log.warn(`backup: could not restore role '${base.name}':`, err?.message ?? err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scoped restore (used by /backup restore)
// ---------------------------------------------------------------------------

const RESTORE_SCOPES = new Set(['config', 'missing', 'full']);

function findExistingChannel(guild, snap) {
  return guild.channels.cache.find((c) => c.type === snap.type && c.name === snap.name) ?? null;
}

async function updateExistingChannel(channel, snap) {
  let changed = false;
  try {
    if (TEXT_LIKE.has(snap.type)) {
      const targetTopic = snap.topic ?? '';
      if ((channel.topic ?? '') !== targetTopic) {
        await channel.setTopic(truncate(String(targetTopic), 1024) || null);
        changed = true;
      }
    }
    if (Number.isInteger(snap.position) && (channel.rawPosition ?? channel.position) !== snap.position) {
      await channel.setPosition(clamp(snap.position, 0, 500)).catch(() => null);
      changed = true;
    }
  } catch (err) {
    log.debug(`backup: could not update channel '${channel?.name}':`, err?.message ?? err);
  }
  return changed;
}

/**
 * Perform a scoped restore.
 *   'config' → import every SMPbot config namespace from the snapshot.
 *   'missing' → recreate roles/channels present in the backup but absent now (matched by name).
 *   'full'   → 'missing' plus syncing existing channels' topic/position to the snapshot.
 * `onProgress(result, phase)` is invoked as work proceeds (throttled by the caller).
 * Returns { config, createdRoles, createdChannels, updatedChannels, skipped }.
 */
async function performRestore(client, guild, snapshot, scope, onProgress) {
  const result = { config: false, createdRoles: 0, createdChannels: 0, updatedChannels: 0, skipped: 0 };
  const report = async (phase) => {
    if (typeof onProgress !== 'function') return;
    try {
      await onProgress(result, phase);
    } catch {
      /* progress reporting must never break a restore */
    }
  };

  if (scope === 'config') {
    try {
      client.config.importForGuild(guild.id, snapshot.config ?? {});
      result.config = true;
    } catch (err) {
      log.warn(`backup: config import failed for guild ${guild.id}:`, err?.message ?? err);
    }
    await report('config');
    return result;
  }

  const full = scope === 'full';
  let paced = 0;
  const pace = async () => {
    paced += 1;
    if (paced % 4 === 0) await sleep(1200);
  };

  // 1) Roles first, so channel overwrites can remap onto freshly-created roles.
  for (const roleSnap of snapshot.roles ?? []) {
    const exists = guild.roles.cache.find((r) => r.name === roleSnap.name && r.id !== guild.id && !r.managed);
    if (exists) {
      result.skipped += 1;
      continue;
    }
    try {
      const created = await restoreRole(client, guild, roleSnap);
      if (created) result.createdRoles += 1;
      else result.skipped += 1;
    } catch (err) {
      log.warn(`backup: role restore failed in guild ${guild.id}:`, err?.message ?? err);
      result.skipped += 1;
    }
    await report('roles');
    await pace();
  }

  // 2) Categories, then their children (parents must exist first).
  const channels = snapshot.channels ?? [];
  const categories = channels
    .filter((c) => c.type === ChannelType.GuildCategory)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const nonCategories = channels
    .filter((c) => c.type !== ChannelType.GuildCategory)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  for (const chanSnap of [...categories, ...nonCategories]) {
    const existing = findExistingChannel(guild, chanSnap);
    if (existing) {
      if (full) {
        const changed = await updateExistingChannel(existing, chanSnap);
        if (changed) result.updatedChannels += 1;
        else result.skipped += 1;
      } else {
        result.skipped += 1;
      }
      await report('channels');
      continue;
    }
    try {
      const created = await restoreChannel(client, guild, chanSnap);
      if (created) result.createdChannels += 1;
      else result.skipped += 1;
    } catch (err) {
      log.warn(`backup: channel restore failed in guild ${guild.id}:`, err?.message ?? err);
      result.skipped += 1;
    }
    await report('channels');
    await pace();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Auto-backup scheduling
// ---------------------------------------------------------------------------

function config(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

/** (Re)arm the recurring auto-backup job for a guild. */
function scheduleAuto(client, guildId, intervalHours) {
  const hours = clamp(Number(intervalHours) || DEFAULTS.auto.intervalHours, MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS);
  client.scheduler.cancelWhere(guildId, JOB_TYPE);
  return client.scheduler.schedule({
    guildId,
    type: JOB_TYPE,
    runAt: Date.now() + hours * 3600 * 1000,
    data: {},
  });
}

function cancelAuto(client, guildId) {
  client.scheduler.cancelWhere(guildId, JOB_TYPE);
}

/** Scheduler handler for 'backup:auto' — take a snapshot, then re-arm itself. */
async function handleAutoJob(client, job) {
  const guildId = job?.guildId ?? job?.data?.guildId;
  if (!guildId) return;
  const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return; // guild gone — stop the loop
  const cfg = config(client, guildId);
  if (!cfg.auto?.enabled) return; // disabled — do not re-arm
  try {
    const id = await create(client, guild, { reason: 'Scheduled automatic backup', auto: true });
    log.info(`backup: automatic backup ${id} created for guild ${guildId}.`);
    await client.logs
      .send(guild, 'server', {
        embeds: [
          client.brand
            .embed(guild, { color: 'info' })
            .setTitle('💾 Automatic backup created')
            .setDescription(`Backup \`${id}\` was taken automatically. The next one runs in **${cfg.auto.intervalHours}h**.`),
        ],
      })
      .catch(() => null);
  } catch (err) {
    log.error(`backup: automatic backup failed for guild ${guildId}:`, err?.message ?? err);
  }
  // Re-arm using the latest interval (config may have changed).
  const fresh = config(client, guildId);
  if (fresh.auto?.enabled) scheduleAuto(client, guildId, fresh.auto.intervalHours);
}

module.exports = {
  NAMESPACE,
  JOB_TYPE,
  DEFAULTS,
  MIN_INTERVAL_HOURS,
  MAX_INTERVAL_HOURS,
  MIN_KEEP,
  MAX_KEEP,
  HARD_CAP,
  RESTORE_SCOPES,
  // core
  create,
  list,
  listRows,
  getBackup,
  getRow,
  latest,
  deleteBackup,
  restoreChannel,
  restoreRole,
  performRestore,
  // config + scheduling
  config,
  scheduleAuto,
  cancelAuto,
  handleAutoJob,
  // introspection helpers used by commands
  countCategories,
};
