'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, open, readOnly, staffOnly, staffVoice, logChannel } = require('./_common');

/** 1. Classic SMP — the traditional, familiar SMP layout. */
module.exports = {
  id: 'classic-smp',
  name: 'Classic SMP',
  emoji: '🏡',
  description: 'The timeless SMP layout: information, community, support tickets, staff area and logs.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'helper', name: 'Helper', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'builder', name: 'Builder', color: COLOR.builder, hoist: true, mentionable: true, permissions: ROLE_PERMS.builder, staff: false },
    { key: 'member', name: 'Member', color: COLOR.member, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'INFORMATION',
      channels: [
        t('rules', { emoji: '📜', marker: 'rules', topic: 'Server rules — read before you play.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'How to connect to the SMP.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Important server news.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'COMMUNITY',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat for the community.', overwrites: open() }),
        t('minecraft-chat', { emoji: '⛏️', topic: 'Talk about anything Minecraft.', overwrites: open() }),
        t('builds', { emoji: '🏗️', topic: 'Show off your builds.', overwrites: open() }),
        t('off-topic', { emoji: '🎲', topic: 'Everything else.', overwrites: open() }),
      ],
    },
    {
      name: 'SUPPORT',
      channels: [
        t('support', { emoji: '🎫', marker: 'tickets-panel', topic: 'Open a ticket for help.', overwrites: readOnly() }),
        t('suggestions', { emoji: '💡', marker: 'suggestions', topic: 'Suggest improvements to the server.', overwrites: open() }),
      ],
    },
    {
      name: 'VOICE',
      channels: [
        v('General VC', { emoji: '🔊', overwrites: open() }),
        v('Music', { emoji: '🎵', overwrites: open() }),
      ],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', topic: 'Private staff discussion.', overwrites: staffOnly() }),
        t('staff-commands', { emoji: '⌨️', topic: 'Run staff commands here.', overwrites: staffOnly() }),
        v('Staff VC', { emoji: '🎙️', overwrites: staffVoice() }),
      ],
    },
    {
      name: 'LOGS',
      overwrites: staffOnly(),
      channels: [
        t('server-logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
        t('mod-logs', { emoji: '🔨', marker: 'logs-moderation', overwrites: logChannel() }),
        t('member-logs', { emoji: '👥', marker: 'logs-members', overwrites: logChannel() }),
      ],
    },
  ],
};
