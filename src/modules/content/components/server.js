'use strict';

const {
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const { truncate } = require('../../../core/utils');
const guideService = require('../services/guide');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function lacksPermission(interaction) {
  return !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Server-connection components (prefix `server`): the setup modal and the
 * channel-select that publishes the connection guide. Data lives in the
 * `minecraft` config namespace.
 */
module.exports = {
  prefix: 'server',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    const [action] = args;

    if (!interaction.inGuild()) return null;
    if (lacksPermission(interaction)) {
      return interaction
        .reply(eph({ embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to configure the server info.')] }))
        .catch(() => null);
    }

    if (action === 'setupmodal' && interaction.isModalSubmit()) {
      const serverName = truncate(String(interaction.fields.getTextInputValue('serverName') ?? '').trim(), guideService.LIMITS.serverName);
      const javaRaw = String(interaction.fields.getTextInputValue('javaIp') ?? '').trim();
      const bedrockRaw = String(interaction.fields.getTextInputValue('bedrockIp') ?? '').trim();
      const portRaw = String(interaction.fields.getTextInputValue('bedrockPort') ?? '').trim();

      let javaIp = '';
      if (javaRaw) {
        const parsed = guideService.parseJavaAddress(javaRaw);
        if (!parsed) {
          return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Invalid Java IP', 'Enter a valid address like `play.server.net` or `play.server.net:25565`.')] })).catch(() => null);
        }
        javaIp = parsed;
      }

      let bedrockIp = '';
      if (bedrockRaw) {
        if (!guideService.isValidHost(bedrockRaw)) {
          return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Invalid Bedrock IP', 'Enter a valid hostname or IP address (no port here — set it in the port field).')] })).catch(() => null);
        }
        bedrockIp = bedrockRaw;
      }

      let bedrockPort = 19132;
      if (portRaw) {
        const parsedPort = guideService.parsePort(portRaw);
        if (!parsedPort) {
          return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Invalid Bedrock port', 'The port must be a number between **1** and **65535**.')] })).catch(() => null);
        }
        bedrockPort = parsedPort;
      }

      if (!javaIp && !bedrockIp) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'No IP provided', 'Enter at least a Java or a Bedrock IP so players can connect.')] })).catch(() => null);
      }

      guideService.saveConfig(client, guild.id, { serverName, javaIp, bedrockIp, bedrockPort });
      const config = guideService.getConfig(client, guild.id);

      const menu = new ChannelSelectMenuBuilder()
        .setCustomId('server:publishselect')
        .setPlaceholder('Publish the connection guide to a channel...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1);

      const guide = guideService.buildGuideEmbed(client, guild, config);
      const success = client.brand.success(
        guild,
        'Server info saved',
        'Your connection details are saved. Pick a channel below to publish the join guide, or use `/server publish` any time.',
      );
      return interaction
        .reply(eph({ embeds: guide ? [success, guide] : [success], components: [new ActionRowBuilder().addComponents(menu)] }))
        .catch(() => null);
    }

    if (action === 'publishselect' && interaction.isChannelSelectMenu()) {
      const channelId = interaction.values?.[0];
      const channel =
        interaction.channels?.get?.(channelId) ??
        guild.channels.cache.get(channelId) ??
        (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) {
        return interaction.update({ embeds: [client.brand.error(guild, 'Channel not found', 'That channel is no longer available.')], components: [] }).catch(() => null);
      }
      await interaction.deferUpdate().catch(() => null);
      const result = await guideService.publishGuide(client, guild, channel);
      return interaction
        .editReply({
          embeds: [
            result.ok
              ? client.brand.success(guild, 'Guide published', `The connection guide is live in <#${channel.id}>.`)
              : client.brand.error(guild, 'Publish failed', result.error),
          ],
          components: [],
        })
        .catch(() => null);
    }

    return null;
  },
};
