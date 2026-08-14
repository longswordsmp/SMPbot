'use strict';

const engine = require('./services/engine');

/**
 * Server Templates module — ten complete, distinct server blueprints. Applying
 * a template creates the role ladder, categories and channels with resolved
 * permission overwrites, wires marker channels into SMPbot's other modules
 * (logging, welcome, rules, verification, tickets, minecraft), and posts
 * starter content. Everything durable lives in SQLite: the last application per
 * guild in `template_applications`, and cross-module wiring in each owning
 * module's config namespace.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS template_applications (
  guild_id     TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL,
  prefix_emoji INTEGER NOT NULL DEFAULT 0,
  roles        TEXT NOT NULL DEFAULT '{}',
  channels     TEXT NOT NULL DEFAULT '[]',
  applied_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

module.exports = {
  name: 'templates',
  schema: SCHEMA,

  init(client) {
    // Cross-module service (contract shape). Accessed defensively elsewhere.
    client.services.templates = {
      list: () => engine.list(),
      get: (id) => engine.get(id),
      apply: (guild, id, options) => engine.apply(guild, id, options),
      preview: (guild, id) => engine.preview(guild, id),
    };
  },
};
