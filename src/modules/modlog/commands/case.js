'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const mod = require('../services/mod');

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('Inspect or remove a moderation case')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View a moderation case by number')
        .addIntegerOption((o) => o.setName('id').setDescription('Case number').setRequired(true).setMinValue(1)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Mark a case (e.g. a warning) inactive so it no longer counts')
        .addIntegerOption((o) => o.setName('id').setDescription('Case number').setRequired(true).setMinValue(1)),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const sub = interaction.options.getSubcommand();
    const caseId = interaction.options.getInteger('id');
    const row = mod.getCase(client, interaction.guild.id, caseId);

    if (!row) {
      return interaction.reply({
        embeds: [client.brand.error(interaction.guild, 'Case not found', `There is no case **#${caseId}** in this server.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetUser = await client.users.fetch(row.user_id).catch(() => null);
    const moderatorUser = await client.users.fetch(row.moderator_id).catch(() => null);

    if (sub === 'view') {
      return interaction.reply({ embeds: [mod.caseEmbed(client, interaction.guild, row, { targetUser, moderatorUser })], flags: MessageFlags.Ephemeral });
    }

    // remove
    if (!row.active) {
      return interaction.reply({
        embeds: [client.brand.warn(interaction.guild, 'Already inactive', `Case **#${caseId}** is already removed / inactive.`)],
        flags: MessageFlags.Ephemeral,
      });
    }
    mod.deactivateCase(client, interaction.guild.id, caseId);
    const updated = mod.getCase(client, interaction.guild.id, caseId);

    await client.logs.send(interaction.guild, 'moderation', {
      embeds: [
        client.brand
          .embed(interaction.guild, { color: 'info' })
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .setTitle(`🗑️ Case #${caseId} removed`)
          .setDescription(`The ${row.type} case for <@${row.user_id}> was marked inactive by <@${interaction.user.id}>.`),
      ],
    });

    return interaction.reply({
      embeds: [
        client.brand
          .success(interaction.guild, 'Case removed', `Case **#${caseId}** (${row.type}) for <@${row.user_id}> is now inactive.`)
          .setFooter({ text: `Case #${caseId} • ${interaction.guild.name}` }),
        mod.caseEmbed(client, interaction.guild, updated, { targetUser, moderatorUser }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
