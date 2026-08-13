# SMPbot Architecture

SMPbot is a modular, database-backed, restart-safe Discord bot. This document
is the **contract** every module follows. Read it fully before writing a module.

## Layout

```
src/
  index.js            # entry point (dotenv, login, graceful shutdown)
  bot.js              # client factory: wires services + loads modules
  core/               # framework — modules NEVER edit core files
    logger.js         # console logger (log.info/warn/error/debug)
    database.js       # DatabaseManager (better-sqlite3, WAL) + DATA_DIR
    config.js         # ConfigManager (per-guild JSON namespaces)
    themes.js         # ThemeManager + 14 built-in themes
    embeds.js         # BrandService (branded embed factory)
    webhooks.js       # WebhookService (webhook-first delivery + fallback)
    logging.js        # GuildLogService + LOG_TYPES
    scheduler.js      # persistent job scheduler (restart-safe timers)
    permissions.js    # hierarchy/danger helpers
    cooldowns.js      # cooldowns + sliding-window counters
    loader.js         # module auto-discovery
    router.js         # interaction router (commands/components/modals)
    utils.js          # parseDuration, deepMerge, confirm, paginate, safeReply...
  modules/<name>/
    module.js         # optional: { name, schema, init(client), ready(client) }
    commands/*.js     # slash commands (auto-registered)
    events/*.js       # gateway event handlers (auto-registered)
    components/*.js   # button/select/modal handlers by customId prefix
    services/*.js     # module-internal logic (plain requires, not auto-loaded)
scripts/
  deploy-commands.js  # registers slash commands (global or DEV_GUILD_ID)
  smoke.js            # offline load test — MUST pass before committing
```

## File shapes

**Command** (`commands/*.js`):
```js
module.exports = {
  cooldown: 5,                                // optional, seconds/user
  permissions: PermissionFlagsBits.ManageGuild, // optional, checked by router
  ownerOnly: false,                           // optional, guild owner only
  guildOnly: true,                            // default true
  data: new SlashCommandBuilder()...,         // also setDefaultMemberPermissions(...)
  async execute(interaction) { ... },
  async autocomplete(interaction) { ... },    // optional
};
```

**Event** (`events/*.js`):
```js
const { Events } = require('discord.js');
module.exports = {
  event: Events.GuildMemberAdd,
  once: false,
  async execute(client, member) { ... },      // client is ALWAYS the first arg
};
```

**Component** (`components/*.js`) — customIds are `prefix:action:arg1:arg2...`:
```js
module.exports = {
  prefix: 'ticket',                           // must be from the registry below
  async handle(interaction, args) { ... },    // args = customId.split(':').slice(1)
};
```

**Module** (`module.js`, optional):
```js
module.exports = {
  name: 'tickets',
  schema: `CREATE TABLE IF NOT EXISTS tickets (...);`,  // idempotent DDL only
  init(client) { client.services.tickets = {...}; client.scheduler.register('tickets:close', handler); },
  async ready(client) { ... },                // after clientReady
};
```

## Core services (on `client`)

| Service | Key APIs |
|---|---|
| `client.db` | `get(sql, ...p)`, `all(sql, ...p)`, `run(sql, ...p)`, `transaction(fn)`, `registerSchema(sql)` |
| `client.config` | `get(guildId, ns, defaults)`, `set(guildId, ns, value)`, `update(guildId, ns, patch)` (deep merge), `allForGuild`, `importForGuild` |
| `client.themes` | `get(guildId)` → `{ name, label, emoji, colors: { primary, secondary, accent, success, error, warning, info } }`, `color(guildId, kind)`, `setTheme`, `setCustom`, `list()` |
| `client.brand` | `embed(guild, { color })`, `success/error/warn/info(guild, title, desc)`, `branding(guildId)` |
| `client.hooks` | `send(channel, payload, { username, avatarURL }?)` — **use for all public messages**; `refreshGuild(guild)`, `isManagedWebhook(id)` |
| `client.logs` | `send(guild, type, payload)` — types: security, antinuke, moderation, members, messages, roles, channels, tickets, giveaways, verification, invites, leveling, server, bots, webhooks |
| `client.scheduler` | `register(type, handler)`, `schedule({ guildId, type, runAt, data })` → id, `cancel(id)`, `cancelWhere(guildId, type)`, `pending(guildId, type)` |
| `client.cooldowns` | `hit(key, seconds)` → remaining ms (0 = allowed), `count(key, windowMs)` sliding window, `peek(key, windowMs)` |
| `core/permissions` | `isGuildOwner(member)`, `isBotOwner(userId)`, `botCanActOn(member)`, `canActOn(executor, target)`, `hasDangerousPermissions(perms)`, `dangerousPermissionNames(perms)` |
| `core/utils` | `parseDuration('1d2h')`→ms, `formatDuration`, `deepMerge`, `parseColor`, `intToHex`, `truncate`, `chunkArray`, `relativeTime(ms)`, `absoluteTime(ms)`, `safeReply(i, payload)`, `confirm(i, { embed, danger })`→bool, `paginate(i, embeds, { ephemeral })` |

## Cross-module services (`client.services.*`)

