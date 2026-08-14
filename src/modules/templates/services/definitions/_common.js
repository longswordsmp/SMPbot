'use strict';

/**
 * Shared building blocks for the ten server templates. Keeping the roles,
 * channel factories, permission bundles and overwrite presets here keeps every
 * template file short, consistent and genuinely comparable.
 *
 * IMPORTANT: permission entries are PermissionFlagsBits *names* (strings). The
 * engine resolves them to bit values and silently skips any name it does not
 * recognise, so templates stay resilient across discord.js versions.
 *
 * Overwrite `roleKey` may be:
 *   '@everyone'   → the guild default role
 *   'STAFF_GROUP' → expands to every role flagged `staff: true` in the template
 *   '<role key>'  → a specific role defined in the template's `roles` array
 */

// Cosmetic role colors (Discord role colors are intentionally fixed — the theme
// system only drives embeds/webhook messages, never member role colors).
const COLOR = {
  owner: 0xe74c3c,
  coowner: 0xe67e22,
  admin: 0xe91e63,
  manager: 0xc0392b,
  srmod: 0x9b59b6,
  mod: 0x3498db,
  helper: 0x1abc9c,
  trainee: 0x16a085,
  builder: 0x27ae60,
  media: 0xff7043,
  partner: 0x00bcd4,
  event: 0xf39c12,
  vip: 0xf1c40f,
  booster: 0xf47fff,
  verified: 0x2ecc71,
  member: 0x95a5a6,
  muted: 0x607d8b,
  bot: 0x546e7a,
};

// Permission bundles for member roles (names resolved by the engine).
const ROLE_PERMS = {
  owner: ['Administrator'],
  admin: [
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'ManageWebhooks',
    'ManageNicknames',
    'ManageMessages',
    'KickMembers',
    'BanMembers',
    'ModerateMembers',
    'ViewAuditLog',
    'MentionEveryone',
    'ManageEvents',
  ],
  manager: [
    'ManageChannels',
    'ManageMessages',
    'ManageNicknames',
    'KickMembers',
    'BanMembers',
    'ModerateMembers',
    'ViewAuditLog',
    'ManageEvents',
    'MentionEveryone',
  ],
  moderator: ['KickMembers', 'BanMembers', 'ModerateMembers', 'ManageMessages', 'ManageNicknames', 'ViewAuditLog'],
  helper: ['ModerateMembers', 'ManageMessages'],
  builder: ['ManageMessages'],
  member: [],
  muted: [],
};

// ---- Naming ----------------------------------------------------------------

/** Emoji-prefixed channel name (used identically at build time and on toggle). */
function decorateName(name, emoji, prefixEmoji) {
  if (prefixEmoji && emoji) return `${emoji}・${name}`;
  return name;
}

// ---- Channel factories -----------------------------------------------------

const t = (name, opts = {}) => ({ name, type: 'text', ...opts });
const ann = (name, opts = {}) => ({ name, type: 'announcement', ...opts });
const v = (name, opts = {}) => ({ name, type: 'voice', ...opts });
const forum = (name, opts = {}) => ({ name, type: 'forum', ...opts });
const stage = (name, opts = {}) => ({ name, type: 'stage', ...opts });

// ---- Overwrite presets -----------------------------------------------------

const SEND = ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'AddReactions', 'EmbedLinks', 'AttachFiles'];

/** Fully public channel — no explicit overwrites, inherits category/@everyone. */
function open() {
  return [];
}

/** Everyone can read but not post; staff can post. Used for info/announcements. */
function readOnly() {
  return [
    { roleKey: '@everyone', allow: ['ViewChannel', 'ReadMessageHistory'], deny: ['SendMessages', 'AddReactions', 'CreatePublicThreads'] },
    { roleKey: 'STAFF_GROUP', allow: ['SendMessages', 'AddReactions', 'ManageMessages', 'MentionEveryone'] },
  ];
}

/** Hidden from everyone; visible + writable only to staff roles. */
function staffOnly() {
  return [
    { roleKey: '@everyone', deny: ['ViewChannel'] },
    { roleKey: 'STAFF_GROUP', allow: SEND },
  ];
}

/** Hidden staff voice channel. */
function staffVoice() {
  return [
    { roleKey: '@everyone', deny: ['ViewChannel', 'Connect'] },
    { roleKey: 'STAFF_GROUP', allow: ['ViewChannel', 'Connect', 'Speak', 'Stream', 'MoveMembers'] },
  ];
}

/** Read-only log channel — hidden from everyone, staff read-only. */
function logChannel() {
  return [
    { roleKey: '@everyone', deny: ['ViewChannel'] },
    { roleKey: 'STAFF_GROUP', allow: ['ViewChannel', 'ReadMessageHistory'], deny: ['SendMessages'] },
  ];
}

/** Visible only to a specific (verified/member) role + staff. */
function gated(roleKey) {
  return [
    { roleKey: '@everyone', deny: ['ViewChannel'] },
    { roleKey, allow: ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'AddReactions', 'EmbedLinks', 'AttachFiles'] },
    { roleKey: 'STAFF_GROUP', allow: SEND.concat(['ManageMessages']) },
  ];
}

/** Read-only gated info (visible to a role, nobody but staff posts). */
function gatedReadOnly(roleKey) {
  return [
    { roleKey: '@everyone', deny: ['ViewChannel'] },
    { roleKey, allow: ['ViewChannel', 'ReadMessageHistory'], deny: ['SendMessages'] },
    { roleKey: 'STAFF_GROUP', allow: ['ViewChannel', 'SendMessages', 'AddReactions', 'ManageMessages'] },
  ];
}

module.exports = {
  COLOR,
  ROLE_PERMS,
  decorateName,
  t,
  ann,
  v,
  forum,
  stage,
  open,
  readOnly,
  staffOnly,
  staffVoice,
  logChannel,
  gated,
  gatedReadOnly,
};
