'use strict';

const { PermissionFlagsBits } = require('discord.js');

/**
 * Central permission / hierarchy helpers. Security-sensitive modules must use
 * these instead of ad-hoc checks so behavior stays consistent.
 */

function botOwnerIds() {
  return (process.env.OWNER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Bot-level owner (from OWNER_IDS env). */
function isBotOwner(userId) {
  return botOwnerIds().includes(userId);
}

/** Guild owner or bot owner. */
function isGuildOwner(member) {
  if (!member) return false;
  return member.guild.ownerId === member.id || isBotOwner(member.id);
}

/** Can the bot act on this member at all (role hierarchy + not owner)? */
function botCanActOn(member) {
  if (!member?.guild) return false;
  if (member.id === member.guild.ownerId) return false;
  const me = member.guild.members.me;
  if (!me) return false;
  return me.roles.highest.comparePositionTo(member.roles.highest) > 0;
}

/** Can `executor` legitimately act on `target` (hierarchy + ownership)? */
function canActOn(executor, target) {
  if (!executor || !target) return false;
  if (executor.guild.id !== target.guild.id) return false;
  if (target.id === target.guild.ownerId) return false;
  if (executor.id === executor.guild.ownerId) return true;
  return executor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

/** Permissions considered dangerous for escalation monitoring. */
const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.MentionEveryone,
];

/** True if the given permission bitfield contains any dangerous permission. */
function hasDangerousPermissions(permissions) {
  return DANGEROUS_PERMISSIONS.some((flag) => permissions?.has?.(flag));
}

/** Human-readable names for a permissions bitfield's dangerous entries. */
function dangerousPermissionNames(permissions) {
  const names = [];
  const labels = {
    [PermissionFlagsBits.Administrator]: 'Administrator',
    [PermissionFlagsBits.ManageGuild]: 'Manage Server',
    [PermissionFlagsBits.ManageRoles]: 'Manage Roles',
    [PermissionFlagsBits.ManageChannels]: 'Manage Channels',
    [PermissionFlagsBits.ManageWebhooks]: 'Manage Webhooks',
    [PermissionFlagsBits.BanMembers]: 'Ban Members',
    [PermissionFlagsBits.KickMembers]: 'Kick Members',
    [PermissionFlagsBits.MentionEveryone]: 'Mention Everyone',
  };
  for (const flag of DANGEROUS_PERMISSIONS) {
    if (permissions?.has?.(flag)) names.push(labels[flag]);
  }
  return names;
}

module.exports = {
  botOwnerIds,
  isBotOwner,
  isGuildOwner,
  botCanActOn,
  canActOn,
  DANGEROUS_PERMISSIONS,
  hasDangerousPermissions,
  dangerousPermissionNames,
};
