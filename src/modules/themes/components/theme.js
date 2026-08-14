'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { THEMES } = require('../../../core/themes');
const { parseColor } = require('../../../core/utils');

module.exports = {
  prefix: 'theme',

  async handle(interaction, args) {
    const client = interaction.client;
    const [action] = args;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [client.brand.error(interaction.guild, 'Missing permissions', 'You need **Manage Server** to change the theme.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'select' && interaction.isStringSelectMenu()) {
      const name = interaction.values[0];
      client.themes.setTheme(interaction.guild.id, name);
      const def = THEMES[name];
      return interaction.update({
        embeds: [
          client.brand.success(interaction.guild, 'Theme applied', `This server now uses the **${def.emoji} ${def.label}** theme. Every SMPbot message will use it immediately.`),
        ],
        components: [],
      });
    }

    if (action === 'custom' && interaction.isButton()) {
      const modal = new ModalBuilder()
        .setCustomId('theme:custommodal')
        .setTitle('Custom SMPbot theme')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('primary').setLabel('Primary color (hex, e.g. #2ECC71)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('secondary').setLabel('Secondary color (hex)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('accent').setLabel('Accent color (hex)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7),
          ),
        );
      return interaction.showModal(modal);
    }

    if (action === 'custommodal' && interaction.isModalSubmit()) {
      const primary = parseColor(interaction.fields.getTextInputValue('primary'));
      if (primary === null) {
        return interaction.reply({
          embeds: [client.brand.error(interaction.guild, 'Invalid color', 'The primary color must be a hex value like `#2ECC71`.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      const colors = { primary };
      const secondary = parseColor(interaction.fields.getTextInputValue('secondary') || '');
      const accent = parseColor(interaction.fields.getTextInputValue('accent') || '');
      if (secondary !== null) colors.secondary = secondary;
      if (accent !== null) colors.accent = accent;
      client.themes.setCustom(interaction.guild.id, colors);
      return interaction.reply({
        embeds: [
          client.brand.success(interaction.guild, 'Custom theme applied', 'Your custom colors are now live across every SMPbot message in this server.'),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    return null;
  },
};
