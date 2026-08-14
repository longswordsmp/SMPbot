'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate } = require('../../../core/utils');
const mod = require('../services/mod');

module.exports = {
  cooldown: 2,
  permissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove an active timeout from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to release').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),

  async execute(interaction) {
    const client = interaction.client;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const guard = mod.actionGuard(client, interaction, targetUser, targetMember, {
      botPerm: PermissionFlagsBits.ModerateMembers,
      requireMember: true,
    });
    if (!guard.ok) return interaction.editReply({ embeds: [guard.embed] });

    if (!targetMember.communicationDisabledUntilTimestamp || targetMember.communicationDisabledUntilTimestamp <= Date.now()) {
      return interaction.editReply({
        embeds: [client.brand.warn(interaction.guild, 'Not timed out', `**${targetUser.tag}** is not currently timed out.`)],
      });
    }

    try {
      await targetMember.timeout(null, truncate(`${reason} — by ${interaction.user.tag}`, 400));
    } catch {
      return interaction.editReply({
        embeds: [client.brand.error(interaction.guild, 'Failed', 'I could not remove this timeout. Check my role position and permissions.')],
      });
    }

    const row = mod.createCase(client, interaction.guild, {
      type: 'untimeout',
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
    });
    const dmEnabled = mod.getConfig(client, interaction.guild.id).dmOnAction;
    if (dmEnabled) await mod.dmTarget(client, interaction.guild, targetUser, row);
    await mod.logCase(client, interaction.guild, row, { targetUser, moderatorUser: interaction.user });

    const embed = mod
      .ackEmbed(client, interaction.guild, 'untimeout', 'Timeout removed', `**${targetUser.tag}** can chat again.`)
      .addFields(
        { name: 'Case', value: `#${row.case_id}`, inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );
    return interaction.editReply({ embeds: [embed] });
  },
};
