'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate, formatDuration } = require('../../../core/utils');
const mod = require('../services/mod');

module.exports = {
  cooldown: 2,
  permissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member (with configurable auto-escalation)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the warning').setRequired(true).setMaxLength(500)),

  async execute(interaction) {
    const client = interaction.client;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const guard = mod.actionGuard(client, interaction, targetUser, targetMember, { requireMember: true });
    if (!guard.ok) return interaction.editReply({ embeds: [guard.embed] });

    const row = mod.createCase(client, interaction.guild, {
      type: 'warn',
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
    });

    const dmEnabled = mod.getConfig(client, interaction.guild.id).dmOnAction;
    const dmed = dmEnabled ? await mod.dmTarget(client, interaction.guild, targetUser, row) : false;
    await mod.logCase(client, interaction.guild, row, { targetUser, moderatorUser: interaction.user });

    const count = mod.activeWarnCount(client, interaction.guild.id, targetUser.id);
    const escalation = await mod.evaluateEscalation(client, interaction.guild, targetMember, count);

    const embed = mod
      .ackEmbed(client, interaction.guild, 'warn', 'Member warned', `**${targetUser.tag}** now has **${count}** active warning${count === 1 ? '' : 's'}.`)
      .addFields(
        { name: 'Case', value: `#${row.case_id}`, inline: true },
        { name: 'User', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Notice', value: dmEnabled ? (dmed ? 'DM delivered' : 'DM could not be sent') : 'DMs disabled', inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );

    if (escalation) {
      if (escalation.applied) {
        const extra = escalation.durationMs ? ` for **${formatDuration(escalation.durationMs)}**` : '';
        embed.addFields({ name: '⚡ Auto-escalation', value: `Reached ${escalation.rule.warns} warnings → **${escalation.action}**${extra} (case #${escalation.caseId}).` });
      } else {
        embed.addFields({ name: '⚡ Auto-escalation skipped', value: `Threshold ${escalation.rule.warns} reached but ${escalation.note}.` });
      }
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
