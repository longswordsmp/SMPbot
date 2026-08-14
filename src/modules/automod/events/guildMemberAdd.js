'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const raid = require('../services/raid');

/**
 * Raid detection: feed each member join into the guild-wide join-rate window.
 * (Bot joins are handled by the security module; raid.handleJoin ignores bots.)
 */
module.exports = {
  event: Events.GuildMemberAdd,

  async execute(client, member) {
    try {
      if (!member?.guild) return;
      if (member.id === client.user?.id) return;
      await raid.handleJoin(client, member);
    } catch (err) {
      log.error('automod: guildMemberAdd raid handler failed:', err);
    }
  },
};
