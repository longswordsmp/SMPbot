'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const log = require('../../../core/logger');
const { THEMES } = require('../../../core/themes');
const { LOG_TYPES } = require('../../../core/logging');
const { confirm, truncate } = require('../../../core/utils');
const w = require('./wizard');

// ---------------------------------------------------------------------------
// Local defaults / presets (kept here so the wizard never requires another
// module's internals — all writes target documented config namespaces).
// ---------------------------------------------------------------------------

const ROLE_DEFS = {
  member: { name: 'Member', kind: 'accent', hoist: false, why: 'the baseline role every verified human gets' },
  vip: { name: 'VIP', kind: 'warning', hoist: true, why: 'a perks role for boosters / supporters' },
  staff: { name: 'Staff', kind: 'secondary', hoist: true, why: 'helpers & moderators' },
  admin: { name: 'Admin', kind: 'primary', hoist: true, why: 'your trusted administrators' },
};

const TICKETS_DEFAULTS = {
  enabled: true,
  maxOpenPerUser: 3,
  dmTranscripts: true,
  logTranscripts: true,
  priorityPrefix: true,
  closedDeleteAfterMs: null,
};

const SPAM_KEYS = ['flood', 'duplicates', 'mentions', 'emoji', 'caps', 'characters'];
const LINK_KEYS = ['invites', 'urlflood', 'repeatedlink', 'shorteners', 'phishing'];

const SPAM_SENSITIVITY = {
  strict: { flood: { maxMessages: 4, windowSeconds: 5 }, caps: { minLength: 10, maxPercent: 60 }, duplicates: { maxRepeats: 2, windowSeconds: 30 } },
  normal: { flood: { maxMessages: 6, windowSeconds: 5 }, caps: { minLength: 15, maxPercent: 75 }, duplicates: { maxRepeats: 3, windowSeconds: 30 } },
  relaxed: { flood: { maxMessages: 9, windowSeconds: 5 }, caps: { minLength: 20, maxPercent: 85 }, duplicates: { maxRepeats: 4, windowSeconds: 45 } },
};

const NSFW_SENSITIVITY = ['strict', 'normal', 'relaxed'];

// Documented anti-nuke presets, applied to the highest-impact monitored actions.
const ANTINUKE_PRESETS = {
  relaxed: { channelDelete: { limit: 5, windowSec: 60 }, roleDelete: { limit: 5, windowSec: 60 }, ban: { limit: 6, windowSec: 60 }, kick: { limit: 6, windowSec: 60 }, webhookDelete: { limit: 5, windowSec: 120 } },
  standard: { channelDelete: { limit: 3, windowSec: 60 }, roleDelete: { limit: 3, windowSec: 60 }, ban: { limit: 4, windowSec: 60 }, kick: { limit: 4, windowSec: 60 }, webhookDelete: { limit: 3, windowSec: 120 } },
  strict: { channelDelete: { limit: 2, windowSec: 60 }, roleDelete: { limit: 2, windowSec: 60 }, ban: { limit: 3, windowSec: 60 }, kick: { limit: 3, windowSec: 60 }, webhookDelete: { limit: 2, windowSec: 120 } },
};

// Auto-created logging layout — every core LOG_TYPE mapped across a few channels.
const LOG_GROUPS = [
  { name: 'security-logs', emoji: '🛡️', types: ['security', 'antinuke', 'bots', 'webhooks'] },
  { name: 'moderation-logs', emoji: '🔨', types: ['moderation'] },
  { name: 'member-logs', emoji: '👥', types: ['members', 'verification', 'invites', 'leveling'] },
  { name: 'message-logs', emoji: '💬', types: ['messages'] },
  { name: 'server-logs', emoji: '🗂️', types: ['roles', 'channels', 'server'] },
  { name: 'ticket-logs', emoji: '🎫', types: ['tickets'] },
  { name: 'giveaway-logs', emoji: '🎉', types: ['giveaways'] },
];
const LOG_CATEGORY_NAME = '🔒 SMPBOT LOGS';

// ---------------------------------------------------------------------------
// Small builders / response helpers.
// ---------------------------------------------------------------------------

function btn(id, label, style, emoji, { disabled = false } = {}) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function channelSelectRow(id, placeholder, types = [ChannelType.GuildText, ChannelType.GuildAnnouncement]) {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder.slice(0, 150)).addChannelTypes(...types).setMinValues(1).setMaxValues(1),
  );
}

function roleSelectRow(id, placeholder, { min = 1, max = 1 } = {}) {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder.slice(0, 150)).setMinValues(min).setMaxValues(max),
  );
}

/** Re-render the current step message in place (update, or editReply after a defer). */
async function present(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
    return await interaction.update(payload);
  } catch (err) {
    log.debug('setup: present failed, falling back to ephemeral:', err?.message ?? err);
    try {
      return await interaction.followUp({ ...payload, flags: w.EPHEMERAL });
    } catch {
      return null;
    }
  }
}

/** Ephemeral side-message that does not disturb the step screen. */
async function tell(interaction, payload) {
  const body = { ...payload, flags: w.EPHEMERAL };
  if (interaction.deferred || interaction.replied) return interaction.followUp(body).catch(() => null);
  return interaction.reply(body).catch(() => null);
}

async function ackSlow(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => null);
}

function meMissing(ctx, permFlag, label) {
  if (w.botHas(ctx.guild, permFlag)) return null;
  return w.warnPayload(
    ctx.client,
    ctx.guild,
    'I need a permission first',
    `SMPbot needs the **${label}** permission to do this. Grant it (or **Administrator**) and try again.`,
  );
}

