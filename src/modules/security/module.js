'use strict';

const log = require('../../core/logger');
const engine = require('./services/engine');

/**
 * Security module — anti-nuke, anti-administrator-abuse, malicious-bot
 * protection, and emergency lockdown.
 *
 * Event handlers attribute every monitored action to an executor via audit
 * logs (~10s window) and feed the sliding-window detection engine. Trusted
 * users/roles, the guild owner, and the bot itself are the ONLY bypasses —
 * Administrator does not bypass monitoring. Executors are never punished
 * blindly: attribution failures alert the owner instead.
 */
module.exports = {
  name: 'security',
  DEFAULTS: engine.DEFAULTS,

  schema: `
CREATE TABLE IF NOT EXISTS security_incidents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  executor_id TEXT,
  action      TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  punished    TEXT NOT NULL DEFAULT 'none',
  details     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_incidents_guild ON security_incidents (guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_incidents_executor ON security_incidents (guild_id, executor_id);

CREATE TABLE IF NOT EXISTS security_quarantine (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role_ids   TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS security_lockdown (
  guild_id   TEXT PRIMARY KEY,
  prev_perms TEXT NOT NULL,
  reason     TEXT,
  created_at INTEGER NOT NULL
);
`,

  init(client) {
    // Restart-safe auto-unlock: /lockdown with minutes (or panic lockdowns)
    // schedules this; the scheduler persists it in SQLite and re-arms on boot.
    client.scheduler.register('security:unlock', async (c, job) => {
      try {
        const guildId = job.guildId ?? job.data?.guildId;
        if (!guildId) return;
        const guild = c.guilds.cache.get(guildId) ?? (await c.guilds.fetch(guildId).catch(() => null));
        if (!guild) return;
        const result = await engine.unlock(c, guild, { initiatorId: null });
        if (!result.ok) log.debug(`security: scheduled unlock skipped for guild ${guildId}: ${result.note}`);
      } catch (err) {
        log.warn('security:unlock job failed:', err?.message ?? err);
      }
    });

    // Cross-module service (accessed defensively by other modules).
    client.services.security = {
      isTrusted(guild, userId) {
        try {
          return engine.isTrusted(client, guild, userId);
        } catch {
          return false;
        }
      },
      async lockdown(guild, { reason, minutes } = {}) {
        return engine.lockdown(client, guild, { reason: reason ?? 'Emergency lockdown', minutes: minutes ?? 0 });
      },
      async unlock(guild) {
        return engine.unlock(client, guild, {});
      },
    };
  },
};
