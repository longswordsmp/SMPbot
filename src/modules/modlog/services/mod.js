'use strict';

const { PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const log = require('../../../core/logger');
const { botCanActOn, canActOn } = require('../../../core/permissions');
const {
  formatDuration,
  truncate,
  relativeTime,
  absoluteTime,
} = require('../../../core/utils');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord hard cap for timeouts.

const MODERATION_DEFAULTS = {
  dmOnAction: true,
  escalation: {
    enabled: true,
    // Evaluated after every warn. A rule fires when the active warn count
    // reaches exactly `warns` (so it never re-triggers on later warns).
    rules: [
      { warns: 3, action: 'timeout', durationMs: 60 * 60 * 1000 },
      { warns: 5, action: 'kick' },
    ],
  },
};

/** Per case type: label, past-tense verb, emoji, and theme color kind. */
const ACTION_META = {
  warn: { label: 'Warning', verb: 'warned', emoji: '⚠️', color: 'warning' },
  timeout: { label: 'Timeout', verb: 'timed out', emoji: '⏳', color: 'warning' },
  untimeout: { label: 'Timeout Removed', verb: 'released from timeout', emoji: '🔊', color: 'success' },
  kick: { label: 'Kick', verb: 'kicked', emoji: '👢', color: 'error' },
  ban: { label: 'Ban', verb: 'banned', emoji: '🔨', color: 'error' },
  softban: { label: 'Softban', verb: 'softbanned', emoji: '🧹', color: 'error' },
  unban: { label: 'Unban', verb: 'unbanned', emoji: '♻️', color: 'success' },
};

function meta(type) {
  return ACTION_META[type] ?? { label: type, verb: type, emoji: '📌', color: 'primary' };
}

function getConfig(client, guildId) {
  return client.config.get(guildId, 'moderation', MODERATION_DEFAULTS);
}

/** Themed moderator acknowledgement embed (ephemeral reply after an action). */
function ackEmbed(client, guild, type, title, description) {
  const m = meta(type);
  const embed = client.brand.embed(guild, { color: m.color }).setTitle(`${m.emoji} ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

/** Build the ephemeral moderation-settings panel (embed + toggle buttons). */
function configPanel(client, guild) {
  const cfg = getConfig(client, guild.id);
  const rules = (cfg.escalation?.rules || []).slice().sort((a, b) => Number(a.warns) - Number(b.warns));
  const rulesText = rules.length
    ? rules
        .map((r) => `• **${r.warns}** warns → **${r.action}**${r.durationMs ? ` (${formatDuration(r.durationMs)})` : ''}`)
        .join('\n')
    : '_No escalation rules configured._';
  const embed = client.brand
    .embed(guild, { color: 'primary' })
    .setTitle('🔨 Moderation settings')
    .addFields(
      { name: 'DM on action', value: cfg.dmOnAction ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'Escalation', value: cfg.escalation?.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'Escalation rules', value: truncate(rulesText, 1024), inline: false },
    )
    .setFooter({ text: 'Edit rules with /modconfig escalation add | remove' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mod:cfg:dm')
      .setLabel(cfg.dmOnAction ? 'Disable action DMs' : 'Enable action DMs')
      .setStyle(cfg.dmOnAction ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('mod:cfg:esc')
      .setLabel(cfg.escalation?.enabled ? 'Disable escalation' : 'Enable escalation')
      .setStyle(cfg.escalation?.enabled ? ButtonStyle.Secondary : ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row] };
}

/** Sequential case id + row insert, atomic within one process via SQLite txn. */
function createCase(client, guild, { type, userId, moderatorId, reason, durationMs = null }) {
  const cleanReason = reason ? truncate(String(reason), 500) : null;
  const createdAt = Date.now();
  const insert = client.db.transaction((data) => {
    const row = client.db.get('SELECT COALESCE(MAX(case_id), 0) + 1 AS next FROM mod_cases WHERE guild_id = ?', data.guildId);
    const caseId = Number(row.next);
    client.db.run(
      `INSERT INTO mod_cases (guild_id, case_id, type, user_id, moderator_id, reason, duration_ms, created_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      data.guildId,
      caseId,
      data.type,
      data.userId,
      data.moderatorId,
      data.reason,
      data.durationMs,
      data.createdAt,
    );
    return caseId;
  });
  const caseId = insert({
    guildId: guild.id,
    type,
    userId: String(userId),
    moderatorId: String(moderatorId),
    reason: cleanReason,
    durationMs: durationMs ?? null,
    createdAt,
  });
  return {
    guild_id: guild.id,
    case_id: caseId,
    type,
    user_id: String(userId),
    moderator_id: String(moderatorId),
    reason: cleanReason,
    duration_ms: durationMs ?? null,
    created_at: createdAt,
    active: 1,
  };
}

