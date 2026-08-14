'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { parseDuration, formatDuration, truncate, relativeTime } = require('../../../core/utils');
const mod = require('../services/mod');

module.exports = {
  cooldown: 2,
  permissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily mute a member using a native Discord timeout (max 28 days)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to time out').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('Duration, e.g. 10m, 2h, 1d (max 28d)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),

  async execute(interaction) {
    const client = interaction.client;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const durationMs = parseDuration(interaction.options.getString('duration'));

    if (!durationMs) {
      return interaction.editReply({
        embeds: [client.brand.error(interaction.guild, 'Invalid duration', 'Use a duration like `10m`, `2h`, or `1d`.')],
      });
    }
    if (durationMs > mod.MAX_TIMEOUT_MS) {
      return interaction.editReply({
        embeds: [client.brand.error(interaction.guild, 'Duration too long', 'Timeouts can be at most **28 days**.')],
      });
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const guard = mod.actionGuard(client, interaction, targetUser, targetMember, {
      botPerm: PermissionFlagsBits.ModerateMembers,
      requireMember: true,
    });
    if (!guard.ok) return interaction.editReply({ embeds: [guard.embed] });

    try {
      await targetMember.timeout(durationMs, truncate(`${reason} — by ${interaction.user.tag}`, 400));
    } catch {
      return interaction.editReply({
        embeds: [client.brand.error(interaction.guild, 'Timeout failed', 'I could not time out this member. Check my role position and permissions.')],
      });
    }

    const row = mod.createCase(client, interaction.guild, {
      type: 'timeout',
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
      durationMs,
    });
    const dmEnabled = mod.getConfig(client, interaction.guild.id).dmOnAction;
    const dmed = dmEnabled ? await mod.dmTarget(client, interaction.guild, targetUser, row) : false;
    await mod.logCase(client, interaction.guild, row, { targetUser, moderatorUser: interaction.user });

    const embed = mod
      .ackEmbed(client, interaction.guild, 'timeout', 'Member timed out', `**${targetUser.tag}** is muted for **${formatDuration(durationMs)}**.`)
      .addFields(
        { name: 'Case', value: `#${row.case_id}`, inline: true },
        { name: 'Expires', value: relativeTime(Date.now() + durationMs), inline: true },
        { name: 'Notice', value: dmEnabled ? (dmed ? 'DM delivered' : 'DM could not be sent') : 'DMs disabled', inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );
    return interaction.editReply({ embeds: [embed] });
  },
};
