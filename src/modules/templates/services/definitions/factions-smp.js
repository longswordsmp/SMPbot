'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, forum, open, readOnly, staffOnly, staffVoice, logChannel } = require('./_common');

/** 7. Factions SMP — wars, alliances, territory and recruitment. */
module.exports = {
  id: 'factions-smp',
  name: 'Factions SMP',
  emoji: '🏴',
  description: 'Faction warfare at its core: factions, wars, alliances, recruitment, territory and reports.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'warden', name: 'War Warden', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'leader', name: 'Faction Leader', color: COLOR.vip, hoist: true, mentionable: true, permissions: ROLE_PERMS.member, staff: false },
    { key: 'member', name: 'Faction Member', color: COLOR.member, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'INFORMATION',
      channels: [
        t('rules', { emoji: '📜', marker: 'rules', topic: 'Server & war rules.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Server news.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'Connect to the SMP.', overwrites: readOnly() }),
        t('territory-map', { emoji: '🗺️', topic: 'Current territory & claims.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'THE WAR ROOM',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat.', overwrites: open() }),
        t('factions', { emoji: '🏴', topic: 'Faction talk & rankings.', overwrites: open() }),
        t('wars', { emoji: '⚔️', topic: 'Declare & discuss wars.', overwrites: open() }),
        t('alliances', { emoji: '🤝', topic: 'Diplomacy & alliances.', overwrites: open() }),
        forum('recruitment', { emoji: '📣', topic: 'Recruit for your faction.', overwrites: open() }),
        ann('events', { emoji: '🎉', marker: 'giveaways', topic: 'Events & giveaways.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'VOICE',
      channels: [
        v('General VC', { emoji: '🔊', overwrites: open() }),
        v('War Room 1', { emoji: '🎧', overwrites: open() }),
        v('War Room 2', { emoji: '🎧', overwrites: open() }),
      ],
    },
    {
      name: 'SUPPORT',
      channels: [t('reports', { emoji: '🚩', marker: 'tickets-panel', topic: 'Report rule-breaking or open a ticket.', overwrites: readOnly() })],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', overwrites: staffOnly() }),
        t('war-review', { emoji: '🎥', topic: 'Warden war rulings.', overwrites: staffOnly() }),
        v('Staff VC', { emoji: '🎙️', overwrites: staffVoice() }),
        t('server-logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
        t('mod-logs', { emoji: '🔨', marker: 'logs-moderation', overwrites: logChannel() }),
      ],
    },
  ],
};
