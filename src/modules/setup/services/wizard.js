'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { isGuildOwner, isBotOwner } = require('../../../core/permissions');

const NAMESPACE = 'setup';

/** Config defaults for the `setup` namespace (exported so templates can reference it). */
const DEFAULTS = {
  completed: false,
  template: null,
  steps: {}, // stepId -> 'done' | 'skipped'
};

/**
 * The 20 wizard steps in order. `feature` describes how to detect whether the
 * owning module is loaded (`service` on client.services, or `module` in
 * client.modules) so a step can degrade gracefully to "this feature isn't
 * loaded" instead of crashing. `power` lists the deep-config commands a step
 * delegates advanced tuning to.
 */
const STEP_META = [
  { id: 'template', num: 1, emoji: '🏗️', title: 'Server Template', short: 'Template', feature: { service: 'templates' }, power: ['/template'] },
  { id: 'branding', num: 2, emoji: '🎨', title: 'Branding', short: 'Branding', feature: { module: 'branding' }, power: ['/branding'] },
  { id: 'theme', num: 3, emoji: '🖌️', title: 'Color Theme', short: 'Theme', feature: null, power: ['/theme'] },
  { id: 'roles', num: 4, emoji: '👥', title: 'Essential Roles', short: 'Roles', feature: null, power: ['/template'] },
  { id: 'channels', num: 5, emoji: '🗂️', title: 'Channels', short: 'Channels', feature: null, power: ['/template'] },
  { id: 'verify', num: 6, emoji: '🔐', title: 'Verification', short: 'Verification', feature: { service: 'verification' }, power: ['/verification'] },
  { id: 'rules', num: 7, emoji: '📜', title: 'Rules', short: 'Rules', feature: { service: 'rules' }, power: ['/rules'] },
  { id: 'mcjava', num: 8, emoji: '☕', title: 'Minecraft Java IP', short: 'Java IP', feature: null, power: ['/server', '/ip'] },
  { id: 'mcbedrock', num: 9, emoji: '📱', title: 'Bedrock IP & Port', short: 'Bedrock', feature: null, power: ['/server', '/ip'] },
  { id: 'tickets', num: 10, emoji: '🎫', title: 'Support Tickets', short: 'Tickets', feature: { module: 'tickets' }, power: ['/ticketpanel', '/ticketconfig'] },
  { id: 'giveaways', num: 11, emoji: '🎉', title: 'Giveaways', short: 'Giveaways', feature: { module: 'giveaways' }, power: ['/giveaway'] },
  { id: 'moderation', num: 12, emoji: '🔨', title: 'Moderation', short: 'Moderation', feature: { module: 'modlog' }, power: ['/warn', '/ban', '/timeout', '/warnings'] },
  { id: 'spam', num: 13, emoji: '🌊', title: 'Anti-Spam', short: 'Anti-Spam', feature: { module: 'automod' }, power: ['/automod'] },
  { id: 'links', num: 14, emoji: '🔗', title: 'Anti-Link', short: 'Anti-Link', feature: { module: 'automod' }, power: ['/automod'] },
  { id: 'nsfw', num: 15, emoji: '🔞', title: 'Anti-NSFW', short: 'Anti-NSFW', feature: { module: 'automod' }, power: ['/automod'] },
  { id: 'antinuke', num: 16, emoji: '🛡️', title: 'Anti-Nuke', short: 'Anti-Nuke', feature: { service: 'security' }, power: ['/antinuke', '/security', '/trusted'] },
  { id: 'backups', num: 17, emoji: '💾', title: 'Backups', short: 'Backups', feature: { service: 'backup' }, power: ['/backup'] },
  { id: 'logging', num: 18, emoji: '🧾', title: 'Logging', short: 'Logging', feature: null, power: [] },
  { id: 'welcome', num: 19, emoji: '👋', title: 'Welcome Messages', short: 'Welcome', feature: { module: 'welcome' }, power: ['/welcome'] },
  { id: 'leveling', num: 20, emoji: '📈', title: 'Leveling', short: 'Leveling', feature: { module: 'leveling' }, power: ['/levels', '/levelroles'] },
];

