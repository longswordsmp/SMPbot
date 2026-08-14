'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { isSnowflake } = require('../../../core/utils');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

/** Parse a message id or a full message link into { channelId, messageId }. */
function parseMessageRef(raw, fallbackChannelId) {
  const value = String(raw ?? '').trim();
  const link = value.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
  if (link) return { channelId: link[2], messageId: link[3] };
  if (isSnowflake(value)) return { channelId: fallbackChannelId, messageId: value };
  return null;
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('publish')
    .setDescription('Publish (crosspost) a message from an announcement channel to all followers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) => opt.setName('message').setDescription('Message ID or message link to publish').setRequired(true))
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel the message is in (default: this channel)')
        .addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;

    const fallbackChannel = interaction.options.getChannel('channel') ?? interaction.channel;
    const ref = parseMessageRef(interaction.options.getString('message'), fallbackChannel?.id);
    if (!ref) {
      return interaction.reply(
        eph({ embeds: [client.brand.error(guild, 'Invalid message', 'Provide a valid message ID or a message link.')] }),
      );
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel =
      guild.channels.cache.get(ref.channelId) ?? (await guild.channels.fetch(ref.channelId).catch(() => null));
    if (!channel || channel.guildId !== guild.id) {
      return interaction.editReply({ embeds: [client.brand.error(guild, 'Channel not found', 'I could not find that channel in this server.')] });
    }
    if (channel.type !== ChannelType.GuildAnnouncement) {
      return interaction.editReply({
        embeds: [
          client.brand.error(
            guild,
            'Not an announcement channel',
            `Only messages in **announcement channels** can be published. ${channel} is a normal text channel.`,
          ),
        ],
      });
    }

    const me = guild.members.me;
    const perms = me ? channel.permissionsFor(me) : null;
    if (!perms?.has(PermissionFlagsBits.ManageMessages) || !perms?.has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({
        embeds: [client.brand.error(guild, 'Missing permissions', `I need **Manage Messages** and **Send Messages** in ${channel} to publish.`)],
      });
    }

    const message = await channel.messages.fetch(ref.messageId).catch(() => null);
    if (!message) {
      return interaction.editReply({ embeds: [client.brand.error(guild, 'Message not found', 'That message no longer exists or is in a different channel.')] });
    }

    try {
      await message.crosspost();
    } catch (err) {
      // 40033: already crossposted. Everything else → generic branded failure.
      if (err?.code === 40033) {
        return interaction.editReply({ embeds: [client.brand.warn(guild, 'Already published', 'That message has already been published to followers.')] });
      }
      return interaction.editReply({
        embeds: [client.brand.error(guild, 'Could not publish', 'I was unable to publish that message. Make sure it is a fresh message in an announcement channel.')],
      });
    }

    return interaction.editReply({
      embeds: [
        client.brand.success(
          guild,
          'Message published',
          `The message in ${channel} was crossposted to all following servers.\n[Jump to message](https://discord.com/channels/${guild.id}/${channel.id}/${message.id})`,
        ),
      ],
    });
  },
};
