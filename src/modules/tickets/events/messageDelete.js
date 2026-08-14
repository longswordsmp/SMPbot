'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');

/** If a published panel message is deleted, mark the panel unpublished so /ticketpanel list stays honest. */
module.exports = {
  event: Events.MessageDelete,

  async execute(client, message) {
    try {
      if (!message?.guildId || !message.id) return;
      const res = client.db.run(
        'UPDATE ticket_panels SET message_id = NULL WHERE guild_id = ? AND message_id = ?',
        message.guildId,
        message.id,
      );
      if (res.changes > 0) log.debug(`tickets: panel message ${message.id} was deleted; panel marked unpublished.`);
    } catch (err) {
      log.debug('tickets messageDelete handler failed:', err?.message ?? err);
    }
  },
};
