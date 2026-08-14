'use strict';

const log = require('../../core/logger');
const settings = require('./services/settings');
const raid = require('./services/raid');

/**
 * AutoMod module — anti-spam, anti-link/advertising, anti-NSFW (text), and raid
 * detection.
 *
 * A single MessageCreate pipeline (services/pipeline.js) checks exemptions
 * first (bots, staff, whitelisted channels/roles), then runs every enabled
 * check in order and applies the configured action of the first violation.
 * Strike escalation, raid mode, and all state live in SQLite; future-dated work
 * (raid-mode expiry) runs through the persistent scheduler so it survives
 * restarts. Enforcement is hierarchy-safe and degrades gracefully — missing
 * permissions or deleted channels alert/log instead of crashing.
 */
module.exports = {
  name: 'automod',
  DEFAULTS: settings.DEFAULTS,

  schema: `
CREATE TABLE IF NOT EXISTS automod_violations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  rule       TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_automod_violations_guild_user ON automod_violations (guild_id, user_id, created_at);

CREATE TABLE IF NOT EXISTS automod_raid (
  guild_id   TEXT PRIMARY KEY,
  response   TEXT NOT NULL DEFAULT 'alert',
  started_at INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  joins      INTEGER NOT NULL DEFAULT 0
);
`,

  init(client) {
    // Restart-safe raid-mode expiry. The scheduler persists the job in SQLite
    // and re-arms it on boot, so raid mode always ends even across restarts.
    client.scheduler.register(raid.RAID_END_TYPE, async (c, job) => {
      try {
        const guildId = job.guildId ?? job.data?.guildId;
        if (!guildId) return;
        c.db.run('DELETE FROM automod_raid WHERE guild_id = ?', guildId);
        const guild = c.guilds.cache.get(guildId) ?? (await c.guilds.fetch(guildId).catch(() => null));
        if (!guild) return;
        await c.logs
          .send(guild, 'security', {
            embeds: [
              c.brand.success(guild, 'Raid mode ended', 'AutoMod raid mode has expired. New accounts are no longer auto-kicked.'),
            ],
          })
          .catch(() => null);
      } catch (err) {
        log.warn('automod:raid-end job failed:', err?.message ?? err);
      }
    });

    // Cross-module service (accessed defensively by other modules).
    client.services.automod = {
      isRaidActive(guildOrId) {
        try {
          const guildId = typeof guildOrId === 'string' ? guildOrId : guildOrId?.id;
          return guildId ? raid.isRaidActive(client, guildId) : false;
        } catch {
          return false;
        }
      },
      getConfig(guildId) {
        try {
          return settings.getConfig(client, guildId);
        } catch {
          return settings.DEFAULTS;
        }
      },
    };
  },
};
