'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { truncate, confirm } = require('../../../core/utils');

const PURGEABLE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread]);

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageMessages,
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk-delete recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('count').setDescription('How many messages to scan/delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user').setRequired(false))
    .addStringOption((o) => o.setName('contains').setDescription('Only delete messages containing this text').setRequired(false).setMaxLength(200)),

  async execute(interaction) {
    const client = interaction.client;
    const count = interaction.options.getInteger('count');
    const user = interaction.options.getUser('user');
    const contains = (interaction.options.getString('contains') || '').toLowerCase();
    const channel = interaction.channel;

    if (!channel || !PURGEABLE.has(channel.type) || typeof channel.bulkDelete !== 'function') {
      return interaction.reply({
        embeds: [client.brand.error(interaction.guild, 'Not supported here', 'Purge can only be used in server text channels or threads.')],
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        embeds: [client.brand.error(interaction.guild, 'Missing bot permission', 'I need **Manage Messages** in this channel.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const filterDesc = [user ? `from <@${user.id}>` : null, contains ? `containing “${truncate(contains, 60)}”` : null].filter(Boolean).join(' ');
    const prompt = client.brand.warn(
      interaction.guild,
      'Confirm purge',
      `Scan the last **${count}** message(s)${filterDesc ? ` ${filterDesc}` : ''} in this channel and delete the matches? This cannot be undone.`,
    );
    const ok = await confirm(interaction, { embed: prompt, confirmLabel: 'Purge', danger: true });
    if (!ok) {
      return interaction.editReply({ embeds: [client.brand.info(interaction.guild, 'Cancelled', 'No messages were deleted.')], components: [] });
    }

    let selected;
    try {
      const fetched = await channel.messages.fetch({ limit: count });
      selected = fetched.filter((m) => {
        if (user && m.author?.id !== user.id) return false;
        if (contains && !(m.content || '').toLowerCase().includes(contains)) return false;
        return true;
      });
    } catch {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Purge failed', 'I could not read messages in this channel.')], components: [] });
    }

    if (!selected.size) {
      return interaction.editReply({ embeds: [client.brand.info(interaction.guild, 'Nothing to delete', 'No messages matched your filters in the scanned range.')], components: [] });
    }

    let deleted;
    try {
      // `true` filters out messages older than 14 days (Discord's bulk-delete limit).
      deleted = await channel.bulkDelete(selected, true);
    } catch {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Purge failed', 'I could not delete these messages. Some may be older than 14 days.')], components: [] });
    }

    const skipped = selected.size - deleted.size;
    const embed = client.brand
      .success(interaction.guild, 'Messages purged', `Deleted **${deleted.size}** message(s) in <#${channel.id}>.`)
      .addFields(
        ...(filterDesc ? [{ name: 'Filter', value: filterDesc, inline: false }] : []),
        ...(skipped > 0 ? [{ name: 'Skipped', value: `${skipped} message(s) were older than 14 days and can't be bulk-deleted.`, inline: false }] : []),
      );

    // Factual moderation log entry.
    const logRecord = client.brand
      .embed(interaction.guild, { color: 'warning' })
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setTitle('🧽 Messages purged')
      .setDescription(`**${deleted.size}** message(s) deleted in <#${channel.id}>.`)
      .addFields(
        { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
        ...(filterDesc ? [{ name: 'Filter', value: filterDesc, inline: true }] : []),
      );
    await client.logs.send(interaction.guild, 'moderation', { embeds: [logRecord] });

    return interaction.editReply({ embeds: [embed], components: [] });
  },
};
