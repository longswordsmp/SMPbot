'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const log = require('../../../core/logger');
const { confirm, truncate } = require('../../../core/utils');
const manager = require('../services/manager');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function resolvePanel(client, guildId, input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const panels = manager.listPanels(client, guildId);
  if (/^\d+$/.test(raw)) {
    const byId = panels.find((p) => p.id === Number(raw));
    if (byId) return byId;
  }
  return panels.find((p) => p.name.toLowerCase() === raw.toLowerCase()) ?? null;
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Design and publish ticket panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new ticket panel')
        .addStringOption((opt) => opt.setName('name').setDescription('Internal panel name (unique)').setRequired(true).setMaxLength(32))
        .addStringOption((opt) => opt.setName('title').setDescription('Panel title shown to members').setRequired(true).setMaxLength(256))
        .addStringOption((opt) => opt.setName('description').setDescription('Panel description shown above the categories').setMaxLength(2000))
        .addStringOption((opt) =>
          opt.setName('categories').setDescription('Comma-separated category keys (default: all categories)').setMaxLength(400),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('publish')
        .setDescription('Publish (or republish) a panel to a channel')
        .addStringOption((opt) => opt.setName('panel').setDescription('Panel to publish').setRequired(true).setAutocomplete(true))
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post the panel in (default: here)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List this server\'s ticket panels'))
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a ticket panel')
        .addStringOption((opt) => opt.setName('panel').setDescription('Panel to delete').setRequired(true).setAutocomplete(true)),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'panel') return interaction.respond([]);
    const query = String(focused.value ?? '').toLowerCase();
    const panels = manager.listPanels(interaction.client, interaction.guildId);
    const choices = panels
      .filter((p) => !query || p.name.toLowerCase().includes(query) || String(p.id) === query)
      .slice(0, 25)
      .map((p) => ({ name: truncate(`${p.name} — ${p.title}`, 100), value: String(p.id) }));
    return interaction.respond(choices);
  },

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const name = interaction.options.getString('name').trim();
      const title = interaction.options.getString('title').trim();
      const description = interaction.options.getString('description')?.trim() ?? '';
      const categoriesRaw = interaction.options.getString('categories')?.trim() ?? '';

      if (!name || !title) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Invalid input', 'The panel needs a name and a title.')] }));
      }
      const existing = manager.listPanels(client, guild.id);
      if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Name taken', `A panel named **${name}** already exists.`)] }));
      }
      if (existing.length >= 25) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Too many panels', 'This server already has 25 panels.')] }));
      }

      let categories = [];
      if (categoriesRaw) {
        const keys = categoriesRaw
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean);
        const unknown = keys.filter((k) => !manager.getCategory(client, guild.id, k));
        if (unknown.length) {
          return interaction.reply(
            eph({
              embeds: [
                client.brand.error(
                  guild,
                  'Unknown categories',
                  `These category keys do not exist: ${unknown.map((k) => `\`${k}\``).join(', ')}\nAdd them with \`/ticketconfig category add\` first.`,
                ),
              ],
            }),
          );
        }
        categories = [...new Set(keys)];
      }

      const panel = manager.createPanel(client, guild.id, { name, title, description, categories });
      return interaction.reply(
        eph({
          embeds: [
            client.brand.success(
              guild,
              'Panel created',
              `**${panel.name}** is ready with ${categories.length ? `**${categories.length}** categor${categories.length === 1 ? 'y' : 'ies'}` : '**all** categories'}.\nPublish it with \`/ticketpanel publish\`.`,
            ),
          ],
        }),
      );
    }

    if (sub === 'publish') {
      const panel = resolvePanel(client, guild.id, interaction.options.getString('panel'));
      if (!panel) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Panel not found', 'No panel matches that name or id.')] }));
      }
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel?.isTextBased?.() || channel.guildId !== guild.id) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Invalid channel', 'Pick a text channel in this server.')] }));
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await manager.publishPanel(client, guild, panel, channel);
      return interaction.editReply({
        embeds: [
          res.ok
            ? client.brand.success(guild, 'Panel published', `**${panel.name}** is live in <#${channel.id}>. Its buttons survive restarts.`)
            : client.brand.error(guild, 'Publish failed', res.error),
        ],
      });
    }

    if (sub === 'list') {
      const panels = manager.listPanels(client, guild.id);
      if (!panels.length) {
        return interaction.reply(
          eph({ embeds: [client.brand.info(guild, 'No panels yet', 'Create your first panel with `/ticketpanel create`.')] }),
        );
      }
      const embed = client.brand.embed(guild).setTitle('📋 Ticket panels');
      for (const panel of panels.slice(0, 25)) {
        const cats = panel.categories.length ? panel.categories.map((k) => `\`${k}\``).join(', ') : 'all categories';
        const status = panel.channel_id && panel.message_id ? `Published in <#${panel.channel_id}>` : 'Not published';
        embed.addFields({
          name: `${panel.name} (id ${panel.id})`,
          value: truncate(`**${panel.title}**\n${status} • ${cats}`, 1024),
        });
      }
      return interaction.reply(eph({ embeds: [embed] }));
    }

    if (sub === 'delete') {
      const panel = resolvePanel(client, guild.id, interaction.options.getString('panel'));
      if (!panel) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Panel not found', 'No panel matches that name or id.')] }));
      }
      const confirmed = await confirm(interaction, {
        embed: client.brand.warn(guild, 'Delete panel?', `**${panel.name}** and its published message will be removed. Existing tickets are unaffected.`),
        confirmLabel: 'Delete panel',
        danger: true,
      });
      if (!confirmed) {
        return interaction.editReply({ embeds: [client.brand.info(guild, 'Cancelled', 'The panel was not deleted.')] }).catch(() => null);
      }
      if (panel.channel_id && panel.message_id) {
        try {
          const channel = guild.channels.cache.get(panel.channel_id) ?? (await guild.channels.fetch(panel.channel_id).catch(() => null));
          const message = channel?.messages ? await channel.messages.fetch(panel.message_id).catch(() => null) : null;
          if (message) await message.delete().catch(() => null);
        } catch (err) {
          log.debug('Panel message cleanup failed:', err?.message ?? err);
        }
      }
      manager.deletePanelRow(client, guild.id, panel.id);
      await manager.logTicket(client, guild, {
        title: '📋 Ticket panel deleted',
        color: 'warning',
        description: `Panel **${panel.name}** was deleted by <@${interaction.user.id}>.`,
      });
      return interaction.editReply({ embeds: [client.brand.success(guild, 'Panel deleted', `**${panel.name}** has been removed.`)] }).catch(() => null);
    }

    return null;
  },
};
