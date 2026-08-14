'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const guideService = require('../services/guide');

/**
 * Public quick command — anyone can run it in any channel to grab the server
 * IPs in a compact branded embed. Rate-limited per user (cooldown handled by
 * the router). The reply is a normal (non-ephemeral) interaction reply.
 */
module.exports = {
  cooldown: 30,
  data: new SlashCommandBuilder().setName('ip').setDescription('Show the Minecraft server IP(s) to connect'),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const config = guideService.getConfig(client, guild.id);
    const embed = guideService.buildCompactEmbed(client, guild, config);

    if (!embed) {
      return interaction.reply({
        embeds: [client.brand.info(guild, 'No server IP set', 'A server admin has not set up the connection info yet. Ask them to run `/server setup`.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    embed.setFooter({ text: 'Use /server for the full join guide' });
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
