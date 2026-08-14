'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate, confirm } = require('../../../core/utils');
const mod = require('../services/mod');

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.KickMembers,
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),

  async execute(interaction) {
    const client = interaction.client;
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const guard = mod.actionGuard(client, interaction, targetUser, targetMember, {
      botPerm: PermissionFlagsBits.KickMembers,
      requireMember: true,
    });
    if (!guard.ok) return interaction.reply({ embeds: [guard.embed], flags: MessageFlags.Ephemeral });

    const prompt = client.brand
      .warn(interaction.guild, 'Confirm kick', `Kick **${targetUser.tag}** (<@${targetUser.id}>) from the server?`)
      .addFields({ name: 'Reason', value: truncate(reason, 1024) });
    const ok = await confirm(interaction, { embed: prompt, confirmLabel: 'Kick', danger: true });
    if (!ok) {
      return interaction.editReply({ embeds: [client.brand.info(interaction.guild, 'Cancelled', 'No action was taken.')], components: [] });
    }

    const row = mod.createCase(client, interaction.guild, {
      type: 'kick',
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
    });
    const dmEnabled = mod.getConfig(client, interaction.guild.id).dmOnAction;
    const dmed = dmEnabled ? await mod.dmTarget(client, interaction.guild, targetUser, row) : false;

    try {
      await targetMember.kick(truncate(`${reason} — by ${interaction.user.tag}`, 400));
    } catch {
      mod.deactivateCase(client, interaction.guild.id, row.case_id);
      return interaction.editReply({
        embeds: [client.brand.error(interaction.guild, 'Kick failed', 'I could not kick this member. Check my role position and permissions.')],
        components: [],
      });
    }

    await mod.logCase(client, interaction.guild, row, { targetUser, moderatorUser: interaction.user });
    const embed = mod
      .ackEmbed(client, interaction.guild, 'kick', 'Member kicked', `**${targetUser.tag}** was removed from the server.`)
      .addFields(
        { name: 'Case', value: `#${row.case_id}`, inline: true },
        { name: 'Notice', value: dmEnabled ? (dmed ? 'DM delivered' : 'DM could not be sent') : 'DMs disabled', inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );
    return interaction.editReply({ embeds: [embed], components: [] });
  },
};
