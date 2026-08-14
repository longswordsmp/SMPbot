'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const manager = require('../services/manager');

/** Keep ticket state consistent when a ticket channel (or panel channel) is deleted by hand. */
module.exports = {
  event: Events.ChannelDelete,

  async execute(client, channel) {
    try {
      const guild = channel?.guild;
      if (!guild) return;

      const row = client.db.get(
        "SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ? AND status = 'open'",
        guild.id,
        channel.id,
      );
      if (row) {
        client.db.run(
          "UPDATE tickets SET status = 'closed', closed_at = ?, close_reason = 'Ticket channel was deleted' WHERE id = ?",
          Date.now(),
          row.id,
        );
        manager.cancelScheduledDeletes(client, guild.id, row.id);
        await manager.logTicket(client, guild, {
          title: `🔒 Ticket #${manager.pad(row.num)} closed`,
          color: 'warning',
          description: 'The ticket channel was deleted, so the ticket was marked closed.',
          ticket: { ...row, channel_id: null },
          fields: [{ name: 'Channel', value: `#${channel.name ?? channel.id}`, inline: true }],
        });
      }

      // Panels published in a deleted channel need republishing.
      const res = client.db.run(
        'UPDATE ticket_panels SET channel_id = NULL, message_id = NULL WHERE guild_id = ? AND channel_id = ?',
        guild.id,
        channel.id,
      );
      if (res.changes > 0) {
        log.debug(`tickets: unpublished ${res.changes} panel(s) after channel ${channel.id} was deleted.`);
      }
    } catch (err) {
      log.warn('tickets channelDelete handler failed:', err?.message ?? err);
    }
  },
};