function validMcHost(input) {
  const s = String(input || '').trim();
  if (!s || s.length > 260) return null;
  let host = s;
  const m = s.match(/^(.+):(\d{1,5})$/);
  if (m) {
    host = m[1];
    const port = Number(m[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  }
  const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  if (!HOST_RE.test(host) && !IPV4_RE.test(host)) return null;
  return s;
}

// ===========================================================================
// STEPS
// ===========================================================================

const STEPS = {};

// --- 1. Template -----------------------------------------------------------
STEPS.template = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('template');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    let list = [];
    try {
      list = client.services.templates.list() || [];
    } catch {
      list = [];
    }
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      'A **template** builds your whole server for you — the role ladder, categories, and channels — in one click. Pick one that fits your community, preview it, then apply it. Applying only **adds** what is missing; it never deletes your existing channels.',
    );
    const rows = [];
    if (!list.length) {
      embed.addFields({ name: 'No templates available', value: 'The templates module has no blueprints to offer right now. You can safely skip this step.' });
    } else {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('setup:step:template:pick')
        .setPlaceholder('Choose a server template…')
        .addOptions(
          list.slice(0, 25).map((t) => ({
            label: String(t.name || t.id).slice(0, 100),
            value: String(t.id).slice(0, 100),
            description: String(t.description || '').slice(0, 100) || undefined,
            emoji: t.emoji || '🏗️',
          })),
        );
      rows.push(new ActionRowBuilder().addComponents(menu));
    }
    rows.push(w.controlsRow('template'));
    return { embeds: [embed], components: rows };
  },

  async handle(ctx, action, rest) {
    const { client, guild, interaction } = ctx;
    const service = client.services?.templates;
    if (!service) return present(interaction, w.notLoadedView(client, guild, w.STEP_INDEX.get('template')));

    if (action === 'pick' && interaction.isStringSelectMenu()) {
      const id = interaction.values[0];
      if (!/^[a-z0-9_-]{1,60}$/i.test(id)) return tell(interaction, w.warnPayload(client, guild, 'Unknown template', 'That template could not be selected.'));
      let tpl = null;
      try {
        tpl = service.get?.(id) || null;
      } catch {
        tpl = null;
      }
      const step = w.STEP_INDEX.get('template');
      const embed = w
        .stepEmbed(client, guild, step)
        .setDescription(
          `You picked **${tpl?.emoji ? `${tpl.emoji} ` : ''}${tpl?.name || id}**.\n${tpl?.description ? `\n${truncate(tpl.description, 500)}\n` : ''}\nUse **Preview** to see exactly what it creates, then **Apply** to build it. Applying adds the missing roles and channels — nothing is deleted.`,
        );
      const actionRow = new ActionRowBuilder().addComponents(
        btn(`setup:step:template:preview:${id}`, 'Preview', ButtonStyle.Secondary, '👀'),
        btn(`setup:step:template:apply:${id}`, 'Apply template', ButtonStyle.Success, '🏗️'),
      );
      return present(interaction, { embeds: [embed], components: [actionRow, w.controlsRow('template')] });
    }

    if (action === 'preview') {
      const id = rest[0];
      let embeds = [];
      try {
        embeds = (await service.preview?.(guild, id)) || [];
      } catch (err) {
        log.debug('setup: template preview failed:', err?.message ?? err);
      }
      if (!embeds.length) return tell(interaction, w.warnPayload(client, guild, 'Preview unavailable', 'Could not build a preview for that template.'));
      return tell(interaction, { embeds: embeds.slice(0, 10) });
    }

    if (action === 'apply') {
      const id = rest[0];
      const ok = await confirm(interaction, {
        embed: client.brand.warn(guild, 'Apply this template?', 'This will create any missing roles and channels for the selected template. Your existing channels stay exactly as they are.'),
        confirmLabel: 'Build it',
        danger: false,
      });
      if (!ok) return null;
      try {
        const result = await service.apply(guild, id, { mode: 'add' });
        w.setTemplate(client, guild.id, id);
        w.markDone(client, guild.id, 'template');
        const created = `${result?.createdChannels ?? 0} channel(s) and ${result?.createdRoles ?? 0} role(s)`;
        return interaction.editReply({
          embeds: [client.brand.success(guild, 'Template applied', `Created ${created}. Head **Back to overview** to keep going — this step is now marked done. ✅`)],
          components: [new ActionRowBuilder().addComponents(btn('setup:home', 'Back to overview', ButtonStyle.Primary, '🏠'))],
        }).catch(() => null);
      } catch (err) {
        log.warn('setup: template apply failed:', err?.message ?? err);
        return interaction.editReply({
          embeds: [client.brand.error(guild, 'Could not apply template', 'Something went wrong while building the server. Some parts may have been created. You can try again or use `/template`.')],
          components: [new ActionRowBuilder().addComponents(btn('setup:home', 'Back to overview', ButtonStyle.Primary, '🏠'))],
        }).catch(() => null);
      }
    }
    return null;
  },
};

// --- 2. Branding -----------------------------------------------------------
STEPS.branding = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('branding');
    const loaded = w.featureLoaded(client, step.feature);
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Branding makes SMPbot look like **your** server: a custom name, avatar, and logo on every panel and announcement.',
        '',
        loaded
          ? 'Run **`/branding setup`** for the full guided branding studio (logo, banner, webhook identity, and generated art).'
          : '_The full branding studio is not loaded right now, but you can still set the bot nickname below._',
        '',
        'Quick option: set the **nickname** SMPbot uses in this server.',
      ].join('\n'),
    );
    const row = new ActionRowBuilder().addComponents(btn('setup:step:branding:nick', 'Set bot nickname', ButtonStyle.Primary, '✏️'));
    return { embeds: [embed], components: [row, w.controlsRow('branding')] };
  },

  async handle(ctx, action, rest) {
    const { client, guild, interaction } = ctx;
    if (action === 'nick' && interaction.isButton()) {
      const modal = new ModalBuilder().setCustomId('setup:step:branding:nickmodal').setTitle('Bot nickname').addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('nickname')
            .setLabel('Nickname (leave blank to reset)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(32)
            .setPlaceholder(guild.members.me?.displayName?.slice(0, 32) || 'SMPbot'),
        ),
      );
      return interaction.showModal(modal);
    }

    if (action === 'nickmodal' && interaction.isModalSubmit()) {
      const warn = meMissing(ctx, PermissionFlagsBits.ChangeNickname, 'Change Nickname');
      if (warn) return interaction.reply(warn);
      const value = (interaction.fields.getTextInputValue('nickname') || '').trim();
      try {
        await guild.members.me.setNickname(value || null, 'SMPbot setup wizard');
        w.markDone(client, guild.id, 'branding');
        return present(interaction, STEPS.branding.view(ctx, value ? `✅ Nickname set to **${truncate(value, 60)}**.` : '✅ Nickname reset to the default.'));
      } catch (err) {
        log.debug('setup: setNickname failed:', err?.message ?? err);
        return interaction.reply(w.warnPayload(client, guild, 'Could not set nickname', 'SMPbot could not change its nickname. Check that its role is high enough and it has **Change Nickname**.'));
      }
    }
    return null;
  },
};

// --- 3. Theme --------------------------------------------------------------
STEPS.theme = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('theme');
    const active = client.themes.get(guild.id);
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      `The theme sets the colors of **every** SMPbot embed, panel, and announcement. Current theme: **${active.emoji} ${active.label}**.\n\nPick one below to apply it instantly.`,
    );
    const menu = new StringSelectMenuBuilder()
      .setCustomId('setup:step:theme:pick')
      .setPlaceholder('Choose a color theme…')
      .addOptions(
        Object.entries(THEMES).map(([key, def]) => ({
          label: def.label,
          value: key,
          description: def.description.slice(0, 100),
          emoji: def.emoji,
          default: key === active.name,
        })),
      );
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), w.controlsRow('theme')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (action === 'pick' && interaction.isStringSelectMenu()) {
      const name = interaction.values[0];
      try {
        client.themes.setTheme(guild.id, name);
      } catch {
        return tell(interaction, w.warnPayload(client, guild, 'Unknown theme', 'That theme could not be applied.'));
      }
      w.markDone(client, guild.id, 'theme');
      const def = THEMES[name];
      return present(interaction, STEPS.theme.view(ctx, `✅ Applied the **${def.emoji} ${def.label}** theme — it is live everywhere now.`));
    }
    return null;
  },
};

// --- 4. Roles --------------------------------------------------------------
function findRoleByName(guild, name) {
  const lower = name.toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === lower) || null;
}