const STEP_INDEX = new Map(STEP_META.map((s) => [s.id, s]));
const STEP_ORDER = STEP_META.map((s) => s.id);

/** Display grouping of the 20 steps into named pages for the home dashboard. */
const PAGES = [
  { emoji: '🧱', label: 'Foundations', steps: ['template', 'branding', 'theme'] },
  { emoji: '🏗️', label: 'Structure', steps: ['roles', 'channels'] },
  { emoji: '🔐', label: 'Access & Content', steps: ['verify', 'rules'] },
  { emoji: '🎮', label: 'Minecraft Server', steps: ['mcjava', 'mcbedrock'] },
  { emoji: '🤝', label: 'Community', steps: ['tickets', 'giveaways'] },
  { emoji: '🛡️', label: 'Safety & Moderation', steps: ['moderation', 'spam', 'links', 'nsfw', 'antinuke'] },
  { emoji: '🧰', label: 'Operations', steps: ['backups', 'logging', 'welcome', 'leveling'] },
];

const STATUS = {
  done: { emoji: '✅', label: 'Done' },
  skipped: { emoji: '⏭️', label: 'Skipped' },
  todo: { emoji: '⬜', label: 'Not set up' },
};

const EPHEMERAL = MessageFlags.Ephemeral;

// ---------------------------------------------------------------------------
// State (persisted in the `setup` config namespace).
// ---------------------------------------------------------------------------

function getState(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

function stepState(state, stepId) {
  const s = state?.steps?.[stepId];
  return s === 'done' || s === 'skipped' ? s : 'todo';
}

function setStepState(client, guildId, stepId, value) {
  if (!STEP_INDEX.has(stepId)) return;
  client.config.update(guildId, NAMESPACE, { steps: { [stepId]: value } });
}

function markDone(client, guildId, stepId) {
  setStepState(client, guildId, stepId, 'done');
}

function resetProgress(client, guildId) {
  client.config.set(guildId, NAMESPACE, { completed: false, template: null, steps: {} });
}

function setCompleted(client, guildId, value = true) {
  client.config.update(guildId, NAMESPACE, { completed: Boolean(value) });
}

function setTemplate(client, guildId, templateId) {
  client.config.update(guildId, NAMESPACE, { template: templateId });
}

// ---------------------------------------------------------------------------
// Detection & permission helpers.
// ---------------------------------------------------------------------------

/** Only the guild owner (or a bot owner) may drive the wizard. */
function authorized(interaction) {
  return isGuildOwner(interaction.member) || isBotOwner(interaction.user.id);
}

/** True if the module/service that owns a step's feature is actually loaded. */
function featureLoaded(client, feature) {
  if (!feature) return true;
  if (feature.service) return Boolean(client.services?.[feature.service]);
  if (feature.module) return Boolean(client.modules?.has?.(feature.module));
  return true;
}

function meFor(guild) {
  return guild?.members?.me ?? null;
}

/** True when SMPbot has the given permission guild-wide. */
function botHas(guild, permFlag) {
  const me = meFor(guild);
  return Boolean(me?.permissions?.has?.(permFlag));
}

// ---------------------------------------------------------------------------
// Shared UI builders.
// ---------------------------------------------------------------------------

function statusOf(client, guild, stepId) {
  return stepState(getState(client, guild.id), stepId);
}

/** The standard bottom control row present on EVERY step (never dead-ends). */
function controlsRow(stepId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup:mark:${stepId}:done`).setLabel('Mark done').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`setup:mark:${stepId}:skip`).setLabel('Skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:home').setLabel('Back to overview').setEmoji('🏠').setStyle(ButtonStyle.Primary),
  );
}

/** Base themed embed for a step screen. */
function stepEmbed(client, guild, step, { note } = {}) {
  const state = statusOf(client, guild, step.id);
  const st = STATUS[state];
  const embed = client.brand
    .embed(guild)
    .setTitle(`${step.emoji} Step ${step.num}/20 — ${step.title}`)
    .setFooter({ text: `${st.emoji} ${st.label} • SMPbot Setup` });
  if (step.power?.length) {
    embed.addFields({ name: '🔧 Fine-tune later', value: step.power.map((c) => `\`${c}\``).join(' · ') });
  }
  if (note) embed.addFields({ name: '​', value: note.slice(0, 1024) });
  return embed;
}

