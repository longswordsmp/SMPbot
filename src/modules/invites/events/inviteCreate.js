'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const tracker = require('../services/tracker');

/** Keep the invite-use cache in sync when a new invite is created. */
module.exports = {
  event: Events.InviteCreate,

  async execute(client, invite) {
    try {
      if (!invite?.guild?.id) return;
      if (tracker.isCached(invite.guild.id)) {
        tracker.applyInviteCreate(invite);
      } else if (tracker.canTrack(invite.guild)) {
        // Guild wasn't cached yet (e.g. Manage Server granted after boot) — build the full cache now.
        await tracker.refreshGuild(client, invite.guild);
      }
    } catch (err) {
      log.debug('invites inviteCreate handler failed:', err?.message ?? err);
    }
  },
};
