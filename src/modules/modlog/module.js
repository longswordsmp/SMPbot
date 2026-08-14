'use strict';

const log = require('../../core/logger');
const mod = require('./services/mod');

/**
 * Modlog module — the moderation suite (cases, warnings, timeouts, kicks,
 * bans, softbans, purge, slowmode, escalation) plus the server-wide logging
 * configuration and gateway event-logging system.
 *
 * Durable state:
 *   - mod_cases          sequential per-guild moderation case ledger
 *   - config 'moderation' escalation rules + DM-on-action toggle
 *   - config 'logging'    logType -> channel mapping (shared shape with core)
 *
 * Restart-safe temp punishments run through the persistent scheduler
 * (`moderation:unban`); native Discord timeouts expire on their own so no job
 * is needed for those.
 */
module.exports = {
  name: 'modlog',
  DEFAULTS: mod.MODERATION_DEFAULTS,

  schema: `
CREATE TABLE IF NOT EXISTS mod_cases (
  guild_id     TEXT NOT NULL,
  case_id      INTEGER NOT NULL,
  type         TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason       TEXT,
  duration_ms  INTEGER,
  created_at   INTEGER NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (guild_id, case_id)
);
CREATE INDEX IF NOT EXISTS idx_mod_cases_user ON mod_cases (guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mod_cases_type ON mod_cases (guild_id, type);
`,

  init(client) {
    // Restart-safe temp-ban expiry. The scheduler persists jobs in SQLite and
    // re-arms them on boot; this handler is (re)registered on every startup.
    client.scheduler.register('moderation:unban', async (c, job) => {
      try {
        const guildId = job.guildId ?? job.data?.guildId;
        const userId = job.data?.userId;
        if (!guildId || !userId) return;
        const guild = c.guilds.cache.get(guildId) ?? (await c.guilds.fetch(guildId).catch(() => null));
        if (!guild) return;
        await mod.expireTempBan(c, guild, userId);
      } catch (err) {
        log.warn('moderation:unban job failed:', err?.message ?? err);
      }
    });

    // Additive cross-module service (accessed defensively by e.g. automod).
    client.services.moderation = {
      warnCount(guildId, userId) {
        try {
          return mod.activeWarnCount(client, guildId, userId);
        } catch {
          return 0;
        }
      },
      async addWarn(guild, { userId, moderatorId, reason } = {}) {
        try {
          return await mod.systemWarn(client, guild, { userId, moderatorId, reason });
        } catch (err) {
          log.warn('services.moderation.addWarn failed:', err?.message ?? err);
          return null;
        }
      },
    };
  },
};
