'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate, isSnowflake } = require('../../../core/utils');
const mod = require('../services/mod');

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.BanMembers,
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Lift a ban by user ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((o) => o.setName('user').setDescription('ID of the banned user').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false).setMaxLength(500)),

  async execute(interaction) {
    const client = interaction.client;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.options.getString('user').trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!isSnowflake(userId)) {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Invalid ID', 'Provide a valid user ID (17-20 digits).')] });
    }
    if (!interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Missing bot permission', 'I need the **Ban Members** permission.')] });
    }

    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      return interaction.editReply({ embeds: [client.brand.warn(interaction.guild, 'Not banned', 'That user is not banned in this server.')] });
    }

    try {
      await interaction.guild.members.unban(userId, truncate(`${reason} — by ${interaction.user.tag}`, 400));
    } catch {
      return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Unban failed', 'I could not lift this ban. Check my permissions.')] });
    }

    // Cancel any pending temp-ban expiry job for this user.
    for (const job of client.scheduler.pending(interaction.guild.id, 'moderation:unban')) {
      if (String(job.data?.userId) === userId) client.scheduler.cancel(job.id);
    }
    client.db.run(
      "UPDATE mod_cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'ban' AND active = 1",
      interaction.guild.id,
      userId,
    );

    const row = mod.createCase(client, interaction.guild, {
      type: 'unban',
      userId,
      moderatorId: interaction.user.id,
      reason,
    });
    const targetUser = ban.user ?? (await client.users.fetch(userId).catch(() => null));
    await mod.logCase(client, interaction.guild, row, { targetUser, moderatorUser: interaction.user });

    const embed = mod
      .ackEmbed(client, interaction.guild, 'unban', 'Ban lifted', `**${targetUser?.tag ?? userId}** has been unbanned.`)
      .addFields(
        { name: 'Case', value: `#${row.case_id}`, inline: true },
        { name: 'Reason', value: truncate(reason, 1024), inline: false },
      );
    return interaction.editReply({ embeds: [embed] });
  },
};
