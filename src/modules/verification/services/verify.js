'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const log = require('../../../core/logger');
const { truncate, absoluteTime, relativeTime } = require('../../../core/utils');
const { config, LOG_TYPE, resolveChannel, resolveRole } = require('./config');
const captcha = require('./captcha');

const KICK_JOB = 'verification:kick';
const PENDING_TTL_MS = 5 * 60 * 1000; // captcha codes live 5 minutes
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pending captcha state (DB-backed, keyed by guild + user).
// ---------------------------------------------------------------------------

function getPending(client, guildId, userId) {
  return client.db.get('SELECT * FROM verification_pending WHERE guild_id = ? AND user_id = ?', guildId, userId);
}

function setPending(client, guildId, userId, code) {
  client.db.run(
    `INSERT INTO verification_pending (guild_id, user_id, code, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET
       code = excluded.code, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at`,
    guildId,
    userId,
    code,
    Date.now() + PENDING_TTL_MS,
    Date.now(),
  );
}

function bumpAttempts(client, guildId, userId) {
  client.db.run('UPDATE verification_pending SET attempts = attempts + 1 WHERE guild_id = ? AND user_id = ?', guildId, userId);
}

function clearPending(client, guildId, userId) {
  client.db.run('DELETE FROM verification_pending WHERE guild_id = ? AND user_id = ?', guildId, userId);
}

// ---------------------------------------------------------------------------
// Auto-kick scheduling.
// ---------------------------------------------------------------------------

/** Schedule an auto-kick job for a member if the feature is enabled. */
function scheduleKick(client, guild, member, cfg) {
  if (!cfg.autoKickUnverifiedHours || cfg.autoKickUnverifiedHours <= 0) return;
  client.scheduler.schedule({
    guildId: guild.id,
    type: KICK_JOB,
    runAt: Date.now() + cfg.autoKickUnverifiedHours * 60 * 60 * 1000,
    data: { userId: member.id },
  });
}

/** Cancel the pending auto-kick job(s) for a specific member. */
function cancelKick(client, guildId, userId) {
  try {
    const jobs = client.scheduler.pending(guildId, KICK_JOB);
    for (const job of jobs) {
      if (String(job.data?.userId) === String(userId)) client.scheduler.cancel(job.id);
    }
  } catch (err) {
    log.debug('verification: cancelKick failed:', err?.message ?? err);
  }
}

// ---------------------------------------------------------------------------
// Account-age helpers.
// ---------------------------------------------------------------------------

/** Timestamp (ms) before which the account is too young, or 0 when the check is off/passes. */
function accountAgeUnlock(user, cfg) {
  const days = Number(cfg.minAccountAgeDays) || 0;
  if (days <= 0) return 0;
  const unlock = (user?.createdTimestamp ?? Date.now()) + days * DAY_MS;
  return unlock > Date.now() ? unlock : 0;
}

// ---------------------------------------------------------------------------
// Role assignment / core verification.
// ---------------------------------------------------------------------------

/**
 * Assign the verified role, remove the unverified role, cancel the auto-kick,
 * log the verification, and optionally DM the member.
 *
 * Returns { ok:true } on success, or { ok:false, userMessage, staffError } when
 * the verified role could not be granted (hierarchy / missing perms / deleted).
 */
