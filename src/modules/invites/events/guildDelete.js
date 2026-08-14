'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const tracker = require('../services/tracker');

/** Drop in-memory invite caches when the bot leaves a guild. DB rows stay. */
module.exports = {
  event: Events.GuildDelete,

  async execute(client, guild) {
    try {
      if (!guild?.id) return;
      tracker.dropGuild(guild.id);
    } catch (err) {
      log.debug('invites guildDelete handler failed:', err?.message ?? err);
    }
  },
};