STEPS.roles = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('roles');
    const status = Object.entries(ROLE_DEFS).map(([key, def]) => {
      const existing = findRoleByName(guild, def.name);
      return { key, def, existing };
    });
    const lines = status.map(({ def, existing }) => `${existing ? '✅' : '⬜'} **${def.name}** — ${def.why}${existing ? ` (${existing})` : ''}`);
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      `Most SMPs need a few core roles. SMPbot can create any that are missing, using your theme colors. You can rename or recolor them later.\n\n${lines.join('\n')}`,
    );
    const buttons = new ActionRowBuilder().addComponents(
      ...status.map(({ key, def, existing }) => btn(`setup:step:roles:create:${key}`, def.name, existing ? ButtonStyle.Secondary : ButtonStyle.Success, existing ? '✅' : '➕', { disabled: Boolean(existing) })),
      btn('setup:step:roles:create:all', 'Create all missing', ButtonStyle.Primary, '✨'),
    );
    return { embeds: [embed], components: [buttons, w.controlsRow('roles')] };
  },

  async handle(ctx, action, rest) {
    const { client, guild, interaction } = ctx;
    if (action !== 'create') return null;
    const warn = meMissing(ctx, PermissionFlagsBits.ManageRoles, 'Manage Roles');
    if (warn) return tell(interaction, warn);
    const target = rest[0];
    const keys = target === 'all' ? Object.keys(ROLE_DEFS) : [target];
    if (!keys.every((k) => ROLE_DEFS[k])) return tell(interaction, w.warnPayload(client, guild, 'Unknown role', 'That role could not be created.'));

    await ackSlow(interaction);
    const created = [];
    const existed = [];
    const failed = [];
    for (const key of keys) {
      const def = ROLE_DEFS[key];
      if (findRoleByName(guild, def.name)) {
        existed.push(def.name);
        continue;
      }
      try {
        await guild.roles.create({
          name: def.name,
          color: client.themes.color(guild.id, def.kind),
          hoist: def.hoist,
          mentionable: false,
          reason: 'SMPbot setup wizard: essential role',
        });
        created.push(def.name);
      } catch (err) {
        log.debug(`setup: role create '${def.name}' failed:`, err?.message ?? err);
        failed.push(def.name);
      }
    }
    if (created.length) w.markDone(client, guild.id, 'roles');
    const parts = [];
    if (created.length) parts.push(`✅ Created: ${created.join(', ')}`);
    if (existed.length) parts.push(`ℹ️ Already existed: ${existed.join(', ')}`);
    if (failed.length) parts.push(`⚠️ Could not create: ${failed.join(', ')}`);
    return present(interaction, STEPS.roles.view(ctx, parts.join('\n') || 'No changes were needed.'));
  },
};

// --- 5. Channels -----------------------------------------------------------
STEPS.channels = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('channels');
    const chans = guild.channels.cache;
    const count = (type) => chans.filter((c) => c.type === type).size;
    const categories = count(ChannelType.GuildCategory);
    const text = count(ChannelType.GuildText) + count(ChannelType.GuildAnnouncement);
    const voice = count(ChannelType.GuildVoice) + count(ChannelType.GuildStageVoice);
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Here is your current channel layout. If it already looks the way you want, just mark this step done.',
        '',
        `📂 **${categories}** categories`,
        `💬 **${text}** text/announcement channels`,
        `🔊 **${voice}** voice/stage channels`,
        '',
        'Want a complete, tidy layout built for you? Use the **Template** step (or `/template`). Fine-tune individual channels in Discord’s own settings.',
      ].join('\n'),
    );
    const row = new ActionRowBuilder().addComponents(btn('setup:goto:template', 'Open the Template step', ButtonStyle.Secondary, '🏗️'));
    return { embeds: [embed], components: [row, w.controlsRow('channels')] };
  },
  async handle() {
    return null;
  },
};

// --- 6. Verification -------------------------------------------------------
STEPS.verify = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('verify');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'verification', {});
    const roleTxt = cfg.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : '_not set_';
    const chanTxt = cfg.channelId ? `<#${cfg.channelId}>` : '_not published_';
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Verification stops bots and raiders by making new members click a button (or solve a captcha) before they can see the server.',
        '',
        `**Verified role:** ${roleTxt}`,
        `**Panel channel:** ${chanTxt}`,
        '',
        '1) Pick (or create) the role given after verifying.',
        '2) Pick the channel to post the verify panel in — it publishes immediately.',
      ].join('\n'),
    );
    return {
      embeds: [embed],
      components: [
        roleSelectRow('setup:step:verify:role', 'Pick the verified role…'),
        new ActionRowBuilder().addComponents(btn('setup:step:verify:createrole', 'Create a “Verified” role for me', ButtonStyle.Secondary, '✨')),
        channelSelectRow('setup:step:verify:channel', 'Pick a channel to publish the verify panel…'),
        w.controlsRow('verify'),
      ],
    };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    const service = client.services?.verification;
    if (!service) return present(interaction, w.notLoadedView(client, guild, w.STEP_INDEX.get('verify')));

    if (action === 'role' && interaction.isRoleSelectMenu()) {
      const roleId = interaction.values[0];
      client.config.update(guild.id, 'verification', { verifiedRoleId: roleId, enabled: true });
      return present(interaction, STEPS.verify.view(ctx, `✅ Verified role set to <@&${roleId}>. Now pick a channel to publish the panel.`));
    }

    if (action === 'createrole' && interaction.isButton()) {
      const warn = meMissing(ctx, PermissionFlagsBits.ManageRoles, 'Manage Roles');
      if (warn) return tell(interaction, warn);
      await ackSlow(interaction);
      try {
        const role = findRoleByName(guild, 'Verified') || (await guild.roles.create({ name: 'Verified', color: client.themes.color(guild.id, 'success'), reason: 'SMPbot setup: verified role' }));
        client.config.update(guild.id, 'verification', { verifiedRoleId: role.id, enabled: true });
        return present(interaction, STEPS.verify.view(ctx, `✅ Created and selected the **${role}** role. Now pick a channel to publish the panel.`));
      } catch (err) {
        log.debug('setup: verify role create failed:', err?.message ?? err);
        return present(interaction, STEPS.verify.view(ctx, '⚠️ Could not create the role — check my permissions and role position.'));
      }
    }

    if (action === 'channel' && interaction.isChannelSelectMenu()) {
      const cfg = client.config.get(guild.id, 'verification', {});
      if (!cfg.verifiedRoleId) return tell(interaction, w.warnPayload(client, guild, 'Set a verified role first', 'Choose (or create) the verified role above before publishing the panel.'));
      const channelId = interaction.values[0];
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) return tell(interaction, w.warnPayload(client, guild, 'Channel unavailable', 'That channel could not be found.'));
      await ackSlow(interaction);
      try {
        await service.publishPanel(guild, channel);
        client.config.update(guild.id, 'verification', { channelId, enabled: true });
        w.markDone(client, guild.id, 'verify');
        return present(interaction, STEPS.verify.view(ctx, `✅ Verification panel published in ${channel}. New members must verify to get in.`));
      } catch (err) {
        log.debug('setup: verify publish failed:', err?.message ?? err);
        return present(interaction, STEPS.verify.view(ctx, '⚠️ Could not publish the panel there — check my permissions in that channel.'));
      }
    }
    return null;
  },
};

