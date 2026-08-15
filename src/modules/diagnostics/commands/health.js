'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, GatewayIntentBits } = require('discord.js');
const { formatDuration } = require('../../../core/utils');

// Permissions SMPbot relies on across its feature set.
const RECOMMENDED_PERMS = [
  [PermissionFlagsBits.ManageChannels, 'Manage Channels'],
  [PermissionFlagsBits.ManageRoles, 'Manage Roles'],
  [PermissionFlagsBits.ManageWebhooks, 'Manage Webhooks'],
  [PermissionFlagsBits.ManageGuild, 'Manage Server'],
  [PermissionFlagsBits.ViewAuditLog, 'View Audit Log'],
  [PermissionFlagsBits.BanMembers, 'Ban Members'],
  [PermissionFlagsBits.KickMembers, 'Kick Members'],
  [PermissionFlagsBits.ModerateMembers, 'Timeout Members'],
  [PermissionFlagsBits.ManageMessages, 'Manage Messages'],
  [PermissionFlagsBits.MentionEveryone, 'Mention Everyone'],
];

const ICON = { ok: '✅', warn: '⚠️', fail: '❌' };

function line(status, label, detail) {
  return `${ICON[status]} **${label}**${detail ? ` — ${detail}` : ''}`;
}

/** Resolve a configured channel id to a mention or a "missing" marker. */
function channelState(guild, id) {
  if (!id) return { ok: false, text: '_not set_' };
  const ch = guild.channels.cache.get(id);
  return ch ? { ok: true, text: `<#${id}>` } : { ok: false, text: '⚠️ configured channel was deleted' };
}

function roleState(guild, id) {
  if (!id) return { ok: false, text: '_not set_' };
  const role = guild.roles.cache.get(id);
  return role ? { ok: true, text: `<@&${id}>`, role } : { ok: false, text: '⚠️ configured role was deleted' };
}

