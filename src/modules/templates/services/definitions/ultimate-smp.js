'use strict';

const {
  COLOR,
  ROLE_PERMS,
  t,
  ann,
  v,
  stage,
  forum,
  open,
  readOnly,
  staffOnly,
  staffVoice,
  logChannel,
  gated,
  gatedReadOnly,
} = require('./_common');

/**
 * 10. Ultimate SMP — the flagship template. A complete, verification-gated
 * server with a full staff ladder, a full logging suite (one channel per major
 * log type) and every marker wired into SMPbot's other modules.
 */
module.exports = {
  id: 'ultimate-smp',
  name: 'Ultimate SMP',
  emoji: '🌟',
  description: 'The flagship: a complete verification-gated SMP with a full staff suite, full logging suite and everything wired in.',
  defaultPrefixEmoji: true,
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'coowner', name: 'Co-Owner', color: COLOR.coowner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'srmod', name: 'Senior Moderator', color: COLOR.srmod, hoist: true, mentionable: true, permissions: ROLE_PERMS.manager, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'helper', name: 'Helper', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'trainee', name: 'Trainee', color: COLOR.trainee, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'builder', name: 'Build Team', color: COLOR.builder, hoist: true, mentionable: true, permissions: ROLE_PERMS.builder, staff: false },
    { key: 'media', name: 'Media Team', color: COLOR.media, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'event', name: 'Event Host', color: COLOR.event, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: false },
    { key: 'partner', name: 'Partner', color: COLOR.partner, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'booster', name: 'Booster', color: COLOR.booster, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'vip', name: 'VIP', color: COLOR.vip, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'verified', name: 'Verified', color: COLOR.verified, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'member', name: 'Member', color: COLOR.member, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'muted', name: 'Muted', color: COLOR.muted, hoist: false, mentionable: false, permissions: ROLE_PERMS.muted, staff: false },
  ],
  categories: [
    {
      name: 'INFORMATION',
      channels: [
        t('welcome', { emoji: '👋', marker: 'welcome', topic: 'Welcome to the server!', overwrites: readOnly() }),
        t('rules', { emoji: '📜', marker: 'rules', topic: 'Read before you play.', overwrites: readOnly() }),
        t('verify', { emoji: '🔐', marker: 'verification', topic: 'Verify to unlock the server.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'How to connect to the SMP.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Important server news.', overwrites: readOnly() }),
        ann('updates', { emoji: '🆕', topic: 'Changelogs & patch notes.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'COMMUNITY',
      overwrites: gated('verified'),
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat.', overwrites: gated('verified') }),
        t('minecraft', { emoji: '⛏️', topic: 'Talk Minecraft & the SMP.', overwrites: gated('verified') }),
        t('media', { emoji: '🎬', topic: 'Videos & clips.', overwrites: gated('verified') }),
        t('screenshots', { emoji: '📸', topic: 'In-game screenshots.', overwrites: gated('verified') }),
        t('memes', { emoji: '😂', topic: 'Memes only.', overwrites: gated('verified') }),
        forum('suggestions', { emoji: '💡', marker: 'suggestions', topic: 'Suggest improvements.', overwrites: gated('verified') }),
      ],
    },
    {
      name: 'EVENTS',
      overwrites: gated('verified'),
      channels: [
        ann('events', { emoji: '🎉', topic: 'Upcoming events.', overwrites: gatedReadOnly('verified') }),
        t('giveaways', { emoji: '🎁', marker: 'giveaways', topic: 'Server giveaways.', overwrites: gatedReadOnly('verified') }),
      ],
    },
    {
      name: 'GROWTH',
      overwrites: gated('verified'),
      channels: [
        forum('partnerships', { emoji: '🤝', topic: 'Partner with the server.', overwrites: gated('verified') }),
        forum('applications', { emoji: '📝', topic: 'Apply for staff & teams.', overwrites: gated('verified') }),
      ],
    },
    {
      name: 'SUPPORT',
      channels: [t('support', { emoji: '🎫', marker: 'tickets-panel', topic: 'Open a ticket for help.', overwrites: readOnly() })],
    },
    {
      name: 'VOICE',
      overwrites: gated('verified'),
      channels: [
        stage('Main Stage', { emoji: '🎤', overwrites: open() }),
        v('Lounge', { emoji: '🛋️', overwrites: open() }),
        v('Community VC', { emoji: '🔊', overwrites: open() }),
        v('Music', { emoji: '🎵', overwrites: open() }),
        v('AFK', { emoji: '💤', overwrites: open() }),
      ],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-announcements', { emoji: '📣', topic: 'Staff-only announcements.', overwrites: staffOnly() }),
        t('staff-chat', { emoji: '🛡️', topic: 'Private staff discussion.', overwrites: staffOnly() }),
        t('staff-commands', { emoji: '⌨️', topic: 'Run staff commands here.', overwrites: staffOnly() }),
        t('admin-chat', { emoji: '👑', topic: 'Admin-only discussion.', overwrites: staffOnly() }),
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
