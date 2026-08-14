# SMPbot Command Reference

Generated from the loaded bot. Options and subcommands are shown as registered with Discord.

## automod

### `/automod`

Configure AutoMod — anti-spam, anti-link, anti-NSFW, and raid protection

- **`/automod status`** — Overview of every AutoMod system in this server
- **`/automod enable`** — Enable AutoMod in this server
- **`/automod disable`** — Disable AutoMod in this server
- **`/automod system toggle`** — Enable or disable one AutoMod system
- **`/automod system action`** — Set the moderation action for a system (not pins/raid)
- **`/automod spam flood`** — Message flooding threshold
- **`/automod spam mentions`** — Mention spam threshold
- **`/automod spam duplicates`** — Repeated identical message threshold
- **`/automod spam emoji`** — Emoji spam threshold
- **`/automod spam caps`** — Caps spam threshold
- **`/automod spam characters`** — Character / newline spam threshold
- **`/automod spam reactions`** — Mass reactions threshold
- **`/automod spam pins`** — Excessive pins alert threshold
- **`/automod links urlflood`** — URL flooding threshold
- **`/automod links repeatedlink`** — Repeated same-link threshold
- **`/automod whitelist domain-add`** — Whitelist a domain (exempt from link checks)
- **`/automod whitelist domain-remove`** — Remove a whitelisted domain
- **`/automod whitelist domain-list`** — List whitelisted domains
- **`/automod whitelist channel-add`** — Exempt a channel/category from AutoMod
- **`/automod whitelist channel-remove`** — Remove a whitelisted channel/category
- **`/automod whitelist role-add`** — Exempt a role from AutoMod
- **`/automod whitelist role-remove`** — Remove a whitelisted role
- **`/automod whitelist bypass-add`** — Add a staff bypass role
- **`/automod whitelist bypass-remove`** — Remove a staff bypass role
- **`/automod mcip add`** — Allow a Minecraft IP/host for advertising
- **`/automod mcip remove`** — Remove an allowed Minecraft IP/host
- **`/automod mcip list`** — List allowed Minecraft IPs/hosts
- **`/automod nsfw sensitivity`** — Set the NSFW matching sensitivity
- **`/automod nsfw word-add`** — Add a custom NSFW word
- **`/automod nsfw word-remove`** — Remove a custom word or suppress a built-in one
- **`/automod nsfw words`** — Show the NSFW wordlist configuration
- **`/automod raid settings`** — Configure raid detection (default response is alert-only)
- **`/automod strikes settings`** — Escalate to a harsher action after repeated violations
- **`/automod timeout set`** — Set how long the timeout action lasts

## backup

### `/backup`

Server structure & configuration backups for anti-nuke recovery

- **`/backup create`** — Take a snapshot of this server (roles, channels, and all SMPbot config)
- **`/backup list`** — List saved backups for this server
- **`/backup info`** — Show the details of a backup
- **`/backup restore`** — Restore structure or config from a backup (server owner only)
- **`/backup delete`** — Delete a saved backup
- **`/backup auto`** — Configure automatic recurring backups

## branding

### `/branding`

Generate a custom logo, banner, and webhook identity for your server

- **`/branding setup`** — Guided wizard: generate a matching logo, banner, and webhook avatar
- **`/branding logo`** — Quickly generate a server logo
- **`/branding banner`** — Quickly generate a server banner
- **`/branding webhook`** — Set the webhook display name and/or regenerate the webhook avatar
- **`/branding theme`** — How to change the colors used by branding
- **`/branding reset`** — Restore the default SMPbot branding

## content

### `/announce`

Create, schedule, and manage rich announcements

- **`/announce create`** — Create an announcement (with an optional live preview)
- **`/announce scheduled list`** — List announcements scheduled for later
- **`/announce scheduled cancel`** — Cancel a scheduled announcement

### `/ip`

Show the Minecraft server IP(s) to connect

### `/publish`

Publish (crosspost) a message from an announcement channel to all followers

- `message` (required) — Message ID or message link to publish
- `channel` — Channel the message is in (default: this channel)

### `/rules`

Build and publish your server rules

- **`/rules setup`** — Start your rules with prewritten starter packs
- **`/rules add`** — Add a rule section
- **`/rules edit`** — Edit a rule section
- **`/rules remove`** — Remove a rule section
- **`/rules list`** — List your rule sections
- **`/rules publish`** — Publish (or republish) the rules to a channel

### `/server`

Configure and publish your Minecraft server connection info

- **`/server setup`** — Set your Java/Bedrock IPs and server name
- **`/server info`** — View the current server info and guide preview
- **`/server publish`** — Publish the connection guide to a channel

## general

### `/botinfo`

About SMPbot — version, stats, and status

### `/help`

Browse every SMPbot command by category

### `/ping`

Check SMPbot's latency and status

## giveaways

### `/giveaway`

Run premium giveaways with invite, level, role, and age requirements

- **`/giveaway start`** — Start a new giveaway
- **`/giveaway end`** — End a giveaway now and draw winners
- **`/giveaway reroll`** — Reroll new winner(s) for an ended giveaway
- **`/giveaway cancel`** — Cancel a giveaway without drawing winners
- **`/giveaway pause`** — Pause a running giveaway (entries close, time freezes)
- **`/giveaway resume`** — Resume a paused giveaway
- **`/giveaway list`** — List active giveaways in this server
- **`/giveaway config`** — View or set the giveaway manager role

## invites

### `/invites`

Invite tracking — stats, leaderboard, and staff tools

- **`/invites view`** — View a member's invite stats
- **`/invites leaderboard`** — Top inviters in this server
- **`/invites add`** — Grant bonus invites to a member (staff)
- **`/invites remove`** — Remove bonus invites from a member (staff)
- **`/invites reset`** — Reset invite stats for one member, or the entire server (staff)
- **`/invites info`** — See who a member has invited
- **`/invites config`** — View or change invite tracking settings (staff)

## leveling

### `/leaderboard`

Show the top members by XP in this server

### `/level`

Show a compact summary of your level and XP

- `user` — Whose level to show (defaults to you)

### `/levelroles`

Manage level-reward roles (staff)

- **`/levelroles add`** — Reward a role when members reach a level
- **`/levelroles remove`** — Remove the reward role for a level
- **`/levelroles list`** — List all configured level-reward roles
- **`/levelroles mode`** — Choose whether reward roles stack or replace the previous one

### `/levels`

Explain how XP and levels work, and list the level rewards

### `/rank`

Show your level and XP as a rank card

- `user` — Whose rank to show (defaults to you)

### `/xp`

Manage member XP and leveling settings (staff)

- **`/xp add`** — Add XP to a member
- **`/xp remove`** — Remove XP from a member
- **`/xp set`** — Set a member's total XP
- **`/xp resetuser`** — Erase a member's XP and level progress
- **`/xp resetserver`** — Erase the XP of every member in this server
- **`/xp multiplier-set`** — Give a role an XP multiplier
- **`/xp multiplier-clear`** — Remove a role’s XP multiplier
- **`/xp noxp-channel`** — Add or remove a channel where no XP is earned
- **`/xp noxp-role`** — Add or remove a role whose members earn no XP
- **`/xp config`** — View or change leveling settings

## modlog

### `/ban`

Ban a member (optionally temporarily and with message deletion)

- `user` (required) — User to ban (accepts an ID for users not in the server)
- `reason` — Reason
- `delete_days` — Delete this many days of their messages (0-7)
- `duration` — Temp-ban length, e.g. 7d, 12h (omit for permanent)

### `/case`

Inspect or remove a moderation case

- **`/case view`** — View a moderation case by number
- **`/case remove`** — Mark a case (e.g. a warning) inactive so it no longer counts

### `/kick`

Remove a member from the server

- `user` (required) — Member to kick
- `reason` — Reason

### `/logging`

Configure SMPbot event logging channels

- **`/logging setup`** — Guided setup: auto-create channels, pick manually, or use one channel
- **`/logging status`** — Show which channel each log type is mapped to
- **`/logging enable`** — Enable logging
- **`/logging disable`** — Disable logging (mappings are kept)
- **`/logging set`** — Map a single log type to a channel
- **`/logging clear`** — Remove the channel mapping for a log type

### `/modconfig`

Configure moderation behavior (DMs and warning escalation)

- **`/modconfig view`** — Show current moderation settings
- **`/modconfig dm`** — Toggle whether targets are DMed a notice on moderation actions
- **`/modconfig escalation enable`** — Enable warning escalation
- **`/modconfig escalation disable`** — Disable warning escalation
- **`/modconfig escalation list`** — List configured escalation rules
- **`/modconfig escalation add`** — Add or update the action for a warning threshold
- **`/modconfig escalation remove`** — Remove the escalation rule at a warning threshold

### `/purge`

Bulk-delete recent messages in this channel

- `count` (required) — How many messages to scan/delete (1-100)
- `user` — Only delete messages from this user
- `contains` — Only delete messages containing this text

### `/slowmode`

Set or clear the per-user slowmode for a channel

- `duration` (required) — Slowmode per message, e.g. 10s, 5m — or "off" to clear (max 6h)
- `channel` — Channel to change (defaults to here)

### `/softban`

Ban then immediately unban a member to purge their recent messages

- `user` (required) — Member to softban
- `reason` — Reason
- `delete_days` — Days of messages to purge (0-7, default 1)

### `/timeout`

Temporarily mute a member using a native Discord timeout (max 28 days)

- `user` (required) — Member to time out
- `duration` (required) — Duration, e.g. 10m, 2h, 1d (max 28d)
- `reason` — Reason

### `/unban`

Lift a ban by user ID

- `user` (required) — ID of the banned user
- `reason` — Reason

### `/untimeout`

Remove an active timeout from a member

- `user` (required) — Member to release
- `reason` — Reason

### `/warn`

Issue a warning to a member (with configurable auto-escalation)

- `user` (required) — Member to warn
- `reason` (required) — Reason for the warning

### `/warnings`

View a member's warning history

- `user` (required) — Member to look up

## security

### `/antinuke`

Configure the anti-nuke detection engine

- **`/antinuke enable`** — Turn the anti-nuke engine on or off
- **`/antinuke thresholds`** — View every detection threshold and punishment
- **`/antinuke set`** — Change the threshold or punishment for one monitored action
- **`/antinuke restore`** — Toggle restoring nuked channels/roles from the latest backup
- **`/antinuke panic`** — Panic mode: every punishment becomes quarantine + auto-lockdown on any trigger

### `/lockdown`

Emergency lockdown: stop @everyone from sending messages server-wide

- `minutes` — Auto-unlock after this many minutes (omit for manual /unlock)
- `reason` — Why the server is being locked

### `/security`

Security overview, incident history, and malicious-bot protection

- **`/security status`** — Overview of every security system in this server
- **`/security incidents`** — Browse recorded security incidents
- **`/security unquarantine`** — Restore the roles removed from a quarantined user
- **`/security bots add`** — Whitelist a bot so it can be added without alerts or enforcement
- **`/security bots remove`** — Remove a bot from the whitelist
- **`/security bots list`** — Show the bot whitelist and current protection settings
- **`/security bots action`** — What happens when a non-whitelisted bot is added

### `/trusted`

Owner only: manage users/roles exempt from anti-nuke monitoring

- **`/trusted add`** — Trust a user or role (they bypass all anti-nuke monitoring)
- **`/trusted remove`** — Remove a user or role from the trusted list
- **`/trusted list`** — Show every trusted user and role

### `/unlock`

Lift an emergency lockdown and restore @everyone permissions

## setup

### `/setup`

Set up your entire server with the SMPbot wizard

## templates

### `/template`

Build your server from one of ten complete SMP templates

- **`/template list`** — Browse the ten built-in server templates
- **`/template preview`** — Preview a template in full without creating anything
- **`/template apply`** — Build your server from a template (server owner only)
- **`/template customize`** — Rename roles and toggle emoji prefixes on the last applied template

## themes

### `/theme`

Choose the color theme used across every SMPbot message

- **`/theme select`** — Pick one of the 14 built-in SMPbot themes
- **`/theme preview`** — Preview a theme without applying it
- **`/theme custom`** — Create a fully custom color theme

## tickets

### `/ticket`

Manage the ticket in this channel

- **`/ticket claim`** — Claim this ticket (staff)
- **`/ticket close`** — Close this ticket
- **`/ticket reopen`** — Reopen this closed ticket (staff)
- **`/ticket rename`** — Rename this ticket channel (staff)
- **`/ticket add`** — Add a member to this ticket (staff)
- **`/ticket remove`** — Remove a member from this ticket (staff)
- **`/ticket priority`** — Set this ticket's priority (staff)
- **`/ticket transcript`** — Generate a transcript of this ticket

### `/ticketconfig`

Configure the ticket system

- **`/ticketconfig category add`** — Add a ticket category
- **`/ticketconfig category edit`** — Edit a ticket category
- **`/ticketconfig category remove`** — Remove a ticket category
- **`/ticketconfig category list`** — List this server's ticket categories
- **`/ticketconfig settings`** — View or change ticket system settings

### `/ticketpanel`

Design and publish ticket panels

- **`/ticketpanel create`** — Create a new ticket panel
- **`/ticketpanel publish`** — Publish (or republish) a panel to a channel
- **`/ticketpanel list`** — List this server's ticket panels
- **`/ticketpanel delete`** — Delete a ticket panel

### `/ticketstats`

Ticket statistics — totals, staff activity, and close times

## verification

### `/verification`

Configure member verification for this server

- **`/verification setup`** — Guided setup — roles, channel, mode, and publish the panel
- **`/verification panel`** — Publish or re-publish the verification panel
- **`/verification config`** — View the current verification configuration
- **`/verification enable`** — Enable verification
- **`/verification disable`** — Disable verification
- **`/verification stats`** — Verification stats (verified members in the last 30 days)
- **`/verification set account-age`** — Minimum Discord account age required to verify
- **`/verification set cooldown`** — Per-user cooldown between verify attempts
- **`/verification set autokick`** — Auto-kick members who never verify
- **`/verification set mode`** — How members verify
- **`/verification set dm`** — Direct-message members when they verify

## welcome

### `/welcome`

Configure welcome & leave messages, auto-roles, banners, and DMs

- **`/welcome status`** — Show the current welcome & leave configuration
- **`/welcome test`** — Preview the welcome message as if you just joined
- **`/welcome toggle`** — Enable or disable welcome messages
- **`/welcome channel set`** — Set the channel welcome messages are posted in
- **`/welcome channel clear`** — Clear the welcome channel
- **`/welcome message edit`** — Edit the welcome title & description (opens a form)
- **`/welcome message image`** — Set a custom image URL shown on the welcome embed
- **`/welcome message image-clear`** — Remove the custom welcome image
- **`/welcome message banner`** — Toggle the generated welcome banner image
- **`/welcome message server-icon`** — Show the server icon on the welcome embed
- **`/welcome dm toggle`** — Enable or disable the welcome DM
- **`/welcome dm edit`** — Edit the welcome DM message (opens a form)
- **`/welcome autoroles add`** — Add an auto-role
- **`/welcome autoroles remove`** — Remove an auto-role
- **`/welcome autoroles list`** — List the configured auto-roles
- **`/welcome autoroles skip-bots`** — Whether bots should be skipped when assigning auto-roles
- **`/welcome buttons add`** — Add a link button
- **`/welcome buttons remove`** — Remove a link button by its position
- **`/welcome buttons list`** — List the configured link buttons
- **`/welcome leave toggle`** — Enable or disable leave messages
- **`/welcome leave channel`** — Set the channel leave messages are posted in
- **`/welcome leave channel-clear`** — Clear the leave channel
- **`/welcome leave edit`** — Edit the leave title & description (opens a form)