function getCase(client, guildId, caseId) {
  return client.db.get('SELECT * FROM mod_cases WHERE guild_id = ? AND case_id = ?', guildId, Number(caseId));
}

function userCases(client, guildId, userId, { type = null } = {}) {
  if (type) {
    return client.db.all(
      'SELECT * FROM mod_cases WHERE guild_id = ? AND user_id = ? AND type = ? ORDER BY case_id DESC',
      guildId,
      String(userId),
      type,
    );
  }
  return client.db.all('SELECT * FROM mod_cases WHERE guild_id = ? AND user_id = ? ORDER BY case_id DESC', guildId, String(userId));
}

function activeWarnCount(client, guildId, userId) {
  const row = client.db.get(
    "SELECT COUNT(*) AS c FROM mod_cases WHERE guild_id = ? AND user_id = ? AND type = 'warn' AND active = 1",
    guildId,
    String(userId),
  );
  return Number(row?.c ?? 0);
}

function deactivateCase(client, guildId, caseId) {
  client.db.run('UPDATE mod_cases SET active = 0 WHERE guild_id = ? AND case_id = ?', guildId, Number(caseId));
}

/** Premium moderation case embed (log + /case view). */
function caseEmbed(client, guild, row, { targetUser = null, moderatorUser = null } = {}) {
  const m = meta(row.type);
  const embed = client.brand
    .embed(guild, { color: m.color, footer: false })
    .setAuthor(
      moderatorUser
        ? { name: `${m.label} • ${moderatorUser.tag ?? moderatorUser.username ?? 'Moderator'}`, iconURL: moderatorUser.displayAvatarURL?.() }
        : { name: m.label },
    )
    .setTitle(`${m.emoji} Case #${row.case_id}`)
    .addFields(
      {
        name: 'User',
        value: targetUser
          ? `${targetUser.tag ?? targetUser.username ?? 'Unknown'} (<@${row.user_id}>)\n\`${row.user_id}\``
          : `<@${row.user_id}>\n\`${row.user_id}\``,
        inline: true,
      },
      { name: 'Moderator', value: `<@${row.moderator_id}>`, inline: true },
    );
  if (row.duration_ms) {
    embed.addFields({
      name: 'Duration',
      value: `${formatDuration(row.duration_ms)} (expires ${relativeTime(row.created_at + row.duration_ms)})`,
      inline: true,
    });
  }
  embed.addFields({ name: 'Reason', value: truncate(row.reason || 'No reason provided', 1024), inline: false });
  embed.setFooter({ text: `Case #${row.case_id} • ${guild.name}` }).setTimestamp(new Date(row.created_at));
  if (!row.active) embed.addFields({ name: 'Status', value: '🗑️ This case has been removed / is inactive.', inline: false });
  if (targetUser?.displayAvatarURL) embed.setThumbnail(targetUser.displayAvatarURL());
  return embed;
}

