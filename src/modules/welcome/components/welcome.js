'use strict';

const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate } = require('../../../core/utils');
const { NAMESPACE, LIMITS } = require('../services/config');

/**
 * Handles the welcome module's modal submissions:
 *   welcome:msgmodal   — welcome title + description
 *   welcome:dmmodal    — DM welcome message
 *   welcome:leavemodal — leave title + description
 *
 * These are the only interactive components the module uses; all other config
 * happens through /welcome subcommands.
 */
module.exports = {
  prefix: 'welcome',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    if (!guild) return null;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to configure the welcome system.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const [action] = args;
    if (!interaction.isModalSubmit()) return null;

    const field = (id) => String(interaction.fields.getTextInputValue(id) ?? '').trim();

    if (action === 'msgmodal') {
      const title = truncate(field('title'), LIMITS.titleMax);
      const description = truncate(field('description'), LIMITS.descriptionMax);
      if (!title || !description) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Nothing saved', 'Both the title and description are required.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      client.config.update(guild.id, NAMESPACE, { title, description });
      return interaction.reply({
        embeds: [
          client.brand.success(
            guild,
            'Welcome message updated',
            'The welcome title and description were saved. Use `/welcome test` to preview it.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'dmmodal') {
      const message = truncate(field('message'), LIMITS.dmMax);
      if (!message) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Nothing saved', 'The DM message cannot be empty.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      client.config.update(guild.id, NAMESPACE, { dm: { message } });
      return interaction.reply({
        embeds: [
          client.brand.success(
            guild,
            'DM message updated',
            'The welcome DM message was saved. Enable DMs with `/welcome dm toggle on:True` if you have not already.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'leavemodal') {
      const title = truncate(field('title'), LIMITS.titleMax);
      const description = truncate(field('description'), LIMITS.descriptionMax);
      if (!title || !description) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Nothing saved', 'Both the leave title and description are required.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      client.config.update(guild.id, NAMESPACE, { leave: { title, description } });
      return interaction.reply({
        embeds: [client.brand.success(guild, 'Leave message updated', 'The leave title and description were saved.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    return null;
  },
};
