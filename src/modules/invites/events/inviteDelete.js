'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const tracker = require('../services/tracker');

/**
 * Keep the invite-use cache in sync when an invite is deleted. The cached
 * counters are parked briefly so a max-uses invite consumed by a join that
 * arrives right after this event can still be attributed.
 */
module.exports = {
  event: Events.InviteDelete,

  async execute(client, invite) {
    try {
      if (!invite?.guild?.id) return;
      tracker.applyInviteDelete(invite);
    } catch (err) {
      log.debug('invites inviteDelete handler failed:', err?.message ?? err);
    }
  },
};
