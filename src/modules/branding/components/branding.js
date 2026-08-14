'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const { parseColor } = require('../../../core/utils');
const { normalizeStyle, styleLabel, lighten, darken } = require('../services/generate');
const {
  getPending,
  setPending,
  clearPending,
  randSeed,
  resolveThemeColors,
  styleSelectMenu,
  colorSourceRow,
  colorModal,
  textModal,
  buildPreview,
  applyGeneration,
} = require('../services/store');

function hex6(int) {
  return (Number(int) & 0xffffff).toString(16).padStart(6, '0');
}

function encodeColors(colors) {
  return [colors.primary, colors.secondary, colors.accent].map(hex6).join('-');
}

function decodeColors(client, guildId, colorspec) {
  if (!colorspec || colorspec === 'theme') return resolveThemeColors(client, guildId);
  const parts = colorspec.split('-').map((p) => parseColor(p));
  const primary = Number.isInteger(parts[0]) ? parts[0] : client.themes.color(guildId, 'primary');
  return {
    primary,
    secondary: Number.isInteger(parts[1]) ? parts[1] : darken(primary, 0.35),
    accent: Number.isInteger(parts[2]) ? parts[2] : lighten(primary, 0.3),
  };
}

function expired(interaction, client) {
  return interaction.reply({
    embeds: [
      client.brand.warn(interaction.guild, 'Preview expired', 'This branding preview is no longer active. Run `/branding setup` again.'),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = {
  prefix: 'branding',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    const guildId = guild?.id;
    const userId = interaction.user.id;
    const [action] = args;

    if (!guildId || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to change branding.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ---- Style select (setup step 1, and "Change style") ----
    if (action === 'style' && interaction.isStringSelectMenu()) {
      const style = normalizeStyle(interaction.values[0]);
      const pending = getPending(client, guildId, userId);

      // Coming from "Change style": we already have text + colors — regenerate.
      if (pending && pending.name) {
        const next = { ...pending, style, seed: randSeed() };
        setPending(client, guildId, userId, next);
        await interaction.deferUpdate();
        return interaction.editReply({ ...buildPreview(client, guild, next), attachments: [] });
      }

      // Fresh flow: proceed to color source.
      const embed = client.brand
        .embed(guild)
        .setTitle('🎨 Branding setup')
        .setDescription(`**Style:** ${styleLabel(style)}\n\nWhere should the colors come from?`);
      return interaction.update({ embeds: [embed], components: [colorSourceRow(style)] });
    }

    // ---- Color source select (setup step 2) ----
    if (action === 'colorsrc' && interaction.isStringSelectMenu()) {
      const style = normalizeStyle(args[1]);
      const src = interaction.values[0];
      if (src === 'custom') return interaction.showModal(colorModal(style));
      return interaction.showModal(textModal(style, 'theme'));
    }

    // ---- Custom color modal (setup step 2b) ----
    if (action === 'colormodal' && interaction.isModalSubmit()) {
      const style = normalizeStyle(args[1]);
      const primary = parseColor(interaction.fields.getTextInputValue('primary'));
      if (primary === null) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Invalid color', 'The primary color must be a hex value like `#2ECC71`.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      const secondary = parseColor(interaction.fields.getTextInputValue('secondary') || '');
      const accent = parseColor(interaction.fields.getTextInputValue('accent') || '');
      const colors = {
        primary,
        secondary: secondary !== null ? secondary : darken(primary, 0.35),
        accent: accent !== null ? accent : lighten(primary, 0.3),
      };
      const colorspec = encodeColors(colors);

      const embed = client.brand
        .embed(guild, { color: colors.primary })
        .setTitle('🖌️ Colors set')
        .setDescription('Now enter your server name and an optional tagline.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`branding:tostep:${style}:${colorspec}`)
          .setLabel('Enter name & tagline')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Primary),
      );
      if (typeof interaction.isFromMessage === 'function' && interaction.isFromMessage()) {
        return interaction.update({ embeds: [embed], components: [row] });
      }
      return interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    }

    // ---- Continue button after custom colors ----
    if (action === 'tostep' && interaction.isButton()) {
      const style = normalizeStyle(args[1]);
      return interaction.showModal(textModal(style, args[2] || 'theme'));
    }

    // ---- Text modal (setup step 3) → build preview ----
    if (action === 'textmodal' && interaction.isModalSubmit()) {
      const style = normalizeStyle(args[1]);
      const colors = decodeColors(client, guildId, args[2]);
      const name = (interaction.fields.getTextInputValue('name') || '').trim().slice(0, 80) || guild.name;
      const tagline = (interaction.fields.getTextInputValue('tagline') || '').trim().slice(0, 60);
      const pending = { style, colors, name, tagline, seed: randSeed(), scope: 'all' };
      setPending(client, guildId, userId, pending);

      if (typeof interaction.isFromMessage === 'function' && interaction.isFromMessage()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
      return interaction.editReply({ ...buildPreview(client, guild, pending), attachments: [] });
    }

    // ---- Apply ----
    if (action === 'apply' && interaction.isButton()) {
      const pending = getPending(client, guildId, userId);
      if (!pending) return expired(interaction, client);
      await interaction.deferUpdate();
      const scope = await applyGeneration(client, guild, pending);
      clearPending(client, guildId, userId);
      const desc =
        scope === 'all'
          ? 'Your logo, banner, and webhook avatar are saved. Existing webhooks have been refreshed to use the new identity.'
          : scope === 'logo'
            ? 'Your logo is saved and the webhook avatar was refreshed to match.'
            : 'Your banner is saved.';
      return interaction.editReply({
        embeds: [client.brand.success(guild, 'Branding applied', desc)],
        components: [],
        files: [],
        attachments: [],
      });
    }

    // ---- Regenerate (fresh variant, same params) ----
    if (action === 'regen' && interaction.isButton()) {
      const pending = getPending(client, guildId, userId);
      if (!pending) return expired(interaction, client);
      const next = { ...pending, seed: randSeed() };
      setPending(client, guildId, userId, next);
      await interaction.deferUpdate();
      return interaction.editReply({ ...buildPreview(client, guild, next), attachments: [] });
    }

    // ---- Change style (reopen the style picker, keep text + colors) ----
    if (action === 'changestyle' && interaction.isButton()) {
      const pending = getPending(client, guildId, userId);
      if (!pending) return expired(interaction, client);
      const embed = client.brand
        .embed(guild)
        .setTitle('🎨 Change style')
        .setDescription('Pick a new art style — your server name, tagline, and colors are kept.');
      return interaction.update({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(styleSelectMenu(pending.style))],
        files: [],
        attachments: [],
      });
    }

    return null;
  },
};
