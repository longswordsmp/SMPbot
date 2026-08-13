'use strict';

const {
  PermissionFlagsBits,
  PermissionsBitField,
  AuditLogEvent,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const log = require('../../../core/logger');
const corePerms = require('../../../core/permissions');
const { clamp, truncate, relativeTime } = require('../../../core/utils');

const NAMESPACE = 'security';

/** Audit-log attribution window: entries older than this are not "this" action. */
const AUDIT_WINDOW_MS = 10000;
/** How long a deleted channel/role stays eligible for restore-from-backup. */
const DELETION_MEMORY_MS = 15 * 60 * 1000;
const MAX_TRUSTED = 50;
const MAX_WHITELIST = 50;
const MAX_LOCKDOWN_MINUTES = 10080; // 7 days

const PUNISHMENTS = ['none', 'quarantine', 'kick', 'ban'];
const BOT_ACTIONS = ['alert', 'kick', 'ban'];

/**
 * Every monitored anti-nuke action. `defaults` are the per-action sliding
 * window thresholds; all of them are overridable per guild in the `security`
 * config namespace (`actions.<key>`).
 */
const ACTIONS = {
  channelDelete: { label: 'Channel deletions', emoji: '🗑️', defaults: { limit: 3, windowSec: 60, punishment: 'ban' } },
  channelCreate: { label: 'Channel creations', emoji: '📁', defaults: { limit: 6, windowSec: 60, punishment: 'quarantine' } },
  roleDelete: { label: 'Role deletions', emoji: '🧨', defaults: { limit: 3, windowSec: 60, punishment: 'ban' } },
  roleCreate: { label: 'Role creations', emoji: '🎭', defaults: { limit: 6, windowSec: 60, punishment: 'quarantine' } },
  permGrant: { label: 'Dangerous permission grants', emoji: '🔓', defaults: { limit: 2, windowSec: 120, punishment: 'quarantine' } },
  dangerousRoleGrant: { label: 'Dangerous role assignments', emoji: '⚠️', defaults: { limit: 2, windowSec: 120, punishment: 'quarantine' } },
  ban: { label: 'Member bans', emoji: '🔨', defaults: { limit: 4, windowSec: 60, punishment: 'ban' } },
  kick: { label: 'Member kicks', emoji: '👢', defaults: { limit: 4, windowSec: 60, punishment: 'ban' } },
  timeout: { label: 'Member timeouts', emoji: '⏲️', defaults: { limit: 5, windowSec: 60, punishment: 'quarantine' } },
  webhookCreate: { label: 'Webhook creations', emoji: '🪝', defaults: { limit: 3, windowSec: 120, punishment: 'quarantine' } },
  webhookDelete: { label: 'Webhook deletions', emoji: '✂️', defaults: { limit: 3, windowSec: 120, punishment: 'quarantine' } },
  guildUpdate: { label: 'Server setting changes', emoji: '🛠️', defaults: { limit: 3, windowSec: 300, punishment: 'none' } },
  bulkDelete: { label: 'Bulk message deletions', emoji: '🧹', defaults: { limit: 3, windowSec: 60, punishment: 'quarantine' } },
  everyoneMention: { label: 'Mass @everyone/@here mentions', emoji: '📢', defaults: { limit: 3, windowSec: 300, punishment: 'quarantine' } },
};

/** Config defaults for the `security` namespace (referenced by /setup + templates). */
const DEFAULTS = {
  enabled: true,
  restore: true, // recreate nuked channels/roles from the latest backup snapshot
  panic: false, // panic mode: every punishment becomes quarantine + auto-lockdown on trigger
  panicLockdownMinutes: 15,
  trustedUsers: [], // user ids exempt from monitoring (owner + bot always exempt)
  trustedRoles: [], // role ids exempt from monitoring
  actions: Object.fromEntries(Object.entries(ACTIONS).map(([key, def]) => [key, { ...def.defaults }])),
  bots: {
    whitelist: [], // bot user ids allowed to join without enforcement
    action: 'alert', // 'alert' | 'kick' | 'ban' — NEVER auto-removes unless staff opted in
    quarantineAdder: false,
  },
};

/** Permissions stripped from @everyone during an emergency lockdown. */
const LOCKDOWN_PERMS = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
];

