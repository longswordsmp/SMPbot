'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { truncate } = require('../../../core/utils');
const guideService = require('../services/guide');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function setupModal(config) {
  return new ModalBuilder()
    .setCustomId('server:setupmodal')
    .setTitle('Minecraft server connection')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('serverName')
          .setLabel('Server name')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(guideService.LIMITS.serverName)
          .setValue(config.serverName ? String(config.serverName) : ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('javaIp')
          .setLabel('Java IP (e.g. play.server.net or with :port)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(260)
          .setValue(config.javaIp ? String(config.javaIp) : ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('bedrockIp')
          .setLabel('Bedrock IP (leave empty if none)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(260)
          .setValue(config.bedrockIp ? String(config.bedrockIp) : ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('bedrockPort')
          .setLabel('Bedrock port (1-65535, default 19132)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setValue(config.bedrockPort ? String(config.bedrockPort) : '19132'),
      ),
    );
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Configure and publish your Minecraft server connection info')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('setup').setDescription('Set your Java/Bedrock IPs and server name'))
    .addSubcommand((sub) => sub.setName('info').setDescription('View the current server info and guide preview'))
    .addSubcommand((sub) =>
      sub
        .setName('publish')
        .setDescription('Publish the connection guide to a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post the guide in (default: this channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const config = guideService.getConfig(client, guild.id);

    if (sub === 'setup') {
      return interaction.showModal(setupModal(config));
    }

    if (sub === 'info') {
      if (!guideService.isConfigured(config)) {
        return interaction.reply(
          eph({ embeds: [client.brand.info(guild, 'Not set up yet', 'Run `/server setup` to add your Java and Bedrock connection details.')] }),
        );
      }
      const summary = client.brand
        .embed(guild)
        .setTitle('🎮 Server connection info')
        .addFields(
          { name: 'Server name', value: truncate(guideService.displayName(client, guild, config), 200), inline: false },
          { name: '☕ Java IP', value: config.javaIp ? `\`${truncate(config.javaIp, 200)}\`` : '_not set_', inline: true },
          {
            name: '📱 Bedrock',
            value: config.bedrockIp ? `\`${truncate(config.bedrockIp, 200)}:${guideService.parsePort(config.bedrockPort) ?? 19132}\`` : '_not set_',
            inline: true,
          },
        );
      if (config.guideChannelId) summary.addFields({ name: 'Guide channel', value: `<#${config.guideChannelId}>`, inline: false });
      const guide = guideService.buildGuideEmbed(client, guild, config);
      const embeds = guide ? [summary, guide] : [summary];
      return interaction.reply(eph({ embeds }));
    }

    if (sub === 'publish') {
      if (!guideService.isConfigured(config)) {
        return interaction.reply(
          eph({ embeds: [client.brand.error(guild, 'Not set up yet', 'Run `/server setup` before publishing the connection guide.')] }),
        );
      }
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await guideService.publishGuide(client, guild, channel);
      return interaction.editReply({
        embeds: [
          result.ok
            ? client.brand.success(guild, 'Guide published', `The connection guide is live in <#${channel.id}>.`)
            : client.brand.error(guild, 'Publish failed', result.error),
        ],
      });
    }

    return null;
  },
};
