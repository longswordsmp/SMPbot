'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, open, readOnly, staffOnly, staffVoice, logChannel } = require('./_common');

/** 8. Hardcore SMP — permadeath, death announcements, survival grit. */
module.exports = {
  id: 'hardcore-smp',
  name: 'Hardcore SMP',
  emoji: '💀',
  description: 'Permadeath survival: hardcore rules, death announcements, survival talk, leaderboards and appeals.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'helper', name: 'Helper', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'survivor', name: 'Survivor', color: COLOR.verified, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'ghost', name: 'Ghost', color: COLOR.muted, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'INFORMATION',
      channels: [
        t('hardcore-rules', { emoji: '📜', marker: 'rules', topic: 'One life. Read carefully.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Season news.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'Connect to the SMP.', overwrites: readOnly() }),
        ann('death-announcements', { emoji: '💀', topic: 'Fallen survivors.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'SURVIVAL',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat.', overwrites: open() }),
        t('survival-discussion', { emoji: '🪓', topic: 'Tips, strategy and stories.', overwrites: open() }),
        t('leaderboards', { emoji: '📊', topic: 'Longest survivors & records.', overwrites: readOnly() }),
        ann('events', { emoji: '🎉', marker: 'giveaways', topic: 'Events & giveaways.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'VOICE',
      channels: [
        v('Survivors VC', { emoji: '🔊', overwrites: open() }),
        v('Spectators', { emoji: '👻', overwrites: open() }),
      ],
    },
    {
      name: 'SUPPORT',
      channels: [
        t('reports', { emoji: '🚩', marker: 'tickets-panel', topic: 'Report issues or open a ticket.', overwrites: readOnly() }),
        t('appeals', { emoji: '⚖️', topic: 'Appeal a ban or death ruling.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', overwrites: staffOnly() }),
        v('Staff VC', { emoji: '🎙️', overwrites: staffVoice() }),
        t('server-logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
        t('mod-logs', { emoji: '🔨', marker: 'logs-moderation', overwrites: logChannel() }),
      ],
    },
  ],
};