/** Standard "feature not loaded" screen for a step whose module is missing. */
function notLoadedView(client, guild, step) {
  const embed = stepEmbed(client, guild, step).setDescription(
    `This part of SMPbot (**${step.title}**) is not currently loaded on this server, so it cannot be configured from the wizard right now.\n\nYou can safely **skip** this step — nothing else depends on it. If you expected this feature to be available, make sure the module is enabled and try again.`,
  );
  return { embeds: [embed], components: [controlsRow(step.id)] };
}

/** Small ephemeral warning payload (for missing-permission feedback etc.). */
function warnPayload(client, guild, title, description) {
  return { embeds: [client.brand.warn(guild, title, description)], flags: EPHEMERAL };
}

// ---------------------------------------------------------------------------
// HOME dashboard.
// ---------------------------------------------------------------------------

function buildHome(client, guild) {
  const state = getState(client, guild.id);
  let done = 0;
  let skipped = 0;
  for (const id of STEP_ORDER) {
    const s = stepState(state, id);
    if (s === 'done') done += 1;
    else if (s === 'skipped') skipped += 1;
  }
  const total = STEP_ORDER.length;
  const configured = done + skipped;
  const bar = progressBar(configured, total);

  const lines = [];
  for (const page of PAGES) {
    lines.push(`\n**${page.emoji} ${page.label}**`);
    for (const id of page.steps) {
      const step = STEP_INDEX.get(id);
      const s = stepState(state, id);
      const loaded = featureLoaded(client, step.feature);
      const tag = loaded ? '' : ' _(not loaded)_';
      lines.push(`${STATUS[s].emoji} \`${String(step.num).padStart(2, ' ')}\` ${step.emoji} ${step.title}${tag}`);
    }
  }

  const embed = client.brand
    .embed(guild)
    .setTitle('🧭 SMPbot Setup Wizard')
    .setDescription(
      [
        `Welcome${guild?.name ? ` to **${guild.name}**` : ''}! This wizard walks you through everything SMPbot can do — in plain language, one small step at a time. Your progress is saved automatically, so you can stop and come back to \`/setup\` any time.`,
        '',
        `**Progress:** ${bar}  ${done} done · ${skipped} skipped · ${total - configured} left`,
        lines.join('\n'),
        '',
        '**Jump to any step** with the menu below, hit **Continue** for the next thing to set up, or **Finish** when you are happy.',
      ].join('\n'),
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup:jump')
    .setPlaceholder('Jump to a setup step…')
    .addOptions(
      STEP_META.map((step) => {
        const s = stepState(state, step.id);
        return {
          label: `${step.num}. ${step.title}`.slice(0, 100),
          value: step.id,
          emoji: STATUS[s].emoji,
          description: `${STATUS[s].label}${featureLoaded(client, step.feature) ? '' : ' • not loaded'}`.slice(0, 100),
        };
      }),
    );

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:continue').setLabel('Continue').setEmoji('➡️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:finish').setLabel('Finish').setEmoji('🏁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup:reset').setLabel('Reset progress').setEmoji('♻️').setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), buttons] };
}

function progressBar(value, total, width = 12) {
  const filled = total > 0 ? Math.round((value / total) * width) : 0;
  return `\`${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}\` ${Math.round((value / total) * 100)}%`;
}

/** Next step (in order) that is still `todo`, or null when everything is set. */
function nextIncomplete(client, guildId) {
  const state = getState(client, guildId);
  for (const id of STEP_ORDER) {
    if (stepState(state, id) === 'todo') return id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// FINISH screen.
// ---------------------------------------------------------------------------

const KEY_PERMISSIONS = [
  { flag: PermissionFlagsBits.ManageChannels, name: 'Manage Channels' },
  { flag: PermissionFlagsBits.ManageRoles, name: 'Manage Roles' },
  { flag: PermissionFlagsBits.ManageWebhooks, name: 'Manage Webhooks' },
  { flag: PermissionFlagsBits.KickMembers, name: 'Kick Members' },
  { flag: PermissionFlagsBits.BanMembers, name: 'Ban Members' },
  { flag: PermissionFlagsBits.ManageGuild, name: 'Manage Server' },
  { flag: PermissionFlagsBits.ModerateMembers, name: 'Timeout Members' },
];

function buildFinish(client, guild) {
  setCompleted(client, guild.id, true);
  const state = getState(client, guild.id);

  const doneList = [];
  const skippedList = [];
  const todoList = [];
  for (const step of STEP_META) {
    const s = stepState(state, step.id);
    const entry = `${step.emoji} ${step.title}`;
    if (s === 'done') doneList.push(entry);
    else if (s === 'skipped') skippedList.push(entry);
    else todoList.push(entry);
  }

  const embed = client.brand
    .embed(guild, { color: 'success' })
    .setTitle('🎉 Your server is ready!')
    .setDescription(
      [
        `Nice work${guild?.name ? `, **${guild.name}**` : ''}! Here is what SMPbot has set up. You can reopen \`/setup\` at any time to change anything, or use the deeper commands for each feature.`,
        '',
        `**${doneList.length}/20** areas configured.`,
      ].join('\n'),
    );

  if (doneList.length) embed.addFields({ name: `✅ Configured (${doneList.length})`, value: truncateList(doneList) });
  if (skippedList.length) embed.addFields({ name: `⏭️ Skipped (${skippedList.length})`, value: truncateList(skippedList) });
  if (todoList.length) embed.addFields({ name: `⬜ Still open (${todoList.length})`, value: truncateList(todoList) });

  // Permission health check.
  const me = meFor(guild);
  const hasAdmin = Boolean(me?.permissions?.has?.(PermissionFlagsBits.Administrator));
  if (!hasAdmin) {
    const missing = KEY_PERMISSIONS.filter((p) => !me?.permissions?.has?.(p.flag)).map((p) => p.name);
    if (missing.length) {
      embed.addFields({
        name: '⚠️ Missing permissions',
        value:
          `SMPbot is missing some permissions it needs to run everything reliably:\n${missing
            .map((n) => `• **${n}**`)
            .join('\n')}\n\nGive SMPbot **Administrator** (recommended) or the permissions above, or features that need them will silently do nothing.`.slice(0, 1024),
      });
    } else {
      embed.addFields({
        name: 'ℹ️ Permissions',
        value: 'SMPbot has the key permissions it needs. Granting **Administrator** is still the simplest way to guarantee every feature works.',
      });
    }
  } else {
    embed.addFields({ name: '✅ Permissions', value: 'SMPbot has **Administrator** — every feature has the access it needs.' });
  }

  embed.addFields({
    name: '💡 Next steps',
    value: [
      '• Post your rules & verification panels where members will see them.',
      '• Invite your staff and assign the **Staff**/**Admin** roles.',
      '• Try `/help` to explore every command.',
    ].join('\n'),
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:home').setLabel('Back to overview').setEmoji('🏠').setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row] };
}

function truncateList(arr, max = 1024) {
  const text = arr.join('\n');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text || '—';
}

module.exports = {
  NAMESPACE,
  DEFAULTS,
  STEP_META,
  STEP_INDEX,
  STEP_ORDER,
  PAGES,
  STATUS,
  EPHEMERAL,
  getState,
  stepState,
  setStepState,
  markDone,
  resetProgress,
  setCompleted,
  setTemplate,
  authorized,
  featureLoaded,
  botHas,
  meFor,
  statusOf,
  controlsRow,
  stepEmbed,
  notLoadedView,
  warnPayload,
  buildHome,
  nextIncomplete,
  buildFinish,
};
