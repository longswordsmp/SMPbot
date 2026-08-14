'use strict';

const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const settings = require('../services/settings');
const raid = require('../services/raid');

/**
 * Buttons/selects under the /automod status panel:
 *   automod:master  — toggle AutoMod on/off for the guild
 *   automod:system  — select a system to toggle on/off
 */
module.exports = {
  prefix: 'automod',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    const [action] = args;
    if (!guild) return null;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to configure AutoMod.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const raidActive = raid.isRaidActive(client, guild.id);

    if (action === 'master' && interaction.isButton()) {
      const cfg = settings.getConfig(client, guild.id);
      client.config.update(guild.id, settings.NAMESPACE, { enabled: !cfg.enabled });
      return interaction.update(settings.buildStatusView(client, guild, { raidActive }));
    }

    if (action === 'system' && interaction.isStringSelectMenu()) {
      const key = interaction.values[0];
      if (!settings.SYSTEMS[key]) return interaction.deferUpdate().catch(() => null);
      const cfg = settings.getConfig(client, guild.id);
      const node = settings.nodeFor(cfg, key) ?? {};
      settings.setSystemEnabled(client, guild.id, key, !node.enabled);
      return interaction.update(settings.buildStatusView(client, guild, { raidActive }));
    }

    return null;
  },
};