/**
 * Recently deleted channels/roles per guild, kept in memory so a triggered
 * incident can restore *everything* the attacker deleted inside the window,
 * not just the entity that tripped the threshold. Restore state itself is
 * derived from the backup module's snapshots (durable) — this is only a hint
 * list of ids, safely rebuilt empty after a restart.
 * guildId -> [{ kind: 'channel'|'role', id, name, at, restored }]
 */
const recentDeletions = new Map();

function config(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

function isEnabled(client, guildId) {
  return Boolean(config(client, guildId)?.enabled);
}

/** Sanitized per-action threshold config (limit/window bounded, punishment validated). */
function actionConfig(cfg, actionKey) {
  const def = ACTIONS[actionKey]?.defaults ?? { limit: 3, windowSec: 60, punishment: 'none' };
  const raw = cfg?.actions?.[actionKey] ?? {};
  const limit = clamp(Number.isFinite(Number(raw.limit)) ? Math.floor(Number(raw.limit)) : def.limit, 1, 50);
  const windowSec = clamp(Number.isFinite(Number(raw.windowSec)) ? Math.floor(Number(raw.windowSec)) : def.windowSec, 10, 3600);
  const punishment = PUNISHMENTS.includes(raw.punishment) ? raw.punishment : def.punishment;
  return { limit, windowSec, punishment };
}

/**
 * Monitoring bypass. Administrator does NOT bypass — only the guild owner,
 * the bot itself (and bot owner), and explicitly trusted users/roles.
 */
function isTrusted(client, guild, userId) {
  if (!guild || !userId) return false;
  const id = String(userId);
  if (id === guild.ownerId) return true;
  if (id === client.user?.id) return true;
  if (corePerms.isBotOwner(id)) return true;
  const cfg = config(client, guild.id);
  if (Array.isArray(cfg.trustedUsers) && cfg.trustedUsers.includes(id)) return true;
  if (Array.isArray(cfg.trustedRoles) && cfg.trustedRoles.length) {
    const member = guild.members.cache.get(id);
    if (member && cfg.trustedRoles.some((rid) => member.roles.cache.has(rid))) return true;
  }
  return false;
}

/**
 * Attribute a gateway event to its executor via the audit log. Only entries
 * matching the target AND created within ~10s count — anything older is a
 * different action. Returns { executorId, executor, entry, reason }.
 */
async function attribute(guild, type, targetId, { windowMs = AUDIT_WINDOW_MS } = {}) {
  const none = { executorId: null, executor: null, entry: null };
  try {
    const me = guild.members?.me;
    if (!me?.permissions?.has?.(PermissionFlagsBits.ViewAuditLog)) {
      return { ...none, reason: 'bot is missing View Audit Log' };
    }
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const now = Date.now();
    const entry =
      logs?.entries?.find((e) => (!targetId || e.targetId === targetId) && now - e.createdTimestamp <= windowMs) ?? null;
    if (!entry) return { ...none, reason: 'no matching audit log entry' };
    const executorId = entry.executorId ?? entry.executor?.id ?? null;
    if (!executorId) return { ...none, entry, reason: 'audit entry has no executor' };
    return { executorId, executor: entry.executor ?? null, entry, reason: null };
  } catch (err) {
    log.debug(`security: audit log fetch failed in guild ${guild?.id}:`, err?.message ?? err);
    return { ...none, reason: 'audit log fetch failed' };
  }
}

/** Remember a deleted channel/role so a triggered incident can restore it. */
function trackDeletion(guildId, kind, { id, name } = {}) {
  if (!guildId || !id) return;
  let list = recentDeletions.get(guildId);
  if (!list) {
    list = [];
    recentDeletions.set(guildId, list);
  }
  const cutoff = Date.now() - DELETION_MEMORY_MS;
  while (list.length && (list[0].at < cutoff || list.length >= 50)) list.shift();
  list.push({ kind, id, name: name ?? null, at: Date.now(), restored: false });
}

/** Restore recently deleted channels/roles from the latest backup snapshot (matched by id). */
async function restoreDeleted(client, guild, kind) {
  const backup = client.services.backup;
  const restoreFn = kind === 'channel' ? backup?.restoreChannel : backup?.restoreRole;
  if (!backup?.latest || typeof restoreFn !== 'function') return 'backup module unavailable — nothing restored';
  let snapshot = null;
  try {
    snapshot = backup.latest(guild.id);
  } catch (err) {
    log.warn(`security: backup.latest failed for guild ${guild.id}:`, err?.message ?? err);
  }
  if (!snapshot) return 'no backup snapshot available — nothing restored';
  const snaps = (kind === 'channel' ? snapshot.channels : snapshot.roles) ?? [];
  const cutoff = Date.now() - DELETION_MEMORY_MS;
  const pending = (recentDeletions.get(guild.id) ?? []).filter((e) => e.kind === kind && !e.restored && e.at >= cutoff);
  let attempted = 0;
  let restored = 0;
  for (const deletion of pending) {
    const snap = snaps.find((s) => s.id === deletion.id);
    if (!snap) continue;
    attempted += 1;
    try {
      await restoreFn.call(backup, guild, snap);
      deletion.restored = true;
      restored += 1;
    } catch (err) {
      log.warn(`security: failed to restore ${kind} ${deletion.id} in guild ${guild.id}:`, err?.message ?? err);
    }
  }
  if (!attempted) return 'no matching entries in the latest backup — nothing restored';
  return `restored ${restored}/${attempted} deleted ${kind}(s) from the latest backup`;
}

/**
 * Quarantine: strip every removable role from the member, storing the removed
 * ids durably for a later restore. Falls back to alert-only when the member
 * out-ranks the bot or roles cannot be managed.
 */
async function quarantineMember(client, guild, member, reason) {
  if (!member) return { applied: 'none', note: 'executor is no longer in the server — alert only' };
  const me = guild.members.me;
  if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    return { applied: 'none', note: 'bot is missing Manage Roles — alert only' };
  }
  if (!corePerms.botCanActOn(member)) {
    return { applied: 'none', note: 'executor out-ranks the bot — alert only' };
  }
  try {
    const removable = [...member.roles.cache.filter((r) => r.id !== guild.id && !r.managed && r.editable).keys()];
    const keep = [...member.roles.cache.filter((r) => r.id !== guild.id && (r.managed || !r.editable)).keys()];
    if (!removable.length) return { applied: 'quarantine', note: 'executor had no removable roles' };
    const prior = client.db.get(
      'SELECT role_ids FROM security_quarantine WHERE guild_id = ? AND user_id = ?',
      guild.id,
      member.id,
    );
    let priorIds = [];
    try {
      priorIds = JSON.parse(prior?.role_ids ?? '[]');
    } catch {
      priorIds = [];
    }
    const merged = [...new Set([...priorIds, ...removable])];
    // Persist BEFORE stripping so a crash mid-action never loses the role list.
    client.db.run(
      `INSERT INTO security_quarantine (guild_id, user_id, role_ids, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET role_ids = excluded.role_ids`,
      guild.id,
      member.id,
      JSON.stringify(merged),
      Date.now(),
    );
    await member.roles.set(keep, truncate(reason ?? 'SMPbot anti-nuke quarantine', 400));
    return { applied: 'quarantine', note: `removed ${removable.length} role(s) (stored for restore)` };
  } catch (err) {
    log.warn(`security: quarantine failed for ${member.id} in guild ${guild.id}:`, err?.message ?? err);
    return { applied: 'none', note: 'quarantine failed — alert only' };
  }
}