// --- 7. Rules --------------------------------------------------------------
STEPS.rules = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('rules');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'rules', { sections: [] });
    const sections = Array.isArray(cfg.sections) ? cfg.sections : [];
    const embed = w.stepEmbed(client, guild, step, { note });
    const rows = [];
    if (sections.length) {
      embed.setDescription(
        `You have **${sections.length}** rule section(s) ready. Pick a channel below to publish a clean, themed rules message.\n\nAdd, edit, or reorder sections any time with **\`/rules\`**.`,
      );
      rows.push(channelSelectRow('setup:step:rules:channel', 'Pick a channel to publish rules…'));
    } else {
      embed.setDescription(
        'Clear rules keep your SMP friendly. You have no rules written yet.\n\nStart with **`/rules setup`** to choose a starter pack (Discord rules, in-game rules, and more), then come back here to publish them — or just mark this step done and do it later.',
      );
    }
    rows.push(w.controlsRow('rules'));
    return { embeds: [embed], components: rows };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    const service = client.services?.rules;
    if (action === 'channel' && interaction.isChannelSelectMenu()) {
      if (!service) return tell(interaction, w.warnPayload(client, guild, 'Rules module not loaded', 'The rules feature is not available right now.'));
      const channelId = interaction.values[0];
      const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) return tell(interaction, w.warnPayload(client, guild, 'Channel unavailable', 'That channel could not be found.'));
      await ackSlow(interaction);
      try {
        await service.publish(guild, channel);
        w.markDone(client, guild.id, 'rules');
        return present(interaction, STEPS.rules.view(ctx, `✅ Published your rules in ${channel}.`));
      } catch (err) {
        log.debug('setup: rules publish failed:', err?.message ?? err);
        return present(interaction, STEPS.rules.view(ctx, '⚠️ Could not publish rules there — check my permissions in that channel.'));
      }
    }
    return null;
  },
};

// --- 8 & 9. Minecraft ------------------------------------------------------
function minecraftView(ctx, stepId, note) {
  const { client, guild } = ctx;
  const step = w.STEP_INDEX.get(stepId);
  const cfg = client.config.get(guild.id, 'minecraft', {});
  const java = stepId === 'mcjava';
  const guideLoaded = Boolean(client.services?.serverinfo);
  const current = java
    ? `**Java IP:** ${cfg.javaIp ? `\`${cfg.javaIp}\`` : '_not set_'}`
    : `**Bedrock IP:** ${cfg.bedrockIp ? `\`${cfg.bedrockIp}\`` : '_not set_'}\n**Bedrock port:** \`${cfg.bedrockPort || 19132}\``;
  const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
    [
      java
        ? 'This is the address Java Edition players type to join your server (for example `play.myserver.net`).'
        : 'Bedrock players (mobile / console / Windows 10) join with an IP **and** a port. The default Bedrock port is `19132`.',
      '',
      current,
      '',
      guideLoaded ? 'After saving, pick a channel to publish a polished **How to Join** guide.' : '_The join-guide publisher is not loaded, but your IP is still saved for other features._',
    ].join('\n'),
  );
  const rows = [new ActionRowBuilder().addComponents(btn(`setup:step:${stepId}:set`, java ? 'Set Java IP' : 'Set Bedrock IP & port', ButtonStyle.Primary, '✏️'))];
  if (guideLoaded) rows.push(channelSelectRow(`setup:step:${stepId}:guide`, 'Publish the join guide in…'));
  rows.push(w.controlsRow(stepId));
  return { embeds: [embed], components: rows };
}

async function minecraftGuide(ctx, stepId) {
  const { client, guild, interaction } = ctx;
  const service = client.services?.serverinfo;
  if (!service) return tell(interaction, w.warnPayload(client, guild, 'Guide not loaded', 'The join-guide publisher is not available right now.'));
  const channelId = interaction.values[0];
  const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) return tell(interaction, w.warnPayload(client, guild, 'Channel unavailable', 'That channel could not be found.'));
  await ackSlow(interaction);
  try {
    await service.publishGuide(guild, channel);
    w.markDone(client, guild.id, stepId);
    return present(interaction, minecraftView(ctx, stepId, `✅ Published the join guide in ${channel}.`));
  } catch (err) {
    log.debug('setup: guide publish failed:', err?.message ?? err);
    return present(interaction, minecraftView(ctx, stepId, '⚠️ Could not publish the guide there — check my permissions in that channel.'));
  }
}

STEPS.mcjava = {
  view: (ctx, note) => minecraftView(ctx, 'mcjava', note),
  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (action === 'set' && interaction.isButton()) {
      const cfg = client.config.get(guild.id, 'minecraft', {});
      const modal = new ModalBuilder().setCustomId('setup:step:mcjava:setmodal').setTitle('Minecraft Java IP').addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('javaip').setLabel('Java server address').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(120).setValue(cfg.javaIp || '').setPlaceholder('play.myserver.net'),
        ),
      );
      return interaction.showModal(modal);
    }
    if (action === 'setmodal' && interaction.isModalSubmit()) {
      const raw = interaction.fields.getTextInputValue('javaip');
      const value = validMcHost(raw);
      if (!value) return interaction.reply(w.warnPayload(client, guild, 'Invalid address', 'Enter a valid server address like `play.myserver.net` (optionally `host:port`).'));
      client.config.update(guild.id, 'minecraft', { javaIp: value });
      w.markDone(client, guild.id, 'mcjava');
      return present(interaction, minecraftView(ctx, 'mcjava', `✅ Java IP saved as \`${value}\`.`));
    }
    if (action === 'guide' && interaction.isChannelSelectMenu()) return minecraftGuide(ctx, 'mcjava');
    return null;
  },
};

STEPS.mcbedrock = {
  view: (ctx, note) => minecraftView(ctx, 'mcbedrock', note),
  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (action === 'set' && interaction.isButton()) {
      const cfg = client.config.get(guild.id, 'minecraft', {});
      const modal = new ModalBuilder().setCustomId('setup:step:mcbedrock:setmodal').setTitle('Minecraft Bedrock IP').addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('bedrockip').setLabel('Bedrock server address').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(120).setValue(cfg.bedrockIp || '').setPlaceholder('play.myserver.net'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('bedrockport').setLabel('Bedrock port (default 19132)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(5).setValue(String(cfg.bedrockPort || 19132)).setPlaceholder('19132'),
        ),
      );
      return interaction.showModal(modal);
    }
    if (action === 'setmodal' && interaction.isModalSubmit()) {
      const host = validMcHost(interaction.fields.getTextInputValue('bedrockip'));
      if (!host) return interaction.reply(w.warnPayload(client, guild, 'Invalid address', 'Enter a valid Bedrock address like `play.myserver.net`.'));
      const portRaw = (interaction.fields.getTextInputValue('bedrockport') || '').trim();
      let port = 19132;
      if (portRaw) {
        port = Number(portRaw);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return interaction.reply(w.warnPayload(client, guild, 'Invalid port', 'The Bedrock port must be a number between 1 and 65535 (usually `19132`).'));
      }
      client.config.update(guild.id, 'minecraft', { bedrockIp: host, bedrockPort: port });
      w.markDone(client, guild.id, 'mcbedrock');
      return present(interaction, minecraftView(ctx, 'mcbedrock', `✅ Bedrock saved as \`${host}\` on port \`${port}\`.`));
    }
    if (action === 'guide' && interaction.isChannelSelectMenu()) return minecraftGuide(ctx, 'mcbedrock');
    return null;
  },
};

