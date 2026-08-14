'use strict';

const { PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const corePerms = require('../../../core/permissions');
const { truncate, formatDuration } = require('../../../core/utils');
const { getConfig, ESCALATION_ACTIONS, boundedAction, bounded } = require('./settings');
const { checkSpam } = require('./spam');
const { checkLinks } = require('./links');
const { checkNsfw } = require('./nsfw');

const ACTION_SEVERITY = { delete: 0, warn: 1, timeout: 2, kick: 3, ban: 4 };
const ACTION_BADGE = { delete: '🗑️ deleted', warn: '⚠️ warned', timeout: '⏲️ timed out', kick: '👢 kicked', ban: '🔨 banned' };

function severity(action) {
  return ACTION_SEVERITY[action] ?? 0;
}

/* --------------------------------------------------------------- exemptions */

function channelWhitelisted(cfg, channel) {
  const wc = Array.isArray(cfg.whitelistChannels) ? cfg.whitelistChannels : [];
  if (!wc.length || !channel) return false;
  return wc.includes(channel.id) || (channel.parentId && wc.includes(channel.parentId));
}

/**
 * Member-based exemptions (shared by the message pass and reaction handler):
 * bots, the guild owner, SMPbot itself, staff with Manage Messages, configured
 * bypass roles, and whitelist roles. A null member is never treated as exempt
 * here — channel whitelist is checked separately so it works without a member.
 */
function memberExempt(client, cfg, guild, member) {
  if (!member) return false;
  if (member.user?.bot) return true;
  if (member.id === guild.ownerId) return true;
  if (member.id === client.user?.id) return true;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageMessages)) return true;
  const bypassRoles = Array.isArray(cfg.bypassRoles) ? cfg.bypassRoles : [];
  if (bypassRoles.length && member.roles.cache.some((r) => bypassRoles.includes(r.id))) return true;
  const whitelistRoles = Array.isArray(cfg.whitelistRoles) ? cfg.whitelistRoles : [];
  if (whitelistRoles.length && member.roles.cache.some((r) => whitelistRoles.includes(r.id))) return true;
  return false;
}

function isExempt(client, cfg, message, member) {
  const author = message.author;
  if (!author || author.bot || author.system) return true;
  if (message.webhookId) return true;
  if (author.id === client.user?.id) return true;
  if (channelWhitelisted(cfg, message.channel)) return true;
  if (memberExempt(client, cfg, message.guild, member)) return true;
  return false;
}

/* --------------------------------------------------------- strikes / history */

function recordViolation(client, guildId, userId, rule, action) {
  try {
    client.db.run(
      'INSERT INTO automod_violations (guild_id, user_id, rule, action, created_at) VALUES (?, ?, ?, ?, ?)',
      guildId,
      userId,
      truncate(String(rule), 60),
      action,
      Date.now(),
    );
    // Light housekeeping so the table cannot grow unbounded.
    client.db.run('DELETE FROM automod_violations WHERE guild_id = ? AND created_at < ?', guildId, Date.now() - 2 * 86400000);
  } catch (err) {
    log.debug(`automod: recordViolation failed for guild ${guildId}:`, err?.message ?? err);
  }
}

function countViolations(client, guildId, userId, since) {
  try {
    const row = client.db.get(
      'SELECT COUNT(*) AS n FROM automod_violations WHERE guild_id = ? AND user_id = ? AND created_at >= ?',
      guildId,
      userId,
      since,
    );
    return Number(row?.n ?? 0);
  } catch {
    return 0;
  }
}

/* ---------------------------------------------------------------- messaging */

async function dmUser(client, guild, user, title, description) {
  try {
    if (!user || user.bot) return false;
    await user.send({ embeds: [client.brand.warn(guild, title, description)] });
    return true;
  } catch (err) {
    log.debug(`automod: DM to ${user?.id} failed:`, err?.message ?? err);
    return false;
  }
}

/**
 * Apply the effective moderation action for a violation. Hierarchy-safe: never
 * acts on members the bot can't act on — it degrades to the already-performed
 * removal with an explanatory note. Returns `{ applied, note }`.
 */
