'use strict';

const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const log = require('../../../core/logger');
const { truncate, formatDuration } = require('../../../core/utils');
const { config, resolveChannel, LOG_TYPE, MODES } = require('../services/config');
const verify = require('../services/verify');
const captcha = require('../services/captcha');
const wizard = require('../services/wizard');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

async function loadMember(interaction) {
  let member = interaction.member;
  if (!member?.roles?.cache) member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  return member;
}

/** Log a staff-facing role-assignment failure to the verification log. */
async function logStaffError(client, guild, staffError) {
  try {
    await client.logs.send(guild, LOG_TYPE, {
      embeds: [
        client.brand
          .embed(guild, { color: 'error' })
          .setTitle('⚠️ Verification could not grant a role')
          .setDescription(truncate(staffError, 4000)),
      ],
    });
  } catch (err) {
    log.debug('verification: staff error log failed:', err?.message ?? err);
  }
}

function validateAssignableRole(guild, role) {
  if (!role) return { ok: false, reason: 'That role no longer exists — pick another.' };
  if (role.id === guild.roles.everyone.id) return { ok: false, reason: 'You cannot use the @everyone role.' };
  if (role.managed) {
    return { ok: false, reason: `**${role.name}** is managed by an integration and cannot be assigned manually. Pick another.` };
  }
  const me = guild.members.me;
  if (me && me.roles.highest.comparePositionTo(role) <= 0) {
    return {
      ok: false,
      reason: `**${role.name}** is above SMPbot's highest role, so I cannot assign it. Move SMPbot's role higher (Server Settings › Roles) or choose a lower role.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Member-facing flow.
// ---------------------------------------------------------------------------

async function handleStart(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  if (!interaction.isButton()) return null;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const cfg = config(client, guild.id);
  if (!cfg.enabled) {
    return interaction.editReply({ embeds: [client.brand.warn(guild, 'Verification unavailable', 'Verification is not active in this server right now.')] }).catch(() => null);
  }

  const member = await loadMember(interaction);
  if (!member) {
    return interaction.editReply({ embeds: [client.brand.error(guild, 'Something went wrong', 'Your membership could not be verified — please try again.')] }).catch(() => null);
  }

  if (cfg.verifiedRoleId && member.roles.cache.has(cfg.verifiedRoleId)) {
    verify.cancelKick(client, guild.id, member.id);
    return interaction.editReply({ embeds: [client.brand.info(guild, 'Already verified', 'You are already verified — welcome back! 🎉')] }).catch(() => null);
  }

  // Cooldown between attempts.
  if (Number(cfg.cooldownSeconds) > 0) {
    const remaining = client.cooldowns.hit(`verify:attempt:${guild.id}:${interaction.user.id}`, cfg.cooldownSeconds);
    if (remaining > 0) {
      return interaction.editReply({ embeds: [client.brand.warn(guild, 'Slow down', `You can try to verify again in **${formatDuration(remaining) || '1s'}**.`)] }).catch(() => null);
    }
  }

  // Minimum account age.
  const unlock = verify.accountAgeUnlock(interaction.user, cfg);
  if (unlock) {
    return interaction
      .editReply({
        embeds: [
          client.brand.error(
            guild,
            'Account too new',
            `Your Discord account is not old enough to verify here yet.\nYou can verify on ${verify.ageUnlockText(unlock)}.`,
          ),
        ],
      })
      .catch(() => null);
  }

  if (cfg.mode === 'captcha') {
    const challenge = verify.buildCaptchaChallenge(client, guild, interaction.user.id);
    return interaction.editReply(challenge).catch((err) => {
      log.warn('verification: failed to send captcha challenge:', err?.message ?? err);
      return interaction
        .editReply({ embeds: [client.brand.error(guild, 'Something went wrong', 'I could not start the captcha — please try again.')] })
        .catch(() => null);
    });
  }

  // Button mode — grant instantly.
  const res = await verify.verifyMember(client, guild, member, cfg, { mode: 'button' });
  if (!res.ok) {
    await logStaffError(client, guild, res.staffError);
    return interaction.editReply({ embeds: [client.brand.error(guild, 'Verification failed', res.userMessage)] }).catch(() => null);
  }
  return interaction
    .editReply({ embeds: [client.brand.success(guild, 'Verified!', `You now have <@&${res.role.id}> and full access to the server. Welcome! 🎉`)] })
    .catch(() => null);
}

async function handleCode(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  if (!interaction.isButton()) return null;

  const cfg = config(client, guild.id);
  if (!cfg.enabled) {
    return interaction.reply(eph({ embeds: [client.brand.warn(guild, 'Verification unavailable', 'Verification is not active right now.')] })).catch(() => null);
  }

  const pending = verify.getPending(client, guild.id, interaction.user.id);
  if (!pending || pending.expires_at <= Date.now()) {
    verify.clearPending(client, guild.id, interaction.user.id);
    return interaction
      .reply(eph({ embeds: [client.brand.warn(guild, 'Code expired', 'Your captcha expired. Click **Verify** again to get a fresh code.')] }))
      .catch(() => null);
  }

  // showModal MUST be the first response — do not defer beforehand.
  const modal = new ModalBuilder()
    .setCustomId('verify:codemodal')
    .setTitle('Enter your verification code')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('code')
          .setLabel('Your 5-character code')
          .setPlaceholder('e.g. K7P2M')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(12),
      ),
    );
  return interaction.showModal(modal);
}

async function handleCodeModal(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  if (!interaction.isModalSubmit()) return null;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const cfg = config(client, guild.id);
  if (!cfg.enabled) {
    return interaction.editReply({ embeds: [client.brand.warn(guild, 'Verification unavailable', 'Verification is not active right now.')] }).catch(() => null);
  }

  const member = await loadMember(interaction);
  if (!member) {
    return interaction.editReply({ embeds: [client.brand.error(guild, 'Something went wrong', 'Your membership could not be verified — please try again.')] }).catch(() => null);
  }

  if (cfg.verifiedRoleId && member.roles.cache.has(cfg.verifiedRoleId)) {
    verify.clearPending(client, guild.id, interaction.user.id);
    return interaction.editReply({ embeds: [client.brand.info(guild, 'Already verified', 'You are already verified — welcome back! 🎉')] }).catch(() => null);
  }

  const pending = verify.getPending(client, guild.id, interaction.user.id);
  if (!pending || pending.expires_at <= Date.now()) {
    verify.clearPending(client, guild.id, interaction.user.id);
    return interaction.editReply({ embeds: [client.brand.warn(guild, 'Code expired', 'Your captcha expired. Click **Verify** again to get a fresh code.')] }).catch(() => null);
  }

  const input = captcha.normalize(interaction.fields.getTextInputValue('code'));
  if (input === pending.code) {
    const res = await verify.verifyMember(client, guild, member, cfg, { mode: 'captcha' });
    if (!res.ok) {
      await logStaffError(client, guild, res.staffError);
      return interaction.editReply({ embeds: [client.brand.error(guild, 'Verification failed', res.userMessage)] }).catch(() => null);
    }
    return interaction
      .editReply({ embeds: [client.brand.success(guild, 'Verified!', `Captcha solved. You now have <@&${res.role.id}> and full access. Welcome! 🎉`)] })
      .catch(() => null);
  }

  // Incorrect — count the attempt.
  verify.bumpAttempts(client, guild.id, interaction.user.id);
  const used = (pending.attempts ?? 0) + 1;
  if (used >= verify.MAX_ATTEMPTS) {
    verify.clearPending(client, guild.id, interaction.user.id);
    return interaction
      .editReply({ embeds: [client.brand.error(guild, 'Too many attempts', 'That code was wrong too many times. Click **Verify** again to request a brand-new code.')] })
      .catch(() => null);
  }
  const left = verify.MAX_ATTEMPTS - used;
  return interaction
    .editReply({ embeds: [client.brand.error(guild, 'Incorrect code', `That code was not correct. You have **${left}** attempt(s) left before you need a new code.`)] })
    .catch(() => null);
}

async function handleNewCode(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  if (!interaction.isButton()) return null;

  await interaction.deferUpdate().catch(() => null);
  const cfg = config(client, guild.id);
  if (!cfg.enabled || cfg.mode !== 'captcha') {
    return interaction.editReply({ embeds: [client.brand.warn(guild, 'Verification unavailable', 'Captcha verification is not active right now.')], components: [], files: [] }).catch(() => null);
  }

  // Guard against spamming new codes.
  const remaining = client.cooldowns.hit(`verify:newcode:${guild.id}:${interaction.user.id}`, 3);
  if (remaining > 0) {
    return interaction.followUp(eph({ embeds: [client.brand.warn(guild, 'Slow down', 'Please wait a moment before requesting a new code.')] })).catch(() => null);
  }

  const member = await loadMember(interaction);
  if (member && cfg.verifiedRoleId && member.roles.cache.has(cfg.verifiedRoleId)) {
    verify.clearPending(client, guild.id, interaction.user.id);
    return interaction.editReply({ embeds: [client.brand.info(guild, 'Already verified', 'You are already verified — welcome back! 🎉')], components: [], files: [] }).catch(() => null);
  }

  const challenge = verify.buildCaptchaChallenge(client, guild, interaction.user.id);
  return interaction.editReply(challenge).catch((err) => {
    log.warn('verification: failed to refresh captcha:', err?.message ?? err);
    return null;
  });
}

// ---------------------------------------------------------------------------
// Admin setup wizard.
// ---------------------------------------------------------------------------

async function handleSetup(interaction, step) {
  const client = interaction.client;
  const guild = interaction.guild;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to configure verification.')] })).catch(() => null);
  }

  if (step === 'verified' && interaction.isRoleSelectMenu()) {
    const roleId = interaction.values?.[0];
    const role = guild.roles.cache.get(roleId);
    const check = validateAssignableRole(guild, role);
    if (!check.ok) {
      return interaction.update(wizard.stepVerified(client, guild, check.reason)).catch(() => null);
    }
    client.config.update(guild.id, 'verification', { verifiedRoleId: roleId });
    return interaction.update(wizard.stepUnverified(client, guild)).catch(() => null);
  }

  if (step === 'unverified' && interaction.isRoleSelectMenu()) {
    const roleId = interaction.values?.[0];
    const role = guild.roles.cache.get(roleId);
    const check = validateAssignableRole(guild, role);
    if (!check.ok) {
      return interaction.update(wizard.stepUnverified(client, guild, check.reason)).catch(() => null);
    }
    client.config.update(guild.id, 'verification', { unverifiedRoleId: roleId });
    return interaction.update(wizard.stepChannel(client, guild)).catch(() => null);
  }

  if (step === 'skipunverified' && interaction.isButton()) {
    client.config.update(guild.id, 'verification', { unverifiedRoleId: null });
    return interaction.update(wizard.stepChannel(client, guild)).catch(() => null);
  }

  if (step === 'channel' && interaction.isChannelSelectMenu()) {
    const channelId = interaction.values?.[0];
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased?.()) {
      return interaction.update(wizard.stepChannel(client, guild)).catch(() => null);
    }
    client.config.update(guild.id, 'verification', { channelId });
    return interaction.update(wizard.stepMode(client, guild)).catch(() => null);
  }

  if (step === 'mode' && interaction.isStringSelectMenu()) {
    let mode = interaction.values?.[0];
    if (!MODES.includes(mode)) mode = 'button';
    client.config.update(guild.id, 'verification', { mode });
    return interaction.update(wizard.stepReview(client, guild)).catch(() => null);
  }

  if (step === 'publish' && interaction.isButton()) {
    await interaction.deferUpdate().catch(() => null);
    const cfg = config(client, guild.id);
    if (!cfg.verifiedRoleId || !cfg.channelId) {
      return interaction.editReply({ embeds: [client.brand.error(guild, 'Setup incomplete', 'Pick a verified role and a channel before publishing.')], components: [] }).catch(() => null);
    }
    const channel = await resolveChannel(guild, cfg.channelId);
    if (!channel) {
      return interaction.editReply({ embeds: [client.brand.error(guild, 'Channel missing', 'The chosen channel no longer exists. Run `/verification setup` again.')], components: [] }).catch(() => null);
    }
    client.config.update(guild.id, 'verification', { enabled: true });
    const res = await verify.publishPanel(client, guild, channel);
    if (!res.ok) {
      return interaction.editReply({ embeds: [client.brand.error(guild, 'Publish failed', res.error)], components: [] }).catch(() => null);
    }
    return interaction
      .editReply({
        embeds: [
          client.brand.success(
            guild,
            'Verification is live! 🚀',
            `The panel is posted in <#${channel.id}> and verification is now **enabled**. Fine-tune it any time with \`/verification set …\`.`,
          ),
        ],
        components: [],
      })
      .catch(() => null);
  }

  return null;
}

module.exports = {
  prefix: 'verify',

  async handle(interaction, args) {
    const client = interaction.client;
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction.reply(eph({ embeds: [client.brand.error(null, 'Server only', 'Verification only works inside a server.')] })).catch(() => null);
    }

    const [action, sub] = args;
    switch (action) {
      case 'setup':
        return handleSetup(interaction, sub);
      case 'start':
        return handleStart(interaction);
      case 'code':
        return handleCode(interaction);
      case 'codemodal':
        return handleCodeModal(interaction);
      case 'newcode':
        return handleNewCode(interaction);
      default:
        return null;
    }
  },
};
