'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  cooldown: 3,
  data: new SlashCommandBuilder().setName('ping').setDescription("Check SMPbot's latency and status"),

  async execute(interaction) {
    const client = interaction.client;
    const sent = Date.now();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const roundtrip = Date.now() - sent;
    const embed = client.brand
      .embed(interaction.guild)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Roundtrip', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'WebSocket', value: `\`${Math.max(client.ws.ping, 0)}ms\``, inline: true },
        { name: 'Uptime', value: `<t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`, inline: true },
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
