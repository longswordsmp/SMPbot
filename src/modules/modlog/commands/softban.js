'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate, confirm } = require('../../../core/utils');
const mod = require('../services/mod');

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.BanMembers,
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban then immediately unban a member to purge their recent messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to softban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
    .addIntegerOption((o) =>
      o.setName('delete_days').setDescription('Days of messages to purge (0-7, default 1)').setRequired(false).setMinValue(0).setMaxValue(7),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 1;
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const guard = mod.actionGuard(client, interaction, targetUser, targetMember, {
      botPerm: PermissionFlagsBits.BanMembers,
      requireMember: true,
    });
    if (!guard.ok) return interaction.reply({ embeds: [guard.embed], flags: MessageFlags.Ephemeral });

    const prompt = client.brand
      .warn(interaction.guild, 'Confirm softban', `Softban **${targetUser.tag}** (<@${targetUser.id}>)? They will be removed and their last ${deleteDays} day(s) of messages deleted, but they can rejoin.`)
      .addFields({ name: 'Reason', value: truncate(reason, 1024) });
    const ok = await confirm(interaction, { embed: prompt, confirmLabel: 'Softban', danger: true });
    if (!ok) {
      return interaction.editReply({ embeds: [client.brand.info(interaction.guild, 'Cancelled', 'No action was taken.')], components: [] });
    }

    const row = mod.createCase(client, interaction.guild, {
      type: 'softban',
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
    });
    const dmEnabled = mod.getConfig(client, interaction.guild.id).dmOnAction;
    const dmed = dmEnabled ? await mod.dmTarget(client, interaction.guild, targetUser, row) : false;

    try {
      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteDays * 86400,
        reason: truncate(`Softban: ${reason} — by ${interaction.user.tag}`, 400),
      });
      await interaction.guild.members.unban(targetUser.id, 'Softban — immediate unban');
    } catch {
      mod.deactivateCase(client, interaction.guild.id, row.case_id);
      return interaction.editReply({
        embeds: [client.brand.error(interaction.guild, 'Softban failed', 'I could not complete the softban. Check my role position and permissions.')],
        components: [],
      });
    }

    await mod.logCase(client, interaction.guild, row, { targetUser, moderatorUser: interaction.user });
    const embed = mod
      .ackEmbed(client, interaction.guild, 'softban', 'Member softbanned', `**${targetUser.tag}** was softbanned (removed, messages purged, ban lifted).`)
      .addFields(
        { name: 'Case', value: `#${row.case_id}`, inline: true },
        { name: 'Notice', value: dmEnabled ? (dmed ? 'DM delivered' : 'DM could not be sent') : 'DMs disabled', inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );
    return interaction.editReply({ embeds: [embed], components: [] });
  },
};
