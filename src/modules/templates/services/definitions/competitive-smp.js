'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, forum, open, readOnly, staffOnly, staffVoice, logChannel } = require('./_common');

/** 4. Competitive SMP — PvP, leaderboards, tournaments, teams and appeals. */
module.exports = {
  id: 'competitive-smp',
  name: 'Competitive SMP',
  emoji: '⚔️',
  description: 'Built for PvP-focused SMPs: leaderboards, tournaments, team rooms, rankings, reports and appeals.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'referee', name: 'Referee', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'champion', name: 'Champion', color: COLOR.vip, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'member', name: 'Competitor', color: COLOR.member, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'INFORMATION',
      channels: [
        t('rules', { emoji: '📜', marker: 'rules', topic: 'Competition rules & fair play.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Match & season news.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'Connect to the arena.', overwrites: readOnly() }),
        t('rankings', { emoji: '🏅', topic: 'Current season rankings.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'ARENA',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat.', overwrites: open() }),
        t('pvp', { emoji: '⚔️', topic: 'PvP strategy & fights.', overwrites: open() }),
        t('leaderboards', { emoji: '📊', topic: 'Kill counts & win streaks.', overwrites: readOnly() }),
        t('tournaments', { emoji: '🏆', topic: 'Bracket & tournament chat.', overwrites: open() }),
        forum('team-recruitment', { emoji: '🧩', topic: 'Recruit teammates.', overwrites: open() }),
      ],
    },
    {
      name: 'TEAM ROOMS',
      channels: [
        v('Team Alpha', { emoji: '🅰️', overwrites: open() }),
        v('Team Bravo', { emoji: '🅱️', overwrites: open() }),
        v('Team Charlie', { emoji: '🇨', overwrites: open() }),
        v('Scrim VC', { emoji: '🎧', overwrites: open() }),
      ],
    },
    {
      name: 'DISPUTES',
      channels: [
        t('reports', { emoji: '🚩', marker: 'tickets-panel', topic: 'Report cheating or misconduct.', overwrites: readOnly() }),
        t('appeals', { emoji: '⚖️', topic: 'Appeal a ban or ruling.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', overwrites: staffOnly() }),
        t('match-review', { emoji: '🎥', topic: 'Referee match reviews.', overwrites: staffOnly() }),
        v('Staff VC', { emoji: '🎙️', overwrites: staffVoice() }),
        t('mod-logs', { emoji: '🔨', marker: 'logs-moderation', overwrites: logChannel() }),
        t('server-logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
      ],
    },
  ],
};
