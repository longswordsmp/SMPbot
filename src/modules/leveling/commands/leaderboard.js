'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { safeReply, paginate, chunkArray } = require('../../../core/utils');
const engine = require('../services/engine');

const MEDALS = ['🥇', '🥈', '🥉'];
const LEADERBOARD_SIZE = 15;
const PER_PAGE = 5;

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top members by XP in this server'),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const rows = engine.topLeaderboard(client, guild.id, LEADERBOARD_SIZE);

    if (!rows.length) {
      return safeReply(interaction, {
        embeds: [
          client.brand.info(
            guild,
            'No leaderboard yet',
            'Nobody has earned any XP in this server yet. Start chatting to be the first!',
          ),
        ],
      });
    }

    const lines = rows.map((row, i) => {
      const rank = MEDALS[i] ?? `**#${i + 1}**`;
      return (
        `${rank} <@${row.userId}> — **Level ${row.level}**\n` +
        `> ${row.totalXp.toLocaleString('en-US')} XP · ${row.messages.toLocaleString('en-US')} messages`
      );
    });

    const embeds = chunkArray(lines, PER_PAGE).map((chunk) =>
      client.brand
        .embed(guild)
        .setTitle('🏆 XP Leaderboard')
        .setDescription(chunk.join('\n\n')),
    );

    return paginate(interaction, embeds);
  },
};
