'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate, confirm, parseDuration, formatDuration, relativeTime } = require('../../../core/utils');
const mod = require('../services/mod');

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.BanMembers,
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member (optionally temporarily and with message deletion)')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to ban (accepts an ID for users not in the server)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500))
    .addIntegerOption((o) =>
      o.setName('delete_days').setDescription('Delete this many days of their messages (0-7)').setRequired(false).setMinValue(0).setMaxValue(7),
    )
    .addStringOption((o) => o.setName('duration').setDescription('Temp-ban length, e.g. 7d, 12h (omit for permanent)').setRequired(false)),

  async execute(interaction) {
    const client = interaction.client;
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    const durationStr = interaction.options.getString('duration');

    let durationMs = null;
    if (durationStr) {
      durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return interaction.reply({
          embeds: [client.brand.error(interaction.guild, 'Invalid duration', 'Use a duration like `7d` or `12h`, or omit it for a permanent ban.')],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const guard = mod.actionGuard(client, interaction, targetUser, targetMember, { botPerm: PermissionFlagsBits.BanMembers });
    if (!guard.ok) return interaction.reply({ embeds: [guard.embed], flags: MessageFlags.Ephemeral });

    const existing = await interaction.guild.bans.fetch(targetUser.id).catch(() => null);
    if (existing) {
      return interaction.reply({
        embeds: [client.brand.warn(interaction.guild, 'Already banned', `**${targetUser.tag}** is already banned from this server.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const kind = durationMs ? `Temp-ban (${formatDuration(durationMs)})` : 'Permanent ban';
    const prompt = client.brand
      .warn(interaction.guild, 'Confirm ban', `${kind} for **${targetUser.tag}** (<@${targetUser.id}>)?`)
      .addFields(
        { name: 'Delete messages', value: deleteDays ? `Last ${deleteDays} day(s)` : 'None', inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );
    const ok = await confirm(interaction, { embed: prompt, confirmLabel: 'Ban', danger: true });
    if (!ok) {
      return interaction.editReply({ embeds: [client.brand.info(interaction.guild, 'Cancelled', 'No action was taken.')], components: [] });
    }

    const row = mod.createCase(client, interaction.guild, {
      type: 'ban',
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      reason,
      durationMs,
    });
    const dmEnabled = mod.getConfig(client, interaction.guild.id).dmOnAction;
    const dmed = dmEnabled ? await mod.dmTarget(client, interaction.guild, targetUser, row) : false;

    try {
      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteDays * 86400,
        reason: truncate(`${reason} — by ${interaction.user.tag}`, 400),
      });
    } catch {
      mod.deactivateCase(client, interaction.guild.id, row.case_id);
      return interaction.editReply({
        embeds: [client.brand.error(interaction.guild, 'Ban failed', 'I could not ban this user. Check my role position and permissions.')],
        components: [],
      });
    }

    if (durationMs) {
      client.scheduler.schedule({
        guildId: interaction.guild.id,
        type: 'moderation:unban',
        runAt: Date.now() + durationMs,
        data: { guildId: interaction.guild.id, userId: targetUser.id, caseId: row.case_id },
      });
    }

    await mod.logCase(client, interaction.guild, row, { targetUser, moderatorUser: interaction.user });
    const embed = mod
      .ackEmbed(client, interaction.guild, 'ban', 'User banned', `**${targetUser.tag}** has been banned.`)
      .addFields(
        { name: 'Case', value: `#${row.case_id}`, inline: true },
        { name: 'Type', value: durationMs ? `Temporary — lifts ${relativeTime(Date.now() + durationMs)}` : 'Permanent', inline: true },
        { name: 'Notice', value: dmEnabled ? (dmed ? 'DM delivered' : 'DM could not be sent') : 'DMs disabled', inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );
    return interaction.editReply({ embeds: [embed], components: [] });
  },
};
