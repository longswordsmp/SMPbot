'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const tracker = require('../services/tracker');

/** Mark the member's join record as left so their inviter's "left" count adjusts. */
module.exports = {
  event: Events.GuildMemberRemove,

  async execute(client, member) {
    try {
      const guildId = member?.guild?.id;
      if (!guildId || !member.id) return;
      tracker.markLeft(client, guildId, member.id);
    } catch (err) {
      log.warn('invites guildMemberRemove handler failed:', err?.message ?? err);
    }
  },
};
