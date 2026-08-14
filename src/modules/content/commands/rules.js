'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { confirm, truncate } = require('../../../core/utils');
const rulesService = require('../services/rules');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function sectionModal(customId, title, prefill = {}) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('emoji')
          .setLabel('Emoji (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(rulesService.LIMITS.emoji)
          .setValue(prefill.emoji ? String(prefill.emoji) : ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Section title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(rulesService.LIMITS.title)
          .setValue(prefill.title ? String(prefill.title) : ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('body')
          .setLabel('Section text')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(rulesService.LIMITS.body)
          .setValue(prefill.body ? String(prefill.body).slice(0, rulesService.LIMITS.body) : ''),
      ),
    );
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Build and publish your server rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Start your rules with prewritten starter packs')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Default channel to publish the rules in')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) => sub.setName('add').setDescription('Add a rule section'))
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit a rule section')
        .addStringOption((opt) => opt.setName('section').setDescription('Section to edit').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a rule section')
        .addStringOption((opt) => opt.setName('section').setDescription('Section to remove').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List your rule sections'))
    .addSubcommand((sub) =>
      sub
        .setName('publish')
        .setDescription('Publish (or republish) the rules to a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to publish in (default: the configured channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'section') return interaction.respond([]);
    const query = String(focused.value ?? '').toLowerCase();
    const sections = rulesService.listSections(interaction.client, interaction.guildId);
    const choices = sections
      .filter((s) => !query || s.title.toLowerCase().includes(query) || s.id.includes(query))
      .slice(0, 25)
      .map((s) => ({ name: truncate(`${s.emoji ? `${s.emoji} ` : ''}${s.title}`, 100), value: s.id }));
    return interaction.respond(choices).catch(() => null);
  },

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      return interaction.showModal(sectionModal('rules:addmodal', 'Add a rule section'));
    }

    if (sub === 'edit') {
      const sectionId = interaction.options.getString('section');
      const section = rulesService.getSection(client, guild.id, sectionId);
      if (!section) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Section not found', 'That rule section does not exist.')] }));
      }
      return interaction.showModal(sectionModal(`rules:editmodal:${section.id}`, 'Edit rule section', section));
    }

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      if (channel) rulesService.saveConfig(client, guild.id, { ...rulesService.getConfig(client, guild.id), channelId: channel.id });

      const menu = new StringSelectMenuBuilder()
        .setCustomId('rules:setup')
        .setPlaceholder('Choose starter rule packs to add...')
        .setMinValues(1)
        .setMaxValues(rulesService.starterList().length)
        .addOptions(
          rulesService.starterList().map((p) => ({
            label: p.label,
            value: p.key,
            description: p.description.slice(0, 100),
            emoji: p.emoji,
          })),
        );
      const embed = client.brand
        .embed(guild)
        .setTitle('📜 Rules setup')
        .setDescription(
          [
            'Pick one or more **starter packs** below to instantly add prewritten, themed rule sections.',
            'You can freely edit them afterwards with `/rules edit`, add more with `/rules add`, then publish with `/rules publish`.',
            channel ? `\nDefault publish channel set to <#${channel.id}>.` : '',
          ].join('\n'),
        );
      return interaction.reply(eph({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] }));
    }

    if (sub === 'remove') {
      const sectionId = interaction.options.getString('section');
      const section = rulesService.getSection(client, guild.id, sectionId);
      if (!section) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Section not found', 'That rule section does not exist.')] }));
      }
      const confirmed = await confirm(interaction, {
        embed: client.brand.warn(guild, 'Remove section?', `**${section.emoji ? `${section.emoji} ` : ''}${section.title}** will be removed. Republish afterwards to update your rules channel.`),
        confirmLabel: 'Remove',
        danger: true,
      });
      if (!confirmed) {
        return interaction.editReply({ embeds: [client.brand.info(guild, 'Cancelled', 'The section was not removed.')] }).catch(() => null);
      }
      rulesService.removeSection(client, guild.id, section.id);
      return interaction.editReply({ embeds: [client.brand.success(guild, 'Section removed', `**${truncate(section.title, 100)}** was removed.`)] }).catch(() => null);
    }

    if (sub === 'list') {
      const sections = rulesService.listSections(client, guild.id);
      if (!sections.length) {
        return interaction.reply(eph({ embeds: [client.brand.info(guild, 'No rules yet', 'Add sections with `/rules setup` or `/rules add`.')] }));
      }
      const embed = client.brand.embed(guild).setTitle('📜 Rule sections');
      for (const [i, s] of sections.slice(0, 25).entries()) {
        embed.addFields({
          name: truncate(`#${i + 1} • ${s.emoji ? `${s.emoji} ` : ''}${s.title}`, 256),
          value: truncate(s.body || '_No details._', 300),
        });
      }
      const config = rulesService.getConfig(client, guild.id);
      if (config.channelId) embed.setFooter({ text: `Publish channel: #${guild.channels.cache.get(config.channelId)?.name ?? config.channelId}` });
      return interaction.reply(eph({ embeds: [embed] }));
    }

    if (sub === 'publish') {
      const config = rulesService.getConfig(client, guild.id);
      const channel =
        interaction.options.getChannel('channel') ??
        (config.channelId ? guild.channels.cache.get(config.channelId) ?? (await guild.channels.fetch(config.channelId).catch(() => null)) : null) ??
        interaction.channel;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await rulesService.publish(client, guild, channel);
      return interaction.editReply({
        embeds: [
          result.ok
            ? client.brand.success(guild, 'Rules published', `**${result.count}** section(s) published in <#${channel.id}>.`)
            : client.brand.error(guild, 'Publish failed', result.error),
        ],
      });
    }

    return null;
  },
};