async function applyPunishment(client, { guild, member, user, userId, action, cfg, violation }) {
  if (action === 'delete') return { applied: 'delete', note: null };

  const me = guild.members.me;
  const reason = truncate(`SMPbot AutoMod: ${violation.label} — ${violation.reason}`, 400);

  if (action === 'warn') {
    const dmed = await dmUser(client, guild, user, 'Message removed', `Your message in **${truncate(guild.name ?? 'the server', 80)}** was removed by AutoMod (**${violation.label}**). Please review the server rules.`);
    return { applied: 'warn', note: dmed ? 'user notified via DM' : 'could not DM the user' };
  }

  if (action === 'timeout') {
    if (!member) return { applied: 'delete', note: 'member unavailable — could not time out' };
    if (!me?.permissions?.has(PermissionFlagsBits.ModerateMembers) || !corePerms.botCanActOn(member)) {
      return { applied: 'delete', note: 'cannot time out (permissions/hierarchy)' };
    }
    const minutes = bounded(cfg.timeoutMinutes, 10, 1, 40320);
    try {
      await dmUser(client, guild, user, 'You were timed out', `You were timed out for **${formatDuration(minutes * 60000)}** by AutoMod (**${violation.label}**).`);
      await member.timeout(minutes * 60000, reason);
      return { applied: 'timeout', note: formatDuration(minutes * 60000) };
    } catch (err) {
      log.warn(`automod: timeout failed for ${userId} in guild ${guild.id}:`, err?.message ?? err);
      return { applied: 'delete', note: 'timeout failed' };
    }
  }

  if (action === 'kick') {
    if (!member) return { applied: 'delete', note: 'member unavailable — could not kick' };
    if (!me?.permissions?.has(PermissionFlagsBits.KickMembers) || !corePerms.botCanActOn(member)) {
      return { applied: 'delete', note: 'cannot kick (permissions/hierarchy)' };
    }
    try {
      await dmUser(client, guild, user, 'You were kicked', `You were kicked from **${truncate(guild.name ?? 'the server', 80)}** by AutoMod (**${violation.label}**).`);
      await member.kick(reason);
      return { applied: 'kick', note: null };
    } catch (err) {
      log.warn(`automod: kick failed for ${userId} in guild ${guild.id}:`, err?.message ?? err);
      return { applied: 'delete', note: 'kick failed' };
    }
  }

  if (action === 'ban') {
    if (!me?.permissions?.has(PermissionFlagsBits.BanMembers)) return { applied: 'delete', note: 'missing Ban Members' };
    if (member && !corePerms.botCanActOn(member)) return { applied: 'delete', note: 'target out-ranks the bot' };
    try {
      await dmUser(client, guild, user, 'You were banned', `You were banned from **${truncate(guild.name ?? 'the server', 80)}** by AutoMod (**${violation.label}**).`);
      await guild.members.ban(userId, { reason, deleteMessageSeconds: 0 });
      return { applied: 'ban', note: null };
    } catch (err) {
      log.warn(`automod: ban failed for ${userId} in guild ${guild.id}:`, err?.message ?? err);
      return { applied: 'delete', note: 'ban failed' };
    }
  }

  return { applied: 'delete', note: `unknown action '${action}'` };
}

