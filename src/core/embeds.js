'use strict';

const { EmbedBuilder } = require('discord.js');

const DEFAULT_BRANDING = {
  name: 'SMPbot',
  footer: 'SMPbot • Built for SMPs',
  webhookName: null, // falls back to `name`
  webhookAvatarUrl: null, // URL used for webhook avatars
  webhookAvatarPath: null, // local generated file (data/branding/...)
  logoUrl: null,
  bannerUrl: null,
  style: 'blocks', // generated-branding style hint
};

/**
 * Branded embed factory. EVERY user-facing embed goes through this service so
 * the whole bot looks like one cohesive premium product and follows the
 * guild's selected theme.
 */
class BrandService {
  constructor(client) {
    this.client = client;
  }

  _guildId(guildOrId) {
    if (!guildOrId) return null;
    return typeof guildOrId === 'string' ? guildOrId : guildOrId.id;
  }

  /** Guild branding config merged over defaults. */
  branding(guildOrId) {
    const guildId = this._guildId(guildOrId);
    if (!guildId) return { ...DEFAULT_BRANDING };
    return this.client.config.get(guildId, 'branding', DEFAULT_BRANDING);
  }

  /** Base themed embed: primary color, branded footer, timestamp. */
  embed(guildOrId, { color = 'primary', footer = true, timestamp = true } = {}) {
    const guildId = this._guildId(guildOrId);
    const theme = guildId ? this.client.themes.get(guildId) : null;
    const brand = this.branding(guildOrId);
    const e = new EmbedBuilder().setColor(
      typeof color === 'number' ? color : theme?.colors[color] ?? theme?.colors.primary ?? 0x2ecc71,
    );
    if (footer) e.setFooter({ text: brand.footer || `${brand.name} • Built for SMPs`, iconURL: brand.logoUrl ?? undefined });
    if (timestamp) e.setTimestamp();
    return e;
  }

  success(guildOrId, title, description) {
    const e = this.embed(guildOrId, { color: 'success' });
    if (title) e.setTitle(`✅ ${title}`);
    if (description) e.setDescription(description);
    return e;
  }

  error(guildOrId, title, description) {
    const e = this.embed(guildOrId, { color: 'error' });
    if (title) e.setTitle(`❌ ${title}`);
    if (description) e.setDescription(description);
    return e;
  }

  warn(guildOrId, title, description) {
    const e = this.embed(guildOrId, { color: 'warning' });
    if (title) e.setTitle(`⚠️ ${title}`);
    if (description) e.setDescription(description);
    return e;
  }

  info(guildOrId, title, description) {
    const e = this.embed(guildOrId, { color: 'info' });
    if (title) e.setTitle(`ℹ️ ${title}`);
    if (description) e.setDescription(description);
    return e;
  }
}

module.exports = { BrandService, DEFAULT_BRANDING };
