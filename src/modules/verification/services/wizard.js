'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const { config } = require('./config');

/**
 * Guided /verification setup wizard. Each step writes its selection to the
 * `verification` config namespace immediately (so progress is restart-safe) and
 * renders the next step in place. All payloads are ephemeral — the caller adds
 * the flag. Component customIds all live under the `verify:setup:*` prefix.
 */

function roleLabel(guild, roleId) {
  if (!roleId) return '*none*';
  const role = guild.roles.cache.get(roleId);
  return role ? `<@&${role.id}>` : `\`${roleId}\` *(deleted?)*`;
}

function channelLabel(guild, channelId) {
  if (!channelId) return '*not set*';
  const channel = guild.channels.cache.get(channelId);
  return channel ? `<#${channel.id}>` : `\`${channelId}\` *(deleted?)*`;
}

function modeLabel(mode) {
  return mode === 'captcha' ? '🧩 Captcha' : '✅ Button';
}

/** Step 1 — pick the verified role. */
function stepVerified(client, guild, note) {
  const embed = client.brand
    .embed(guild, { color: 'info' })
    .setTitle('🔐 Verification setup — Step 1 of 4')
    .setDescription(
      [
        note ? `⚠️ ${note}\n` : '',
        'Select the role members will receive **once they verify**.',
        'This role should unlock the rest of the server.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  const row = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('verify:setup:verified')
      .setPlaceholder('Choose the verified role…')
      .setMinValues(1)
      .setMaxValues(1),
  );
  return { embeds: [embed], components: [row] };
}

/** Step 2 — optional unverified role. */
function stepUnverified(client, guild, note) {
  const cfg = config(client, guild.id);
  const embed = client.brand
    .embed(guild, { color: 'info' })
    .setTitle('🔐 Verification setup — Step 2 of 4')
    .setDescription(
      [
        note ? `⚠️ ${note}\n` : '',
        `Verified role: ${roleLabel(guild, cfg.verifiedRoleId)}`,
        '',
        'Optionally pick an **unverified role** assigned to members the moment they join',
        '(and removed automatically when they verify). Skip this if you gate access another way.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  const roleRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('verify:setup:unverified')
      .setPlaceholder('Choose the unverified role (optional)…')
      .setMinValues(1)
      .setMaxValues(1),
  );
  const skipRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify:setup:skipunverified').setLabel('Skip — no unverified role').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [roleRow, skipRow] };
}

/** Step 3 — pick the panel channel. */
function stepChannel(client, guild) {
  const cfg = config(client, guild.id);
  const embed = client.brand
    .embed(guild, { color: 'info' })
    .setTitle('🔐 Verification setup — Step 3 of 4')
    .setDescription(
      [
        `Verified role: ${roleLabel(guild, cfg.verifiedRoleId)}`,
        `Unverified role: ${roleLabel(guild, cfg.unverifiedRoleId)}`,
        '',
        'Select the channel where the **verification panel** will be posted.',
      ].join('\n'),
    );
  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('verify:setup:channel')
      .setPlaceholder('Choose the verification channel…')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1),
  );
  return { embeds: [embed], components: [row] };
}

/** Step 4 — pick the verification mode. */
function stepMode(client, guild) {
  const cfg = config(client, guild.id);
  const embed = client.brand
    .embed(guild, { color: 'info' })
    .setTitle('🔐 Verification setup — Step 4 of 4')
    .setDescription(
      [
        `Verified role: ${roleLabel(guild, cfg.verifiedRoleId)}`,
        `Unverified role: ${roleLabel(guild, cfg.unverifiedRoleId)}`,
        `Channel: ${channelLabel(guild, cfg.channelId)}`,
        '',
        'Choose **how** members verify.',
      ].join('\n'),
    );
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('verify:setup:mode')
      .setPlaceholder('Choose the verification mode…')
      .addOptions(
        {
          label: 'Button — instant',
          value: 'button',
          emoji: '✅',
          description: 'One click grants the verified role right away.',
          default: cfg.mode === 'button',
        },
        {
          label: 'Captcha — solve a code',
          value: 'captcha',
          emoji: '🧩',
          description: 'Members read a distorted image code — stops most bots.',
          default: cfg.mode === 'captcha',
        },
      ),
  );
  return { embeds: [embed], components: [row] };
}

/** Final review — publish + enable. */
function stepReview(client, guild) {
  const cfg = config(client, guild.id);
  const embed = client.brand
    .embed(guild, { color: 'primary' })
    .setTitle('🔐 Verification — ready to launch')
    .setDescription('Review the configuration, then publish the panel and enable verification.')
    .addFields(
      { name: 'Verified role', value: roleLabel(guild, cfg.verifiedRoleId), inline: true },
      { name: 'Unverified role', value: roleLabel(guild, cfg.unverifiedRoleId), inline: true },
      { name: 'Mode', value: modeLabel(cfg.mode), inline: true },
      { name: 'Channel', value: channelLabel(guild, cfg.channelId), inline: true },
      { name: 'Min account age', value: cfg.minAccountAgeDays > 0 ? `${cfg.minAccountAgeDays} day(s)` : 'Off', inline: true },
      {
        name: 'Auto-kick unverified',
        value: cfg.autoKickUnverifiedHours > 0 ? `${cfg.autoKickUnverifiedHours} hour(s)` : 'Off',
        inline: true,
      },
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify:setup:publish')
      .setLabel('Publish panel & enable')
      .setEmoji('🚀')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!cfg.verifiedRoleId || !cfg.channelId),
  );
  return { embeds: [embed], components: [row] };
}

module.exports = { stepVerified, stepUnverified, stepChannel, stepMode, stepReview, roleLabel, channelLabel, modeLabel };