/** Restore a quarantined member's stored roles. Returns { ok, restored, note }. */
async function releaseQuarantine(client, guild, userId) {
  const row = client.db.get('SELECT role_ids FROM security_quarantine WHERE guild_id = ? AND user_id = ?', guild.id, userId);
  if (!row) return { ok: false, restored: 0, note: 'No quarantine record for this user.' };
  let ids = [];
  try {
    ids = JSON.parse(row.role_ids ?? '[]');
  } catch {
    ids = [];
  }
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return { ok: false, restored: 0, note: 'User is no longer in the server. Record kept.' };
  let restored = 0;
  for (const roleId of ids) {
    const role = guild.roles.cache.get(roleId);
    if (!role || role.managed || !role.editable) continue;
    try {
      await member.roles.add(role, 'SMPbot quarantine release');
      restored += 1;
    } catch (err) {
      log.debug(`security: failed to restore role ${roleId} to ${userId}:`, err?.message ?? err);
    }
  }
  client.db.run('DELETE FROM security_quarantine WHERE guild_id = ? AND user_id = ?', guild.id, userId);
  return { ok: true, restored, note: `Restored ${restored}/${ids.length} stored role(s).` };
}

/** Apply a punishment with hierarchy pre-checks. Never throws. */
async function punish(client, guild, executorId, punishment, reason) {
  try {
    if (punishment === 'none') return { applied: 'none', note: null };
    const me = guild.members.me;
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (punishment === 'ban') {
      if (!me?.permissions?.has(PermissionFlagsBits.BanMembers)) {
        return { applied: 'none', note: 'bot is missing Ban Members — alert only' };
      }
      if (member && !corePerms.botCanActOn(member)) {
        return { applied: 'none', note: 'executor out-ranks the bot — alert only' };
      }
      await guild.members.ban(executorId, { reason: truncate(reason, 400) });
      return { applied: 'ban', note: null };
    }
    if (punishment === 'kick') {
      if (!member) return { applied: 'none', note: 'executor is no longer in the server — alert only' };
      if (!me?.permissions?.has(PermissionFlagsBits.KickMembers) || !corePerms.botCanActOn(member)) {
        return { applied: 'none', note: 'cannot kick (permissions/hierarchy) — alert only' };
      }
      await member.kick(truncate(reason, 400));
      return { applied: 'kick', note: null };
    }
    if (punishment === 'quarantine') return quarantineMember(client, guild, member, reason);
    return { applied: 'none', note: `unknown punishment '${punishment}' — alert only` };
  } catch (err) {
    log.warn(`security: punishment '${punishment}' failed for ${executorId} in guild ${guild.id}:`, err?.message ?? err);
    return { applied: 'none', note: 'punishment failed — alert only' };
  }
}

