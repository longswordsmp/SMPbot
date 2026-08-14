'use strict';

const { SlashCommandBuilder, MessageFlags, version: djsVersion } = require('discord.js');
const { formatDuration } = require('../../../core/utils');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder().setName('botinfo').setDescription('About SMPbot — version, stats, and status'),

  async execute(interaction) {
    const client = interaction.client;
    const theme = interaction.guild ? client.themes.get(interaction.guild.id) : null;
    const embed = client.brand
      .embed(interaction.guild)
      .setTitle('🟩 SMPbot')
      .setDescription('**Built for SMPs. Built for communities. Built for security.**')
      .addFields(
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Commands', value: `${client.commands.size}`, inline: true },
        { name: 'Uptime', value: formatDuration(client.uptime ?? 0), inline: true },
        { name: 'Active theme', value: theme ? `${theme.emoji} ${theme.label}` : '—', inline: true },
        { name: 'discord.js', value: `v${djsVersion}`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
      );
    if (client.user?.displayAvatarURL) embed.setThumbnail(client.user.displayAvatarURL({ size: 256 }));
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
