'use strict';

const log = require('../../core/logger');
const manager = require('./services/manager');

/**
 * Backup module — server structure & configuration snapshots that power
 * anti-nuke recovery. A snapshot captures guild meta, every non-managed role,
 * every channel/category (with permission overwrites), and ALL of SMPbot's
 * per-guild config namespaces. Snapshots live in SQLite; automatic backups run
 * on the persistent scheduler so they survive restarts.
 *
 * The security module depends on `client.services.backup` (create / list /
 * getBackup / latest / restoreChannel / restoreRole) — those shapes, including
 * `snapshot.channels[]` and `snapshot.roles[]`, are a hard contract.
 */
module.exports = {
  name: 'backup',
  DEFAULTS: manager.DEFAULTS,

  schema: `
CREATE TABLE IF NOT EXISTS backups (
  id            TEXT PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  reason        TEXT,
  auto          INTEGER NOT NULL DEFAULT 0,
  channel_count INTEGER NOT NULL DEFAULT 0,
  role_count    INTEGER NOT NULL DEFAULT 0,
  data          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backups_guild ON backups (guild_id, created_at);
`,

  init(client) {
    // Restart-safe recurring auto-backup: the scheduler persists the job in
    // SQLite and re-arms it on boot; the handler re-schedules itself on fire.
    client.scheduler.register(manager.JOB_TYPE, (c, job) => manager.handleAutoJob(c, job));

    // Cross-module service (contract shape). Accessed defensively elsewhere;
    // security calls restoreChannel/restoreRole as `fn.call(service, guild, snap)`,
    // so every method is a `this`-free closure over the client.
    client.services.backup = {
      create: (guild, opts = {}) => manager.create(client, guild, opts),
      list: (guildId) => manager.list(client, guildId),
      getBackup: (guildId, backupId) => manager.getBackup(client, guildId, backupId),
      latest: (guildId) => manager.latest(client, guildId),
      restoreChannel: (guild, channelSnapshot) => manager.restoreChannel(client, guild, channelSnapshot),
      restoreRole: (guild, roleSnapshot) => manager.restoreRole(client, guild, roleSnapshot),
    };
  },

  async ready(client) {
    // Belt-and-braces: every guild with auto-backups enabled must have a pending
    // 'backup:auto' job. Re-arm any that are missing (e.g. crashed mid-cycle).
    try {
      for (const guild of client.guilds.cache.values()) {
        let cfg;
        try {
          cfg = manager.config(client, guild.id);
        } catch {
          continue;
        }
        if (!cfg.auto?.enabled) continue;
        const pending = client.scheduler.pending(guild.id, manager.JOB_TYPE);
        if (pending.length) continue;
        log.info(`backup: re-arming auto-backup job for guild ${guild.id}.`);
        manager.scheduleAuto(client, guild.id, cfg.auto.intervalHours);
      }
    } catch (err) {
      log.error('backup: ready() auto-backup sweep failed:', err?.message ?? err);
    }
  },
};
