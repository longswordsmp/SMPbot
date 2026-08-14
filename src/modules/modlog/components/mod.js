'use strict';

const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const mod = require('../services/mod');

/**
 * Moderation settings panel interactions (`mod:cfg:*`). All escalation rule
 * editing lives in `/modconfig`; these buttons are quick in-panel toggles.
 */
module.exports = {
  prefix: 'mod',

  async handle(interaction, args) {
    const client = interaction.client;
    const [section, action] = args;

    if (!interaction.inGuild()) return null;
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [client.brand.error(interaction.guild, 'Missing permissions', 'You need **Manage Server** to change moderation settings.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (section === 'cfg' && interaction.isButton()) {
      const cfg = mod.getConfig(client, interaction.guild.id);
      if (action === 'dm') {
        client.config.update(interaction.guild.id, 'moderation', { dmOnAction: !cfg.dmOnAction });
      } else if (action === 'esc') {
        client.config.update(interaction.guild.id, 'moderation', {
          escalation: { ...cfg.escalation, enabled: !cfg.escalation?.enabled },
        });
      } else {
        return null;
      }
      return interaction.update(mod.configPanel(client, interaction.guild));
    }

    return null;
  },
};
