'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { paginate, truncate, absoluteTime, chunkArray } = require('../../../core/utils');
const mod = require('../services/mod');

const PER_PAGE = 6;

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ModerateMembers,
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription("View a member's warning history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to look up').setRequired(true)),

  async execute(interaction) {
    const client = interaction.client;
    const targetUser = interaction.options.getUser('user');
    const warns = mod.userCases(client, interaction.guild.id, targetUser.id, { type: 'warn' });
    const active = warns.filter((w) => w.active).length;

    if (!warns.length) {
      return interaction.reply({
        embeds: [client.brand.success(interaction.guild, 'Clean record', `**${targetUser.tag}** has no warnings on record.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const pages = chunkArray(warns, PER_PAGE);
    const embeds = pages.map((page, idx) => {
      const embed = client.brand
        .embed(interaction.guild, { color: 'warning' })
        .setTitle(`⚠️ Warnings — ${targetUser.tag}`)
        .setDescription(`**${active}** active of **${warns.length}** total warning${warns.length === 1 ? '' : 's'}.`)
        .setThumbnail(targetUser.displayAvatarURL());
      for (const w of page) {
        embed.addFields({
          name: `Case #${w.case_id}${w.active ? '' : ' • removed'}`,
          value: [
            `**Reason:** ${truncate(w.reason || 'No reason provided', 300)}`,
            `**By:** <@${w.moderator_id}> • ${absoluteTime(w.created_at, 'f')}`,
          ].join('\n'),
          inline: false,
        });
      }
      embed.setFooter({ text: `Page ${idx + 1}/${pages.length} • Remove a warning with /case remove <id>` });
      return embed;
    });

    await paginate(interaction, embeds, { ephemeral: true });
  },
};
