'use strict';

/**
 * SMPbot theme engine. Fourteen built-in Minecraft-inspired themes plus a
 * fully custom theme. A theme controls every color the bot renders: embeds,
 * webhook messages, panels, buttons where possible, and status colors.
 */

const THEMES = {
  emerald: {
    label: 'Emerald',
    emoji: '💚',
    description: 'Lush emerald green — the classic SMP look.',
    colors: { primary: 0x2ecc71, secondary: 0x1e8e4e, accent: 0xa9dfbf },
  },
  diamond: {
    label: 'Diamond',
    emoji: '💎',
    description: 'Crisp diamond cyan with icy sparkle.',
    colors: { primary: 0x3ec6e0, secondary: 0x1f9bb5, accent: 0xbdefff },
  },
  nether: {
    label: 'Nether',
    emoji: '🔥',
    description: 'Molten reds and dark basalt of the Nether.',
    colors: { primary: 0xb02e26, secondary: 0x7a1f1a, accent: 0xff8c66 },
  },
  end: {
    label: 'End',
    emoji: '🌌',
    description: 'Void purples and endstone glow of the End.',
    colors: { primary: 0x8a4fbe, secondary: 0x4b2d6b, accent: 0xd9c7f2 },
  },
  redstone: {
    label: 'Redstone',
    emoji: '🟥',
    description: 'Powered redstone crimson with circuit energy.',
    colors: { primary: 0xe74c3c, secondary: 0x99271b, accent: 0xffb3ab },
  },
  ocean: {
    label: 'Ocean',
    emoji: '🌊',
    description: 'Deep ocean blues and prismarine tones.',
    colors: { primary: 0x2980b9, secondary: 0x1a5276, accent: 0xa9cce3 },
  },
  midnight: {
    label: 'Midnight',
    emoji: '🌙',
    description: 'Sleek dark slate for a premium night look.',
    colors: { primary: 0x2c3e50, secondary: 0x1b2631, accent: 0x85929e },
  },
  purple: {
    label: 'Purple',
    emoji: '💜',
    description: 'Rich amethyst purple with soft highlights.',
    colors: { primary: 0x9b59b6, secondary: 0x6c3483, accent: 0xd7bde2 },
  },
  gold: {
    label: 'Gold',
    emoji: '🪙',
    description: 'Gleaming gold-ingot warmth and luxury.',
    colors: { primary: 0xf1c40f, secondary: 0xb7950b, accent: 0xf9e79f },
  },
  crimson: {
    label: 'Crimson',
    emoji: '🍄',
    description: 'Crimson forest reds with warped contrast.',
    colors: { primary: 0xdc143c, secondary: 0x8e0e27, accent: 0xf1948a },
  },
  forest: {
    label: 'Forest',
    emoji: '🌲',
    description: 'Deep taiga greens and mossy calm.',
    colors: { primary: 0x228b22, secondary: 0x145214, accent: 0x82c982 },
  },
  ice: {
    label: 'Ice',
    emoji: '🧊',
    description: 'Frosted glacier blues and packed-ice white.',
    colors: { primary: 0x7fdbff, secondary: 0x3aa8cc, accent: 0xe0f7ff },
  },
  sunset: {
    label: 'Sunset',
    emoji: '🌅',
    description: 'Warm sunset oranges over the horizon.',
    colors: { primary: 0xe67e22, secondary: 0xa04000, accent: 0xf5cba7 },
  },
  custom: {
    label: 'Custom',
    emoji: '🎨',
    description: 'Your own colors — fully custom theme.',
    colors: { primary: 0x2ecc71, secondary: 0x1e8e4e, accent: 0xa9dfbf },
  },
};

// Semantic status colors are consistent across themes so meaning is never ambiguous.
const STATUS_COLORS = { success: 0x2ecc71, error: 0xe74c3c, warning: 0xf39c12, info: 0x3498db };

const DEFAULT_THEME = 'emerald';

class ThemeManager {
  constructor(client) {
    this.client = client;
  }

  /** Names of every built-in theme (including 'custom'). */
  list() {
    return Object.keys(THEMES);
  }

  /** Static theme definition by name, or null. */
  definition(name) {
    return THEMES[name] ?? null;
  }

  /**
   * Resolve the active theme for a guild:
   * { name, label, emoji, description, colors: { primary, secondary, accent, success, error, warning, info } }
   */
  get(guildId) {
    const stored = this.client.config.get(guildId, 'theme', { theme: DEFAULT_THEME, custom: {} });
    const name = THEMES[stored.theme] ? stored.theme : DEFAULT_THEME;
    const base = THEMES[name];
    const colors = { ...base.colors, ...STATUS_COLORS };
    if (name === 'custom') {
      for (const key of ['primary', 'secondary', 'accent', 'success', 'error', 'warning', 'info']) {
        const v = stored.custom?.[key];
        if (Number.isInteger(v) && v >= 0 && v <= 0xffffff) colors[key] = v;
      }
    }
    return { name, label: base.label, emoji: base.emoji, description: base.description, colors };
  }

  /** Shorthand: a single color from the active theme. */
  color(guildId, kind = 'primary') {
    return this.get(guildId).colors[kind] ?? this.get(guildId).colors.primary;
  }

  setTheme(guildId, name) {
    if (!THEMES[name]) throw new Error(`Unknown theme: ${name}`);
    this.client.config.update(guildId, 'theme', { theme: name });
  }

  /** Store custom colors (integers) and activate the custom theme. */
  setCustom(guildId, colors) {
    this.client.config.update(guildId, 'theme', { theme: 'custom', custom: colors });
  }
}

module.exports = { ThemeManager, THEMES, STATUS_COLORS, DEFAULT_THEME };
