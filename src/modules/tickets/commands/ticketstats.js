'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { formatDuration } = require('../../../core/utils');
const manager = require('../services/manager');

function leaderboardLines(rows, unit) {
  if (!rows.length) return `_No ${unit} yet._`;
  return rows
    .slice(0, 10)
    .map((row, i) => `**${i + 1}.** <@${row.user_id}> — ${row.count}`)
    .join('\n');
}

module.exports = {
  cooldown: 5,
  permissions: PermissionFlagsBits.ManageMessages,
  data: new SlashCommandBuilder()
    .setName('ticketstats')
    .setDescription('Ticket statistics — totals, staff activity, and close times')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const stats = manager.stats(client, guild.id);

    const embed = client.brand
      .embed(guild)
      .setTitle('📊 Ticket statistics')
      .addFields(
        { name: 'Opened (all time)', value: `${stats.opened}`, inline: true },
        { name: 'Open right now', value: `${stats.openNow}`, inline: true },
        { name: 'Closed', value: `${stats.closed}`, inline: true },
        {
          name: 'Average close time',
          value: stats.avgCloseMs ? formatDuration(stats.avgCloseMs) : '—',
          inline: true,
        },
      );

    if (stats.byCategory.length) {
      embed.addFields({
        name: 'By category',
        value: stats.byCategory
          .map((row) => `\`${row.category}\` — ${row.count}`)
          .join('\n')
          .slice(0, 1024),
        inline: true,
      });
    }

    embed.addFields(
      { name: '🙋 Top claimers', value: leaderboardLines(stats.claims, 'claims'), inline: true },
      { name: '🔒 Top closers', value: leaderboardLines(stats.closes, 'closes'), inline: true },
    );

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
