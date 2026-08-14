'use strict';

/**
 * Branding persistence + shared UI builders.
 *
 * All durable state lives in SQLite via the `branding` config namespace:
 *  - committed branding fields (name, webhookName, style, webhookAvatarPath,
 *    colors, tagline) that the rest of the bot reads through client.brand.
 *  - a per-user `pending` working set for the multi-step setup flow, so the
 *    flow needs no in-memory state (every choice is either in the customId or
 *    persisted here).
 *
 * Generated PNGs are written under DATA_DIR/branding/<guildId>/.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const { DATA_DIR } = require('../../../core/database');
const { DEFAULT_BRANDING } = require('../../../core/embeds');
const log = require('../../../core/logger');
const {
  STYLES,
  STYLE_IDS,
  normalizeStyle,
  styleLabel,
  generateAsset,
} = require('./generate');

const ASSET_FILES = ['logo.png', 'banner.png', 'avatar.png', 'webhook.png'];

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

function ensureGuildDir(guildId) {
  const dir = path.join(DATA_DIR, 'branding', String(guildId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function assetPath(guildId, file) {
  return path.join(ensureGuildDir(guildId), file);
}

function writeAsset(guildId, file, buffer) {
  const full = path.join(ensureGuildDir(guildId), file);
  fs.writeFileSync(full, buffer);
  return full;
}

function removeGuildAssets(guildId) {
  const dir = path.join(DATA_DIR, 'branding', String(guildId));
  for (const file of ASSET_FILES) {
    try {
      fs.rmSync(path.join(dir, file), { force: true });
    } catch (err) {
      log.debug(`branding: failed to remove ${file} for ${guildId}:`, err?.message ?? err);
    }
  }
}

// ---------------------------------------------------------------------------
// Pending working-set (per user) inside the branding namespace
// ---------------------------------------------------------------------------

function getPending(client, guildId, userId) {
  const b = client.config.get(guildId, 'branding', DEFAULT_BRANDING);
  const p = b.pending && b.pending[userId];
  return p && typeof p === 'object' ? p : null;
}

function setPending(client, guildId, userId, params) {
  client.config.update(guildId, 'branding', { pending: { [userId]: params } });
}

function clearPending(client, guildId, userId) {
  // Rewrite the stored value directly rather than deep-merging `null` over an
  // object (the core deepMerge throws on merging null onto an object). `get`
  // with empty defaults returns a fresh clone of the full stored namespace.
  const current = client.config.get(guildId, 'branding', {});
  if (!current.pending || !(userId in current.pending)) return;
  delete current.pending[userId];
  client.config.set(guildId, 'branding', current);
}

function randSeed() {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

/** Resolve the color set for a guild: stored branding colors, else active theme. */
function resolveThemeColors(client, guildId) {
  const t = client.themes.get(guildId).colors;
  return { primary: t.primary, secondary: t.secondary, accent: t.accent };
}

// ---------------------------------------------------------------------------
// UI builders (shared between the command and the component handler)
// ---------------------------------------------------------------------------

function styleSelectMenu(currentStyle) {
  return new StringSelectMenuBuilder()
    .setCustomId('branding:style')
    .setPlaceholder('Choose an art style...')
    .addOptions(
      STYLES.map((s) => ({
        label: s.label,
        value: s.id,
        description: s.description.slice(0, 100),
        emoji: s.emoji,
        default: s.id === currentStyle,
      })),
    );
}

function colorSourceRow(style) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`branding:colorsrc:${style}`)
    .setPlaceholder('Choose colors...')
    .addOptions(
      { label: 'Theme colors', value: 'theme', emoji: '🎯', description: "Use this server's active theme colors" },
      { label: 'Custom colors', value: 'custom', emoji: '🖌️', description: 'Enter your own hex colors' },
    );
  return new ActionRowBuilder().addComponents(menu);
}

function colorModal(style) {
  return new ModalBuilder()
    .setCustomId(`branding:colormodal:${style}`)
    .setTitle('Custom branding colors')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('primary')
          .setLabel('Primary color (hex, e.g. #2ECC71)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(7)
          .setPlaceholder('#2ECC71'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('secondary')
          .setLabel('Secondary color (hex, optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setPlaceholder('#1E8E4E'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('accent')
          .setLabel('Accent color (hex, optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setPlaceholder('#A9DFBF'),
      ),
    );
}

function textModal(style, colorspec) {
  return new ModalBuilder()
    .setCustomId(`branding:textmodal:${style}:${colorspec}`)
    .setTitle('Server branding text')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Server name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
          .setPlaceholder('e.g. Emerald SMP'),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tagline')
          .setLabel('Tagline (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(60)
          .setPlaceholder('e.g. Survival • Community • Since 2024'),
      ),
    );
}

function previewButtons(scope) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('branding:apply').setLabel('Apply').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('branding:regen').setLabel('Regenerate').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
  );
  if (scope === 'all') {
    row.addComponents(
      new ButtonBuilder().setCustomId('branding:changestyle').setLabel('Change style').setEmoji('🎨').setStyle(ButtonStyle.Primary),
    );
  }
  return [row];
}

// ---------------------------------------------------------------------------
// Preview + apply
// ---------------------------------------------------------------------------

function attachment(buffer, name) {
  return new AttachmentBuilder(buffer, { name });
}

