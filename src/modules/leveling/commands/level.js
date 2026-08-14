'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { safeReply } = require('../../../core/utils');
const engine = require('../services/engine');

function progressBar(ratio, size = 16) {
  const filled = Math.max(0, Math.min(size, Math.round(ratio * size)));
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Show a compact summary of your level and XP')
    .addUserOption((opt) => opt.setName('user').setDescription('Whose level to show (defaults to you)')),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const target = interaction.options.getUser('user') ?? interaction.user;

    if (target.bot) {
      return safeReply(interaction, {
        embeds: [client.brand.info(guild, 'No level', 'Bots do not earn XP.')],
      });
    }

    const profile = engine.getProfile(client, guild.id, target.id);
    if (profile.totalXp <= 0) {
      return safeReply(interaction, {
        embeds: [
          client.brand.info(
            guild,
            'No XP yet',
            `${target} has not earned any XP yet. Start chatting to climb the leaderboard!`,
          ),
        ],
      });
    }

    const ratio = profile.xpForNext > 0 ? profile.xp / profile.xpForNext : 0;
    const embed = client.brand
      .embed(guild)
      .setTitle(`📊 ${target.displayName ?? target.username}`)
      .setDescription(
        [
          `**Level ${profile.level}** • Rank ${profile.rank > 0 ? `**#${profile.rank}**` : '*unranked*'}`,
          `\`${progressBar(ratio)}\` ${Math.floor(ratio * 100)}%`,
          `**${profile.xp} / ${profile.xpForNext}** XP to level ${profile.level + 1} • **${profile.totalXp}** total`,
        ].join('\n'),
      );
    if (target.displayAvatarURL) embed.setThumbnail(target.displayAvatarURL({ size: 128 }));
    return safeReply(interaction, { embeds: [embed] });
  },
};
