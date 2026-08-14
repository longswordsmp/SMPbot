'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const tracker = require('../services/tracker');

/** Cache invite uses for guilds the bot joins after boot. */
module.exports = {
  event: Events.GuildCreate,

  async execute(client, guild) {
    try {
      await tracker.refreshGuild(client, guild);
    } catch (err) {
      log.debug('invites guildCreate handler failed:', err?.message ?? err);
    }
  },
};
