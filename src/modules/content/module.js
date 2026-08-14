'use strict';

const announcements = require('./services/announcements');
const rulesService = require('./services/rules');
const guideService = require('./services/guide');

/**
 * Content module — three cohesive feature sets:
 *  • Announcements & publishing (scheduled, restart-safe, webhook-first).
 *  • The rules system (starter packs, editable sections, clean republish).
 *  • The Minecraft server connection system (IPs + a premium join guide).
 *
 * All durable state lives in SQLite: scheduled/draft announcements in the
 * `announcements` table, rules in the `rules` config namespace, and server
 * connection details in the `minecraft` config namespace.
 */
module.exports = {
  name: 'content',

  // Exposed so /setup and templates can reference the namespaces this module owns.
  DEFAULTS: {
    announce: announcements.DEFAULTS,
    rules: rulesService.DEFAULTS,
    minecraft: guideService.DEFAULTS,
  },

  schema: `
CREATE TABLE IF NOT EXISTS announcements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  author_id  TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'draft',
  run_at     INTEGER,
  job_id     INTEGER,
  message_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_announcements_guild_status ON announcements (guild_id, status);
`,

  init(client) {
    // Restart-safe scheduled announcements: the scheduler persists jobs in
    // SQLite and re-arms them on boot; this handler is registered every start.
    client.scheduler.register('announce:publish', (c, job) => announcements.handlePublishJob(c, job));

    // Cross-module services (accessed defensively by other modules).
    client.services.rules = {
      publish: (guild, channel) => rulesService.publish(client, guild, channel),
      ensureDefaults: (guild) => rulesService.ensureDefaults(client, guild.id),
    };
    client.services.serverinfo = {
      publishGuide: (guild, channel) => guideService.publishGuide(client, guild, channel),
    };
  },

  async ready(client) {
    await announcements.sweep(client);
  },
};