/** DM the target a branded notice. Never throws — a failed DM is expected. */
async function dmTarget(client, guild, user, row) {
  if (!user || typeof user.send !== 'function') return false;
  try {
    const m = meta(row.type);
    const embed = client.brand
      .embed(guild, { color: m.color })
      .setTitle(`${m.emoji} You were ${m.verb} in ${guild.name}`)
      .addFields({ name: 'Reason', value: truncate(row.reason || 'No reason provided', 1024) });
    if (row.duration_ms) {
      embed.addFields({
        name: 'Duration',
        value: `${formatDuration(row.duration_ms)} — until ${absoluteTime(row.created_at + row.duration_ms)}`,
      });
    }
    if (guild.iconURL?.()) embed.setThumbnail(guild.iconURL());
    await user.send({ embeds: [embed] });
    return true;
  } catch (err) {
    log.debug(`modlog: DM to ${user?.id} failed:`, err?.message ?? err);
    return false;
  }
}

/** Emit the case to the configured 'moderation' log channel. */
async function logCase(client, guild, row, { targetUser = null, moderatorUser = null } = {}) {
  try {
    await client.logs.send(guild, 'moderation', { embeds: [caseEmbed(client, guild, row, { targetUser, moderatorUser })] });
  } catch (err) {
    log.debug(`modlog: log for case #${row.case_id} failed:`, err?.message ?? err);
  }
}

/**
 * Guard a moderation target: self / bot / owner / hierarchy / bot permission.
 * Returns { ok:true } or { ok:false, embed } (a branded ephemeral error embed).
 */
function actionGuard(client, interaction, targetUser, targetMember, { botPerm = null, requireMember = false } = {}) {
  const guild = interaction.guild;
  const fail = (title, desc) => ({ ok: false, embed: client.brand.error(guild, title, desc) });

  if (targetUser?.id === interaction.user.id) return fail('Not allowed', 'You cannot use this action on yourself.');
  if (targetUser?.id === client.user?.id) return fail('Not allowed', 'I cannot use that action on myself.');
  if (targetUser?.id === guild.ownerId) return fail('Not allowed', 'You cannot moderate the **server owner**.');

  if (botPerm && !guild.members.me?.permissions?.has(botPerm)) {
    return fail('Missing bot permission', 'I am missing the permission required to perform this action. Ask an admin to grant it.');
  }

  if (requireMember && !targetMember) {
    return fail('Not in this server', 'That user is not a member of this server.');
  }

  if (targetMember) {
    if (!canActOn(interaction.member, targetMember)) {
      return fail('Role hierarchy', 'You cannot moderate this member — their highest role is equal to or above yours.');
    }
    if (!botCanActOn(targetMember)) {
      return fail('Role hierarchy', "I cannot moderate this member — their highest role is equal to or above mine. Move my role higher.");
    }
  }

  return { ok: true };
}

/**
 * After a warn, apply the configured escalation for the *current* active warn
 * count (fires only on the exact threshold). Best-effort — a failure to
 * escalate never fails the warn itself. Returns an info object or null.
 */
