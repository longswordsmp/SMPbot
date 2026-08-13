'use strict';

const tracker = require('./services/tracker');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS invite_joins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  member_id  TEXT NOT NULL,
  inviter_id TEXT,
  code       TEXT,
  joined_at  INTEGER NOT NULL,
  fake       INTEGER NOT NULL DEFAULT 0,
  left_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invite_joins_guild_inviter ON invite_joins (guild_id, inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_joins_guild_member ON invite_joins (guild_id, member_id);

CREATE TABLE IF NOT EXISTS invite_bonus (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  bonus      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, user_id)
);
`;

module.exports = {
  name: 'invites',
  schema: SCHEMA,
  DEFAULTS: tracker.DEFAULTS,

  init(client) {
    // Cross-module service (accessed defensively by other modules).
    client.services.invites = {
      getStats: (guildId, userId) => tracker.getStats(client, guildId, userId),
      addBonus: (guildId, userId, amount) => tracker.addBonus(client, guildId, userId, amount),
      resetUser: (guildId, userId) => tracker.resetUser(client, guildId, userId),
      resetGuild: (guildId) => tracker.resetGuild(client, guildId),
      leaderboard: (guildId, limit) => tracker.leaderboard(client, guildId, limit),
    };
  },
};
