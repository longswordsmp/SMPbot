'use strict';

const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const log = require('../../../core/logger');
const { safeReply } = require('../../../core/utils');
const engine = require('../services/engine');
const card = require('../services/card');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your level and XP as a rank card')
    .addUserOption((opt) => opt.setName('user').setDescription('Whose rank to show (defaults to you)')),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const target = interaction.options.getUser('user') ?? interaction.user;

    if (target.bot) {
      return safeReply(interaction, {
        embeds: [client.brand.info(guild, 'No rank', 'Bots do not earn XP, so they have no rank card.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply().catch(() => null);

    const profile = engine.getProfile(client, guild.id, target.id);
    const member = await guild.members.fetch(target.id).catch(() => null);
    const displayName = member?.displayName ?? target.displayName ?? target.username;

    const theme = client.themes.get(guild.id);
    const avatarUrl = (member ?? target).displayAvatarURL
      ? (member ?? target).displayAvatarURL({ extension: 'png', size: 256 })
      : null;

    const buffer = await card.renderRankCard({
      username: displayName,
      avatarUrl,
      level: profile.level,
      rank: profile.rank,
      xpIntoLevel: profile.xp,
      xpForNext: profile.xpForNext,
      totalXp: profile.totalXp,
      primaryColor: theme.colors.primary,
      accentColor: theme.colors.accent,
      serverName: guild.name,
    });

    // Graceful fallback: if the image could not be generated, send a text card.
    if (!buffer) {
      log.debug('leveling: rank card unavailable, falling back to text for guild', guild.id);
      const embed = client.brand
        .embed(guild)
        .setTitle(`📈 Rank — ${displayName}`)
        .setDescription(
          profile.totalXp > 0
            ? `Level **${profile.level}** • Rank **${profile.rank > 0 ? `#${profile.rank}` : 'Unranked'}**`
            : `${target} has not earned any XP yet.`,
        )
        .addFields(
          { name: 'XP (this level)', value: `${profile.xp} / ${profile.xpForNext}`, inline: true },
          { name: 'Total XP', value: `${profile.totalXp}`, inline: true },
          { name: 'Messages', value: `${profile.messages}`, inline: true },
        );
      if ((member ?? target).displayAvatarURL) embed.setThumbnail((member ?? target).displayAvatarURL({ size: 128 }));
      return interaction.editReply({ embeds: [embed] }).catch(() => null);
    }

    const attachment = new AttachmentBuilder(buffer, { name: 'rank.png' });
    const embed = client.brand.embed(guild).setImage('attachment://rank.png');
    return interaction.editReply({ embeds: [embed], files: [attachment] }).catch(() => null);
  },
};
