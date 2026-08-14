'use strict';

const {
  COLOR,
  ROLE_PERMS,
  t,
  ann,
  v,
  forum,
  open,
  readOnly,
  staffOnly,
  staffVoice,
  logChannel,
  gated,
  gatedReadOnly,
} = require('./_common');

/** 9. Professional Network — a polished, verification-gated large-community layout. */
module.exports = {
  id: 'professional-network',
  name: 'Professional Network',
  emoji: '🏢',
  description: 'A polished large-community layout with a verification gate, partnerships, applications and full logs.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Administrator', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'manager', name: 'Manager', color: COLOR.manager, hoist: true, mentionable: true, permissions: ROLE_PERMS.manager, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'helper', name: 'Support Team', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'partner', name: 'Partner', color: COLOR.partner, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'verified', name: 'Verified', color: COLOR.verified, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'WELCOME',
      channels: [
        t('verify', { emoji: '🔐', marker: 'verification', topic: 'Verify to unlock the server.', overwrites: readOnly() }),
        t('rules', { emoji: '📜', marker: 'rules', topic: 'Community rules & guidelines.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Official announcements.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'How to connect.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'COMMUNITY',
      overwrites: gated('verified'),
      channels: [
        t('information', { emoji: 'ℹ️', topic: 'Guides & resources.', overwrites: gatedReadOnly('verified') }),
        t('general', { emoji: '💬', marker: 'general', topic: 'General discussion.', overwrites: gated('verified') }),
        t('community', { emoji: '🌍', topic: 'Community talk & introductions.', overwrites: gated('verified') }),
        t('media', { emoji: '📸', topic: 'Screenshots & clips.', overwrites: gated('verified') }),
      ],
    },
    {
      name: 'EVENTS & GROWTH',
      overwrites: gated('verified'),
      channels: [
        ann('events', { emoji: '🎉', marker: 'giveaways', topic: 'Events & giveaways.', overwrites: gatedReadOnly('verified') }),
        forum('partnerships', { emoji: '🤝', topic: 'Partner with us.', overwrites: gated('verified') }),
        forum('applications', { emoji: '📝', topic: 'Apply for staff & roles.', overwrites: gated('verified') }),
      ],
    },
    {
      name: 'VOICE',
      overwrites: gated('verified'),
      channels: [
        v('Lounge', { emoji: '🛋️', overwrites: open() }),
        v('Community VC', { emoji: '🔊', overwrites: open() }),
        v('Meeting Room', { emoji: '📊', overwrites: open() }),
      ],
    },
    {
      name: 'SUPPORT',
      channels: [t('support', { emoji: '🎫', marker: 'tickets-panel', topic: 'Open a support ticket.', overwrites: readOnly() })],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', overwrites: staffOnly() }),
        t('staff-announcements', { emoji: '📣', overwrites: staffOnly() }),
        v('Staff VC', { emoji: '🎙️', overwrites: staffVoice() }),
      ],
    },
    {
      name: 'LOGS',
      overwrites: staffOnly(),
      channels: [
        t('server-logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
        t('security-logs', { emoji: '🛡️', marker: 'logs-security', overwrites: logChannel() }),
        t('mod-logs', { emoji: '🔨', marker: 'logs-moderation', overwrites: logChannel() }),
        t('member-logs', { emoji: '👥', marker: 'logs-members', overwrites: logChannel() }),
        t('message-logs', { emoji: '✉️', marker: 'logs-messages', overwrites: logChannel() }),
      ],
    },
  ],
};
