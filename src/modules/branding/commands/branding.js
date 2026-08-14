'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');

const { safeReply, confirm } = require('../../../core/utils');
const { DEFAULT_BRANDING } = require('../../../core/embeds');
const log = require('../../../core/logger');
const { STYLES, normalizeStyle, styleLabel, generateAsset } = require('../services/generate');
const {
  writeAsset,
  removeGuildAssets,
  setPending,
  randSeed,
  resolveThemeColors,
  styleSelectMenu,
  buildPreview,
  normalizeToAvatar,
} = require('../services/store');

const STYLE_CHOICES = STYLES.map((s) => ({ name: `${s.emoji} ${s.label}`, value: s.id }));
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

module.exports = {
  cooldown: 5,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('branding')
    .setDescription('Generate a custom logo, banner, and webhook identity for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('setup').setDescription('Guided wizard: generate a matching logo, banner, and webhook avatar'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('logo')
        .setDescription('Quickly generate a server logo')
        .addStringOption((opt) => {
          opt.setName('style').setDescription('Art style');
          for (const c of STYLE_CHOICES) opt.addChoices(c);
          return opt;
        })
        .addStringOption((opt) => opt.setName('text').setDescription('Server name / monogram source').setMaxLength(80)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('banner')
        .setDescription('Quickly generate a server banner')
        .addStringOption((opt) => {
          opt.setName('style').setDescription('Art style');
          for (const c of STYLE_CHOICES) opt.addChoices(c);
          return opt;
        })
        .addStringOption((opt) => opt.setName('text').setDescription('Banner title').setMaxLength(80)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('webhook')
        .setDescription('Set the webhook display name and/or regenerate the webhook avatar')
        .addStringOption((opt) => opt.setName('name').setDescription('Webhook display name').setMaxLength(80))
        .addStringOption((opt) => {
          opt.setName('style').setDescription('Art style for the generated avatar');
          for (const c of STYLE_CHOICES) opt.addChoices(c);
          return opt;
        })
        .addAttachmentOption((opt) =>
          opt.setName('image').setDescription('Your own PNG/JPEG avatar image (under 2 MB)'),
        ),
    )
    .addSubcommand((sub) => sub.setName('theme').setDescription('How to change the colors used by branding'))
    .addSubcommand((sub) => sub.setName('reset').setDescription('Restore the default SMPbot branding')),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const guildId = guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') return runSetup(interaction, client, guild, guildId);
    if (sub === 'logo' || sub === 'banner') return runQuick(interaction, client, guild, guildId, sub);
    if (sub === 'webhook') return runWebhook(interaction, client, guild, guildId);
    if (sub === 'theme') return runThemeShortcut(interaction, client, guild);
    if (sub === 'reset') return runReset(interaction, client, guild, guildId);
    return null;
  },
};

async function runSetup(interaction, client, guild, guildId) {
  const current = client.brand.branding(guildId);
  const embed = client.brand
    .embed(guild)
    .setTitle('🎨 Branding setup')
    .setDescription(
      [
        'Generate a matching **logo**, **banner**, and **webhook avatar** for your server — all rendered from your theme colors.',
        '',
        '**1.** Pick an art style below.',
        '**2.** Choose theme colors or enter custom hex colors.',
        '**3.** Enter your server name and an optional tagline.',
        '',
        'You can preview, regenerate variants, and change style before applying.',
      ].join('\n'),
    );
  return interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(styleSelectMenu(normalizeStyle(current.style)))],
    flags: MessageFlags.Ephemeral,
  });
}

async function runQuick(interaction, client, guild, guildId, scope) {
  const style = normalizeStyle(interaction.options.getString('style') || client.brand.branding(guildId).style);
  const text = (interaction.options.getString('text') || '').trim().slice(0, 80) || guild.name;
  const brand = client.brand.branding(guildId);
  const colors = brand.colors && Number.isInteger(brand.colors.primary) ? brand.colors : resolveThemeColors(client, guildId);

  const pending = {
    style,
    colors,
    name: text,
    tagline: scope === 'banner' ? brand.tagline || '' : '',
    seed: randSeed(),
    scope,
  };
  setPending(client, guildId, interaction.user.id, pending);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const preview = buildPreview(client, guild, pending);
  return interaction.editReply(preview);
}