// --- 10. Tickets -----------------------------------------------------------
STEPS.tickets = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('tickets');
    const loaded = w.featureLoaded(client, step.feature);
    const setup = client.config.get(guild.id, 'setup', {});
    const chanTxt = setup.ticketsPanelChannel ? `<#${setup.ticketsPanelChannel}>` : '_not chosen_';
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Tickets let members open a private channel to ask staff for help. SMPbot handles claiming, transcripts, and closing.',
        '',
        `**Chosen panel channel:** ${chanTxt}`,
        '',
        loaded
          ? '1) Pick where the ticket panel should live.\n2) Use **Write default ticket settings** to enable sensible defaults, then publish the panel with **`/ticketpanel`**.'
          : '_The tickets module is not loaded right now. You can still note a panel channel; publish it later once tickets are available._',
      ].join('\n'),
    );
    return {
      embeds: [embed],
      components: [
        channelSelectRow('setup:step:tickets:channel', 'Pick the ticket panel channel…'),
        new ActionRowBuilder().addComponents(btn('setup:step:tickets:defaults', 'Write default ticket settings', ButtonStyle.Primary, '⚙️')),
        w.controlsRow('tickets'),
      ],
    };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (action === 'channel' && interaction.isChannelSelectMenu()) {
      const channelId = interaction.values[0];
      client.config.update(guild.id, 'setup', { ticketsPanelChannel: channelId });
      return present(interaction, STEPS.tickets.view(ctx, `✅ Noted <#${channelId}> as your ticket panel channel. Publish it there with \`/ticketpanel publish\`.`));
    }
    if (action === 'defaults' && interaction.isButton()) {
      const raw = client.config.getRaw(guild.id, 'tickets') || {};
      if (Object.keys(raw).length === 0) {
        client.config.set(guild.id, 'tickets', { ...TICKETS_DEFAULTS });
        w.markDone(client, guild.id, 'tickets');
        return present(interaction, STEPS.tickets.view(ctx, '✅ Wrote default ticket settings. Now run `/ticketpanel publish` to post your support panel.'));
      }
      w.markDone(client, guild.id, 'tickets');
      return present(interaction, STEPS.tickets.view(ctx, 'ℹ️ Tickets are already configured — fine-tune them with `/ticketconfig`, or publish a panel with `/ticketpanel`.'));
    }
    return null;
  },
};

// --- 11. Giveaways ---------------------------------------------------------
STEPS.giveaways = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('giveaways');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'giveaways', {});
    const roleTxt = cfg.managerRoleId ? `<@&${cfg.managerRoleId}>` : '_none (Manage Server only)_';
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Run giveaways with entry requirements (invites, levels, roles, account age) and automatic winner picking.',
        '',
        `**Giveaway manager role:** ${roleTxt}`,
        '',
        'Pick a role that can start and manage giveaways (in addition to anyone with Manage Server). Start a giveaway any time with **`/giveaway start`**.',
      ].join('\n'),
    );
    return { embeds: [embed], components: [roleSelectRow('setup:step:giveaways:role', 'Pick the giveaway manager role…'), w.controlsRow('giveaways')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (action === 'role' && interaction.isRoleSelectMenu()) {
      const roleId = interaction.values[0];
      client.config.update(guild.id, 'giveaways', { managerRoleId: roleId });
      w.markDone(client, guild.id, 'giveaways');
      return present(interaction, STEPS.giveaways.view(ctx, `✅ <@&${roleId}> can now manage giveaways.`));
    }
    return null;
  },
};

// --- 12. Moderation --------------------------------------------------------
STEPS.moderation = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('moderation');
    const loaded = w.featureLoaded(client, step.feature);
    const cfg = client.config.get(guild.id, 'moderation', { dmOnAction: true, escalation: { enabled: true } });
    const dm = cfg.dmOnAction !== false;
    const esc = cfg.escalation?.enabled !== false;
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Moderation tools: warnings, timeouts, kicks, and bans — each logged as a numbered case.',
        loaded ? '' : '\n_The moderation module is not loaded yet; these settings are saved and take effect once it is._',
        '',
        `**DM members on action:** ${dm ? '🟢 On' : '⚫ Off'} — tell a member (in DMs) when they are warned/timed out.`,
        `**Auto-escalation:** ${esc ? '🟢 On' : '⚫ Off'} — automatically escalate repeat offenders after enough warnings.`,
        '',
        'Take action with `/warn`, `/timeout`, `/kick`, `/ban`, and review history with `/warnings`.',
      ]
        .filter((l) => l !== '')
        .join('\n'),
    );
    const row = new ActionRowBuilder().addComponents(
      btn('setup:step:moderation:dm', dm ? 'Turn off DM-on-action' : 'Turn on DM-on-action', dm ? ButtonStyle.Secondary : ButtonStyle.Success, '✉️'),
      btn('setup:step:moderation:escalation', esc ? 'Turn off auto-escalation' : 'Turn on auto-escalation', esc ? ButtonStyle.Secondary : ButtonStyle.Success, '⚡'),
    );
    return { embeds: [embed], components: [row, w.controlsRow('moderation')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    const cfg = client.config.get(guild.id, 'moderation', { dmOnAction: true, escalation: { enabled: true } });
    if (action === 'dm') {
      const next = !(cfg.dmOnAction !== false);
      client.config.update(guild.id, 'moderation', { dmOnAction: next });
      w.markDone(client, guild.id, 'moderation');
      return present(interaction, STEPS.moderation.view(ctx, `✅ DM-on-action is now **${next ? 'on' : 'off'}**.`));
    }
    if (action === 'escalation') {
      const next = !(cfg.escalation?.enabled !== false);
      client.config.update(guild.id, 'moderation', { escalation: { enabled: next } });
      w.markDone(client, guild.id, 'moderation');
      return present(interaction, STEPS.moderation.view(ctx, `✅ Auto-escalation is now **${next ? 'on' : 'off'}**.`));
    }
    return null;
  },
};

// --- 13. Anti-Spam ---------------------------------------------------------
function automodModule(client) {
  return client.modules?.has?.('automod');
}

