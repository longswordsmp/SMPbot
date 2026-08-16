# 🟩 SMPbot

**Built for SMPs. Built for communities. Built for security.**

SMPbot is a premium, all-in-one Discord bot engineered specifically for
Minecraft SMP communities. Invite it, run `/setup`, pick one of 10 complete
server templates, choose a color theme, generate custom branding, enter your
Java IP and Bedrock port — and a professional SMP Discord server is created
almost automatically.

Every public-facing message uses a consistent, webhook-style branded design.
Every setting persists across restarts. Every automated security action is
configurable.

---

## ✨ Feature overview

| System | Highlights |
|---|---|
| ⚙️ **Interactive setup** | `/setup` — a 20-step guided wizard using buttons, select menus, and modals. No commands to memorize. |
| 🏗️ **10 server templates** | Classic SMP, Modern Gaming, Clean Minimal, Competitive, Lifesteal, Economy, Factions, Hardcore, Professional Network, and the flagship Ultimate SMP — full categories, channels, roles, permissions, and log wiring, with preview before apply. |
| 🎨 **Theme engine** | 14 built-in Minecraft-inspired themes (Emerald, Diamond, Nether, End, Redstone, Ocean, Midnight, Purple, Gold, Crimson, Forest, Ice, Sunset, Custom) controlling every embed, panel, and webhook message. |
| 🖼️ **Branding generation** | `/branding setup` generates a custom logo, avatar, banner, and webhook identity in four art styles — Minecraft-inspired, no copyrighted assets. |
| 🎫 **Tickets** | Multi-category panels (support, reports, partnerships, appeals, purchases, staff, custom), claiming, priorities, transcripts, statistics, staff activity, cooldowns, per-category permissions. |
| 🎉 **Giveaways** | Button entry, role/level/account-age/membership requirements, **required invites** with live `3 / 5` progress, blacklists, pause/resume, automatic winner validation with auto-reroll. |
| 🔗 **Invite tracking** | Legitimate-invite verification, fake-invite detection, leave adjustments, bonus invites, leaderboard, per-user statistics. |
| 🛡️ **Anti-nuke** | Audit-log-verified detection of mass deletions/creations/bans/kicks, webhook abuse, permission escalation, and setting changes — with configurable thresholds, trusted users/roles, quarantine, backup-powered restoration, and owner alerts. |
| 👑 **Anti-admin abuse** | `Administrator` does **not** bypass monitoring. Compromised admins trigger emergency protection: permission revocation, structure restoration, lockdown, owner alerts. |
| 🤖 **Bot protection** | Approved-bot whitelist, unauthorized-bot detection, audit-log verification, optional automatic removal (off by default). |
| 🚫 **AutoMod** | Anti-spam (flooding, mentions, emoji, caps, characters), anti-link (invites, MC server ads, shorteners, phishing heuristics, whitelists, own-IP exceptions), configurable anti-NSFW, raid detection. |
| 📈 **Leveling** | XP with cooldowns and daily caps, anti-farming, boosters and multipliers, level roles, canvas rank cards, leaderboards, branded level-up announcements. |
| 👋 **Welcome system** | Themed welcome/leave embeds, generated welcome banners, placeholders (`{user}`, `{membercount}`, `{invites}`, `{level}`, …), auto-roles, DM welcome, link buttons. |
| 📢 **Announcements** | `/announce` with preview, scheduling, mentions, buttons, and auto-crosspost via `/publish`. |
| 📜 **Rules** | Starter packs (Discord / Minecraft / SMP / chat / staff rules, punishment ladder), fully editable, beautifully published. |
| 🔐 **Verification** | Button or generated-image CAPTCHA verification, account-age requirements, auto-kick for unverified, themed panels. |
| 🎮 **Server connection** | `/server setup` stores Java IP + Bedrock IP/port and publishes a polished "How to join" guide; `/ip` for quick access. |
| 💾 **Backups** | Channels, categories, roles, permissions, and every SMPbot configuration — manual + scheduled, with confirmation-gated restores that also power anti-nuke recovery. |
| 🧾 **Logging** | 15 log categories (security, moderation, members, messages, tickets, giveaways, webhooks, …) with auto-created log category or per-channel mapping. |
| 🔨 **Moderation** | Warnings with escalation, timeouts, kicks, bans/tempbans/softbans, purge, slowmode — full case system with DM notices. |

---

## 🚀 Getting started

### 1. Create the Discord application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Under **Bot**, create the bot and copy the **token**.
3. Enable the **privileged gateway intents**: `Server Members Intent` and `Message Content Intent`.
4. Under **OAuth2 → URL Generator**, select `bot` + `applications.commands`, permissions **Administrator** (or the granular set below), and invite the bot to your server.

### 2. Install & configure
```bash
git clone <this repo>
cd SMPbot
npm install
cp .env.example .env   # then fill in DISCORD_TOKEN and CLIENT_ID
```

### 3. Register slash commands
```bash
npm run deploy          # global (up to 1h to propagate)
# or set DEV_GUILD_ID in .env first for instant registration to one guild
```

### 4. Run
```bash
npm start
```

### 5. In Discord
Run **`/setup`** as the server owner and follow the wizard.

---

## 🔑 Recommended permissions

SMPbot works best with **Administrator**. If you prefer granular permissions:
Manage Channels, Manage Roles, Manage Webhooks, Manage Server, View Audit Log,
Ban Members, Kick Members, Moderate Members, Manage Messages, Read/Send
Messages, Embed Links, Attach Files, Mention Everyone, Manage Events.

The bot's highest role must be **above** the roles it manages (verification
roles, level roles, quarantine targets) for those systems to work.

---

## 🔒 Security notes

- Tokens and secrets live only in `.env` (gitignored). Nothing is hardcoded.
- All automated protection actions are **configurable and conservative by
  default** — alert-only until the owner opts into enforcement.
- The guild owner, the bot itself, and explicitly trusted users/roles are the
  only principals exempt from anti-nuke monitoring. `Administrator` is not.
- Detection (anti-nuke, anti-NSFW, phishing heuristics) is best-effort, not
  perfect. Review the security log channel and tune thresholds for your
  community.
- Users never see raw stack traces — errors are logged to the console for
  operators and shown to users as branded error embeds.

## 🗄️ Persistence

All state — configuration, tickets, giveaways, invites, XP, cases, backups,
scheduled jobs — lives in a WAL-mode SQLite database at `data/smpbot.db`.
Timers (giveaway endings, temp bans, scheduled announcements, auto-backups)
are re-armed automatically on restart. Back up the `data/` directory to back
up the bot.

## 🧱 Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Each feature is a
self-contained module under `src/modules/` (commands, events, components,
services, schema) auto-discovered at boot — the framework wires slash
commands, component routing, theming, webhook delivery, logging, scheduling,
and permissions.

```bash
npm run smoke   # offline load test: modules, schemas, command serialization
```

## ⚔️ Minecraft plugin: TotemGuardians

This repository also carries a Paper server plugin at
[`minecraft-plugin/TotemGuardians`](minecraft-plugin/TotemGuardians). Popping a
Totem of Undying enchanted with **Unbreaking** summons a squad of five nameless,
blacked-out guardians in full netherite with shields and maxed swords that fight
for you for five minutes. Unbreaking I guardians defend; Unbreaking III guardians
also attack whatever you attack. Build it with `mvn clean package` — see the
plugin's own README for configuration and commands.

## 📄 License

MIT
