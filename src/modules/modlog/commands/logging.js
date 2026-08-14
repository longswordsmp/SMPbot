'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const { LOG_TYPES, DEFAULT_LOGGING } = require('../../../core/logging');

const TYPE_CHOICES = LOG_TYPES.map((t) => ({ name: t, value: t }));

const TEXTLIKE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

function statusEmbed(client, guild) {
  const cfg = client.config.get(guild.id, 'logging', DEFAULT_LOGGING);
  const lines = LOG_TYPES.map((type) => {
    const target = cfg.channels?.[type]
      ? `<#${cfg.channels[type]}>`
      : cfg.channels?.default
        ? `<#${cfg.channels.default}> _(default)_`
        : '—';
    return `\`${type.padEnd(13)}\` ${target}`;
  });
  return client.brand
    .embed(guild, { color: cfg.enabled ? 'primary' : 'error' })
    .setTitle('🧾 Logging status')
    .setDescription(`Logging is **${cfg.enabled ? 'enabled' : 'disabled'}**.\n\n${lines.join('\n')}`)
    .setFooter({ text: 'Map a type with /logging set • run /logging setup for guided configuration' });
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Configure SMPbot event logging channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('setup').setDescription('Guided setup: auto-create channels, pick manually, or use one channel'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show which channel each log type is mapped to'))
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable logging'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable logging (mappings are kept)'))
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Map a single log type to a channel')
        .addStringOption((o) => o.setName('type').setDescription('Log category').setRequired(true).addChoices(...TYPE_CHOICES))
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Remove the channel mapping for a log type')
        .addStringOption((o) => o.setName('type').setDescription('Log category to clear').setRequired(true).addChoices(...TYPE_CHOICES)),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'status') {
      return interaction.reply({ embeds: [statusEmbed(client, interaction.guild)], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'enable' || sub === 'disable') {
      client.config.update(guildId, 'logging', { enabled: sub === 'enable' });
      return interaction.reply({
        embeds: [client.brand.success(interaction.guild, 'Logging updated', `Event logging is now **${sub === 'enable' ? 'enabled' : 'disabled'}**.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'set') {
      const type = interaction.options.getString('type');
      const channel = interaction.options.getChannel('channel');
      if (!channel || !TEXTLIKE.has(channel.type)) {
        return interaction.reply({ embeds: [client.brand.error(interaction.guild, 'Invalid channel', 'Pick a normal text or announcement channel.')], flags: MessageFlags.Ephemeral });
      }
      const cfg = client.config.get(guildId, 'logging', DEFAULT_LOGGING);
      const channels = { ...(cfg.channels || {}), [type]: channel.id };
      client.config.set(guildId, 'logging', { ...cfg, enabled: true, channels });
      return interaction.reply({
        embeds: [client.brand.success(interaction.guild, 'Mapping saved', `\`${type}\` logs will go to <#${channel.id}>.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'clear') {
      const type = interaction.options.getString('type');
      const cfg = client.config.get(guildId, 'logging', DEFAULT_LOGGING);
      const channels = { ...(cfg.channels || {}) };
      if (!(type in channels)) {
        return interaction.reply({ embeds: [client.brand.warn(interaction.guild, 'Not set', `\`${type}\` was not mapped to a channel.`)], flags: MessageFlags.Ephemeral });
      }
      delete channels[type];
      client.config.set(guildId, 'logging', { ...cfg, channels });
      return interaction.reply({
        embeds: [client.brand.success(interaction.guild, 'Mapping cleared', `\`${type}\` logging is no longer mapped${cfg.channels?.default ? ' (will use the default channel if set)' : ''}.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // setup — interactive choice
    const embed = client.brand
      .embed(interaction.guild)
      .setTitle('🧾 Logging setup')
      .setDescription(
        [
          'Choose how you want SMPbot to log server events:',
          '',
          '**🏗️ Auto-create** — build a private `🔒 SMPBOT LOGS` category with staff-only channels and map everything for you.',
          '**🎯 Pick channels** — choose a channel per group (moderation, members, messages, server, security).',
          '**📥 Single channel** — send every log to one channel.',
        ].join('\n'),
      );
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('logging:setup:auto').setLabel('Auto-create').setEmoji('🏗️').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('logging:setup:manual').setLabel('Pick channels').setEmoji('🎯').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('logging:setup:single').setLabel('Single channel').setEmoji('📥').setStyle(ButtonStyle.Secondary),
    );
    return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  },
};