function insertIncident(client, guild, { executorId, actionKey, count, punished, details }) {
  const result = client.db.run(
    'INSERT INTO security_incidents (guild_id, executor_id, action, count, punished, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    guild.id,
    executorId ?? null,
    actionKey,
    count,
    punished,
    truncate(details ?? '', 900),
    Date.now(),
  );
  return Number(result.lastInsertRowid);
}

/** DM the guild owner a branded alert. Failure (closed DMs) degrades to a log entry. */
async function alertOwner(client, guild, embed) {
  try {
    const owner = await guild.fetchOwner().catch(() => null);
    if (!owner) return false;
    await owner.send({ embeds: [embed] });
    return true;
  } catch (err) {
    log.debug(`security: owner DM failed for guild ${guild.id}:`, err?.message ?? err);
    return false;
  }
}

function incidentEmbed(client, guild, { title, actionLabel, executorId, count, windowSec, punishedText, summary, notes = [] }) {
  const embed = client.brand
    .embed(guild, { color: 'error' })
    .setTitle(title ?? '🚨 Anti-nuke triggered')
    .addFields(
      { name: 'Server', value: `${truncate(guild.name ?? 'Unknown', 100)} (\`${guild.id}\`)`, inline: false },
      { name: 'Action', value: actionLabel ?? 'Unknown', inline: true },
      { name: 'Executor', value: executorId ? `<@${executorId}> (\`${executorId}\`)` : 'Unknown (audit attribution failed)', inline: true },
    );
  if (count != null && windowSec != null) {
    embed.addFields({ name: 'Threshold', value: `**${count}** action(s) within **${windowSec}s**`, inline: true });
  }
  if (punishedText) embed.addFields({ name: 'Response', value: truncate(punishedText, 1024), inline: false });
  if (summary) embed.addFields({ name: 'Details', value: truncate(summary, 1024), inline: false });
  const extra = notes.filter(Boolean);
  if (extra.length) embed.addFields({ name: 'Notes', value: truncate(extra.map((n) => `• ${n}`).join('\n'), 1024), inline: false });
  return embed;
}