async function evaluateEscalation(client, guild, member, warnCount) {
  const cfg = getConfig(client, guild.id);
  if (!cfg.escalation?.enabled) return null;
  const rule = (cfg.escalation.rules || []).find((r) => Number(r.warns) === Number(warnCount));
  if (!rule) return null;
  if (!member) return { applied: false, rule, note: 'member is no longer in the server' };
  if (!botCanActOn(member)) return { applied: false, rule, note: 'I cannot act on this member (role hierarchy)' };

  const reason = `Auto-escalation: reached ${warnCount} warning${warnCount === 1 ? '' : 's'}`;
  const me = guild.members.me;
  try {
    if (rule.action === 'timeout') {
      if (!me?.permissions?.has(PermissionFlagsBits.ModerateMembers)) return { applied: false, rule, note: 'missing Timeout Members permission' };
      const ms = Math.min(Math.max(Number(rule.durationMs) || 60 * 60 * 1000, 1000), MAX_TIMEOUT_MS);
      await member.timeout(ms, reason);
      const row = createCase(client, guild, { type: 'timeout', userId: member.id, moderatorId: client.user.id, reason, durationMs: ms });
      if (getConfig(client, guild.id).dmOnAction) await dmTarget(client, guild, member.user, row);
      await logCase(client, guild, row, { targetUser: member.user, moderatorUser: client.user });
      return { applied: true, rule, action: 'timeout', caseId: row.case_id, durationMs: ms };
    }
    if (rule.action === 'kick') {
      if (!me?.permissions?.has(PermissionFlagsBits.KickMembers)) return { applied: false, rule, note: 'missing Kick Members permission' };
      // DM before removal so the notice can be delivered.
      const row = createCase(client, guild, { type: 'kick', userId: member.id, moderatorId: client.user.id, reason });
      if (getConfig(client, guild.id).dmOnAction) await dmTarget(client, guild, member.user, row);
      await member.kick(reason);
      await logCase(client, guild, row, { targetUser: member.user, moderatorUser: client.user });
      return { applied: true, rule, action: 'kick', caseId: row.case_id };
    }
    if (rule.action === 'ban') {
      if (!me?.permissions?.has(PermissionFlagsBits.BanMembers)) return { applied: false, rule, note: 'missing Ban Members permission' };
      const row = createCase(client, guild, { type: 'ban', userId: member.id, moderatorId: client.user.id, reason });
      if (getConfig(client, guild.id).dmOnAction) await dmTarget(client, guild, member.user, row);
      await member.ban({ reason });
      await logCase(client, guild, row, { targetUser: member.user, moderatorUser: client.user });
      return { applied: true, rule, action: 'ban', caseId: row.case_id };
    }
    return { applied: false, rule, note: `unknown escalation action '${rule.action}'` };
  } catch (err) {
    log.warn(`modlog: escalation '${rule.action}' failed in guild ${guild.id}:`, err?.message ?? err);
    return { applied: false, rule, note: 'the escalation action could not be applied' };
  }
}

/**
 * Programmatic warn used by the cross-module service (e.g. automod). Records a
 * case, DMs, logs, and evaluates escalation. Returns { row, count, escalation }.
 */
async function systemWarn(client, guild, { userId, moderatorId, reason }) {
  const row = createCase(client, guild, {
    type: 'warn',
    userId,
    moderatorId: moderatorId || client.user.id,
    reason: reason || 'No reason provided',
  });
  const member = await guild.members.fetch(String(userId)).catch(() => null);
  if (getConfig(client, guild.id).dmOnAction && member) await dmTarget(client, guild, member.user, row);
  const moderatorUser = await client.users.fetch(String(moderatorId || client.user.id)).catch(() => null);
  await logCase(client, guild, row, { targetUser: member?.user ?? null, moderatorUser });
  const count = activeWarnCount(client, guild.id, userId);
  const escalation = await evaluateEscalation(client, guild, member, count);
  return { row, count, escalation };
}

/** Scheduler-driven temp-ban expiry: unban + record an 'unban' case + log. */
async function expireTempBan(client, guild, userId) {
  try {
    const ban = await guild.bans.fetch(String(userId)).catch(() => null);
    if (!ban) return; // already unbanned manually
    await guild.members.unban(String(userId), 'Temporary ban expired').catch(() => null);
    // Mark the active temp-ban case(s) inactive.
    client.db.run(
      "UPDATE mod_cases SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'ban' AND active = 1",
      guild.id,
      String(userId),
    );
    const row = createCase(client, guild, {
      type: 'unban',
      userId,
      moderatorId: client.user.id,
      reason: 'Temporary ban expired',
    });
    const targetUser = await client.users.fetch(String(userId)).catch(() => null);
    await logCase(client, guild, row, { targetUser, moderatorUser: client.user });
  } catch (err) {
    log.warn(`modlog: temp-ban expiry failed for ${userId} in guild ${guild.id}:`, err?.message ?? err);
  }
}

module.exports = {
  MODERATION_DEFAULTS,
  ACTION_META,
  MAX_TIMEOUT_MS,
  meta,
  getConfig,
  ackEmbed,
  configPanel,
  createCase,
  getCase,
  userCases,
  activeWarnCount,
  deactivateCase,
  caseEmbed,
  dmTarget,
  logCase,
  actionGuard,
  evaluateEscalation,
  systemWarn,
  expireTempBan,
  // re-exported for command convenience
  MessageFlags,
};
