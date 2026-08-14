'use strict';

const { Events } = require('discord.js');
const engine = require('../services/engine');

/**
 * Malicious-bot protection: every bot join is attributed to whoever added it
 * via the audit log. Non-whitelisted bots are alerted on by default; staff can
 * opt into automatic kick/ban (and quarantining the adder) via /security bots.
 */
module.exports = {
  event: Events.GuildMemberAdd,

  async execute(client, member) {
    if (!member?.guild || !member.user?.bot) return;
    if (member.id === client.user?.id) return;
    await engine.handleBotAdd(client, member);
  },
};