/**
 * Core of the detection engine. Called by the thin event handlers after audit
 * attribution. Counts the action in a per-executor sliding window and, when
 * the configured threshold trips, punishes (verified executors only — never
 * blindly), alerts the owner, records the incident, logs to 'antinuke', and
 * optionally restores deleted channels/roles from backup.
 */
async function recordAction(client, guild, actionKey, executorId, { summary = '', restoreKind = null, attributionNote = null } = {}) {
  try {
    const cfg = config(client, guild.id);
    if (!cfg.enabled) return { triggered: false, reason: 'disabled' };
    if (executorId && isTrusted(client, guild, executorId)) return { triggered: false, reason: 'trusted' };

    const ac = actionConfig(cfg, actionKey);
    const windowKey = `security:win:${guild.id}:${actionKey}:${executorId ?? 'unknown'}`;
    const count = client.cooldowns.count(windowKey, ac.windowSec * 1000);
    if (count < ac.limit) return { triggered: false, count };

    // One incident per executor+action per window — don't spam punishments/alerts.
    if (client.cooldowns.hit(`security:trip:${guild.id}:${actionKey}:${executorId ?? 'unknown'}`, ac.windowSec) > 0) {
      return { triggered: false, count, suppressed: true };
    }

    const label = ACTIONS[actionKey]?.label ?? actionKey;
    const notes = [];
    if (attributionNote) notes.push(`Attribution: ${attributionNote}`);

    // NEVER punish blindly: without a verified executor we alert instead.
    let punishment = 'none';
    let result = { applied: 'none', note: null };
    if (executorId) {
      punishment = cfg.panic ? 'quarantine' : ac.punishment;
      if (cfg.panic && ac.punishment !== 'quarantine') notes.push('Panic mode active — punishment forced to quarantine.');
      result = await punish(client, guild, executorId, punishment, `SMPbot anti-nuke: ${label} ×${count} in ${ac.windowSec}s`);
    } else {
      notes.push('Executor could not be verified via the audit log — alerting only, no punishment.');
    }

    if (restoreKind && cfg.restore) {
      notes.push(`Restore: ${await restoreDeleted(client, guild, restoreKind)}`);
    }

    if (cfg.panic) {
      const lock = await lockdown(client, guild, {
        reason: `Panic mode: ${label} threshold exceeded`,
        minutes: clamp(Number(cfg.panicLockdownMinutes) || 15, 1, MAX_LOCKDOWN_MINUTES),
      });
      if (lock.ok) notes.push(`Panic lockdown engaged${lock.until ? ` until ${relativeTime(lock.until)}` : ''}.`);
      else if (!lock.already) notes.push(`Panic lockdown failed: ${lock.note}`);
    }

    const punishedText =
      result.applied === 'none'
        ? `⚠️ Alert only${result.note ? ` — ${result.note}` : ''}`
        : `🛡️ ${result.applied}${result.note ? ` — ${result.note}` : ''}`;
    const incidentId = insertIncident(client, guild, {
      executorId,
      actionKey,
      count,
      punished: result.applied,
      details: [summary, ...notes].filter(Boolean).join(' | '),
    });

    const embed = incidentEmbed(client, guild, {
      title: `🚨 Anti-nuke triggered (incident #${incidentId})`,
      actionLabel: `${ACTIONS[actionKey]?.emoji ?? '🚨'} ${label}`,
      executorId,
      count,
      windowSec: ac.windowSec,
      punishedText,
      summary,
      notes,
    });
    await alertOwner(client, guild, embed);
    await client.logs.send(guild, 'antinuke', { embeds: [embed] });
    log.warn(`security: incident #${incidentId} in guild ${guild.id} — ${actionKey} ×${count} by ${executorId ?? 'unknown'} → ${result.applied}`);
    return { triggered: true, count, incidentId, punished: result.applied };
  } catch (err) {
    log.error(`security: recordAction(${actionKey}) failed in guild ${guild?.id}:`, err);
    return { triggered: false, reason: 'error' };
  }
}

/**
 * Malicious-bot protection. Default is alert-only — the bot NEVER auto-removes
 * another bot unless staff explicitly configured kick/ban.
 */