STEPS.spam = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('spam');
    if (!automodModule(client)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'automod', {});
    const on = SPAM_KEYS.filter((k) => cfg.spam?.[k]?.enabled).length;
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Anti-spam automatically deletes message floods, repeated messages, mention spam, emoji/caps spam, and character spam.',
        '',
        `**Status:** ${on} of ${SPAM_KEYS.length} spam checks enabled.`,
        '',
        'Turn the whole set on or off, and choose how strict it is. Fine-tune every threshold later with **`/automod`**.',
      ].join('\n'),
    );
    const buttons = new ActionRowBuilder().addComponents(
      btn('setup:step:spam:enable', 'Enable anti-spam', ButtonStyle.Success, '🟢'),
      btn('setup:step:spam:disable', 'Disable anti-spam', ButtonStyle.Secondary, '⚫'),
    );
    const sens = new StringSelectMenuBuilder()
      .setCustomId('setup:step:spam:sens')
      .setPlaceholder('Choose spam sensitivity…')
      .addOptions(
        { label: 'Strict', value: 'strict', emoji: '🔒', description: 'Catches spam aggressively.' },
        { label: 'Normal (recommended)', value: 'normal', emoji: '⚖️', description: 'Balanced defaults.' },
        { label: 'Relaxed', value: 'relaxed', emoji: '🪶', description: 'Only obvious spam.' },
      );
    return { embeds: [embed], components: [buttons, new ActionRowBuilder().addComponents(sens), w.controlsRow('spam')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (!automodModule(client)) return present(interaction, w.notLoadedView(client, guild, w.STEP_INDEX.get('spam')));
    if (action === 'enable' || action === 'disable') {
      const enabled = action === 'enable';
      const spamPatch = {};
      for (const k of SPAM_KEYS) spamPatch[k] = { enabled };
      client.config.update(guild.id, 'automod', enabled ? { enabled: true, spam: spamPatch } : { spam: spamPatch });
      if (enabled) w.markDone(client, guild.id, 'spam');
      return present(interaction, STEPS.spam.view(ctx, enabled ? '✅ Anti-spam enabled.' : '⚫ Anti-spam disabled.'));
    }
    if (action === 'sens' && interaction.isStringSelectMenu()) {
      const preset = SPAM_SENSITIVITY[interaction.values[0]];
      if (!preset) return null;
      client.config.update(guild.id, 'automod', { spam: preset });
      w.markDone(client, guild.id, 'spam');
      return present(interaction, STEPS.spam.view(ctx, `✅ Spam sensitivity set to **${interaction.values[0]}**.`));
    }
    return null;
  },
};

// --- 14. Anti-Link ---------------------------------------------------------
STEPS.links = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('links');
    if (!automodModule(client)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'automod', {});
    const on = LINK_KEYS.filter((k) => cfg.links?.[k]?.enabled).length;
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Anti-link blocks Discord invite links, known scam/phishing links, link shorteners, and link spam from non-staff.',
        '',
        `**Status:** ${on} of ${LINK_KEYS.length} link checks enabled.`,
        '',
        'Add allowed domains and tune behavior later with **`/automod`**.',
      ].join('\n'),
    );
    const buttons = new ActionRowBuilder().addComponents(
      btn('setup:step:links:enable', 'Enable anti-link', ButtonStyle.Success, '🟢'),
      btn('setup:step:links:disable', 'Disable anti-link', ButtonStyle.Secondary, '⚫'),
    );
    return { embeds: [embed], components: [buttons, w.controlsRow('links')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (!automodModule(client)) return present(interaction, w.notLoadedView(client, guild, w.STEP_INDEX.get('links')));
    if (action === 'enable' || action === 'disable') {
      const enabled = action === 'enable';
      const linkPatch = {};
      for (const k of LINK_KEYS) linkPatch[k] = { enabled };
      client.config.update(guild.id, 'automod', enabled ? { enabled: true, links: linkPatch } : { links: linkPatch });
      if (enabled) w.markDone(client, guild.id, 'links');
      return present(interaction, STEPS.links.view(ctx, enabled ? '✅ Anti-link enabled.' : '⚫ Anti-link disabled.'));
    }
    return null;
  },
};

// --- 15. Anti-NSFW ---------------------------------------------------------
STEPS.nsfw = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('nsfw');
    if (!automodModule(client)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'automod', {});
    const enabled = Boolean(cfg.nsfw?.enabled);
    const sensitivity = cfg.nsfw?.sensitivity || 'normal';
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Anti-NSFW deletes messages containing profanity and inappropriate language, keeping your SMP family-friendly.',
        '',
        `**Status:** ${enabled ? '🟢 On' : '⚫ Off'} · sensitivity **${sensitivity}**.`,
        '',
        'Add or remove filtered words and exempt channels later with **`/automod`**.',
      ].join('\n'),
    );
    const buttons = new ActionRowBuilder().addComponents(
      btn('setup:step:nsfw:enable', 'Enable anti-NSFW', ButtonStyle.Success, '🟢'),
      btn('setup:step:nsfw:disable', 'Disable anti-NSFW', ButtonStyle.Secondary, '⚫'),
    );
    const sens = new StringSelectMenuBuilder()
      .setCustomId('setup:step:nsfw:sens')
      .setPlaceholder('Choose filter sensitivity…')
      .addOptions(
        { label: 'Strict', value: 'strict', emoji: '🔒', description: 'Also catches words inside other words.' },
        { label: 'Normal (recommended)', value: 'normal', emoji: '⚖️', description: 'Whole-word matching.' },
        { label: 'Relaxed', value: 'relaxed', emoji: '🪶', description: 'Only exact standalone words.' },
      );
    return { embeds: [embed], components: [buttons, new ActionRowBuilder().addComponents(sens), w.controlsRow('nsfw')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (!automodModule(client)) return present(interaction, w.notLoadedView(client, guild, w.STEP_INDEX.get('nsfw')));
    if (action === 'enable' || action === 'disable') {
      const enabled = action === 'enable';
      client.config.update(guild.id, 'automod', enabled ? { enabled: true, nsfw: { enabled: true } } : { nsfw: { enabled: false } });
      if (enabled) w.markDone(client, guild.id, 'nsfw');
      return present(interaction, STEPS.nsfw.view(ctx, enabled ? '✅ Anti-NSFW enabled.' : '⚫ Anti-NSFW disabled.'));
    }
    if (action === 'sens' && interaction.isStringSelectMenu()) {
      const value = interaction.values[0];
      if (!NSFW_SENSITIVITY.includes(value)) return null;
      client.config.update(guild.id, 'automod', { nsfw: { sensitivity: value } });
      w.markDone(client, guild.id, 'nsfw');
      return present(interaction, STEPS.nsfw.view(ctx, `✅ NSFW sensitivity set to **${value}**.`));
    }
    return null;
  },
};

