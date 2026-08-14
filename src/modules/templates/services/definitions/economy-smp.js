'use strict';

const { COLOR, ROLE_PERMS, t, ann, v, forum, open, readOnly, staffOnly, staffVoice, logChannel } = require('./_common');

/** 6. Economy SMP — marketplaces, auctions, shops and player businesses. */
module.exports = {
  id: 'economy-smp',
  name: 'Economy SMP',
  emoji: '💰',
  description: 'A trading-driven economy server: marketplace, auctions, shops, jobs and player businesses.',
  roles: [
    { key: 'owner', name: 'Owner', color: COLOR.owner, hoist: true, mentionable: false, permissions: ROLE_PERMS.owner, staff: true },
    { key: 'admin', name: 'Admin', color: COLOR.admin, hoist: true, mentionable: false, permissions: ROLE_PERMS.admin, staff: true },
    { key: 'mod', name: 'Moderator', color: COLOR.mod, hoist: true, mentionable: true, permissions: ROLE_PERMS.moderator, staff: true },
    { key: 'broker', name: 'Market Broker', color: COLOR.helper, hoist: true, mentionable: true, permissions: ROLE_PERMS.helper, staff: true },
    { key: 'tycoon', name: 'Tycoon', color: COLOR.vip, hoist: true, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
    { key: 'member', name: 'Trader', color: COLOR.member, hoist: false, mentionable: false, permissions: ROLE_PERMS.member, staff: false },
  ],
  categories: [
    {
      name: 'INFORMATION',
      channels: [
        t('rules', { emoji: '📜', marker: 'rules', topic: 'Server & trading rules.', overwrites: readOnly() }),
        ann('announcements', { emoji: '📢', marker: 'announcements', topic: 'Economy news & updates.', overwrites: readOnly() }),
        t('server-ip', { emoji: '🌐', marker: 'server-ip', topic: 'Connect to the SMP.', overwrites: readOnly() }),
        t('economy-guide', { emoji: '📈', topic: 'How the server economy works.', overwrites: readOnly() }),
      ],
    },
    {
      name: 'COMMUNITY',
      channels: [
        t('general', { emoji: '💬', marker: 'general', topic: 'General chat.', overwrites: open() }),
        t('economy-chat', { emoji: '💹', topic: 'Talk prices, markets and deals.', overwrites: open() }),
      ],
    },
    {
      name: 'MARKETPLACE',
      channels: [
        forum('marketplace', { emoji: '🛒', topic: 'Buy & sell listings.', overwrites: open() }),
        t('trading', { emoji: '🔁', topic: 'Live trades & offers.', overwrites: open() }),
        t('auctions', { emoji: '🔨', topic: 'Auction rare items.', overwrites: open() }),
        forum('shops', { emoji: '🏪', topic: 'Advertise your shop.', overwrites: open() }),
        forum('player-businesses', { emoji: '🏢', topic: 'Register and promote businesses.', overwrites: open() }),
        t('jobs', { emoji: '💼', topic: 'Hiring & job postings.', overwrites: open() }),
      ],
    },
    {
      name: 'VOICE',
      channels: [
        v('Market Hall', { emoji: '🔊', overwrites: open() }),
        v('Negotiation Room', { emoji: '🤝', overwrites: open() }),
      ],
    },
    {
      name: 'SUPPORT',
      channels: [t('support', { emoji: '🎫', marker: 'tickets-panel', topic: 'Trade disputes & help.', overwrites: readOnly() })],
    },
    {
      name: 'STAFF',
      overwrites: staffOnly(),
      channels: [
        t('staff-chat', { emoji: '🛡️', overwrites: staffOnly() }),
        t('economy-logs', { emoji: '💱', topic: 'Market moderation notes.', overwrites: staffOnly() }),
        v('Staff VC', { emoji: '🎙️', overwrites: staffVoice() }),
        t('server-logs', { emoji: '🧾', marker: 'logs-default', overwrites: logChannel() }),
        t('mod-logs', { emoji: '🔨', marker: 'logs-moderation', overwrites: logChannel() }),
      ],
    },
  ],
};
