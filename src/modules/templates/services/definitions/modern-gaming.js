'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, stage, open, readOnly, staffOnly, staffVoice, logChannel } = require('./_common');

/** 2. Modern Gaming — sleek lowercase-with-emoji naming and rich voice lounges. */
module.exports = {
  id: 'modern-gaming',
  name: 'Modern Gaming',
  emoji: '🎮',
  description: 'A modern, emoji-forward gaming community layout with clips, memes, events and voice lounges.',
  defaultPrefixEmoji: true,
  roles: [
    { key: 'owner', name: 'owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'mod', name: 'mod', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'event', name: 'event host', color: COLOR.event, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'vip', name: 'vip', color: COLOR.vip, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'member', name: 'member', color: COLOR.member, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'welcome',
      channels: [
        t('rules', { emoji: '📜', marker: 'rules', topic: 'the rules — read them.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📣', marker: 'announcements', topic: 'server news', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'connect to the server', overwrites: readOnly() }),
      ],
    },
    {
      name: 'community',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'general chat', overwrites: open() }),
        t('gaming', { emoji: '🎮', topic: 'talk games', overwrites: open() }),
        t('clips', { emoji: '🎬', topic: 'drop your best clips', overwrites: open() }),
        t('screenshots', { emoji: '📸', topic: 'in-game screenshots', overwrites: open() }),
        t('memes', { emoji: '😂', topic: 'memes only', overwrites: open() }),
        t('events', { emoji: '🎉', marker: 'suggestions', topic: 'community events & ideas', overwrites: open() }),
      ],
    },
    {
      name: 'support',
      channels: [t('support', { emoji: '🎫', marker: 'tickets-panel', topic: 'open a ticket', overwrites: readOnly() })],
    },
    {
      name: 'voice',
      channels: [
        stage('Main Stage', { emoji: '🎤', overwrites: open() }),
        v('lounge', { emoji: '🛋️', overwrites: open() }),
        v('gaming', { emoji: '🎮', overwrites: open() }),
        v('music', { emoji: '🎵', overwrites: open() }),
        v('afk', { emoji: '💤', overwrites: open() }),
      ],
    },
    {
      name: 'staff',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', overwrites: staffOnly() }),
        t('logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
        v('staff voice', { emoji: '🎙️', overwrites: staffVoice() }),
      ],
    },
  ],
};
