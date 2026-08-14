'use strict';

const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const engine = require('../services/engine');

/**
 * Buttons under the /security status panel:
 *   security:refresh — re-render the status overview
 *   security:lock    — immediate emergency lockdown (manual /unlock)
 *   security:unlock  — lift an active lockdown
 */
module.exports = {
  prefix: 'security',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    const [action] = args;
    if (!guild) return null;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to use the security panel.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'refresh' && interaction.isButton()) {
      return interaction.update({
        embeds: [engine.buildStatusEmbed(client, guild)],
        components: [engine.buildStatusRow(client, guild)],
      });
    }

    if (action === 'lock' && interaction.isButton()) {
      await interaction.deferUpdate().catch(() => null);
      const result = await engine.lockdown(client, guild, {
        reason: `Manual lockdown via security panel by ${interaction.user.tag}`,
        minutes: 0,
        initiatorId: interaction.user.id,
      });
      if (!result.ok && !result.already) {
        await interaction.followUp({
          embeds: [client.brand.error(guild, 'Lockdown failed', result.note ?? 'The lockdown could not be applied.')],
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
      return interaction.editReply({
        embeds: [engine.buildStatusEmbed(client, guild)],
        components: [engine.buildStatusRow(client, guild)],
      }).catch(() => null);
    }

    if (action === 'unlock' && interaction.isButton()) {
      await interaction.deferUpdate().catch(() => null);
      const result = await engine.unlock(client, guild, { initiatorId: interaction.user.id });
      if (!result.ok) {
        await interaction.followUp({
          embeds: [client.brand.warn(guild, 'Nothing to unlock', result.note ?? 'The server is not locked down.')],
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      }
      return interaction.editReply({
        embeds: [engine.buildStatusEmbed(client, guild)],
        components: [engine.buildStatusRow(client, guild)],
      }).catch(() => null);
    }

    return null;
  },
};
