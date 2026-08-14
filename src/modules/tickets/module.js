'use strict';

const log = require('../../core/logger');
const manager = require('./services/manager');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ticket_panels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  title      TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  categories TEXT NOT NULL DEFAULT '[]',
  channel_id TEXT,
  message_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_ticket_panels_guild ON ticket_panels (guild_id);

CREATE TABLE IF NOT EXISTS ticket_categories (
  guild_id         TEXT NOT NULL,
  key              TEXT NOT NULL,
  label            TEXT NOT NULL,
  emoji            TEXT,
  description      TEXT,
  parent_id        TEXT,
  staff_role_ids   TEXT NOT NULL DEFAULT '[]',
  name_pattern     TEXT NOT NULL DEFAULT '{category}-{num}',
  welcome          TEXT,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  max_open         INTEGER NOT NULL DEFAULT 1,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, key)
);

CREATE TABLE IF NOT EXISTS tickets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  channel_id   TEXT,
  opener_id    TEXT NOT NULL,
  category     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  claimer_id   TEXT,
  priority     TEXT NOT NULL DEFAULT 'normal',
  num          INTEGER NOT NULL DEFAULT 0,
  opened_at    INTEGER NOT NULL,
  closed_at    INTEGER,
  closed_by    TEXT,
  close_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_guild_status ON tickets (guild_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets (channel_id);
`;

module.exports = {
  name: 'tickets',
  schema: SCHEMA,
  DEFAULTS: manager.DEFAULTS,

  init(client) {
    // Restart-safe auto-delete of closed tickets (scheduled on close when configured).
    client.scheduler.register('tickets:delete', async (c, job) => {
      try {
        const ticketId = Number(job.data?.ticketId);
        if (!ticketId) return;
        const ticket = manager.getTicket(c, ticketId);
        if (!ticket || ticket.status !== 'closed') return; // reopened or already gone
        const guild = c.guilds.cache.get(ticket.guild_id) ?? (await c.guilds.fetch(ticket.guild_id).catch(() => null));
        if (!guild) return;
        await manager.deleteTicket(c, guild, ticket, null, 'Auto-deleted after close');
      } catch (err) {
        log.warn('tickets:delete job failed:', err?.message ?? err);
      }
    });

    // Cross-module service (accessed defensively by other modules).
    client.services.tickets = {
      getStats: (guildId) => manager.stats(client, guildId),
      countOpenForUser: (guildId, userId) => manager.countOpenForUser(client, guildId, userId),
      listCategories: (guildId) => manager.listCategories(client, guildId),
      getTicketByChannel: (guildId, channelId) => manager.getTicketByChannel(client, guildId, channelId),
      // Seed the 7 core ticket categories and publish a ready-made panel.
      seedDefaultPanel: (guild, channel) => manager.seedDefaultPanel(client, guild, channel),
    };
  },

  async ready(client) {
    // Sweep: tickets whose channels vanished while the bot was offline get marked closed.
    try {
      const rows = client.db.all("SELECT * FROM tickets WHERE status = 'open'");
      for (const row of rows) {
        const guild = client.guilds.cache.get(row.guild_id);
        if (!guild) continue;
        if (row.channel_id && guild.channels.cache.has(row.channel_id)) continue;
        const channel = row.channel_id ? await guild.channels.fetch(row.channel_id).catch(() => null) : null;
        if (channel) continue;
        client.db.run(
          "UPDATE tickets SET status = 'closed', closed_at = ?, close_reason = ? WHERE id = ?",
          Date.now(),
          'Ticket channel was deleted while the bot was offline',
          row.id,
        );
        manager.cancelScheduledDeletes(client, row.guild_id, row.id);
        log.info(`tickets: marked ticket #${manager.pad(row.num)} (${row.id}) closed — channel missing.`);
      }
    } catch (err) {
      log.warn('tickets ready sweep failed:', err?.message ?? err);
    }
  },
};