async function handleBotAdd(client, member) {
  const guild = member.guild;
  const cfg = config(client, guild.id);
  if (!cfg.enabled) return;

  const attr = await attribute(guild, AuditLogEvent.BotAdd, member.id);
  const adderId = attr.executorId;
  const whitelisted = Array.isArray(cfg.bots?.whitelist) && cfg.bots.whitelist.includes(member.id);

  if (whitelisted) {
    const embed = client.brand
      .info(guild, 'Whitelisted bot added', `<@${member.id}> (\`${member.id}\`) joined.`)
      .addFields({ name: 'Added by', value: adderId ? `<@${adderId}>` : 'Unknown', inline: true });
    await client.logs.send(guild, 'bots', { embeds: [embed] });
    return;
  }

  const notes = [];
  let action = BOT_ACTIONS.includes(cfg.bots?.action) ? cfg.bots.action : 'alert';
  if (!adderId) {
    notes.push('The adder could not be verified via the audit log.');
  } else if (isTrusted(client, guild, adderId) && action !== 'alert') {
    notes.push('Added by a trusted user — enforcement skipped, alerting only.');
    action = 'alert';
  }

  let result = { applied: 'none', note: null };
  if (action === 'kick' || action === 'ban') {
    result = await punish(client, guild, member.id, action, 'SMPbot bot protection: unauthorized bot addition');
  }

  let adderResult = null;
  if (cfg.bots?.quarantineAdder && adderId && !isTrusted(client, guild, adderId) && result.applied !== 'none') {
    const adder = await guild.members.fetch(adderId).catch(() => null);
    adderResult = await quarantineMember(client, guild, adder, 'SMPbot bot protection: added an unauthorized bot');
    notes.push(`Adder quarantine: ${adderResult.applied === 'quarantine' ? adderResult.note ?? 'done' : adderResult.note ?? 'skipped'}`);
  }

  const incidentId = insertIncident(client, guild, {
    executorId: adderId,
    actionKey: 'botAdd',
    count: 1,
    punished: result.applied,
    details: [`Unauthorized bot <@${member.id}> (\`${member.id}\`) joined.`, ...notes].filter(Boolean).join(' | '),
  });

  const embed = incidentEmbed(client, guild, {
    title: `🤖 Unauthorized bot added (incident #${incidentId})`,
    actionLabel: '🤖 Bot addition',
    executorId: adderId,
    count: null,
    windowSec: null,
    punishedText:
      result.applied === 'none'
        ? `⚠️ Alert only${result.note ? ` — ${result.note}` : ''}`
        : `🛡️ Bot was ${result.applied === 'ban' ? 'banned' : 'kicked'}${result.note ? ` — ${result.note}` : ''}`,
    summary: `Bot <@${member.id}> (\`${member.id}\`) is not on the whitelist. Use \`/security bots add\` to whitelist it.`,
    notes,
  });
  await alertOwner(client, guild, embed);
  await client.logs.send(guild, 'bots', { embeds: [embed] });
}

/** Current lockdown row for a guild (or null). */
function lockdownState(client, guildId) {
  return client.db.get('SELECT guild_id, prev_perms, reason, created_at FROM security_lockdown WHERE guild_id = ?', guildId) ?? null;
}

/**
 * Emergency lockdown: strip SendMessages (+ thread perms) from @everyone at
 * the role level, storing the previous bitfield durably for restore. Optional
 * auto-unlock through the persistent scheduler ('security:unlock').
 */
