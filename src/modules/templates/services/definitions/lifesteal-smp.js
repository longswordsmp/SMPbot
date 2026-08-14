'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, forum, open, readOnly, staffOnly, staffVoice, logChannel } = require('./_common');

/** 5. Lifesteal SMP — hearts, bounties, teams and PvP drama. */
module.exports = {
  id: 'lifesteal-smp',
  name: 'Lifesteal SMP',
  emoji: '❤️',
  description: 'The lifesteal formula: hearts, bounties, PvP, teams, revives, leaderboards and reports.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'helper', name: 'Helper', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'alive', name: 'Alive', color: COLOR.verified, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false, gate: true },
    { key: 'eliminated', name: 'Eliminated', color: COLOR.muted, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'INFORMATION',
      channels: [
        t('lifesteal-info', { emoji: 'ℹ️', topic: 'How lifesteal works on this server.', overwrites: readOnly() }),
        t('rules', { emoji: '📜', marker: 'rules', topic: 'Server rules.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Season & event news.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'Connect to the SMP.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'THE SERVER',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat.', overwrites: open() }),
        t('hearts', { emoji: '❤️', topic: 'Heart trades, gains and losses.', overwrites: open() }),
        t('pvp', { emoji: '⚔️', topic: 'Fights, clips and callouts.', overwrites: open() }),
        t('bounties', { emoji: '🎯', topic: 'Post and claim bounties.', overwrites: open() }),
        t('leaderboards', { emoji: '📊', topic: 'Most hearts & top killers.', overwrites: readOnly() }),
        ann('events', { emoji: '🎉', marker: 'giveaways', topic: 'Events & giveaways.', overwrites: readOnly() }),
        forum('teams', { emoji: '🤝', topic: 'Form and manage teams.', overwrites: open() }),
      ],
    },
    {
      name: 'VOICE',
      channels: [
        v('General VC', { emoji: '🔊', overwrites: open() }),
        v('Team VC 1', { emoji: '🎧', overwrites: open() }),
        v('Team VC 2', { emoji: '🎧', overwrites: open() }),
      ],
    },
    {
      name: 'SUPPORT',
      channels: [t('reports', { emoji: '🚩', marker: 'tickets-panel', topic: 'Report a player or open a ticket.', overwrites: readOnly() })],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', overwrites: staffOnly() }),
        v('Staff VC', { emoji: '🎙️', overwrites: staffVoice() }),
        t('mod-logs', { emoji: '🔨', marker: 'logs-moderation', overwrites: logChannel() }),
        t('server-logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
      ],
    },
  ],
};