async function logAction(client, { guild, user, channel, violation, baseAction, action, escalated, outcome, context }) {
  const embed = client.brand
    .embed(guild, { color: 'warning' })
    .setTitle('🚫 AutoMod action')
    .addFields(
      { name: 'User', value: user ? `<@${user.id}> (\`${user.id}\`)` : 'Unknown', inline: true },
      { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unknown', inline: true },
      { name: 'Rule', value: `${violation.label} \`(${violation.rule})\``, inline: true },
      {
        name: 'Action taken',
        value: `${ACTION_BADGE[outcome.applied] ?? outcome.applied}${outcome.note ? ` — ${outcome.note}` : ''}`,
        inline: false,
      },
      { name: 'Reason', value: truncate(violation.reason ?? '—', 1024), inline: false },
    );
  if (escalated) {
    embed.addFields({ name: 'Strike escalation', value: `\`${baseAction}\` → \`${action}\` (violation threshold reached)`, inline: false });
  }
  if (context?.messageDeleted) {
    embed.addFields({ name: 'Message', value: '🗑️ Deleted', inline: true });
  }
  if (context?.excerpt) {
    embed.addFields({ name: 'Content excerpt', value: truncate(`\`\`\`\n${context.excerpt}\n\`\`\``, 1024), inline: false });
  }
  await client.logs.send(guild, 'moderation', { embeds: [embed] });
}

/**
 * Shared enforcement entry point (used by the message pass, reactions, etc.).
 * Records the violation, applies strike escalation, performs the action, and
 * logs a detailed embed to 'moderation'. The caller is responsible for removing
 * the offending content (message delete / reaction remove) beforehand.
 */
async function applyAction(client, { guild, member, user, channel, cfg, violation, context = {} }) {
  const userId = user?.id ?? member?.id;
  if (!userId) return;

  const baseAction = boundedAction(violation.action, 'delete');
  recordViolation(client, guild.id, userId, violation.rule, baseAction);

  let action = baseAction;
  let escalated = false;
  const strikes = cfg.strikes ?? {};
  if (strikes.enabled) {
    const windowMin = bounded(strikes.windowMinutes, 10, 1, 1440);
    const threshold = bounded(strikes.threshold, 4, 2, 50);
    const count = countViolations(client, guild.id, userId, Date.now() - windowMin * 60000);
    if (count >= threshold) {
      const escAction = ESCALATION_ACTIONS.includes(strikes.action) ? strikes.action : 'timeout';
      if (severity(escAction) > severity(action)) {
        action = escAction;
        escalated = true;
      }
    }
  }

  const outcome = await applyPunishment(client, { guild, member, user, userId, action, cfg, violation });
  await logAction(client, { guild, user, channel, violation, baseAction, action, escalated, outcome, context });
  return outcome;
}

/* ------------------------------------------------------------- message pass */

async function enforceOnMessage(client, { guild, message, member, cfg, violation }) {
  let messageDeleted = false;
  const me = guild.members.me;
  const canDelete = Boolean(me && message.channel?.permissionsFor?.(me)?.has?.(PermissionFlagsBits.ManageMessages));
  if (message.deletable && canDelete) {
    try {
      await message.delete();
      messageDeleted = true;
    } catch (err) {
      log.debug(`automod: message delete failed in guild ${guild.id}:`, err?.message ?? err);
    }
  }
  const excerpt = truncate((message.content ?? '').replace(/`/g, 'ˋ'), 300) || '(no text content)';
  await applyAction(client, {
    guild,
    member,
    user: message.author,
    channel: message.channel,
    cfg,
    violation,
    context: { messageDeleted, excerpt },
  });
}

/**
 * The single MessageCreate pipeline. Exemptions are checked first, then every
 * enabled check runs in order (spam → links → nsfw) and the configured action
 * of the FIRST violation is applied. Fully self-contained: never throws.
 */
async function runMessage(client, message) {
  try {
    const guild = message.guild;
    if (!guild) return;
    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        return;
      }
    }
    if (!message.author) return;

    const cfg = getConfig(client, guild.id);
    if (!cfg.enabled) return;

    let member = message.member;
    if (!member && !message.author.bot) member = await guild.members.fetch(message.author.id).catch(() => null);
    if (isExempt(client, cfg, message, member)) return;

    let violation = null;
    try {
      violation = checkSpam(client, cfg, message);
    } catch (err) {
      log.debug(`automod: spam check failed in guild ${guild.id}:`, err?.message ?? err);
    }
    if (!violation) {
      try {
        violation = await checkLinks(client, cfg, message);
      } catch (err) {
        log.debug(`automod: link check failed in guild ${guild.id}:`, err?.message ?? err);
      }
    }
    if (!violation) {
      try {
        violation = checkNsfw(client, cfg, message, member);
      } catch (err) {
        log.debug(`automod: nsfw check failed in guild ${guild.id}:`, err?.message ?? err);
      }
    }
    if (!violation) return;

    await enforceOnMessage(client, { guild, message, member, cfg, violation });
  } catch (err) {
    log.error(`automod: pipeline crashed in guild ${message?.guild?.id}:`, err);
  }
}

module.exports = {
  runMessage,
  applyAction,
  isExempt,
  memberExempt,
  channelWhitelisted,
  severity,
};
