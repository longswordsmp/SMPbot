'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { parseDuration, formatDuration } = require('../../../core/utils');

const MAX_SLOWMODE_SEC = 21600; // Discord's per-user rate-limit cap (6h).
const SLOWMODEABLE = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
]);

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageChannels,
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set or clear the per-user slowmode for a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) => o.setName('duration').setDescription('Slowmode per message, e.g. 10s, 5m — or "off" to clear (max 6h)').setRequired(true))
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Channel to change (defaults to here)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia),
    ),

  async execute(interaction) {
    const client = interaction.client;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const raw = interaction.options.getString('duration').trim().toLowerCase();
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    if (!channel || !SLOWMODEABLE.has(channel.type) || typeof channel.setRateLimitPerUser !== 'function') {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Unsupported channel', 'Slowmode can only be set on text, forum, media, or thread channels.')] });
    }
    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Missing bot permission', 'I need **Manage Channels** in that channel.')] });
    }

    let seconds;
    if (['off', '0', 'none', 'disable'].includes(raw)) {
      seconds = 0;
    } else {
      const ms = parseDuration(raw);
      if (!ms) {
        return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Invalid duration', 'Use a duration like `10s`, `1m`, or `off`.')] });
      }
      seconds = Math.round(ms / 1000);
      if (seconds > MAX_SLOWMODE_SEC) {
        return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Too long', 'Slowmode can be at most **6 hours**.')] });
      }
    }

    try {
      await channel.setRateLimitPerUser(seconds, `Slowmode by ${interaction.user.tag}`);
    } catch {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Failed', 'I could not change the slowmode for that channel.')] });
    }

    const desc = seconds === 0 ? `Slowmode disabled in <#${channel.id}>.` : `Slowmode in <#${channel.id}> set to **${formatDuration(seconds * 1000)}** per message.`;
    const embed = client.brand.success(interaction.guild, 'Slowmode updated', desc);

    await client.logs.send(interaction.guild, 'channels', {
      embeds: [
        client.brand
          .embed(interaction.guild, { color: 'info' })
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .setTitle('🐌 Slowmode changed')
          .setDescription(desc)
          .addFields({ name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }),
      ],
    });

    return interaction.editReply({ embeds: [embed] });
  },
};