async function runWebhook(interaction, client, guild, guildId) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const nameOpt = (interaction.options.getString('name') || '').trim().slice(0, 80);
  const style = normalizeStyle(interaction.options.getString('style') || client.brand.branding(guildId).style);
  const image = interaction.options.getAttachment('image');

  if (image) {
    const contentType = String(image.contentType || '').toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(contentType)) {
      return interaction.editReply({
        embeds: [client.brand.error(guild, 'Unsupported image', 'Please upload a **PNG** or **JPEG** image.')],
      });
    }
    if ((image.size || 0) > MAX_IMAGE_BYTES) {
      return interaction.editReply({
        embeds: [client.brand.error(guild, 'Image too large', 'The image must be under **2 MB**.')],
      });
    }

    let png;
    try {
      const res = await fetch(image.url);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      png = await normalizeToAvatar(buf);
    } catch (err) {
      log.debug(`branding: webhook image processing failed for ${guildId}:`, err?.message ?? err);
      return interaction.editReply({
        embeds: [client.brand.error(guild, 'Could not process image', 'That image could not be downloaded or read. Try another file.')],
      });
    }

    const webhookFull = writeAsset(guildId, 'webhook.png', png);
    writeAsset(guildId, 'logo.png', png);
    const patch = { webhookAvatarPath: webhookFull, logoUrl: null };
    if (nameOpt) {
      patch.webhookName = nameOpt;
      patch.name = nameOpt;
    }
    client.config.update(guildId, 'branding', patch);
    await refreshAndLog(client, guild, 'Custom webhook avatar applied.');

    const emb = client.brand
      .success(
        guild,
        'Webhook updated',
        nameOpt ? `Webhook name set to **${nameOpt}** and avatar updated from your image.` : 'Webhook avatar updated from your image.',
      )
      .setThumbnail('attachment://webhook.png');
    return interaction.editReply({ embeds: [emb], files: [new AttachmentBuilder(png, { name: 'webhook.png' })] });
  }

  // No image: regenerate the webhook avatar (and/or set the name).
  const brand = client.brand.branding(guildId);
  const colors = brand.colors && Number.isInteger(brand.colors.primary) ? brand.colors : resolveThemeColors(client, guildId);
  const nm = nameOpt || brand.name || guild.name;
  const png = generateAsset({ style, kind: 'webhook', colors, name: nm, tagline: '', seed: randSeed() });
  const webhookFull = writeAsset(guildId, 'webhook.png', png);

  const patch = { style, webhookAvatarPath: webhookFull };
  if (nameOpt) {
    patch.webhookName = nameOpt;
    patch.name = nameOpt;
  }
  client.config.update(guildId, 'branding', patch);
  await refreshAndLog(client, guild, `Regenerated webhook avatar (${styleLabel(style)}).`);

  const emb = client.brand
    .success(
      guild,
      'Webhook updated',
      `Regenerated the webhook avatar in the **${styleLabel(style)}** style.${nameOpt ? ` Name set to **${nameOpt}**.` : ''}`,
    )
    .setThumbnail('attachment://webhook.png');
  return interaction.editReply({ embeds: [emb], files: [new AttachmentBuilder(png, { name: 'webhook.png' })] });
}

async function runThemeShortcut(interaction, client, guild) {
  const active = client.themes.get(guild.id);
  const embed = client.brand
    .info(
      guild,
      'Branding colors follow your theme',
      [
        `Branding art is rendered from this server's active theme — currently **${active.emoji} ${active.label}**.`,
        '',
        'To change the colors:',
        '• Run **`/theme select`** to pick one of 14 built-in themes.',
        '• Run **`/theme custom`** to set your own hex colors.',
        '',
        'Then run **`/branding setup`** to regenerate matching art, or use **`/branding setup`** with custom colors to override the theme just for branding.',
      ].join('\n'),
    );
  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function runReset(interaction, client, guild, guildId) {
  const confirmed = await confirm(interaction, {
    embed: client.brand.warn(
      guild,
      'Reset branding?',
      'This restores the **default SMPbot branding**, removes generated logo/banner/avatar files, and reverts managed webhooks to the default identity.',
    ),
    confirmLabel: 'Reset',
    danger: true,
  });

  if (!confirmed) {
    return safeReply(interaction, {
      embeds: [client.brand.info(guild, 'Cancelled', 'Branding was not changed.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  client.config.set(guildId, 'branding', { ...DEFAULT_BRANDING });
  removeGuildAssets(guildId);
  await refreshAndLog(client, guild, 'Branding reset to defaults.');

  return safeReply(interaction, {
    embeds: [client.brand.success(guild, 'Branding reset', 'Default SMPbot branding has been restored.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function refreshAndLog(client, guild, message) {
  try {
    await client.hooks.refreshGuild(guild);
  } catch (err) {
    log.debug(`branding: refreshGuild failed for ${guild.id}:`, err?.message ?? err);
  }
  try {
    await client.logs.send(guild, 'webhooks', { embeds: [client.brand.info(guild, 'Branding updated', message)] });
  } catch (err) {
    log.debug(`branding: log send failed for ${guild.id}:`, err?.message ?? err);
  }
}
