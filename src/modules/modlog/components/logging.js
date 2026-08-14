'use strict';

const {
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const log = require('../../../core/logger');
const { DEFAULT_LOGGING } = require('../../../core/logging');
const logs = require('../services/logs');

const TEXTLIKE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

/** Build the manual-mapping view: one ChannelSelectMenu per major group. */
function manualView(client, guild) {
  const cfg = client.config.get(guild.id, 'logging', DEFAULT_LOGGING);
  const statusLines = logs.MANUAL_GROUPS.map((g) => {
    const id = cfg.channels?.[g.types[0]];
    return `${g.emoji} **${g.label}** — ${id ? `<#${id}>` : '_not set_'}`;
  });
  const embed = client.brand
    .embed(guild, { color: 'primary' })
    .setTitle('🎯 Pick logging channels')
    .setDescription(`Choose a channel for each group. Each selection saves immediately.\n\n${statusLines.join('\n')}`)
    .setFooter({ text: 'Run /logging status any time to review the full mapping.' });

  const rows = logs.MANUAL_GROUPS.map((g) =>
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`logging:pick:${g.key}`)
        .setPlaceholder(`${g.emoji} ${g.label}`)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1),
    ),
  );
  return { embeds: [embed], components: rows };
}

module.exports = {
  prefix: 'logging',

  async handle(interaction, args) {
    const client = interaction.client;
    const [section, key] = args;

    if (!interaction.inGuild()) return null;
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [client.brand.error(interaction.guild, 'Missing permissions', 'You need **Manage Server** to configure logging.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    // --- Setup mode selection ----------------------------------------------
    if (section === 'setup' && interaction.isButton()) {
      if (key === 'auto') {
        const me = interaction.guild.members.me;
        if (!me?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.update({
            embeds: [client.brand.error(interaction.guild, 'Missing bot permission', 'I need **Manage Channels** to auto-create the logging category.')],
            components: [],
          });
        }
        await interaction.update({
          embeds: [client.brand.info(interaction.guild, 'Setting up…', 'Creating the `🔒 SMPBOT LOGS` category and channels…')],
          components: [],
        });
        try {
          const result = await logs.autoCreate(client, interaction.guild);
          const list = result.channels.map((c) => `${c.group.emoji} <#${c.channel.id}>`).join('\n') || '_No channels created._';
          const embed = client.brand
            .success(interaction.guild, 'Logging ready', 'Created a staff-only logging category and mapped every log type.')
            .addFields({ name: 'Channels', value: list, inline: false })
            .setFooter({ text: 'Fine-tune any mapping with /logging set' });
          return interaction.editReply({ embeds: [embed], components: [] });
        } catch (err) {
          log.warn(`modlog: auto logging setup failed in guild ${interaction.guild.id}:`, err?.message ?? err);
          return interaction.editReply({
            embeds: [client.brand.error(interaction.guild, 'Setup failed', 'I could not create the logging channels. Check my permissions and try again.')],
            components: [],
          });
        }
      }

      if (key === 'manual') {
        return interaction.update(manualView(client, interaction.guild));
      }

      if (key === 'single') {
        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('logging:single')
            .setPlaceholder('Select one channel for all logs')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setMinValues(1)
            .setMaxValues(1),
        );
        return interaction.update({
          embeds: [client.brand.info(interaction.guild, 'Single channel', 'Pick the channel that should receive **every** log type.')],
          components: [row],
        });
      }
      return null;
    }

    // --- Manual group mapping ----------------------------------------------
    if (section === 'pick' && interaction.isChannelSelectMenu()) {
      const group = logs.MANUAL_GROUPS.find((g) => g.key === key);
      const channelId = interaction.values[0];
      const channel = interaction.channels?.get?.(channelId) ?? interaction.guild.channels.cache.get(channelId);
      if (!group || !channel || !TEXTLIKE.has(channel.type)) {
        return interaction.reply({ embeds: [client.brand.error(interaction.guild, 'Invalid channel', 'Pick a normal text or announcement channel.')], flags: MessageFlags.Ephemeral });
      }
      const cfg = client.config.get(interaction.guild.id, 'logging', DEFAULT_LOGGING);
      const channels = { ...(cfg.channels || {}) };
      for (const type of group.types) channels[type] = channelId;
      client.config.set(interaction.guild.id, 'logging', { ...cfg, enabled: true, channels });
      return interaction.update(manualView(client, interaction.guild));
    }

    // --- Single channel for everything -------------------------------------
    if (section === 'single' && interaction.isChannelSelectMenu()) {
      const channelId = interaction.values[0];
      const channel = interaction.channels?.get?.(channelId) ?? interaction.guild.channels.cache.get(channelId);
      if (!channel || !TEXTLIKE.has(channel.type)) {
        return interaction.reply({ embeds: [client.brand.error(interaction.guild, 'Invalid channel', 'Pick a normal text or announcement channel.')], flags: MessageFlags.Ephemeral });
      }
      client.config.set(interaction.guild.id, 'logging', { enabled: true, channels: { default: channelId } });
      return interaction.update({
        embeds: [client.brand.success(interaction.guild, 'Logging ready', `Every log type will now be sent to <#${channelId}>.`)],
        components: [],
      });
    }

    return null;
  },
};