async function verifyMember(client, guild, member, cfg, { mode = 'button' } = {}) {
  if (!cfg.verifiedRoleId) {
    return {
      ok: false,
      userMessage: 'Verification is not fully set up yet. Please contact a staff member.',
      staffError: 'No verified role is configured — set one with `/verification setup`.',
    };
  }

  const me = guild.members.me;
  if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return {
      ok: false,
      userMessage: 'I could not grant your role. Please contact a staff member.',
      staffError: 'SMPbot is missing the **Manage Roles** permission — it cannot grant the verified role.',
    };
  }

  const role = await resolveRole(guild, cfg.verifiedRoleId);
  if (!role) {
    return {
      ok: false,
      userMessage: 'The verification role no longer exists. Please contact a staff member.',
      staffError: `The configured verified role (\`${cfg.verifiedRoleId}\`) no longer exists. Reconfigure it with \`/verification setup\`.`,
    };
  }
  if (role.managed) {
    return {
      ok: false,
      userMessage: 'I could not grant your role. Please contact a staff member.',
      staffError: `The verified role **${role.name}** is managed by an integration and cannot be assigned manually.`,
    };
  }
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return {
      ok: false,
      userMessage: 'I could not grant your role because of a role setup issue. Please contact a staff member.',
      staffError: `SMPbot's highest role is not above the verified role **${role.name}** — move SMPbot's role higher in Server Settings › Roles.`,
    };
  }

  // Grant the verified role.
  try {
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role, 'SMPbot verification');
    }
  } catch (err) {
    log.warn('verification: failed to add verified role:', err?.message ?? err);
    return {
      ok: false,
      userMessage: 'I could not grant your role. Please contact a staff member.',
      staffError: `Failed to add the verified role **${role.name}** to <@${member.id}>: ${err?.message ?? 'unknown error'}.`,
    };
  }

  // Remove the unverified role (best-effort).
  if (cfg.unverifiedRoleId && member.roles.cache.has(cfg.unverifiedRoleId)) {
    try {
      await member.roles.remove(cfg.unverifiedRoleId, 'SMPbot verification — member verified');
    } catch (err) {
      log.debug('verification: failed to remove unverified role:', err?.message ?? err);
    }
  }

  // Cancel any pending auto-kick and clear captcha state.
  cancelKick(client, guild.id, member.id);
  clearPending(client, guild.id, member.id);

  // Durable log row (used by /verification stats).
  try {
    client.db.run(
      'INSERT INTO verification_log (guild_id, user_id, verified_at, mode) VALUES (?, ?, ?, ?)',
      guild.id,
      member.id,
      Date.now(),
      mode,
    );
  } catch (err) {
    log.debug('verification: failed to write verification_log row:', err?.message ?? err);
  }

  // Guild verification log.
  try {
    const embed = client.brand
      .embed(guild, { color: 'success' })
      .setTitle('🔓 Member verified')
      .setDescription(`<@${member.id}> (${member.user?.tag ?? member.id}) passed verification.`)
      .addFields(
        { name: 'Method', value: mode === 'captcha' ? '🧩 Captcha' : '✅ Button', inline: true },
        { name: 'Role', value: `<@&${role.id}>`, inline: true },
      );
    if (member.user?.displayAvatarURL) embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));
    await client.logs.send(guild, LOG_TYPE, { embeds: [embed] });
  } catch (err) {
    log.debug('verification: verify log failed:', err?.message ?? err);
  }

  // Optional DM.
  if (cfg.dm?.enabled && !member.user?.bot) {
    try {
      const text = renderMessage(guild, member, cfg.dm.message || '');
      if (text) {
        const dm = client.brand.embed(guild, { color: 'success' }).setTitle('🔓 Verified').setDescription(truncate(text, 4096));
        await member.send({ embeds: [dm] }).catch((err) => log.debug('verification: DM failed (likely closed DMs):', err?.message ?? err));
      }
    } catch (err) {
      log.debug('verification: DM build failed:', err?.message ?? err);
    }
  }

  return { ok: true, role };
}

/** Minimal placeholder substitution for the verify DM message. */
function renderMessage(guild, member, template) {
  return String(template ?? '')
    .replaceAll('{server}', guild?.name ?? 'the server')
    .replaceAll('{user}', member ? `<@${member.id}>` : '')
    .replaceAll('{username}', member?.user?.username ?? 'there')
    .replaceAll('{membercount}', String(guild?.memberCount ?? ''));
}

// ---------------------------------------------------------------------------
// Panel rendering / publishing.
// ---------------------------------------------------------------------------

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify:start').setLabel('Verify').setEmoji('✅').setStyle(ButtonStyle.Success),
    ),
  ];
}

function buildPanelEmbed(client, guild, cfg) {
  const lines = [
    `Welcome to **${guild.name}**! To unlock the rest of the server, click the **Verify** button below.`,
    '',
  ];
  if (cfg.mode === 'captcha') {
    lines.push('🧩 You will be asked to solve a quick captcha to prove you are human.');
  }
  if (Number(cfg.minAccountAgeDays) > 0) {
    lines.push(`⏳ Your Discord account must be at least **${cfg.minAccountAgeDays}** day(s) old to verify.`);
  }
  return client.brand
    .embed(guild, { color: 'primary' })
    .setTitle('🔐 Verification')
    .setDescription(truncate(lines.join('\n'), 4000));
}