// --- 16. Anti-Nuke ---------------------------------------------------------
STEPS.antinuke = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('antinuke');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'security', {});
    const enabled = cfg.enabled !== false;
    const preset = cfg.setupPreset ? ` · preset **${cfg.setupPreset}**` : '';
    const trusted = Array.isArray(cfg.trustedRoles) ? cfg.trustedRoles : [];
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Anti-nuke watches for mass channel/role deletions, bans, and dangerous permission grants — and automatically stops a compromised account or rogue admin before they can wreck the server.',
        '',
        `**Status:** ${enabled ? '🟢 Protected' : '⚫ Off'}${enabled ? preset : ''}.`,
        `**Trusted roles:** ${trusted.length ? trusted.map((id) => `<@&${id}>`).join(' ') : '_none yet_'} (exempt from monitoring).`,
        '',
        'Choose a strictness preset, and add roles you fully trust so they are never flagged.',
      ].join('\n'),
    );
    const toggle = new ActionRowBuilder().addComponents(
      btn('setup:step:antinuke:enable', enabled ? 'Disable anti-nuke' : 'Enable anti-nuke', enabled ? ButtonStyle.Secondary : ButtonStyle.Success, '🛡️'),
    );
    const presetMenu = new StringSelectMenuBuilder()
      .setCustomId('setup:step:antinuke:preset')
      .setPlaceholder('Choose a protection preset…')
      .addOptions(
        { label: 'Relaxed', value: 'relaxed', emoji: '🪶', description: 'Higher thresholds — fewer false alarms.' },
        { label: 'Standard (recommended)', value: 'standard', emoji: '⚖️', description: 'Balanced protection.' },
        { label: 'Strict', value: 'strict', emoji: '🔒', description: 'Trips fast — maximum protection.' },
      );
    return {
      embeds: [embed],
      components: [toggle, new ActionRowBuilder().addComponents(presetMenu), roleSelectRow('setup:step:antinuke:roles', 'Add trusted roles…', { min: 1, max: 10 }), w.controlsRow('antinuke')],
    };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (!w.featureLoaded(client, w.STEP_INDEX.get('antinuke').feature)) return present(interaction, w.notLoadedView(client, guild, w.STEP_INDEX.get('antinuke')));
    const cfg = client.config.get(guild.id, 'security', {});
    if (action === 'enable') {
      const next = !(cfg.enabled !== false);
      client.config.update(guild.id, 'security', { enabled: next });
      if (next) w.markDone(client, guild.id, 'antinuke');
      return present(interaction, STEPS.antinuke.view(ctx, next ? '✅ Anti-nuke is now protecting this server.' : '⚫ Anti-nuke disabled.'));
    }
    if (action === 'preset' && interaction.isStringSelectMenu()) {
      const key = interaction.values[0];
      const preset = ANTINUKE_PRESETS[key];
      if (!preset) return null;
      client.config.update(guild.id, 'security', { enabled: true, setupPreset: key, actions: preset });
      w.markDone(client, guild.id, 'antinuke');
      return present(interaction, STEPS.antinuke.view(ctx, `✅ Applied the **${key}** protection preset (anti-nuke enabled).`));
    }
    if (action === 'roles' && interaction.isRoleSelectMenu()) {
      const current = Array.isArray(cfg.trustedRoles) ? cfg.trustedRoles : [];
      const merged = Array.from(new Set([...current, ...interaction.values])).slice(0, 50);
      client.config.update(guild.id, 'security', { trustedRoles: merged });
      return present(interaction, STEPS.antinuke.view(ctx, `✅ Trusted roles updated (${merged.length} total).`));
    }
    return null;
  },
};

