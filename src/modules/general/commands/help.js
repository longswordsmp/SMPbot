'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { paginate } = require('../../../core/utils');

const MODULE_META = {
  general: { emoji: '🧭', label: 'General' },
  setup: { emoji: '⚙️', label: 'Setup' },
  branding: { emoji: '🎨', label: 'Branding' },
  themes: { emoji: '🖌️', label: 'Themes' },
  templates: { emoji: '🏗️', label: 'Server Templates' },
  tickets: { emoji: '🎫', label: 'Tickets' },
  giveaways: { emoji: '🎉', label: 'Giveaways' },
  invites: { emoji: '🔗', label: 'Invites' },
  security: { emoji: '🛡️', label: 'Security & Anti-Nuke' },
  automod: { emoji: '🚫', label: 'AutoMod' },
  moderation: { emoji: '🔨', label: 'Moderation' },
  leveling: { emoji: '📈', label: 'Leveling' },
  welcome: { emoji: '👋', label: 'Welcome' },
  verification: { emoji: '🔐', label: 'Verification' },
  announcements: { emoji: '📢', label: 'Announcements' },
  rules: { emoji: '📜', label: 'Rules' },
  serverinfo: { emoji: '🎮', label: 'Minecraft Server' },
  backup: { emoji: '💾', label: 'Backups' },
  logging: { emoji: '🧾', label: 'Logging' },
};

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder().setName('help').setDescription('Browse every SMPbot command by category'),

  async execute(interaction) {
    const client = interaction.client;
    const byModule = new Map();
    for (const command of client.commands.values()) {
      const key = command.module ?? 'general';
      if (!byModule.has(key)) byModule.set(key, []);
      byModule.get(key).push(command);
    }

    const embeds = [];
    const overview = client.brand
      .embed(interaction.guild)
      .setTitle('🟩 SMPbot — Help')
      .setDescription(
        [
          '**SMPbot** is an all-in-one operating system for Minecraft SMP Discord servers.',
          '',
          'New here? Run **`/setup`** — the interactive wizard configures your entire server:',
          'templates, themes, branding, verification, rules, tickets, giveaways, moderation,',
          'security, backups, logging, welcome messages, and leveling.',
          '',
          `Browse **${client.commands.size} commands** across **${byModule.size} categories** with the buttons below.`,
        ].join('\n'),
      );
    embeds.push(overview);

    const moduleNames = [...byModule.keys()].sort();
    for (const moduleName of moduleNames) {
      const meta = MODULE_META[moduleName] ?? { emoji: '📦', label: moduleName };
      const commands = byModule
        .get(moduleName)
        .sort((a, b) => a.data.name.localeCompare(b.data.name))
        .map((c) => `**\`/${c.data.name}\`** — ${c.data.description}`)
        .join('\n');
      embeds.push(
        client.brand
          .embed(interaction.guild)
          .setTitle(`${meta.emoji} ${meta.label}`)
          .setDescription(commands.slice(0, 4000)),
      );
    }

    await paginate(interaction, embeds, { ephemeral: true });
  },
};
