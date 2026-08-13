'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { THEMES } = require('../../../core/themes');
const { intToHex } = require('../../../core/utils');

function themePreviewEmbeds(client, guild, name) {
  const def = THEMES[name];
  const active = client.themes.get(guild.id);
  const colors = name === active.name ? active.colors : { ...def.colors, success: 0x2ecc71, error: 0xe74c3c, warning: 0xf39c12, info: 0x3498db };
  const main = client.brand
    .embed(guild, { color: colors.primary })
    .setTitle(`${def.emoji} ${def.label} theme`)
    .setDescription(def.description)
    .addFields(
      { name: 'Primary', value: `\`${intToHex(colors.primary)}\``, inline: true },
      { name: 'Secondary', value: `\`${intToHex(colors.secondary)}\``, inline: true },
      { name: 'Accent', value: `\`${intToHex(colors.accent)}\``, inline: true },
    );
  const success = client.brand.embed(guild, { color: colors.success, footer: false, timestamp: false }).setDescription('✅ This is a **success** message.');
  const warning = client.brand.embed(guild, { color: colors.warning, footer: false, timestamp: false }).setDescription('⚠️ This is a **warning** message.');
  const error = client.brand.embed(guild, { color: colors.error, footer: false, timestamp: false }).setDescription('❌ This is an **error** message.');
  return [main, success, warning, error];
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('theme')
    .setDescription('Choose the color theme used across every SMPbot message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('select').setDescription('Pick one of the 14 built-in SMPbot themes'))
    .addSubcommand((sub) =>
      sub
        .setName('preview')
        .setDescription('Preview a theme without applying it')
        .addStringOption((opt) => {
          opt.setName('theme').setDescription('Theme to preview').setRequired(true);
          for (const [key, def] of Object.entries(THEMES)) opt.addChoices({ name: `${def.emoji} ${def.label}`, value: key });
          return opt;
        }),
    )
    .addSubcommand((sub) => sub.setName('custom').setDescription('Create a fully custom color theme')),

  async execute(interaction) {
    const client = interaction.client;
    const sub = interaction.options.getSubcommand();

    if (sub === 'preview') {
      const name = interaction.options.getString('theme');
      return interaction.reply({ embeds: themePreviewEmbeds(client, interaction.guild, name), flags: MessageFlags.Ephemeral });
    }

    if (sub === 'custom') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('theme:custom').setLabel('Open custom theme editor').setEmoji('🎨').setStyle(ButtonStyle.Primary),
      );
      return interaction.reply({
        embeds: [
          client.brand.info(
            interaction.guild,
            'Custom theme',
            'Design your own SMPbot theme. You will be asked for **primary**, **secondary**, and **accent** hex colors (e.g. `#00FFAA`).',
          ),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    // select
    const active = client.themes.get(interaction.guild.id);
    const menu = new StringSelectMenuBuilder()
      .setCustomId('theme:select')
      .setPlaceholder('Choose a theme...')
      .addOptions(
        Object.entries(THEMES).map(([key, def]) => ({
          label: def.label,
          value: key,
          description: def.description.slice(0, 100),
          emoji: def.emoji,
          default: key === active.name,
        })),
      );
    const embed = client.brand
      .embed(interaction.guild)
      .setTitle('🖌️ SMPbot theme')
      .setDescription(
        `Current theme: **${active.emoji} ${active.label}**\n\nThe theme controls the colors of every embed, webhook message, panel, and announcement SMPbot sends in this server.`,
      );
    return interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
