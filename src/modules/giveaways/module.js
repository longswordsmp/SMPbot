'use strict';

const log = require('../../core/logger');
const manager = require('./services/manager');

/**
 * Giveaways module — advanced giveaway system with invite / level / role /
 * account-age / membership requirements, pause & resume, restart-safe endings
 * through the persistent scheduler, and webhook-first branded messages.
 */
module.exports = {
  name: 'giveaways',

  schema: `
CREATE TABLE IF NOT EXISTS giveaways (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id            TEXT NOT NULL,
  channel_id          TEXT NOT NULL,
  message_id          TEXT,
  prize               TEXT NOT NULL,
  winners             INTEGER NOT NULL DEFAULT 1,
  ends_at             INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'running',
  requirements        TEXT NOT NULL DEFAULT '{}',
  host_id             TEXT NOT NULL,
  paused_remaining_ms INTEGER,
  image_url           TEXT,
  job_id              INTEGER,
  winner_ids          TEXT NOT NULL DEFAULT '[]',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_giveaways_guild_status ON giveaways (guild_id, status);
CREATE INDEX IF NOT EXISTS idx_giveaways_message ON giveaways (message_id);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  giveaway_id INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  entered_at  INTEGER NOT NULL,
  PRIMARY KEY (giveaway_id, user_id)
);
`,

  init(client) {
    // Restart-safe giveaway endings: the scheduler persists jobs in SQLite and
    // re-arms them on boot; this handler is registered on every startup.
    client.scheduler.register('giveaway:end', (c, job) => manager.handleEndJob(c, job));

    // Read-only cross-module service (accessed defensively by other modules).
    client.services.giveaways = {
      active(guildId) {
        return client.db.all(
          `SELECT id, guild_id, channel_id, message_id, prize, winners, ends_at, status
             FROM giveaways WHERE guild_id = ? AND status IN ('running', 'paused') ORDER BY ends_at ASC`,
          guildId,
        );
      },
      entryCount(giveawayId) {
        return manager.entryCount(client, giveawayId);
      },
    };
  },

  async ready(client) {
    // Belt-and-braces sweep: every running giveaway must have a pending
    // scheduler job. Overdue orphans are ended now; future orphans (e.g. a
    // crash between insert and schedule) are re-scheduled.
    try {
      const running = client.db.all(`SELECT * FROM giveaways WHERE status = 'running'`);
      const jobsByGuild = new Map();
      for (const giveaway of running) {
        if (!jobsByGuild.has(giveaway.guild_id)) {
          jobsByGuild.set(giveaway.guild_id, client.scheduler.pending(giveaway.guild_id, 'giveaway:end'));
        }
        const jobs = jobsByGuild.get(giveaway.guild_id) ?? [];
        if (jobs.some((job) => Number(job.data?.giveawayId) === giveaway.id)) continue;
        if (giveaway.ends_at <= Date.now()) {
          log.info(`Giveaways: ending orphaned overdue giveaway #${giveaway.id} (guild ${giveaway.guild_id}).`);
          try {
            await manager.endGiveaway(client, giveaway);
          } catch (err) {
            log.error(`Giveaways: failed to end orphaned giveaway #${giveaway.id}:`, err);
          }
        } else {
          log.info(`Giveaways: re-scheduling missing end job for giveaway #${giveaway.id} (guild ${giveaway.guild_id}).`);
          manager.scheduleEnd(client, giveaway);
        }
      }
    } catch (err) {
      log.error('Giveaways ready() sweep failed:', err);
    }
  },
};
