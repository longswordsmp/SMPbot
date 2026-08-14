'use strict';

const { Events } = require('discord.js');
const pipeline = require('../services/pipeline');

/**
 * The AutoMod message pipeline entry point. `runMessage` is fully self-contained
 * (exemptions, ordered checks, enforcement, logging) and never throws.
 */
module.exports = {
  event: Events.MessageCreate,

  async execute(client, message) {
    await pipeline.runMessage(client, message);
  },
};