async function lockdown(client, guild, { reason = 'Emergency lockdown', minutes = 0, initiatorId = null } = {}) {
  try {
    if (lockdownState(client, guild.id)) return { ok: false, already: true, note: 'The server is already locked down.' };
    const me = guild.members.me;
    if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
      return { ok: false, note: 'The bot is missing **Manage Roles** and cannot edit @everyone.' };
    }
    const everyone = guild.roles.everyone;
    if (!everyone) return { ok: false, note: 'Could not resolve the @everyone role.' };

    const prev = everyone.permissions.bitfield.toString();
    const next = new PermissionsBitField(everyone.permissions.bitfield).remove(LOCKDOWN_PERMS);
    client.db.run(
      `INSERT INTO security_lockdown (guild_id, prev_perms, reason, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (guild_id) DO UPDATE SET prev_perms = excluded.prev_perms, reason = excluded.reason, created_at = excluded.created_at`,
      guild.id,
      prev,
      truncate(reason, 400),
      Date.now(),
    );
    try {
      await everyone.setPermissions(next.bitfield, truncate(`SMPbot lockdown: ${reason}`, 400));
    } catch (err) {
      client.db.run('DELETE FROM security_lockdown WHERE guild_id = ?', guild.id);
      log.warn(`security: lockdown failed in guild ${guild.id}:`, err?.message ?? err);
      return { ok: false, note: 'Failed to edit @everyone permissions.' };
    }

    client.scheduler.cancelWhere(guild.id, 'security:unlock');
    let until = null;
    const mins = clamp(Number(minutes) || 0, 0, MAX_LOCKDOWN_MINUTES);
    if (mins > 0) {
      until = Date.now() + mins * 60000;
      client.scheduler.schedule({ guildId: guild.id, type: 'security:unlock', runAt: until, data: { reason } });
    }

    const embed = client.brand
      .warn(guild, 'Server locked down', `**Reason:** ${truncate(reason, 300)}`)
      .addFields(
        { name: 'Server', value: `${truncate(guild.name ?? 'Unknown', 100)} (\`${guild.id}\`)`, inline: true },
        { name: 'By', value: initiatorId ? `<@${initiatorId}>` : 'SMPbot (automatic)', inline: true },
        { name: 'Auto-unlock', value: until ? relativeTime(until) : 'Manual (`/unlock`)', inline: true },
      );
    await client.logs.send(guild, 'security', { embeds: [embed] });
    await alertOwner(client, guild, embed);
    return { ok: true, until };
  } catch (err) {
    log.error(`security: lockdown crashed in guild ${guild?.id}:`, err);
    return { ok: false, note: 'Lockdown failed unexpectedly.' };
  }
}

/** Undo a lockdown: restore the stored @everyone permission bitfield. */
async function unlock(client, guild, { initiatorId = null } = {}) {
  try {
    const row = lockdownState(client, guild.id);
    if (!row) return { ok: false, note: 'The server is not locked down.' };
    const me = guild.members.me;
    if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
      return { ok: false, note: 'The bot is missing **Manage Roles** and cannot edit @everyone.' };
    }
    const everyone = guild.roles.everyone;
    if (!everyone) return { ok: false, note: 'Could not resolve the @everyone role.' };
    let prev;
    try {
      prev = BigInt(row.prev_perms);
    } catch {
      prev = null;
    }
    if (prev === null) return { ok: false, note: 'Stored lockdown state is corrupt — restore @everyone permissions manually.' };
    try {
      await everyone.setPermissions(prev, 'SMPbot lockdown lifted');
    } catch (err) {
      log.warn(`security: unlock failed in guild ${guild.id}:`, err?.message ?? err);
      return { ok: false, note: 'Failed to edit @everyone permissions.' };
    }
    client.db.run('DELETE FROM security_lockdown WHERE guild_id = ?', guild.id);
    client.scheduler.cancelWhere(guild.id, 'security:unlock');

    const embed = client.brand
      .success(guild, 'Lockdown lifted', '@everyone permissions have been restored.')
      .addFields({ name: 'By', value: initiatorId ? `<@${initiatorId}>` : 'SMPbot (auto-unlock)', inline: true });
    await client.logs.send(guild, 'security', { embeds: [embed] });
    return { ok: true };
  } catch (err) {
    log.error(`security: unlock crashed in guild ${guild?.id}:`, err);
    return { ok: false, note: 'Unlock failed unexpectedly.' };
  }
}

/** Recent incidents, newest first (optionally filtered by executor). */
function listIncidents(client, guildId, { executorId = null, limit = 90 } = {}) {
  const lim = clamp(Number(limit) || 90, 1, 200);
  if (executorId) {
    return client.db.all(
      'SELECT * FROM security_incidents WHERE guild_id = ? AND executor_id = ? ORDER BY id DESC LIMIT ?',
      guildId,
      executorId,
      lim,
    );
  }
  return client.db.all('SELECT * FROM security_incidents WHERE guild_id = ? ORDER BY id DESC LIMIT ?', guildId, lim);
}

