'use strict';

const fs = require('node:fs');
const path = require('node:path');
const log = require('./logger');

const MODULES_DIR = path.join(__dirname, '..', 'modules');

function jsFilesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFilesIn(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Module auto-discovery. Each folder under src/modules/ may contain:
 *   module.js      → { name, schema?, services?, init(client)?, ready(client)? }
 *   commands/*.js  → { data: SlashCommandBuilder, execute(interaction), autocomplete?,
 *                      cooldown?, permissions?, ownerOnly?, guildOnly? }
 *   events/*.js    → { event, once?, execute(client, ...args) }
 *   components/*.js→ { prefix, handle(interaction, args) }  // customId "prefix:arg1:arg2"
 *
 * Nothing else needs to be registered anywhere — dropping a module folder in
 * is enough, which is what keeps SMPbot modular and maintainable.
 */
function loadModules(client) {
  if (!fs.existsSync(MODULES_DIR)) {
    log.warn('No modules directory found.');
    return;
  }
  const moduleNames = fs
    .readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const name of moduleNames) {
    const moduleDir = path.join(MODULES_DIR, name);
    try {
      loadModule(client, name, moduleDir);
    } catch (err) {
      log.error(`Failed to load module '${name}':`, err);
      throw err;
    }
  }
  log.info(
    `Loaded ${client.modules.size} module(s), ${client.commands.size} command(s), ${client.componentHandlers.size} component handler(s).`,
  );
}

function loadModule(client, name, moduleDir) {
  const moduleFile = path.join(moduleDir, 'module.js');
  let mod = { name };
  if (fs.existsSync(moduleFile)) {
    mod = require(moduleFile);
    mod.name = mod.name || name;
    if (mod.schema) client.db.registerSchema(mod.schema);
  }
  client.modules.set(mod.name || name, mod);

  for (const file of jsFilesIn(path.join(moduleDir, 'commands'))) {
    const command = require(file);
    if (!command?.data || typeof command.execute !== 'function') {
      log.warn(`Skipping invalid command file: ${file}`);
      continue;
    }
    const commandName = command.data.name;
    if (client.commands.has(commandName)) {
      throw new Error(`Duplicate command name '${commandName}' from ${file}`);
    }
    command.module = name;
    client.commands.set(commandName, command);
  }

  for (const file of jsFilesIn(path.join(moduleDir, 'events'))) {
    const handler = require(file);
    if (!handler?.event || typeof handler.execute !== 'function') {
      log.warn(`Skipping invalid event file: ${file}`);
      continue;
    }
    const listener = (...args) => {
      Promise.resolve(handler.execute(client, ...args)).catch((err) =>
        log.error(`Event handler ${name}/${path.basename(file)} failed:`, err),
      );
    };
    if (handler.once) client.once(handler.event, listener);
    else client.on(handler.event, listener);
  }

  for (const file of jsFilesIn(path.join(moduleDir, 'components'))) {
    const comp = require(file);
    if (!comp?.prefix || typeof comp.handle !== 'function') {
      log.warn(`Skipping invalid component file: ${file}`);
      continue;
    }
    if (client.componentHandlers.has(comp.prefix)) {
      throw new Error(`Duplicate component prefix '${comp.prefix}' from ${file}`);
    }
    client.componentHandlers.set(comp.prefix, comp);
  }

  if (typeof mod.init === 'function') mod.init(client);
}

/** Run every module's async ready() hook (after clientReady). */
async function readyModules(client) {
  for (const [name, mod] of client.modules) {
    if (typeof mod.ready === 'function') {
      try {
        await mod.ready(client);
      } catch (err) {
        log.error(`Module '${name}' ready() failed:`, err);
      }
    }
  }
}

module.exports = { loadModules, readyModules, MODULES_DIR };
