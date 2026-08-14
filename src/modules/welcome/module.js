'use strict';

const { DEFAULTS } = require('./services/config');
const render = require('./services/render');

/**
 * Welcome & leave module — themed welcome messages (with an optional generated
 * banner, custom image, link buttons, and auto-roles), optional DM welcomes,
 * leave messages, and join/leave logging to the `members` log. All durable
 * state lives in the `welcome` config namespace (SQLite-backed), so it is fully
 * restart-safe with no in-memory source of truth.
 */
module.exports = {
  name: 'welcome',
  DEFAULTS,

  init(client) {
    // Cross-module service: placeholder substitution for welcome-style text.
    // Signature per the architecture contract: renderMessage(guild, member, template).
    client.services.welcome = {
      renderMessage: (guild, member, template) => render.renderMessage(client, guild, member, template),
    };
  },
};
