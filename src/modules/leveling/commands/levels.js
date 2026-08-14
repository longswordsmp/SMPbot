'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { safeReply, truncate } = require('../../../core/utils');
const engine = require('../services/engine');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('levels')
    .setDescription('Explain how XP and levels work, and list the level rewards'),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const cfg = engine.config(client, guild.id);

    // A few example thresholds so members can see the curve concretely.
    const sample = [1, 5, 10, 20, 50].map((lvl) => {
      const total = engine.totalXpForLevel(lvl);
      return `• **Level ${lvl}** — ${total.toLocaleString('en-US')} total XP`;
    });

    const embed = client.brand
      .embed(guild)
      .setTitle('📈 How leveling works')
      .setDescription(
        [
          'Earn XP simply by chatting. Every eligible message grants a random amount of XP.',
          '',
          `**XP per message:** ${cfg.minXp}–${cfg.maxXp}`,
          `**Cooldown:** one XP grant every ${cfg.cooldownSeconds}s per person`,
          cfg.dailyCap > 0 ? `**Daily cap:** ${cfg.dailyCap.toLocaleString('en-US')} XP per day` : '**Daily cap:** none',
          '',
          '**The level curve**',
          'XP needed to advance from level *n* to *n+1* is `5·n² + 50·n + 100`,',
          'so each level takes a little more effort than the last.',
        ].join('\n'),
      )
      .addFields({ name: 'XP milestones', value: sample.join('\n'), inline: false });

    // Multipliers.
    const multLines = [];
    if (Number(cfg.boosterMultiplier) > 0 && cfg.boosterMultiplier !== 1) {
      multLines.push(`• Server boosters: **×${cfg.boosterMultiplier}**`);
    }
    const roleMults = Object.entries(cfg.roleMultipliers || {});
    for (const [roleId, m] of roleMults.slice(0, 10)) {
      multLines.push(`• <@&${roleId}>: **×${m}**`);
    }
    if (multLines.length) {
      multLines.push('_Multipliers do not stack — the highest one applies._');
      embed.addFields({ name: 'XP multipliers', value: truncate(multLines.join('\n'), 1024), inline: false });
    }

    // Level-role rewards.
    const rewards = engine.listLevelRoles(client, guild.id);
    if (rewards.length) {
      const mode = cfg.roleMode === 'replace' ? 'you keep only your highest reward role' : 'reward roles stack';
      const lines = rewards
        .slice(0, 20)
        .map((r) => `• **Level ${r.level}** → <@&${r.role_id}>`);
      if (rewards.length > 20) lines.push(`…and ${rewards.length - 20} more.`);
      embed.addFields({
        name: `🏅 Level rewards (${mode})`,
        value: truncate(lines.join('\n'), 1024),
        inline: false,
      });
    }

    return safeReply(interaction, { embeds: [embed] });
  },
};
