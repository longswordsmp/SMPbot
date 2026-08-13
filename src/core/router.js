'use strict';

const { MessageFlags, PermissionsBitField } = require('discord.js');
const log = require('./logger');
const { isGuildOwner, isBotOwner } = require('./permissions');
const { safeReply, formatDuration } = require('./utils');

/**
 * Central interaction router: slash commands, autocomplete, buttons, select
 * menus, and modals all flow through here with consistent permission checks,
 * cooldowns, and branded error handling. Raw stack traces are NEVER shown to
 * users — they only ever see a themed error embed.
 */
async function handleInteraction(client, interaction) {
  try {
    if (interaction.isChatInputCommand()) return await handleCommand(client, interaction);
    if (interaction.isAutocomplete()) return await handleAutocomplete(client, interaction);
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      return await handleComponent(client, interaction);
    }
  } catch (err) {
    log.error('Interaction routing failed:', err);
    await respondWithError(client, interaction);
  }
  return null;
}

async function handleCommand(client, interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return safeReply(interaction, {
      embeds: [client.brand.error(interaction.guild, 'Unknown command', 'This command is not available.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (command.guildOnly !== false && !interaction.inGuild()) {
    return safeReply(interaction, {
      embeds: [client.brand.error(null, 'Server only', 'This command can only be used inside a server.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (command.ownerOnly && !isGuildOwner(interaction.member) && !isBotOwner(interaction.user.id)) {
    return safeReply(interaction, {
      embeds: [client.brand.error(interaction.guild, 'Owner only', 'Only the **server owner** can use this command.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (command.permissions && interaction.inGuild() && !isBotOwner(interaction.user.id)) {
    const required = new PermissionsBitField(command.permissions);
    if (!interaction.memberPermissions?.has(required)) {
      return safeReply(interaction, {
        embeds: [
          client.brand.error(
            interaction.guild,
            'Missing permissions',
            `You need: ${required
              .toArray()
              .map((p) => `\`${p}\``)
              .join(', ')}`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  if (command.cooldown) {
    const key = `cmd:${interaction.commandName}:${interaction.guildId ?? 'dm'}:${interaction.user.id}`;
    const remaining = client.cooldowns.hit(key, command.cooldown);
    if (remaining > 0) {
      return safeReply(interaction, {
        embeds: [
          client.brand.warn(
            interaction.guild,
            'Slow down',
            `You can use this command again in **${formatDuration(remaining) || '1s'}**.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    log.error(`Command /${interaction.commandName} failed:`, err);
    await respondWithError(client, interaction);
  }
  return null;
}

async function handleAutocomplete(client, interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command || typeof command.autocomplete !== 'function') {
    return interaction.respond([]).catch(() => null);
  }
  try {
    return await command.autocomplete(interaction);
  } catch (err) {
    log.debug(`Autocomplete for /${interaction.commandName} failed:`, err?.message ?? err);
    return interaction.respond([]).catch(() => null);
  }
}

async function handleComponent(client, interaction) {
  const [prefix, ...args] = String(interaction.customId ?? '').split(':');
  // 'core:' components (confirm dialogs, paginators) are handled by local collectors.
  if (prefix === 'core') return null;
  const handler = client.componentHandlers.get(prefix);
  if (!handler) {
    return safeReply(interaction, {
      embeds: [client.brand.warn(interaction.guild, 'Expired', 'This component is no longer active.')],
      flags: MessageFlags.Ephemeral,
    });
  }
  try {
    await handler.handle(interaction, args);
  } catch (err) {
    log.error(`Component '${interaction.customId}' failed:`, err);
    await respondWithError(client, interaction);
  }
  return null;
}

async function respondWithError(client, interaction) {
  if (!interaction || interaction.isAutocomplete?.()) return;
  await safeReply(interaction, {
    embeds: [
      client.brand.error(
        interaction.guild,
        'Something went wrong',
        'The action could not be completed. The error has been logged — please try again, and contact staff if it keeps happening.',
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleInteraction };
