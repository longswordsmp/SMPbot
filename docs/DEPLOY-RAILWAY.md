# Deploying SMPbot on Railway

A step-by-step guide from zero to a running bot. No coding required.

## Part 1 — Create the Discord bot

1. Go to https://discord.com/developers/applications and click **New Application**. Name it `SMPbot` (or your server's name).
2. Open the **Bot** tab → click **Reset Token** → **copy the token** and keep it secret. This is your `DISCORD_TOKEN`.
3. Still on the **Bot** tab, scroll to **Privileged Gateway Intents** and turn ON:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**
   (Both are required — invites, welcome, leveling, and automod won't work without them.)
4. Invite the bot: **OAuth2 → URL Generator** → check `bot` and `applications.commands` → under Bot Permissions check **Administrator** → copy the generated URL, open it, and add the bot to your server.
5. In your Discord server, drag the bot's role **near the top** of the role list (Server Settings → Roles) so it can manage roles and channels below it.

## Part 2 — Deploy on Railway

1. Go to https://railway.app and sign in **with your GitHub account**.
2. **New Project → Deploy from GitHub repo** → select **SMPbot**. (Authorize Railway's GitHub access if asked.)
3. **Pick the branch**: in the service's **Settings → Source**, make sure the branch with the bot code is selected (`main` after the pull request is merged).
4. **Add environment variables** — service → **Variables** tab:

   | Variable | Value |
   |---|---|
   | `DISCORD_TOKEN` | the bot token from Part 1 step 2 |
   | `AUTO_DEPLOY_COMMANDS` | `true` |

   That's all that's required. Optional extras: `OWNER_IDS` (your Discord user ID), `DEV_GUILD_ID` (your server's ID — makes slash commands appear instantly instead of up to an hour on the very first boot).
5. **Attach a Volume (important!)** — right-click the service → **Attach Volume** → set the mount path to:

   ```
   /app/data
   ```

   This is where SMPbot's database lives (settings, tickets, giveaways, XP, backups). Without a volume, everything resets every time Railway redeploys.
6. Railway builds and starts automatically (`npm start` is detected from package.json). Open the **Deployments → Logs** and wait for:

   ```
   SMPbot online as YourBot#1234 in 1 guild(s).
   Auto-registered 46 slash command(s) globally.
   ```

## Part 3 — Set up your server

In your Discord server, run **`/setup`** (you must be the server owner). The wizard walks you through everything: template, theme, branding, verification, rules, Minecraft IPs, tickets, giveaways, moderation, security, backups, logging, welcome, and leveling.

## Troubleshooting

- **"Used disallowed intents" in logs** → you skipped Part 1 step 3 (enable both privileged intents), then redeploy.
- **Slash commands don't appear** → global registration can take up to an hour the first time. Set `DEV_GUILD_ID` to your server ID for instant registration while testing.
- **Bot can't create channels/roles** → it needs Administrator (or the granular permissions in the README) and its role must be above the roles it manages.
- **Settings lost after redeploy** → the volume isn't attached at `/app/data` (Part 2 step 5).
- Every push to the deployed branch auto-redeploys the bot — that's normal.
