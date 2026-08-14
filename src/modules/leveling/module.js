'use strict';

const engine = require('./services/engine');

/**
 * Leveling module — message XP, a MEE6-style level curve, generated rank-card
 * images, level-role rewards, booster / role multipliers, and a leaderboard.
 * All durable state lives in SQLite (leveling_users / leveling_roles) and the
 * `leveling` config namespace, so it is fully restart-safe.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS leveling_users (
  guild_id        TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  xp              INTEGER NOT NULL DEFAULT 0,
  daily_xp        INTEGER NOT NULL DEFAULT 0,
  last_daily_date TEXT,
  last_message_at INTEGER NOT NULL DEFAULT 0,
  messages        INTEGER NOT NULL DEFAULT 0,
  last_hash       TEXT,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leveling_users_guild_xp ON leveling_users (guild_id, xp DESC);

CREATE TABLE IF NOT EXISTS leveling_roles (
  guild_id TEXT NOT NULL,
  level    INTEGER NOT NULL,
  role_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, level)
);
CREATE INDEX IF NOT EXISTS idx_leveling_roles_guild ON leveling_roles (guild_id, level);
`;

module.exports = {
  name: 'leveling',
  schema: SCHEMA,
  DEFAULTS: engine.DEFAULTS,

  init(client) {
    // Cross-module service (accessed defensively by other modules, e.g. giveaways).
    client.services.leveling = {
      getProfile: (guildId, userId) => engine.getProfile(client, guildId, userId),
      getLevel: (guildId, userId) => engine.getLevel(client, guildId, userId),
      addXp: (guildId, userId, amount) => engine.addXp(client, guildId, userId, amount),
    };
  },
};
