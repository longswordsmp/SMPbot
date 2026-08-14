'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate, confirm, clamp } = require('../../../core/utils');
const engine = require('../services/engine');

const ACTION_CHOICES = Object.entries(engine.ACTIONS).map(([value, def]) => ({
  name: `${def.label}`,
  value,
}));

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.Administrator,
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure the anti-nuke detection engine')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Turn the anti-nuke engine on or off')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable protection?').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('thresholds').setDescription('View every detection threshold and punishment'))
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Change the threshold or punishment for one monitored action')
        .addStringOption((opt) => {
          opt.setName('action').setDescription('Monitored action').setRequired(true);
          for (const choice of ACTION_CHOICES) opt.addChoices(choice);
          return opt;
        })
        .addIntegerOption((opt) =>
          opt.setName('limit').setDescription('How many actions trigger the incident (1-50)').setMinValue(1).setMaxValue(50),
        )
        .addIntegerOption((opt) =>
          opt.setName('window').setDescription('Sliding window in seconds (10-3600)').setMinValue(10).setMaxValue(3600),
        )
        .addStringOption((opt) =>
          opt
            .setName('punishment')
            .setDescription('What happens to the executor when the threshold trips')
            .addChoices(
              { name: 'None (alert only)', value: 'none' },
              { name: 'Quarantine (strip all roles)', value: 'quarantine' },
              { name: 'Kick', value: 'kick' },
              { name: 'Ban', value: 'ban' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('restore')
        .setDescription('Toggle restoring nuked channels/roles from the latest backup')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Restore from backup on incidents?').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('panic')
        .setDescription('Panic mode: every punishment becomes quarantine + auto-lockdown on any trigger')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable panic mode?').setRequired(true))
        .addIntegerOption((opt) =>
          opt
            .setName('lockdown_minutes')
            .setDescription('Auto-unlock the panic lockdown after this many minutes (1-10080)')
            .setMinValue(1)
            .setMaxValue(10080),
        ),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'enable') {
      const enabled = interaction.options.getBoolean('enabled', true);
      if (!enabled) {
        const ok = await confirm(interaction, {
          embed: client.brand.warn(
            guild,
            'Disable anti-nuke protection?',
            'With the engine off, **nothing** watches for mass deletions, mass bans, permission escalations, webhook abuse, or malicious bots. Are you sure?',
          ),
          confirmLabel: 'Disable protection',
          danger: true,
        });
        if (!ok) {
          return interaction.editReply({ embeds: [client.brand.info(guild, 'Cancelled', 'Anti-nuke protection stays enabled.')] });
        }
        client.config.update(guild.id, engine.NAMESPACE, { enabled: false });
        await client.logs.send(guild, 'antinuke', {
          embeds: [client.brand.warn(guild, 'Anti-nuke disabled', `Disabled by <@${interaction.user.id}>.`)],
        });
        return interaction.editReply({
          embeds: [client.brand.warn(guild, 'Anti-nuke disabled', 'The detection engine is now **off**. Re-enable it with `/antinuke enable enabled:True`.')],
        });
      }
      client.config.update(guild.id, engine.NAMESPACE, { enabled: true });
      await client.logs.send(guild, 'antinuke', {
        embeds: [client.brand.success(guild, 'Anti-nuke enabled', `Enabled by <@${interaction.user.id}>.`)],
      });
      return interaction.reply({
        embeds: [client.brand.success(guild, 'Anti-nuke enabled', 'The detection engine is watching this server again.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'thresholds') {
      const cfg = engine.config(client, guild.id);
      const lines = Object.entries(engine.ACTIONS).map(([key, def]) => {
        const ac = engine.actionConfig(cfg, key);
        const punishment = cfg.panic ? `quarantine (panic override, configured: ${ac.punishment})` : ac.punishment;
        return `${def.emoji} **${def.label}** — \`${key}\`\n> **${ac.limit}** in **${ac.windowSec}s** → \`${punishment}\``;
      });
      const embed = client.brand
        .embed(guild)
        .setTitle('⚖️ Anti-nuke thresholds')
        .setDescription(
          [
            `Engine: **${cfg.enabled ? 'enabled' : 'disabled'}** • Panic: **${cfg.panic ? 'ACTIVE' : 'off'}** • Restore from backup: **${cfg.restore ? 'on' : 'off'}**`,
            '',
            ...lines,
          ].join('\n'),
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'set') {
      const action = interaction.options.getString('action', true);
      if (!engine.ACTIONS[action]) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Unknown action', 'That monitored action does not exist.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      const limit = interaction.options.getInteger('limit');
      const windowSec = interaction.options.getInteger('window');
      const punishment = interaction.options.getString('punishment');
      if (limit === null && windowSec === null && punishment === null) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Nothing to change', 'Provide at least one of `limit`, `window`, or `punishment`.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (punishment !== null && !engine.PUNISHMENTS.includes(punishment)) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Invalid punishment', 'Choose none, quarantine, kick, or ban.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      const patch = { actions: { [action]: {} } };
      if (limit !== null) patch.actions[action].limit = clamp(limit, 1, 50);
      if (windowSec !== null) patch.actions[action].windowSec = clamp(windowSec, 10, 3600);
      if (punishment !== null) patch.actions[action].punishment = punishment;
      const cfg = client.config.update(guild.id, engine.NAMESPACE, patch);
      const ac = engine.actionConfig(cfg, action);
      const def = engine.ACTIONS[action];
      await client.logs.send(guild, 'antinuke', {
        embeds: [
          client.brand.info(
            guild,
            'Threshold updated',
            `<@${interaction.user.id}> set **${def.label}** to **${ac.limit}**/${ac.windowSec}s → \`${ac.punishment}\`.`,
          ),
        ],
      });
      return interaction.reply({
        embeds: [
          client.brand.success(
            guild,
            'Threshold updated',
            `${def.emoji} **${def.label}** now triggers at **${ac.limit}** action(s) within **${ac.windowSec}s** → punishment: \`${ac.punishment}\`.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'restore') {
      const enabled = interaction.options.getBoolean('enabled', true);
      client.config.update(guild.id, engine.NAMESPACE, { restore: enabled });
      const backupAvailable = Boolean(client.services.backup?.latest);
      return interaction.reply({
        embeds: [
          client.brand.success(
            guild,
            'Restore setting updated',
            `Restore-from-backup on incidents is now **${enabled ? 'on' : 'off'}**.` +
              (enabled && !backupAvailable ? '\n⚠️ The backup module is not available — nothing can be restored until it is.' : ''),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'panic') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const minutes = interaction.options.getInteger('lockdown_minutes');
      const patch = { panic: enabled };
      if (minutes !== null) patch.panicLockdownMinutes = clamp(minutes, 1, engine.MAX_LOCKDOWN_MINUTES);
      const cfg = client.config.update(guild.id, engine.NAMESPACE, patch);
      await client.logs.send(guild, 'antinuke', {
        embeds: [
          enabled
            ? client.brand.warn(guild, 'Panic mode ACTIVATED', `Activated by <@${interaction.user.id}>. All punishments are forced to quarantine and any trigger locks the server down.`)
            : client.brand.info(guild, 'Panic mode deactivated', `Deactivated by <@${interaction.user.id}>.`),
        ],
      });
      return interaction.reply({
        embeds: [
          enabled
            ? client.brand.warn(
                guild,
                'Panic mode ACTIVE',
                truncate(
                  `Every anti-nuke punishment is temporarily forced to **quarantine**, and any trigger also locks the server down for **${clamp(Number(cfg.panicLockdownMinutes) || 15, 1, engine.MAX_LOCKDOWN_MINUTES)} minute(s)**.\nDisable with \`/antinuke panic enabled:False\` once the threat has passed.`,
                  2000,
                ),
              )
            : client.brand.success(guild, 'Panic mode off', 'Punishments follow the configured per-action settings again.'),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    return null;
  },
};
