'use strict';

const { PermissionFlagsBits, ChannelType, OverwriteType } = require('discord.js');
const log = require('../../../core/logger');
const { LOG_TYPES, DEFAULT_LOGGING } = require('../../../core/logging');

const AUDIT_WINDOW_MS = 10 * 1000;

/**
 * The auto-created logging layout: one channel per staff group, and the full
 * set of LOG_TYPES mapped across them. Every LOG_TYPE appears exactly once.
 */
const LOG_GROUPS = [
  { key: 'security', name: 'security-logs', emoji: '🛡️', types: ['security', 'antinuke', 'bots'] },
  { key: 'moderation', name: 'moderation-logs', emoji: '🔨', types: ['moderation'] },
  { key: 'members', name: 'member-logs', emoji: '👥', types: ['members', 'verification', 'invites', 'leveling'] },
  { key: 'messages', name: 'message-logs', emoji: '💬', types: ['messages'] },
  { key: 'server', name: 'server-logs', emoji: '🗂️', types: ['roles', 'channels', 'server', 'webhooks'] },
  { key: 'tickets', name: 'ticket-logs', emoji: '🎫', types: ['tickets'] },
  { key: 'giveaways', name: 'giveaway-logs', emoji: '🎉', types: ['giveaways'] },
];

/** Manual-setup groups (fewer, each backed by a ChannelSelectMenu). */
const MANUAL_GROUPS = [
  { key: 'moderation', label: 'Moderation', emoji: '🔨', types: ['moderation'] },
  { key: 'members', label: 'Members & Access', emoji: '👥', types: ['members', 'verification', 'invites', 'leveling'] },
  { key: 'messages', label: 'Messages', emoji: '💬', types: ['messages'] },
  { key: 'server', label: 'Server & Roles', emoji: '🗂️', types: ['roles', 'channels', 'server', 'webhooks'] },
  { key: 'security', label: 'Security & Community', emoji: '🛡️', types: ['security', 'antinuke', 'bots', 'tickets', 'giveaways'] },
];

const CATEGORY_NAME = '🔒 SMPBOT LOGS';

function getConfig(client, guildId) {
  return client.config.get(guildId, 'logging', DEFAULT_LOGGING);
}

/**
 * Attribute a gateway event to its executor via the audit log. Only entries
 * matching the target AND created within ~10s count. Returns
 * { executorId, executor, entry, reason }.
 */
async function attribute(guild, type, targetId, { windowMs = AUDIT_WINDOW_MS } = {}) {
  const none = { executorId: null, executor: null, entry: null, reason: null };
  try {
    const me = guild.members?.me;
    if (!me?.permissions?.has?.(PermissionFlagsBits.ViewAuditLog)) {
      return { ...none, reason: 'missing View Audit Log' };
    }
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const now = Date.now();
    const entry =
      logs?.entries?.find((e) => (!targetId || e.targetId === targetId) && now - e.createdTimestamp <= windowMs) ?? null;
    if (!entry) return { ...none, reason: 'no matching audit entry' };
    const executorId = entry.executorId ?? entry.executor?.id ?? null;
    return { executorId, executor: entry.executor ?? null, entry, reason: executorId ? null : 'audit entry has no executor' };
  } catch (err) {
    log.debug(`modlog: audit fetch failed in guild ${guild?.id}:`, err?.message ?? err);
    return { ...none, reason: 'audit fetch failed' };
  }
}

/** Only process a given audit entry once across repeated gateway fires. */
function auditSeen(client, entryId) {
  if (!entryId) return false;
  return client.cooldowns.hit(`modlog:audit:${entryId}`, 600) > 0;
}

/** Base themed log embed with an actor author line. */
function logEmbed(client, guild, { colorKind = 'primary', emoji = '', title, description, fields = [], actor = null }) {
  const embed = client.brand.embed(guild, { color: colorKind });
  if (title) embed.setTitle(`${emoji ? `${emoji} ` : ''}${title}`);
  if (description) embed.setDescription(description);
  if (actor) {
    embed.setAuthor({
      name: actor.tag ?? actor.username ?? actor.name ?? 'Unknown',
      iconURL: actor.displayAvatarURL?.() ?? undefined,
    });
  }
  if (fields.length) embed.addFields(fields.filter((f) => f && f.value != null && f.value !== ''));
  return embed;
}

/** Mention + id line for an executor (or an honest "unknown"). */
function executorField(attr) {
  if (attr?.executorId) return { name: 'Performed by', value: `<@${attr.executorId}> (\`${attr.executorId}\`)`, inline: true };
  return { name: 'Performed by', value: attr?.reason ? `Unknown (${attr.reason})` : 'Unknown', inline: true };
}

/** Staff-only overwrites for the auto-created logging category. */
function staffOverwrites(guild) {
  const me = guild.members.me;
  const overwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
  ];
  if (me) {
    // Only grant permissions the bot itself holds — allowing a permission it
    // lacks (e.g. Manage Webhooks) would make channel creation 403. The bot
    // keeps its guild-level perms in the channel regardless, so webhook-based
    // delivery still works where available.
    overwrites.push({
      id: me.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }
  // Grant view to obvious staff roles (Administrator / Manage Server), best-effort.
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.roles.everyone.id) continue;
    if (role.managed) continue;
    if (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageGuild)) {
      overwrites.push({
        id: role.id,
        type: OverwriteType.Role,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      });
      if (overwrites.length >= 20) break; // keep the overwrite list bounded
    }
  }
  return overwrites;
}

/**
 * Auto-create the "SMPBOT LOGS" category + one channel per group, then map
 * every LOG_TYPE to a channel and persist the config. Returns
 * { category, channels: [{ group, channel }], mapping } or throws on hard fail.
 */
async function autoCreate(client, guild) {
  const overwrites = staffOverwrites(guild);
  const category = await guild.channels.create({
    name: CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: 'SMPbot logging setup',
  });

  const created = [];
  const mapping = {};
  for (const group of LOG_GROUPS) {
    try {
      const channel = await guild.channels.create({
        name: group.name,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwrites,
        reason: 'SMPbot logging setup',
      });
      created.push({ group, channel });
      for (const type of group.types) mapping[type] = channel.id;
    } catch (err) {
      log.warn(`modlog: failed to create ${group.name} in guild ${guild.id}:`, err?.message ?? err);
    }
  }

  // Any LOG_TYPE that somehow didn't get a channel falls back to the first created channel.
  const fallback = created[0]?.channel?.id ?? null;
  for (const type of LOG_TYPES) {
    if (!mapping[type] && fallback) mapping[type] = fallback;
  }

  client.config.set(guild.id, 'logging', { enabled: true, channels: mapping });
  return { category, channels: created, mapping };
}

module.exports = {
  AUDIT_WINDOW_MS,
  LOG_GROUPS,
  MANUAL_GROUPS,
  CATEGORY_NAME,
  LOG_TYPES,
  getConfig,
  attribute,
  auditSeen,
  logEmbed,
  executorField,
  autoCreate,
};