/** The /security status overview embed (shared with the security:refresh component). */
function buildStatusEmbed(client, guild) {
  const cfg = config(client, guild.id);
  const locked = lockdownState(client, guild.id);
  const dayAgo = Date.now() - 86400000;
  const incidents = client.db.get('SELECT COUNT(*) AS n FROM security_incidents WHERE guild_id = ? AND created_at > ?', guild.id, dayAgo);
  const quarantined = client.db.get('SELECT COUNT(*) AS n FROM security_quarantine WHERE guild_id = ?', guild.id);

  const mentionList = (ids, fmt) => {
    const list = (ids ?? []).slice(0, 10).map(fmt);
    const extra = (ids?.length ?? 0) - list.length;
    return list.length ? list.join(', ') + (extra > 0 ? ` +${extra} more` : '') : 'None';
  };

  const thresholds = Object.keys(ACTIONS)
    .map((key) => {
      const ac = actionConfig(cfg, key);
      const punishment = cfg.panic ? 'quarantine (panic)' : ac.punishment;
      return `${ACTIONS[key].emoji} ${ACTIONS[key].label}: **${ac.limit}**/${ac.windowSec}s → \`${punishment}\``;
    })
    .join('\n');

  return client.brand
    .embed(guild)
    .setTitle('🛡️ Security overview')
    .setDescription(
      [
        `**Anti-nuke:** ${cfg.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
        `**Panic mode:** ${cfg.panic ? '🚨 ACTIVE — all punishments forced to quarantine + auto-lockdown' : 'Off'}`,
        `**Restore from backup:** ${cfg.restore ? 'On' : 'Off'}`,
        `**Lockdown:** ${locked ? `🔒 Active since ${relativeTime(locked.created_at)} — ${truncate(locked.reason ?? 'no reason', 100)}` : '🔓 Not active'}`,
      ].join('\n'),
    )
    .addFields(
      { name: 'Trusted users', value: truncate(mentionList(cfg.trustedUsers, (id) => `<@${id}>`), 1024), inline: true },
      { name: 'Trusted roles', value: truncate(mentionList(cfg.trustedRoles, (id) => `<@&${id}>`), 1024), inline: true },
      {
        name: 'Bot protection',
        value: `Action: \`${BOT_ACTIONS.includes(cfg.bots?.action) ? cfg.bots.action : 'alert'}\` • Quarantine adder: ${cfg.bots?.quarantineAdder ? 'Yes' : 'No'}\nWhitelist: ${truncate(mentionList(cfg.bots?.whitelist, (id) => `<@${id}>`), 700)}`,
        inline: false,
      },
      { name: 'Thresholds', value: truncate(thresholds, 1024), inline: false },
      {
        name: 'Activity',
        value: `Incidents (24h): **${Number(incidents?.n ?? 0)}** • Quarantined users: **${Number(quarantined?.n ?? 0)}**`,
        inline: false,
      },
    );
}

/** Buttons under the /security status embed. */
function buildStatusRow(client, guild) {
  const locked = Boolean(lockdownState(client, guild.id));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('security:refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    locked
      ? new ButtonBuilder().setCustomId('security:unlock').setLabel('Lift lockdown').setEmoji('🔓').setStyle(ButtonStyle.Success)
      : new ButtonBuilder().setCustomId('security:lock').setLabel('Emergency lockdown').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
}

module.exports = {
  NAMESPACE,
  DEFAULTS,
  ACTIONS,
  PUNISHMENTS,
  BOT_ACTIONS,
  MAX_TRUSTED,
  MAX_WHITELIST,
  MAX_LOCKDOWN_MINUTES,
  AUDIT_WINDOW_MS,
  config,
  isEnabled,
  actionConfig,
  isTrusted,
  attribute,
  trackDeletion,
  recordAction,
  handleBotAdd,
  quarantineMember,
  releaseQuarantine,
  lockdown,
  unlock,
  lockdownState,
  listIncidents,
  buildStatusEmbed,
  buildStatusRow,
};
