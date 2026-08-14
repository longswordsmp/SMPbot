'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const verify = require('../services/verify');

/**
 * On leave: drop any pending captcha state and cancel the member's scheduled
 * auto-kick job so it never fires against someone who already left. Wrapped so a
 * partial member never crashes the handler.
 */
module.exports = {
  event: Events.GuildMemberRemove,

  async execute(client, member) {
    try {
      const guild = member?.guild;
      if (!guild?.id || !member?.id) return;
      verify.clearPending(client, guild.id, member.id);
      verify.cancelKick(client, guild.id, member.id);
    } catch (err) {
      log.debug('verification guildMemberRemove handler failed:', err?.message ?? err);
    }
  },
};
