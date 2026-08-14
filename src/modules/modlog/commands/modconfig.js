'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { parseDuration, formatDuration } = require('../../../core/utils');
const mod = require('../services/mod');

const MAX_RULES = 10;

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('modconfig')
    .setDescription('Configure moderation behavior (DMs and warning escalation)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('view').setDescription('Show current moderation settings'))
    .addSubcommand((sub) =>
      sub
        .setName('dm')
        .setDescription('Toggle whether targets are DMed a notice on moderation actions')
        .addBooleanOption((o) => o.setName('enabled').setDescription('Send DM notices?').setRequired(true)),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('escalation')
        .setDescription('Automatic action when a member reaches a warning threshold')
        .addSubcommand((sub) => sub.setName('enable').setDescription('Enable warning escalation'))
        .addSubcommand((sub) => sub.setName('disable').setDescription('Disable warning escalation'))
        .addSubcommand((sub) => sub.setName('list').setDescription('List configured escalation rules'))
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Add or update the action for a warning threshold')
            .addIntegerOption((o) => o.setName('warns').setDescription('Warning count that triggers the action').setRequired(true).setMinValue(1).setMaxValue(50))
            .addStringOption((o) =>
              o
                .setName('action')
                .setDescription('Action to apply at that threshold')
                .setRequired(true)
                .addChoices({ name: 'Timeout', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }),
            )
            .addStringOption((o) => o.setName('duration').setDescription('Timeout length (only for timeout), e.g. 1h, 1d').setRequired(false)),
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('Remove the escalation rule at a warning threshold')
            .addIntegerOption((o) => o.setName('warns').setDescription('Warning count of the rule to remove').setRequired(true).setMinValue(1).setMaxValue(50)),
        ),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guildId = interaction.guild.id;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (!group && sub === 'view') {
      return interaction.reply({ ...mod.configPanel(client, interaction.guild), flags: MessageFlags.Ephemeral });
    }

    if (!group && sub === 'dm') {
      const enabled = interaction.options.getBoolean('enabled');
      client.config.update(guildId, 'moderation', { dmOnAction: enabled });
      return interaction.reply({
        embeds: [client.brand.success(interaction.guild, 'Setting saved', `Action DM notices are now **${enabled ? 'enabled' : 'disabled'}**.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (group === 'escalation') {
      const cfg = mod.getConfig(client, guildId);
      const rules = (cfg.escalation?.rules || []).slice();

      if (sub === 'enable' || sub === 'disable') {
        const enabled = sub === 'enable';
        client.config.update(guildId, 'moderation', { escalation: { ...cfg.escalation, enabled } });
        return interaction.reply({
          embeds: [client.brand.success(interaction.guild, 'Escalation updated', `Warning escalation is now **${enabled ? 'enabled' : 'disabled'}**.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'list') {
        return interaction.reply({ ...mod.configPanel(client, interaction.guild), flags: MessageFlags.Ephemeral });
      }

      if (sub === 'add') {
        const warns = interaction.options.getInteger('warns');
        const action = interaction.options.getString('action');
        const durationStr = interaction.options.getString('duration');
        let durationMs = null;
        if (action === 'timeout') {
          durationMs = durationStr ? parseDuration(durationStr) : 60 * 60 * 1000;
          if (!durationMs) {
            return interaction.reply({
              embeds: [client.brand.error(interaction.guild, 'Invalid duration', 'Provide a timeout length like `1h` or `1d`.')],
              flags: MessageFlags.Ephemeral,
            });
          }
          if (durationMs > mod.MAX_TIMEOUT_MS) durationMs = mod.MAX_TIMEOUT_MS;
        }

        const next = rules.filter((r) => Number(r.warns) !== warns);
        if (next.length >= MAX_RULES) {
          return interaction.reply({
            embeds: [client.brand.error(interaction.guild, 'Too many rules', `You can configure at most **${MAX_RULES}** escalation rules.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        const rule = { warns, action };
        if (durationMs) rule.durationMs = durationMs;
        next.push(rule);
        next.sort((a, b) => Number(a.warns) - Number(b.warns));
        client.config.update(guildId, 'moderation', { escalation: { ...cfg.escalation, rules: next } });

        const detail = action === 'timeout' ? `**timeout** (${formatDuration(durationMs)})` : `**${action}**`;
        return interaction.reply({
          embeds: [client.brand.success(interaction.guild, 'Rule saved', `At **${warns}** warnings SMPbot will now ${detail}.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'remove') {
        const warns = interaction.options.getInteger('warns');
        const next = rules.filter((r) => Number(r.warns) !== warns);
        if (next.length === rules.length) {
          return interaction.reply({
            embeds: [client.brand.warn(interaction.guild, 'No such rule', `There is no escalation rule at **${warns}** warnings.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        client.config.update(guildId, 'moderation', { escalation: { ...cfg.escalation, rules: next } });
        return interaction.reply({
          embeds: [client.brand.success(interaction.guild, 'Rule removed', `The escalation rule at **${warns}** warnings was removed.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    return interaction.reply({
      embeds: [client.brand.error(interaction.guild, 'Unknown subcommand', 'That configuration action is not available.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
