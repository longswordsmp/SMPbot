'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const wizard = require('../services/wizard');

/**
 * /setup — the interactive, resumable setup wizard. Owner-only and ephemeral
 * throughout. It simply renders the HOME dashboard; every subsequent screen is
 * driven by the `setup` component handler, so nothing is held in memory.
 */
module.exports = {
  cooldown: 3,
  ownerOnly: true,
  // Belt-and-braces so the command is hidden from non-admins in the picker; the
  // router still enforces ownerOnly on top of this.
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up your entire server with the SMPbot wizard')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const view = wizard.buildHome(interaction.client, interaction.guild);
    return interaction.reply({ ...view, flags: MessageFlags.Ephemeral });
  },
};
