'use strict';

const { DEFAULTS } = require('./services/wizard');

/**
 * Setup module — the flagship interactive `/setup` wizard for non-technical
 * owners. It is a stateful, restart-safe wizard: ALL state lives in the `setup`
 * config namespace (`{ completed, template, steps }`) plus whatever is encoded
 * in component customIds. There are NO in-memory session objects, so the wizard
 * survives a restart mid-flight — reopening `/setup` resumes exactly where the
 * owner left off.
 *
 * The wizard never owns feature configuration itself; each step writes into the
 * owning module's config namespace (verification, tickets, automod, security,
 * welcome, leveling, moderation, minecraft, logging, backup, giveaways) or
 * delegates to that module's cross-module service. Every step degrades
 * gracefully when a feature module is not loaded.
 */
module.exports = {
  name: 'setup',
  DEFAULTS,
};