/**
 * Publish (or republish) the verify panel to a channel via the branded webhook
 * pipeline, storing the message id so it can be refreshed/cleaned up later.
 * Returns { ok:true, message } or { ok:false, error }.
 */
async function publishPanel(client, guild, channel) {
  if (!guild) return { ok: false, error: 'No guild.' };
  if (!channel?.isTextBased?.() || channel.guildId !== guild.id) {
    return { ok: false, error: 'Pick a text channel in this server for the verification panel.' };
  }

  const cfg = config(client, guild.id);

  // Remove the previous panel message so the Verify button is never duplicated.
  if (cfg.panelChannelId && cfg.panelMessageId) {
    try {
      const oldChannel = await resolveChannel(guild, cfg.panelChannelId);
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(cfg.panelMessageId).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => null);
    } catch (err) {
      log.debug('verification: could not remove old panel message:', err?.message ?? err);
    }
  }

  const embed = buildPanelEmbed(client, guild, cfg);
  const message = await client.hooks.send(channel, { embeds: [embed], components: panelComponents() });
  if (!message) {
    return { ok: false, error: 'I could not post the panel there. Check that I can send messages in that channel.' };
  }

  client.config.update(guild.id, 'verification', {
    channelId: channel.id,
    panelChannelId: channel.id,
    panelMessageId: message.id,
  });

  try {
    await client.logs.send(guild, LOG_TYPE, {
      embeds: [
        client.brand
          .embed(guild, { color: 'info' })
          .setTitle('🔐 Verification panel published')
          .setDescription(`The verification panel is now live in <#${channel.id}>.`),
      ],
    });
  } catch (err) {
    log.debug('verification: panel publish log failed:', err?.message ?? err);
  }

  return { ok: true, message };
}

// ---------------------------------------------------------------------------
// Captcha challenge payload (ephemeral reply content).
// ---------------------------------------------------------------------------

/**
 * Build the ephemeral captcha challenge payload for a member. Generates a fresh
 * code, stores it, and renders the image (with a text fallback when canvas is
 * unavailable). Returns a message payload object ({ embeds, components, files }).
 */
function buildCaptchaChallenge(client, guild, userId) {
  const code = captcha.generateCode();
  setPending(client, guild.id, userId, code);

  const theme = client.themes.get(guild.id);
  const buffer = captcha.renderCaptcha(code, theme.colors);

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify:code').setLabel('Enter code').setEmoji('⌨️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('verify:newcode').setLabel('New code').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    ),
  ];

  if (buffer) {
    const embed = client.brand
      .embed(guild, { color: 'accent' })
      .setTitle('🧩 Solve the captcha')
      .setDescription(
        'Read the **5-character code** in the image, then click **Enter code** and type it.\nNot case-sensitive • Expires in 5 minutes • 3 attempts per code.',
      )
      .setImage('attachment://captcha.png');
    // attachments:[] clears any previous image so refreshes replace it cleanly.
    return { embeds: [embed], components, files: [new AttachmentBuilder(buffer, { name: 'captcha.png' })], attachments: [] };
  }

  // Text fallback: still requires the member to read and re-type the code.
  const embed = client.brand
    .embed(guild, { color: 'accent' })
    .setTitle('🧩 Solve the captcha')
    .setDescription(
      `Type this code exactly to verify:\n\n# \`${code}\`\n\nClick **Enter code** and type it.\nNot case-sensitive • Expires in 5 minutes • 3 attempts per code.`,
    );
  return { embeds: [embed], components, files: [], attachments: [] };
}

module.exports = {
  KICK_JOB,
  PENDING_TTL_MS,
  MAX_ATTEMPTS,
  getPending,
  setPending,
  bumpAttempts,
  clearPending,
  scheduleKick,
  cancelKick,
  accountAgeUnlock,
  verifyMember,
  renderMessage,
  publishPanel,
  buildPanelEmbed,
  buildCaptchaChallenge,
  // re-export for command displays
  ageUnlockText: (unlock) => `${absoluteTime(unlock, 'F')} (${relativeTime(unlock)})`,
};