module.exports = {
  cooldown: 5,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('Run a full self-check of SMPbot in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const tally = { ok: 0, warn: 0, fail: 0 };
    const bump = (s) => {
      tally[s] += 1;
      return s;
    };

    // ── Connection & core ────────────────────────────────────────────────
    const conn = [];
    const ping = Math.max(client.ws.ping, 0);
    conn.push(line(bump(ping && ping < 500 ? 'ok' : 'warn'), 'Gateway', `${ping || '—'}ms ping`));
    conn.push(line(bump('ok'), 'Uptime', formatDuration(client.uptime ?? 0) || '< 1s'));
    // Database read/write round-trip.
    let dbOk = true;
    try {
      client.config.get(guild.id, 'theme', {});
    } catch {
      dbOk = false;
    }
    conn.push(line(bump(dbOk ? 'ok' : 'fail'), 'Database', dbOk ? 'read/write OK' : 'not responding'));
    // Persisted scheduled jobs for this guild (giveaways, temp-bans, backups…).
    let jobs = 0;
    try {
      jobs = client.db.get('SELECT COUNT(*) AS n FROM scheduled_jobs WHERE guild_id = ?', guild.id)?.n ?? 0;
    } catch {
      /* ignore */
    }
    conn.push(line('ok', 'Scheduler', `${jobs} scheduled job(s) armed`));

    // Privileged intents requested by the code (must also be enabled in the portal).
    const wantMembers = client.options.intents.has(GatewayIntentBits.GuildMembers);
    const wantContent = client.options.intents.has(GatewayIntentBits.MessageContent);
    conn.push(
      line(
        bump(wantMembers && wantContent ? 'ok' : 'warn'),
        'Privileged intents',
        `${wantMembers ? 'Members ✓' : 'Members ✗'} · ${wantContent ? 'Message Content ✓' : 'Message Content ✗'} (enable both in the Developer Portal)`,
      ),
    );

    // ── Permissions & hierarchy ──────────────────────────────────────────
    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    const perms = [];
    if (!me) {
      perms.push(line(bump('fail'), 'Bot member', 'could not resolve my own member — re-invite me'));
    } else if (me.permissions.has(PermissionFlagsBits.Administrator)) {
      perms.push(line(bump('ok'), 'Administrator', 'full permissions granted'));
    } else {
      const missing = RECOMMENDED_PERMS.filter(([flag]) => !me.permissions.has(flag)).map(([, name]) => name);
      if (missing.length) perms.push(line(bump('warn'), 'Permissions', `missing: ${missing.join(', ')}`));
      else perms.push(line(bump('ok'), 'Permissions', 'all recommended permissions granted'));
    }
    if (me) {
      // Role position: how many non-managed roles sit above the bot (it can't manage those).
      const above = guild.roles.cache.filter((r) => r.id !== guild.id && !r.managed && r.position >= me.roles.highest.position).size;
      perms.push(
        line(
          bump(above === 0 ? 'ok' : 'warn'),
          'Role position',
          above === 0 ? 'my role is at the top — I can manage every role' : `${above} role(s) sit above me — drag my role higher to manage them`,
        ),
      );
    }

    // ── Feature configuration ────────────────────────────────────────────
    const feats = [];
    const push = (status, label, detail) => feats.push(line(bump(status), label, detail));

    // Template applied?
    const setup = client.config.get(guild.id, 'setup', {});
    push(setup.template ? 'ok' : 'warn', 'Server template', setup.template ? `\`${setup.template}\`${setup.completed ? ' · setup complete' : ''}` : 'none applied — run `/setup` or `/template apply`');

    // Theme (always set).
    const theme = client.themes.get(guild.id);
    push('ok', 'Theme', `${theme.emoji} ${theme.label}`);

    // Branding.
    const brand = client.brand.branding(guild.id);
    push(brand.webhookAvatarPath || brand.style ? 'ok' : 'warn', 'Branding', brand.webhookAvatarPath || brand.style ? `generated (${brand.style || 'custom'})` : 'default — run `/branding setup`');

    // Verification + gating.
    const verif = client.config.get(guild.id, 'verification', {});
    if (verif.enabled) {
      const vc = channelState(guild, verif.channelId);
      const vr = roleState(guild, verif.verifiedRoleId);
      let status = 'ok';
      const bits = [`channel ${vc.text}`, `role ${vr.text}`];
      if (!vc.ok || !vr.ok) status = 'warn';
      if (vr.role && me && vr.role.position >= me.roles.highest.position) {
        status = 'warn';
        bits.push('⚠️ verified role is above my role — I cannot assign it');
      }
      push(status, 'Verification', bits.join(' · '));
    } else {
      push('warn', 'Verification', 'disabled');
    }

    // Rules.
    const rules = client.config.get(guild.id, 'rules', { sections: [], messages: [] });
    const ruleCount = Array.isArray(rules.sections) ? rules.sections.length : 0;
    push(ruleCount ? 'ok' : 'warn', 'Rules', ruleCount ? `${ruleCount} section(s)${rules.messages?.length ? ' · published' : ' · not published yet'}` : 'none — run `/rules setup`');

    // Tickets.
    let ticketCats = 0;
    try {
      ticketCats = client.services.tickets?.listCategories?.(guild.id)?.length ?? 0;
    } catch {
      /* ignore */
    }
    let panelCount = 0;
    try {
      panelCount = client.db.get('SELECT COUNT(*) AS n FROM ticket_panels WHERE guild_id = ?', guild.id)?.n ?? 0;
    } catch {
      /* ignore */
    }
    push(panelCount ? 'ok' : 'warn', 'Tickets', panelCount ? `${panelCount} panel(s) · ${ticketCats} categor(y/ies)` : 'no panel published — run `/ticketpanel`');

    // Welcome.
    const welcome = client.config.get(guild.id, 'welcome', {});
    if (welcome.enabled) {
      const wc = channelState(guild, welcome.channelId);
      push(wc.ok ? 'ok' : 'warn', 'Welcome', `channel ${wc.text}`);
    } else {
      push('warn', 'Welcome', 'disabled');
    }

    // Leveling.
    const leveling = client.config.get(guild.id, 'leveling', {});
    push(leveling.enabled ? 'ok' : 'warn', 'Leveling', leveling.enabled ? 'enabled' : 'disabled');

    // Logging.
    const logging = client.config.get(guild.id, 'logging', { channels: {} });
    const logCount = Object.keys(logging.channels ?? {}).length;
    push(logCount ? 'ok' : 'warn', 'Logging', logCount ? `${logCount} log channel(s) mapped` : 'no log channels — run `/logging setup`');

    // Security / anti-nuke.
    const security = client.config.get(guild.id, 'security', {});
    push(security.enabled ? 'ok' : 'warn', 'Anti-nuke', security.enabled ? 'active' : 'disabled — enable in `/antinuke`');

    // AutoMod.
    const automod = client.config.get(guild.id, 'automod', {});
    push(automod.enabled ? 'ok' : 'warn', 'AutoMod', automod.enabled ? 'active' : 'disabled — enable in `/automod`');

    // Backups.
    let backupCount = 0;
    try {
      backupCount = client.db.get('SELECT COUNT(*) AS n FROM backups WHERE guild_id = ?', guild.id)?.n ?? 0;
    } catch {
      /* ignore */
    }
    push(backupCount ? 'ok' : 'warn', 'Backups', backupCount ? `${backupCount} backup(s) saved` : 'none yet — run `/backup create`');

    // Minecraft connection.
    const mc = client.config.get(guild.id, 'minecraft', {});
    push(mc.javaIp || mc.bedrockIp ? 'ok' : 'warn', 'Minecraft IP', mc.javaIp || mc.bedrockIp ? [mc.javaIp && `Java \`${mc.javaIp}\``, mc.bedrockIp && `Bedrock \`${mc.bedrockIp}:${mc.bedrockPort || 19132}\``].filter(Boolean).join(' · ') : 'not set — run `/server setup`');

    // ── Compose ──────────────────────────────────────────────────────────
    const headline =
      tally.fail > 0
        ? { color: 'error', text: `${tally.fail} issue(s) need attention` }
        : tally.warn > 0
          ? { color: 'warning', text: `Operational — ${tally.warn} optional item(s) not configured` }
          : { color: 'success', text: 'All systems operational' };

    const embed = client.brand
      .embed(guild, { color: headline.color })
      .setTitle('🩺 SMPbot Health Check')
      .setDescription(`**${headline.text}**\n${ICON.ok} ${tally.ok}  ·  ${ICON.warn} ${tally.warn}  ·  ${ICON.fail} ${tally.fail}`)
      .addFields(
        { name: '🔌 Connection & Core', value: conn.join('\n').slice(0, 1024) },
        { name: '🔐 Permissions & Hierarchy', value: perms.join('\n').slice(0, 1024) || '—' },
        { name: '🧩 Features', value: feats.join('\n').slice(0, 1024) },
      );
    if (feats.join('\n').length > 1024) {
      // Spill the rest of the features into a second field if needed.
      const half = Math.ceil(feats.length / 2);
      embed.spliceFields(2, 1,
        { name: '🧩 Features', value: feats.slice(0, half).join('\n').slice(0, 1024) },
        { name: '🧩 Features (cont.)', value: feats.slice(half).join('\n').slice(0, 1024) },
      );
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