// --- 17. Backups -----------------------------------------------------------
STEPS.backups = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('backups');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'backup', { auto: { enabled: false } });
    const auto = Boolean(cfg.auto?.enabled);
    let count = 0;
    try {
      count = (client.services.backup.list?.(guild.id) || []).length;
    } catch {
      count = 0;
    }
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Backups snapshot your roles, channels, and all SMPbot settings. If someone nukes the server, they can be restored — and anti-nuke uses them to auto-recover.',
        '',
        `**Saved backups:** ${count}`,
        `**Automatic backups:** ${auto ? '🟢 On' : '⚫ Off'}`,
        '',
        'Make your first backup now, and turn on automatic backups. Manage and restore with **`/backup`**.',
      ].join('\n'),
    );
    const row = new ActionRowBuilder().addComponents(
      btn('setup:step:backups:create', 'Create first backup now', ButtonStyle.Success, '💾'),
      btn('setup:step:backups:auto', auto ? 'Turn off auto-backups' : 'Turn on auto-backups', auto ? ButtonStyle.Secondary : ButtonStyle.Primary, '🔁'),
    );
    return { embeds: [embed], components: [row, w.controlsRow('backups')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    const service = client.services?.backup;
    if (!service) return present(interaction, w.notLoadedView(client, guild, w.STEP_INDEX.get('backups')));
    if (action === 'create') {
      await ackSlow(interaction);
      try {
        const id = await service.create(guild, { reason: 'Initial setup wizard backup' });
        w.markDone(client, guild.id, 'backups');
        return present(interaction, STEPS.backups.view(ctx, `✅ Backup created${id ? ` (\`${String(id).slice(0, 20)}\`)` : ''}.`));
      } catch (err) {
        log.debug('setup: backup create failed:', err?.message ?? err);
        return present(interaction, STEPS.backups.view(ctx, '⚠️ Could not create a backup — check my permissions and try again with `/backup`.'));
      }
    }
    if (action === 'auto') {
      const cfg = client.config.get(guild.id, 'backup', { auto: { enabled: false } });
      const next = !cfg.auto?.enabled;
      client.config.update(guild.id, 'backup', { auto: { enabled: next } });
      w.markDone(client, guild.id, 'backups');
      const tip = next ? '✅ Automatic backups turned on. Confirm the interval and schedule with `/backup auto`.' : '⚫ Automatic backups turned off.';
      return present(interaction, STEPS.backups.view(ctx, tip));
    }
    return null;
  },
};

// --- 18. Logging -----------------------------------------------------------
STEPS.logging = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('logging');
    const cfg = client.config.get(guild.id, 'logging', { enabled: true, channels: {} });
    const mapped = Object.keys(cfg.channels || {}).length;
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Logging keeps a record of what happens: moderation actions, joins/leaves, message edits, role and channel changes, and security events.',
        '',
        `**Log channels mapped:** ${mapped}`,
        '',
        'Let SMPbot **auto-create** a private set of log channels, or send **everything to one channel** you choose.',
      ].join('\n'),
    );
    const row = new ActionRowBuilder().addComponents(btn('setup:step:logging:auto', 'Auto-create logging channels', ButtonStyle.Success, '🗂️'));
    return { embeds: [embed], components: [row, channelSelectRow('setup:step:logging:channel', 'Or send all logs to one channel…'), w.controlsRow('logging')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    if (action === 'channel' && interaction.isChannelSelectMenu()) {
      const channelId = interaction.values[0];
      client.config.update(guild.id, 'logging', { enabled: true, channels: { default: channelId } });
      w.markDone(client, guild.id, 'logging');
      return present(interaction, STEPS.logging.view(ctx, `✅ All logs will now go to <#${channelId}>.`));
    }
    if (action === 'auto' && interaction.isButton()) {
      const warn = meMissing(ctx, PermissionFlagsBits.ManageChannels, 'Manage Channels');
      if (warn) return tell(interaction, warn);
      await ackSlow(interaction);
      try {
        const everyone = guild.roles.everyone;
        const category = await guild.channels.create({
          name: LOG_CATEGORY_NAME,
          type: ChannelType.GuildCategory,
          permissionOverwrites: [{ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
          reason: 'SMPbot setup: logging category',
        });
        const channels = {};
        let defaultId = null;
        for (const group of LOG_GROUPS) {
          try {
            const ch = await guild.channels.create({
              name: group.name,
              type: ChannelType.GuildText,
              parent: category.id,
              permissionOverwrites: [{ id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
              reason: 'SMPbot setup: logging channel',
            });
            for (const type of group.types) channels[type] = ch.id;
            if (group.name === 'server-logs') defaultId = ch.id;
          } catch (err) {
            log.debug(`setup: logging channel '${group.name}' failed:`, err?.message ?? err);
          }
        }
        // Ensure every core LOG_TYPE has a home; fall back to the default channel.
        if (defaultId) {
          channels.default = defaultId;
          for (const type of LOG_TYPES) if (!channels[type]) channels[type] = defaultId;
        }
        client.config.update(guild.id, 'logging', { enabled: true, channels });
        w.markDone(client, guild.id, 'logging');
        return present(interaction, STEPS.logging.view(ctx, `✅ Created a private **${LOG_CATEGORY_NAME}** category with ${LOG_GROUPS.length} log channels and mapped every log type.`));
      } catch (err) {
        log.debug('setup: logging auto-create failed:', err?.message ?? err);
        return present(interaction, STEPS.logging.view(ctx, '⚠️ Could not create the logging channels — check my **Manage Channels** permission.'));
      }
    }
    return null;
  },
};

// --- 19. Welcome -----------------------------------------------------------
STEPS.welcome = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('welcome');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'welcome', {});
    const chanTxt = cfg.channelId ? `<#${cfg.channelId}>` : '_not set_';
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Welcome messages greet every new member with a friendly, themed embed so your SMP feels alive.',
        '',
        `**Welcome channel:** ${chanTxt} · ${cfg.enabled ? '🟢 On' : '⚫ Off'}`,
        '',
        'Pick a channel to turn welcomes on with a good default message, then send a test. Customize the wording with **`/welcome`**.',
      ].join('\n'),
    );
    return {
      embeds: [embed],
      components: [
        channelSelectRow('setup:step:welcome:channel', 'Pick the welcome channel…'),
        new ActionRowBuilder().addComponents(btn('setup:step:welcome:test', 'Send a test welcome', ButtonStyle.Secondary, '🧪')),
        w.controlsRow('welcome'),
      ],
    };
  },

  async handle(ctx, action) {
    const { client, guild, interaction, member } = ctx;
    if (action === 'channel' && interaction.isChannelSelectMenu()) {
      const channelId = interaction.values[0];
      client.config.update(guild.id, 'welcome', { channelId, enabled: true });
      w.markDone(client, guild.id, 'welcome');
      return present(interaction, STEPS.welcome.view(ctx, `✅ Welcomes are on and will post in <#${channelId}>.`));
    }
    if (action === 'test' && interaction.isButton()) {
      const cfg = client.config.get(guild.id, 'welcome', {});
      if (!cfg.channelId) return tell(interaction, w.warnPayload(client, guild, 'Pick a channel first', 'Choose a welcome channel above, then send a test.'));
      const channel = guild.channels.cache.get(cfg.channelId) || (await guild.channels.fetch(cfg.channelId).catch(() => null));
      if (!channel) return tell(interaction, w.warnPayload(client, guild, 'Channel unavailable', 'The welcome channel could not be found.'));
      await ackSlow(interaction);
      try {
        const template = cfg.description || 'Hey {user}, welcome to **{server}**! 🎉';
        let body = template;
        try {
          body = client.services.welcome?.renderMessage?.(guild, member, template) || template;
        } catch {
          body = template.replace(/\{user\}/g, `<@${member.id}>`).replace(/\{server\}/g, guild.name);
        }
        const embed = client.brand.embed(guild).setTitle(cfg.title ? cfg.title.replace(/\{server\}/g, guild.name) : `Welcome to ${guild.name}!`).setDescription(body);
        await client.hooks.send(channel, { embeds: [embed] });
        return present(interaction, STEPS.welcome.view(ctx, `✅ Sent a test welcome to ${channel}.`));
      } catch (err) {
        log.debug('setup: welcome test failed:', err?.message ?? err);
        return present(interaction, STEPS.welcome.view(ctx, '⚠️ Could not send a test there — check my permissions in that channel.'));
      }
    }
    return null;
  },
};

// --- 20. Leveling ----------------------------------------------------------
STEPS.leveling = {
  view(ctx, note) {
    const { client, guild } = ctx;
    const step = w.STEP_INDEX.get('leveling');
    if (!w.featureLoaded(client, step.feature)) return w.notLoadedView(client, guild, step);
    const cfg = client.config.get(guild.id, 'leveling', { enabled: true, announce: {} });
    const enabled = cfg.enabled !== false;
    const chanTxt = cfg.announce?.channelId ? `<#${cfg.announce.channelId}>` : '_where the level-up happens_';
    const embed = w.stepEmbed(client, guild, step, { note }).setDescription(
      [
        'Leveling rewards active members with XP and levels as they chat, with optional level-up announcements and role rewards.',
        '',
        `**Status:** ${enabled ? '🟢 On' : '⚫ Off'}`,
        `**Announce level-ups in:** ${chanTxt}`,
        '',
        'Set up level-reward roles and XP rates with **`/levels`** and **`/levelroles`**.',
      ].join('\n'),
    );
    const row = new ActionRowBuilder().addComponents(
      btn('setup:step:leveling:toggle', enabled ? 'Turn leveling off' : 'Turn leveling on', enabled ? ButtonStyle.Secondary : ButtonStyle.Success, '📈'),
    );
    return { embeds: [embed], components: [row, channelSelectRow('setup:step:leveling:channel', 'Announce level-ups in…'), w.controlsRow('leveling')] };
  },

  async handle(ctx, action) {
    const { client, guild, interaction } = ctx;
    const cfg = client.config.get(guild.id, 'leveling', { enabled: true, announce: {} });
    if (action === 'toggle') {
      const next = !(cfg.enabled !== false);
      client.config.update(guild.id, 'leveling', { enabled: next });
      w.markDone(client, guild.id, 'leveling');
      return present(interaction, STEPS.leveling.view(ctx, `✅ Leveling is now **${next ? 'on' : 'off'}**.`));
    }
    if (action === 'channel' && interaction.isChannelSelectMenu()) {
      const channelId = interaction.values[0];
      client.config.update(guild.id, 'leveling', { enabled: true, announce: { enabled: true, channelId } });
      w.markDone(client, guild.id, 'leveling');
      return present(interaction, STEPS.leveling.view(ctx, `✅ Level-ups will be announced in <#${channelId}>.`));
    }
    return null;
  },
};

module.exports = { STEPS };
