'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const engine = require('../services/engine');

module.exports = {
  cooldown: 5,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Lift an emergency lockdown and restore @everyone permissions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await engine.unlock(client, guild, { initiatorId: interaction.user.id });

    if (!result.ok) {
      return interaction.editReply({
        embeds: [client.brand.warn(guild, 'Nothing to unlock', result.note ?? 'The server is not locked down.')],
      });
    }
    return interaction.editReply({
      embeds: [client.brand.success(guild, 'Lockdown lifted', '@everyone permissions have been restored to their pre-lockdown state.')],
    });
  },
};