/**
 * Build the ephemeral preview payload ({ embeds, files, components }) for a
 * pending generation. Only renders the assets the scope needs.
 */
function buildPreview(client, guild, pending) {
  const scope = pending.scope || 'all';
  const files = [];
  const embeds = [];
  const styleName = styleLabel(pending.style);
  const gid = guild.id;

  if (scope === 'all') {
    const banner = generateAsset({ ...pending, kind: 'banner' });
    const logo = generateAsset({ ...pending, kind: 'logo' });
    const avatar = generateAsset({ ...pending, kind: 'avatar' });
    files.push(attachment(banner, 'banner.png'), attachment(logo, 'logo.png'), attachment(avatar, 'avatar.png'));
    embeds.push(
      client.brand
        .embed(gid)
        .setTitle(`🎨 Branding preview — ${pending.name}`)
        .setDescription(
          [
            `**Style:** ${styleName}`,
            pending.tagline ? `**Tagline:** ${pending.tagline}` : null,
            '',
            'Below: banner, logo, and webhook avatar. Use the buttons to apply, regenerate a fresh variant, or change the style.',
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .setImage('attachment://banner.png'),
      client.brand.embed(gid, { footer: false, timestamp: false }).setTitle('Logo').setImage('attachment://logo.png'),
      client.brand.embed(gid, { footer: false, timestamp: false }).setTitle('Webhook avatar').setImage('attachment://avatar.png'),
    );
  } else if (scope === 'logo') {
    const logo = generateAsset({ ...pending, kind: 'logo' });
    files.push(attachment(logo, 'logo.png'));
    embeds.push(
      client.brand
        .embed(gid)
        .setTitle('🖼️ Logo preview')
        .setDescription(`**Style:** ${styleName}\n\nApply saves the logo and refreshes your webhook avatar to match.`)
        .setImage('attachment://logo.png'),
    );
  } else {
    const banner = generateAsset({ ...pending, kind: 'banner' });
    files.push(attachment(banner, 'banner.png'));
    embeds.push(
      client.brand
        .embed(gid)
        .setTitle('🏷️ Banner preview')
        .setDescription(`**Style:** ${styleName}`)
        .setImage('attachment://banner.png'),
    );
  }

  return { embeds, files, components: previewButtons(scope) };
}

/**
 * Persist a pending generation: write PNG files, update the branding config,
 * refresh managed webhooks, and emit a log entry. Returns the applied scope.
 */
async function applyGeneration(client, guild, pending) {
  const scope = pending.scope || 'all';
  const guildId = guild.id;
  const patch = { style: normalizeStyle(pending.style) };

  if (scope === 'all') {
    writeAsset(guildId, 'logo.png', generateAsset({ ...pending, kind: 'logo' }));
    writeAsset(guildId, 'banner.png', generateAsset({ ...pending, kind: 'banner' }));
    writeAsset(guildId, 'avatar.png', generateAsset({ ...pending, kind: 'avatar' }));
    const webhookFull = writeAsset(guildId, 'webhook.png', generateAsset({ ...pending, kind: 'webhook' }));
    patch.name = pending.name;
    patch.webhookName = (pending.name || '').slice(0, 80) || null;
    patch.webhookAvatarPath = webhookFull;
    patch.logoUrl = null;
    patch.bannerUrl = null;
    patch.colors = pending.colors;
    patch.tagline = pending.tagline || null;
  } else if (scope === 'logo') {
    writeAsset(guildId, 'logo.png', generateAsset({ ...pending, kind: 'logo' }));
    const webhookFull = writeAsset(guildId, 'webhook.png', generateAsset({ ...pending, kind: 'webhook' }));
    patch.webhookAvatarPath = webhookFull;
    patch.logoUrl = null;
    patch.colors = pending.colors;
    if (pending.name) patch.name = pending.name;
  } else if (scope === 'banner') {
    writeAsset(guildId, 'banner.png', generateAsset({ ...pending, kind: 'banner' }));
    patch.bannerUrl = null;
    patch.colors = pending.colors;
  }

  client.config.update(guildId, 'branding', patch);

  try {
    await client.hooks.refreshGuild(guild);
  } catch (err) {
    log.debug(`branding: refreshGuild failed for ${guildId}:`, err?.message ?? err);
  }

  try {
    await client.logs.send(guild, 'server', {
      embeds: [
        client.brand.info(
          guild,
          'Branding updated',
          `Generated **${scope}** assets in the **${styleLabel(patch.style)}** style.`,
        ),
      ],
    });
  } catch (err) {
    log.debug(`branding: log send failed for ${guildId}:`, err?.message ?? err);
  }

  return scope;
}

/**
 * Load an owner-supplied image and normalize it to a 512x512 PNG (cover fit),
 * used for custom webhook avatars / logos.
 */
async function normalizeToAvatar(buffer) {
  const img = await loadImage(buffer);
  const size = 512;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  const scale = Math.max(size / img.width, size / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return canvas.toBuffer('image/png');
}

module.exports = {
  ASSET_FILES,
  STYLE_IDS,
  ensureGuildDir,
  assetPath,
  writeAsset,
  removeGuildAssets,
  getPending,
  setPending,
  clearPending,
  randSeed,
  resolveThemeColors,
  styleSelectMenu,
  colorSourceRow,
  colorModal,
  textModal,
  previewButtons,
  buildPreview,
  applyGeneration,
  normalizeToAvatar,
};