Registered in each module's `init()`. **Always access defensively**
(`client.services.invites?.getStats?.(...)`) — a missing service must degrade
gracefully, never crash.

```js
// invites module registers:
client.services.invites = {
  getStats(guildId, userId),         // → { regular, bonus, fake, left, total } (total = regular + bonus - fake - left)
  addBonus(guildId, userId, amount), // amount may be negative
  resetUser(guildId, userId),
  resetGuild(guildId),
  leaderboard(guildId, limit),       // → [{ userId, regular, bonus, fake, left, total }]
};

// leveling module registers:
client.services.leveling = {
  getProfile(guildId, userId),       // → { xp, level, totalXp, rank } (level 0 if unknown)
  getLevel(guildId, userId),         // → number
  addXp(guildId, userId, amount),
};

// backup module registers:
client.services.backup = {
  async create(guild, { reason, auto } = {}),   // → backupId (string)
  list(guildId),                                 // → [{ id, createdAt, reason, auto, counts }]
  getBackup(guildId, backupId),                  // → full snapshot object or null
  latest(guildId),                               // → snapshot or null; snapshot.channels/roles arrays
  async restoreChannel(guild, channelSnapshot),  // recreate one deleted channel
  async restoreRole(guild, roleSnapshot),        // recreate one deleted role
};
// snapshot.channels: [{ id, name, type, parentId, topic, position, nsfw, rateLimitPerUser, permissionOverwrites: [{ id, type, allow, deny }] }]
// snapshot.roles:    [{ id, name, color, hoist, position, permissions, mentionable }]

// security module registers:
client.services.security = {
  isTrusted(guild, userId),                      // trusted users/roles/owner check
  async lockdown(guild, { reason, minutes }),    // emergency lockdown
  async unlock(guild),
};

// templates module registers:
client.services.templates = {
  list(),                                        // → [{ id, name, emoji, description }]
  get(id),                                       // full template definition
  async apply(guild, id, options),               // build the server; → { createdChannels, createdRoles }
  preview(guild, id),                            // → EmbedBuilder[] describing the template
};

// verification module registers:
client.services.verification = {
  async publishPanel(guild, channel),            // post the themed verify panel
};

// rules module registers:
client.services.rules = { async publish(guild, channel) };

// serverinfo module registers:
client.services.serverinfo = { async publishGuide(guild, channel) };  // connection guide

// welcome module registers:
client.services.welcome = { renderMessage(guild, member, template) }; // placeholder substitution
```

## Config namespaces (one owner module each)

`theme`, `branding` (core-owned), `tickets`, `giveaways`, `invites`,
`security`, `automod`, `leveling`, `welcome`, `announce`, `rules`,
`verification`, `minecraft` (`{ javaIp, bedrockIp, bedrockPort, serverName }`),
`backup`, `logging`, `moderation`, `setup` (`{ completed, template, steps }`).

Each owner module exports its `DEFAULTS` object from `services/` or
`module.js` so `/setup` and templates can reference it.

## Component prefix registry (no collisions)

`core` (reserved), `theme`, `branding`, `setup`, `template`, `ticket`,
`giveaway`, `invites`, `security`, `automod`, `level`, `welcome`, `announce`,
`rules`, `verify`, `server`, `backup`, `logging`, `mod`, `help`.

## Scheduler job types

Namespace job types with the module name: `giveaway:end`, `announce:publish`,
`security:unlock`, `moderation:untimeout`, `backup:auto`, etc. Handlers are
re-registered on every boot in `init()`; jobs persist in SQLite.

## Non-negotiable rules

1. **Webhook-first UI**: every public-facing message goes through
   `client.hooks.send(channel, { embeds, components })`. Interaction replies
   use branded embeds via `client.brand`. No plain-text responses.
2. **Theme-aware**: never hardcode embed colors — always `client.brand.embed()`
   or `client.themes.color(guildId, kind)`.
3. **Persistence**: ALL state that must survive a restart lives in SQLite
   (module `schema` + `client.config`). No in-memory-only source of truth,
   no JSON files. In-memory caches are fine if rebuilt from DB/API on boot.
4. **Restart-safe timers**: never a bare `setTimeout` for future work —
   use `client.scheduler`.
5. **Graceful degradation**: wrap Discord API calls that can fail
   (missing perms, deleted channels/roles) and degrade with a log entry —
   never crash, never show users a stack trace.
6. **Permission hygiene**: check bot permissions before acting; check user
   permissions via command `permissions` + `setDefaultMemberPermissions`;
   check role hierarchy via `core/permissions` before moderating anyone.
7. **Validation**: validate and bound every user input (durations, colors,
   counts, snowflakes). Reject bad input with a branded error embed.
8. **Ephemeral admin UX**: configuration/staff responses are ephemeral
   (`flags: MessageFlags.Ephemeral`); public panels are posted via webhooks.
9. **Destructive actions** require `utils.confirm(...)` first.
10. **Logs**: every significant action emits `client.logs.send(guild, type, ...)`.
11. **Modules never edit core files or other modules.** Shared needs go in
    your own `services/` folder or through `client.services.*`.
12. Look at `src/modules/themes/` and `src/modules/general/` as reference
    implementations of the patterns above.
