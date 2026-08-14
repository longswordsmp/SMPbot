'use strict';

/**
 * Aggregates the ten server templates in a fixed, curated display order. Each
 * template file is required explicitly (never globbed) so shared helpers like
 * `_common.js` are never mistaken for a template.
 */

const templates = [
  require('./classic-smp'),
  require('./modern-gaming'),
  require('./clean-minimal'),
  require('./competitive-smp'),
  require('./lifesteal-smp'),
  require('./economy-smp'),
  require('./factions-smp'),
  require('./hardcore-smp'),
  require('./professional-network'),
  require('./ultimate-smp'),
];

const byId = new Map(templates.map((tpl) => [tpl.id, tpl]));

/** Lightweight catalog entries: { id, name, emoji, description }. */
function list() {
  return templates.map((tpl) => ({ id: tpl.id, name: tpl.name, emoji: tpl.emoji, description: tpl.description }));
}

/** Full template definition, or null when the id is unknown. */
function get(id) {
  return byId.get(id) ?? null;
}

/** Count of roles + categories + channels for summary/preview displays. */
function counts(tpl) {
  const categories = tpl.categories.length;
  const channels = tpl.categories.reduce((n, c) => n + c.channels.length, 0);
  return { roles: tpl.roles.length, categories, channels };
}

module.exports = { templates, byId, list, get, counts };
