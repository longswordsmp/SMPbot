'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { relativeTime, truncate } = require('../../../core/utils');
const engine = require('../services/engine');

module.exports = {
  cooldown: 5,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Emergency lockdown: stop @everyone from sending messages server-wide')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) =>
      opt
        .setName('minutes')
        .setDescription('Auto-unlock after this many minutes (omit for manual /unlock)')
        .setMinValue(1)
        .setMaxValue(10080),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Why the server is being locked').setMaxLength(200)),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const minutes = interaction.options.getInteger('minutes') ?? 0;
    const reason = truncate(interaction.options.getString('reason') ?? 'Emergency lockdown', 200);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await engine.lockdown(client, guild, { reason, minutes, initiatorId: interaction.user.id });

    if (!result.ok) {
      return interaction.editReply({
        embeds: [
          result.already
            ? client.brand.warn(guild, 'Already locked', 'The server is already in lockdown. Use `/unlock` to lift it.')
            : client.brand.error(guild, 'Lockdown failed', result.note ?? 'The lockdown could not be applied.'),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        client.brand
          .warn(guild, 'Server locked down', `**Reason:** ${reason}`)
          .addFields({
            name: 'Auto-unlock',
            value: result.until ? `${relativeTime(result.until)} (or \`/unlock\` sooner)` : 'Manual — run `/unlock` to lift it',
            inline: false,
          }),
      ],
    });
  },
};
