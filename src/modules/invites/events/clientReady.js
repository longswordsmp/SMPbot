'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const tracker = require('../services/tracker');

/** Build the invite-use cache for every guild on boot so joins can be diffed. */
module.exports = {
  event: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      const total = client.guilds.cache.size;
      const cached = await tracker.refreshAll(client);
      log.info(`invites: cached invite uses for ${cached}/${total} guild(s).`);
    } catch (err) {
      log.warn('invites clientReady cache build failed:', err?.message ?? err);
    }
  },
};
