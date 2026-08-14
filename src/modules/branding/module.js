'use strict';

const { STYLES, normalizeStyle } = require('./services/generate');
const { applyGeneration, randSeed, resolveThemeColors } = require('./services/store');

/**
 * Branding module.
 *
 * Owns the `/branding` command, the `branding:` component flow, and generates
 * all branding art with @napi-rs/canvas. Durable state lives in the core-owned
 * `branding` config namespace (DEFAULT_BRANDING in core/embeds.js) plus the
 * generated PNGs under data/branding/<guildId>/. No custom SQLite tables are
 * required.
 *
 * A small cross-module service is exposed so other modules (e.g. /setup) can
 * apply a full branding set programmatically. Always access it defensively:
 *   await client.services.branding?.apply?.(guild, { style, name, tagline })
 */
module.exports = {
  name: 'branding',

  init(client) {
    client.services.branding = {
      /** Available art styles: [{ id, label, emoji, description }]. */
      styles() {
        return STYLES.map((s) => ({ ...s }));
      },

      /** Current committed branding config for a guild. */
      config(guildId) {
        return client.brand.branding(guildId);
      },

      /**
       * Generate and apply a full branding set (logo/banner/avatar/webhook),
       * update the branding config, and refresh managed webhooks.
       * @param {import('discord.js').Guild} guild
       * @param {{ style?:string, colors?:object, name?:string, tagline?:string }} opts
       */
      async apply(guild, opts = {}) {
        if (!guild) return null;
        const colors =
          opts.colors && Number.isInteger(opts.colors.primary)
            ? opts.colors
            : resolveThemeColors(client, guild.id);
        const pending = {
          style: normalizeStyle(opts.style),
          colors,
          name: (opts.name || guild.name || 'SMPbot').slice(0, 80),
          tagline: (opts.tagline || '').slice(0, 60),
          seed: randSeed(),
          scope: 'all',
        };
        return applyGeneration(client, guild, pending);
      },
    };
  },
};
