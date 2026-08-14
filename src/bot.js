'use strict';

const { Client, Collection, GatewayIntentBits, Partials, Events, ActivityType } = require('discord.js');
const log = require('./core/logger');
const { DatabaseManager } = require('./core/database');
const { ConfigManager } = require('./core/config');
const { ThemeManager } = require('./core/themes');
const { BrandService } = require('./core/embeds');
const { WebhookService } = require('./core/webhooks');
const { GuildLogService } = require('./core/logging');
const { Scheduler } = require('./core/scheduler');
const { CooldownManager } = require('./core/cooldowns');
const { loadModules, readyModules } = require('./core/loader');
const { handleInteraction } = require('./core/router');

/**
 * Build the fully wired SMPbot client (without logging in). Everything the
 * modules need hangs off the client: db, config, themes, brand, hooks, logs,
 * scheduler, cooldowns, services.
 */
function createBot({ database } = {}) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildExpressions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User, Partials.Reaction],
    allowedMentions: { parse: ['users', 'roles'] },
  });

  // 16+ modules attach listeners to shared gateway events (messageCreate,
  // guildMemberAdd, ...); raise the cap so Node doesn't warn about it.
  client.setMaxListeners(64);

  client.commands = new Collection();
  client.componentHandlers = new Collection();
  client.modules = new Collection();
  client.services = {}; // cross-module service registry (invites, leveling, backup, ...)

  client.db = database ?? new DatabaseManager();
  client.config = new ConfigManager(client.db);
  client.themes = new ThemeManager(client);
  client.brand = new BrandService(client);
  client.hooks = new WebhookService(client);
  client.logs = new GuildLogService(client);
  client.scheduler = new Scheduler(client);
  client.cooldowns = new CooldownManager();

  loadModules(client);

  client.on(Events.InteractionCreate, (interaction) => handleInteraction(client, interaction));

  client.once(Events.ClientReady, async (readyClient) => {
    log.info(`SMPbot online as ${readyClient.user.tag} in ${readyClient.guilds.cache.size} guild(s).`);
    try {
      readyClient.user.setPresence({
        activities: [{ name: '/setup • Built for SMPs', type: ActivityType.Watching }],
        status: 'online',
      });
    } catch (err) {
      log.debug('Failed to set presence:', err?.message ?? err);
    }
    client.scheduler.start();
    await readyModules(client);
  });

  client.on(Events.Error, (err) => log.error('Discord client error:', err));
  client.on(Events.Warn, (msg) => log.warn('Discord client warning:', msg));
  client.rest.on('rateLimited', (info) =>
    log.warn(`Rate limited on ${info.method} ${info.route} — retry in ${Math.ceil(info.timeToReset / 1000)}s`),
  );

  return client;
}

module.exports = { createBot };
