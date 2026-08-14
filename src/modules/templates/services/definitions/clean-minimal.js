'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, open, readOnly, staffOnly, logChannel } = require('./_common');

/** 3. Clean Minimal — no clutter: 3 roles, ~8 channels. */
module.exports = {
  id: 'clean-minimal',
  name: 'Clean Minimal',
  emoji: '🧼',
  description: 'A deliberately minimal server — three roles and a handful of essential channels, zero clutter.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'staff', name: 'Staff', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'member', name: 'Member', color: COLOR.member, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'INFO',
      channels: [
        t('rules', { emoji: '📜', marker: 'rules', topic: 'The rules.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Server news.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'How to connect.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'CHAT',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat.', overwrites: open() }),
        t('support', { emoji: '🎫', marker: 'tickets-panel', topic: 'Need help? Open a ticket.', overwrites: readOnly() }),
        v('Voice', { emoji: '🔊', overwrites: open() }),
      ],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', topic: 'Private staff area.', overwrites: staffOnly() }),
        t('logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
      ],
    },
  ],
};
