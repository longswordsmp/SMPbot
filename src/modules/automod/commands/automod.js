'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { clamp, truncate } = require('../../../core/utils');
const settings = require('../services/settings');
const raid = require('../services/raid');
const { BUILTIN_WORDS } = require('../services/nsfw-words');

const { NAMESPACE, SYSTEMS, ACTIONS, ESCALATION_ACTIONS, SENSITIVITIES, RAID_RESPONSES } = settings;

const MAX_DOMAINS = 100;
const MAX_CHANNELS = 50;
const MAX_ROLES = 50;
const MAX_MCIPS = 50;
const MAX_WORDS = 300;

const systemChoices = Object.entries(SYSTEMS).map(([key, def]) => ({ name: `${def.emoji} ${def.label}`, value: key }));
const actionChoices = ACTIONS.map((a) => ({ name: a, value: a }));
const escalationChoices = ESCALATION_ACTIONS.map((a) => ({ name: a, value: a }));
const sensitivityChoices = SENSITIVITIES.map((s) => ({ name: s, value: s }));
const raidResponseChoices = RAID_RESPONSES.map((r) => ({ name: r, value: r }));

/** system key → threshold fields, for the /automod spam|links groups. */
const THRESHOLD_MAP = {
  flood: { path: ['spam', 'flood'], fields: [{ opt: 'messages', key: 'maxMessages', min: 2, max: 100 }, { opt: 'seconds', key: 'windowSeconds', min: 1, max: 300 }] },
  mentions: { path: ['spam', 'mentions'], fields: [{ opt: 'per_message', key: 'maxPerMessage', min: 1, max: 50 }, { opt: 'per_window', key: 'maxPerWindow', min: 1, max: 200 }, { opt: 'seconds', key: 'windowSeconds', min: 2, max: 600 }] },
  duplicates: { path: ['spam', 'duplicates'], fields: [{ opt: 'repeats', key: 'maxRepeats', min: 2, max: 20 }, { opt: 'seconds', key: 'windowSeconds', min: 2, max: 600 }] },
  emoji: { path: ['spam', 'emoji'], fields: [{ opt: 'per_message', key: 'maxPerMessage', min: 1, max: 100 }] },
  caps: { path: ['spam', 'caps'], fields: [{ opt: 'min_length', key: 'minLength', min: 4, max: 500 }, { opt: 'percent', key: 'maxPercent', min: 40, max: 100 }] },
  characters: { path: ['spam', 'characters'], fields: [{ opt: 'repeated', key: 'maxRepeated', min: 3, max: 200 }, { opt: 'newlines', key: 'maxNewlines', min: 2, max: 200 }] },
  reactions: { path: ['spam', 'reactions'], fields: [{ opt: 'reactions', key: 'maxReactions', min: 3, max: 200 }, { opt: 'seconds', key: 'windowSeconds', min: 2, max: 600 }] },
  pins: { path: ['spam', 'pins'], fields: [{ opt: 'pins', key: 'maxPins', min: 2, max: 50 }, { opt: 'seconds', key: 'windowSeconds', min: 5, max: 3600 }] },
  urlflood: { path: ['links', 'urlflood'], fields: [{ opt: 'per_message', key: 'maxPerMessage', min: 1, max: 50 }, { opt: 'per_window', key: 'maxPerWindow', min: 1, max: 200 }, { opt: 'seconds', key: 'windowSeconds', min: 2, max: 3600 }] },
  repeatedlink: { path: ['links', 'repeatedlink'], fields: [{ opt: 'repeats', key: 'maxRepeats', min: 2, max: 20 }, { opt: 'seconds', key: 'windowSeconds', min: 2, max: 3600 }] },
};

function normalizeDomain(input) {
  let d = String(input).trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d) || d.length > 100) return null;
  return d;
}

function normalizeMcHost(input) {
  let v = String(input).trim().toLowerCase();
  v = v.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!v) return null;
  const [host, port] = v.split(':');
  if (!host || host.length > 100 || !/^[a-z0-9.-]+$/.test(host)) return null;
  if (port !== undefined && !/^\d{2,5}$/.test(port)) return null;
  return port !== undefined ? `${host}:${port}` : host;
}

function normalizeWord(input) {
  const w = String(input).trim().toLowerCase();
  if (!/^[a-z0-9 .*_-]{2,40}$/.test(w)) return null;
  return w;
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure AutoMod — anti-spam, anti-link, anti-NSFW, and raid protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('status').setDescription('Overview of every AutoMod system in this server'))
    .addSubcommand((s) => s.setName('enable').setDescription('Enable AutoMod in this server'))
    .addSubcommand((s) => s.setName('disable').setDescription('Disable AutoMod in this server'))
    .addSubcommandGroup((g) =>
      g
        .setName('system')
        .setDescription('Turn individual systems on/off and set their action')
        .addSubcommand((s) =>
          s
            .setName('toggle')
            .setDescription('Enable or disable one AutoMod system')
            .addStringOption((o) => o.setName('system').setDescription('Which system').setRequired(true).addChoices(...systemChoices))
            .addBooleanOption((o) => o.setName('on').setDescription('On or off').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('action')
            .setDescription('Set the moderation action for a system (not pins/raid)')
            .addStringOption((o) => o.setName('system').setDescription('Which system').setRequired(true).addChoices(...systemChoices))
            .addStringOption((o) => o.setName('action').setDescription('Action to apply on violation').setRequired(true).addChoices(...actionChoices)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('spam')
        .setDescription('Set anti-spam thresholds')
        .addSubcommand((s) =>
          s
            .setName('flood')
            .setDescription('Message flooding threshold')
            .addIntegerOption((o) => o.setName('messages').setDescription('Max messages (2-100)').setMinValue(2).setMaxValue(100))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Window in seconds (1-300)').setMinValue(1).setMaxValue(300)),
        )
        .addSubcommand((s) =>
          s
            .setName('mentions')
            .setDescription('Mention spam threshold')
            .addIntegerOption((o) => o.setName('per_message').setDescription('Max mentions per message (1-50)').setMinValue(1).setMaxValue(50))
            .addIntegerOption((o) => o.setName('per_window').setDescription('Max mentions per window (1-200)').setMinValue(1).setMaxValue(200))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Window in seconds (2-600)').setMinValue(2).setMaxValue(600)),
        )
        .addSubcommand((s) =>
          s
            .setName('duplicates')
            .setDescription('Repeated identical message threshold')
            .addIntegerOption((o) => o.setName('repeats').setDescription('Max identical repeats (2-20)').setMinValue(2).setMaxValue(20))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Window in seconds (2-600)').setMinValue(2).setMaxValue(600)),
        )
        .addSubcommand((s) =>
          s
            .setName('emoji')
            .setDescription('Emoji spam threshold')
            .addIntegerOption((o) => o.setName('per_message').setDescription('Max emoji per message (1-100)').setMinValue(1).setMaxValue(100)),
        )
        .addSubcommand((s) =>
          s
            .setName('caps')
            .setDescription('Caps spam threshold')
            .addIntegerOption((o) => o.setName('min_length').setDescription('Minimum letters before checking (4-500)').setMinValue(4).setMaxValue(500))
            .addIntegerOption((o) => o.setName('percent').setDescription('Max uppercase percent (40-100)').setMinValue(40).setMaxValue(100)),
        )
        .addSubcommand((s) =>
          s
            .setName('characters')
            .setDescription('Character / newline spam threshold')
            .addIntegerOption((o) => o.setName('repeated').setDescription('Max repeated characters (3-200)').setMinValue(3).setMaxValue(200))
            .addIntegerOption((o) => o.setName('newlines').setDescription('Max newlines (2-200)').setMinValue(2).setMaxValue(200)),
        )
        .addSubcommand((s) =>
          s
            .setName('reactions')
            .setDescription('Mass reactions threshold')
            .addIntegerOption((o) => o.setName('reactions').setDescription('Max reactions per window (3-200)').setMinValue(3).setMaxValue(200))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Window in seconds (2-600)').setMinValue(2).setMaxValue(600)),
        )
        .addSubcommand((s) =>
          s
            .setName('pins')
            .setDescription('Excessive pins alert threshold')
            .addIntegerOption((o) => o.setName('pins').setDescription('Max pin updates per window (2-50)').setMinValue(2).setMaxValue(50))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Window in seconds (5-3600)').setMinValue(5).setMaxValue(3600)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('links')
        .setDescription('Set anti-link thresholds')
        .addSubcommand((s) =>
          s
            .setName('urlflood')
            .setDescription('URL flooding threshold')
            .addIntegerOption((o) => o.setName('per_message').setDescription('Max links per message (1-50)').setMinValue(1).setMaxValue(50))
            .addIntegerOption((o) => o.setName('per_window').setDescription('Max links per window (1-200)').setMinValue(1).setMaxValue(200))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Window in seconds (2-3600)').setMinValue(2).setMaxValue(3600)),
        )
        .addSubcommand((s) =>
          s
            .setName('repeatedlink')
            .setDescription('Repeated same-link threshold')
            .addIntegerOption((o) => o.setName('repeats').setDescription('Max repeats (2-20)').setMinValue(2).setMaxValue(20))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Window in seconds (2-3600)').setMinValue(2).setMaxValue(3600)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('whitelist')
        .setDescription('Manage AutoMod whitelists and staff bypass')
        .addSubcommand((s) => s.setName('domain-add').setDescription('Whitelist a domain (exempt from link checks)').addStringOption((o) => o.setName('domain').setDescription('e.g. youtube.com').setRequired(true)))
        .addSubcommand((s) => s.setName('domain-remove').setDescription('Remove a whitelisted domain').addStringOption((o) => o.setName('domain').setDescription('Domain to remove').setRequired(true)))
        .addSubcommand((s) => s.setName('domain-list').setDescription('List whitelisted domains'))
        .addSubcommand((s) => s.setName('channel-add').setDescription('Exempt a channel/category from AutoMod').addChannelOption((o) => o.setName('channel').setDescription('Channel or category').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildCategory)))
        .addSubcommand((s) => s.setName('channel-remove').setDescription('Remove a whitelisted channel/category').addChannelOption((o) => o.setName('channel').setDescription('Channel or category').setRequired(true)))
        .addSubcommand((s) => s.setName('role-add').setDescription('Exempt a role from AutoMod').addRoleOption((o) => o.setName('role').setDescription('Role to exempt').setRequired(true)))
        .addSubcommand((s) => s.setName('role-remove').setDescription('Remove a whitelisted role').addRoleOption((o) => o.setName('role').setDescription('Role to remove').setRequired(true)))
        .addSubcommand((s) => s.setName('bypass-add').setDescription('Add a staff bypass role').addRoleOption((o) => o.setName('role').setDescription('Bypass role').setRequired(true)))
        .addSubcommand((s) => s.setName('bypass-remove').setDescription('Remove a staff bypass role').addRoleOption((o) => o.setName('role').setDescription('Bypass role').setRequired(true))),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('mcip')
        .setDescription('Allowed Minecraft server IPs (own server is always allowed)')
        .addSubcommand((s) => s.setName('add').setDescription('Allow a Minecraft IP/host for advertising').addStringOption((o) => o.setName('ip').setDescription('e.g. play.example.net or 1.2.3.4:25565').setRequired(true)))
        .addSubcommand((s) => s.setName('remove').setDescription('Remove an allowed Minecraft IP/host').addStringOption((o) => o.setName('ip').setDescription('IP/host to remove').setRequired(true)))
        .addSubcommand((s) => s.setName('list').setDescription('List allowed Minecraft IPs/hosts')),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('nsfw')
        .setDescription('NSFW text filter settings and wordlist')
        .addSubcommand((s) =>
          s
            .setName('sensitivity')
            .setDescription('Set the NSFW matching sensitivity')
            .addStringOption((o) => o.setName('level').setDescription('strict | normal | relaxed').setRequired(true).addChoices(...sensitivityChoices)),
        )
        .addSubcommand((s) => s.setName('word-add').setDescription('Add a custom NSFW word').addStringOption((o) => o.setName('word').setDescription('Word to block').setRequired(true)))
        .addSubcommand((s) => s.setName('word-remove').setDescription('Remove a custom word or suppress a built-in one').addStringOption((o) => o.setName('word').setDescription('Word to remove').setRequired(true)))
        .addSubcommand((s) => s.setName('words').setDescription('Show the NSFW wordlist configuration')),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('raid')
        .setDescription('Raid detection settings')
        .addSubcommand((s) =>
          s
            .setName('settings')
            .setDescription('Configure raid detection (default response is alert-only)')
            .addBooleanOption((o) => o.setName('enabled').setDescription('Enable raid detection'))
            .addIntegerOption((o) => o.setName('threshold').setDescription('Joins to trigger (2-500)').setMinValue(2).setMaxValue(500))
            .addIntegerOption((o) => o.setName('seconds').setDescription('Join window in seconds (5-3600)').setMinValue(5).setMaxValue(3600))
            .addStringOption((o) => o.setName('response').setDescription('What to do on raid').addChoices(...raidResponseChoices))
            .addIntegerOption((o) => o.setName('duration').setDescription('Raid mode duration in minutes (1-720)').setMinValue(1).setMaxValue(720))
            .addIntegerOption((o) => o.setName('min_account_age').setDescription('Kick joining accounts younger than N days (0-3650)').setMinValue(0).setMaxValue(3650)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('strikes')
        .setDescription('Strike escalation settings')
        .addSubcommand((s) =>
          s
            .setName('settings')
            .setDescription('Escalate to a harsher action after repeated violations')
            .addBooleanOption((o) => o.setName('enabled').setDescription('Enable strike escalation'))
            .addIntegerOption((o) => o.setName('threshold').setDescription('Violations before escalating (2-50)').setMinValue(2).setMaxValue(50))
            .addIntegerOption((o) => o.setName('minutes').setDescription('Strike window in minutes (1-1440)').setMinValue(1).setMaxValue(1440))
            .addStringOption((o) => o.setName('action').setDescription('Escalation action').addChoices(...escalationChoices)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('timeout')
        .setDescription('Timeout action duration')
        .addSubcommand((s) =>
          s
            .setName('set')
            .setDescription('Set how long the timeout action lasts')
            .addIntegerOption((o) => o.setName('minutes').setDescription('Minutes (1-40320)').setRequired(true).setMinValue(1).setMaxValue(40320)),
        ),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    const ok = (title, desc) => interaction.reply({ embeds: [client.brand.success(guild, title, desc)], flags: MessageFlags.Ephemeral });
    const bad = (title, desc) => interaction.reply({ embeds: [client.brand.error(guild, title, desc)], flags: MessageFlags.Ephemeral });
    const info = (embed) => interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    // ----------------------------------------------------------- top level
    if (!group) {
      if (sub === 'status') {
        const raidActive = raid.isRaidActive(client, guild.id);
        return interaction.reply({ ...settings.buildStatusView(client, guild, { raidActive }), flags: MessageFlags.Ephemeral });
      }
      if (sub === 'enable' || sub === 'disable') {
        client.config.update(guild.id, NAMESPACE, { enabled: sub === 'enable' });
        return ok(`AutoMod ${sub === 'enable' ? 'enabled' : 'disabled'}`, `AutoMod is now **${sub === 'enable' ? 'active' : 'inactive'}** in this server.`);
      }
      return null;
    }

    // -------------------------------------------------------------- system
    if (group === 'system') {
      const key = interaction.options.getString('system', true);
      const def = SYSTEMS[key];
      if (!def) return bad('Unknown system', 'That system is not recognized.');

      if (sub === 'toggle') {
        const on = interaction.options.getBoolean('on', true);
        settings.setSystemEnabled(client, guild.id, key, on);
        return ok('System updated', `${def.emoji} **${def.label}** is now **${on ? 'ON' : 'OFF'}**.`);
      }
      if (sub === 'action') {
        if (key === 'pins') return bad('No action', 'Excessive pins is alert-only and has no moderation action.');
        if (key === 'raid') return bad('Use raid settings', 'Set the raid response with `/automod raid settings`.');
        const action = interaction.options.getString('action', true);
        if (!ACTIONS.includes(action)) return bad('Invalid action', 'Choose delete, warn, timeout, kick, or ban.');
        client.config.update(guild.id, NAMESPACE, settings.patchFor(def.path, { action }));
        return ok('Action updated', `${def.emoji} **${def.label}** will now **${action}** on violation.`);
      }
      return null;
    }

    // ------------------------------------------------------ spam / links thresholds
    if (group === 'spam' || group === 'links') {
      const def = THRESHOLD_MAP[sub];
      if (!def) return bad('Unknown setting', 'That threshold is not recognized.');
      const patch = {};
      for (const f of def.fields) {
        const v = interaction.options.getInteger(f.opt);
        if (v !== null && v !== undefined) patch[f.key] = clamp(v, f.min, f.max);
      }
      if (!Object.keys(patch).length) return bad('Nothing to change', 'Provide at least one value to update.');
      client.config.update(guild.id, NAMESPACE, settings.patchFor(def.path, patch));
      const node = settings.nodeFor(settings.getConfig(client, guild.id), sub) ?? {};
      return ok('Threshold updated', `${SYSTEMS[sub].emoji} **${SYSTEMS[sub].label}** — ${SYSTEMS[sub].describe(node)}`);
    }

    // ----------------------------------------------------------- whitelist
    if (group === 'whitelist') {
      const cfg = settings.getConfig(client, guild.id);

      if (sub === 'domain-add' || sub === 'domain-remove') {
        const domain = normalizeDomain(interaction.options.getString('domain', true));
        if (!domain) return bad('Invalid domain', 'Enter a domain like `youtube.com` (no path or protocol).');
        const current = Array.isArray(cfg.links?.whitelistDomains) ? [...cfg.links.whitelistDomains] : [];
        if (sub === 'domain-add') {
          if (current.includes(domain)) return bad('Already whitelisted', `\`${domain}\` is already whitelisted.`);
          if (current.length >= MAX_DOMAINS) return bad('List full', `The domain whitelist is capped at **${MAX_DOMAINS}**.`);
          client.config.update(guild.id, NAMESPACE, { links: { whitelistDomains: [...current, domain] } });
          return ok('Domain whitelisted', `\`${domain}\` is now exempt from link checks.`);
        }
        if (!current.includes(domain)) return bad('Not whitelisted', `\`${domain}\` is not on the whitelist.`);
        client.config.update(guild.id, NAMESPACE, { links: { whitelistDomains: current.filter((d) => d !== domain) } });
        return ok('Domain removed', `\`${domain}\` was removed from the whitelist.`);
      }

      if (sub === 'domain-list') {
        const list = Array.isArray(cfg.links?.whitelistDomains) ? cfg.links.whitelistDomains : [];
        const embed = client.brand
          .embed(guild)
          .setTitle('📋 Whitelisted domains')
          .setDescription(list.length ? truncate(list.map((d) => `• \`${d}\``).join('\n'), 4000) : 'No domains whitelisted.');
        return info(embed);
      }

      if (sub === 'channel-add' || sub === 'channel-remove') {
        const channel = interaction.options.getChannel('channel', true);
        const current = Array.isArray(cfg.whitelistChannels) ? [...cfg.whitelistChannels] : [];
        if (sub === 'channel-add') {
          if (current.includes(channel.id)) return bad('Already whitelisted', `<#${channel.id}> is already exempt.`);
          if (current.length >= MAX_CHANNELS) return bad('List full', `The channel whitelist is capped at **${MAX_CHANNELS}**.`);
          client.config.update(guild.id, NAMESPACE, { whitelistChannels: [...current, channel.id] });
          return ok('Channel exempt', `AutoMod will no longer run in <#${channel.id}>${channel.type === ChannelType.GuildCategory ? ' (and its channels)' : ''}.`);
        }
        if (!current.includes(channel.id)) return bad('Not whitelisted', `<#${channel.id}> is not exempt.`);
        client.config.update(guild.id, NAMESPACE, { whitelistChannels: current.filter((c) => c !== channel.id) });
        return ok('Channel removed', `AutoMod will run again in <#${channel.id}>.`);
      }

      if (sub === 'role-add' || sub === 'role-remove') {
        const role = interaction.options.getRole('role', true);
        const current = Array.isArray(cfg.whitelistRoles) ? [...cfg.whitelistRoles] : [];
        if (sub === 'role-add') {
          if (current.includes(role.id)) return bad('Already whitelisted', `<@&${role.id}> is already exempt.`);
          if (current.length >= MAX_ROLES) return bad('List full', `The role whitelist is capped at **${MAX_ROLES}**.`);
          client.config.update(guild.id, NAMESPACE, { whitelistRoles: [...current, role.id] });
          return ok('Role exempt', `Members with <@&${role.id}> are now exempt from AutoMod.`);
        }
        if (!current.includes(role.id)) return bad('Not whitelisted', `<@&${role.id}> is not exempt.`);
        client.config.update(guild.id, NAMESPACE, { whitelistRoles: current.filter((r) => r !== role.id) });
        return ok('Role removed', `<@&${role.id}> is no longer exempt.`);
      }

      if (sub === 'bypass-add' || sub === 'bypass-remove') {
        const role = interaction.options.getRole('role', true);
        const current = Array.isArray(cfg.bypassRoles) ? [...cfg.bypassRoles] : [];
        if (sub === 'bypass-add') {
          if (current.includes(role.id)) return bad('Already a bypass role', `<@&${role.id}> already bypasses AutoMod.`);
          if (current.length >= MAX_ROLES) return bad('List full', `The bypass list is capped at **${MAX_ROLES}**.`);
          client.config.update(guild.id, NAMESPACE, { bypassRoles: [...current, role.id] });
          return ok('Bypass role added', `Members with <@&${role.id}> now bypass AutoMod (like staff).`);
        }
        if (!current.includes(role.id)) return bad('Not a bypass role', `<@&${role.id}> is not a bypass role.`);
        client.config.update(guild.id, NAMESPACE, { bypassRoles: current.filter((r) => r !== role.id) });
        return ok('Bypass role removed', `<@&${role.id}> no longer bypasses AutoMod.`);
      }
      return null;
    }

    // --------------------------------------------------------------- mcip
    if (group === 'mcip') {
      const cfg = settings.getConfig(client, guild.id);
      const current = Array.isArray(cfg.links?.minecraft?.allowedIps) ? [...cfg.links.minecraft.allowedIps] : [];

      if (sub === 'add' || sub === 'remove') {
        const host = normalizeMcHost(interaction.options.getString('ip', true));
        if (!host) return bad('Invalid IP/host', 'Enter something like `play.example.net` or `1.2.3.4:25565`.');
        if (sub === 'add') {
          if (current.includes(host)) return bad('Already allowed', `\`${host}\` is already allowed.`);
          if (current.length >= MAX_MCIPS) return bad('List full', `The allowed IP list is capped at **${MAX_MCIPS}**.`);
          client.config.update(guild.id, NAMESPACE, { links: { minecraft: { allowedIps: [...current, host] } } });
          return ok('MC IP allowed', `\`${host}\` may now be advertised without triggering the MC-ad filter.`);
        }
        if (!current.includes(host)) return bad('Not allowed-listed', `\`${host}\` is not in the allowed list.`);
        client.config.update(guild.id, NAMESPACE, { links: { minecraft: { allowedIps: current.filter((h) => h !== host) } } });
        return ok('MC IP removed', `\`${host}\` was removed from the allowed list.`);
      }

      // list
      const embed = client.brand
        .embed(guild)
        .setTitle('⛏️ Allowed Minecraft IPs')
        .setDescription(
          `${current.length ? truncate(current.map((h) => `• \`${h}\``).join('\n'), 3500) : 'No custom IPs allowed.'}\n\n` +
            'Your own server (from the `minecraft` config) is **always** allowed.',
        );
      return info(embed);
    }

    // --------------------------------------------------------------- nsfw
    if (group === 'nsfw') {
      const cfg = settings.getConfig(client, guild.id);

      if (sub === 'sensitivity') {
        const level = interaction.options.getString('level', true);
        if (!SENSITIVITIES.includes(level)) return bad('Invalid level', 'Choose strict, normal, or relaxed.');
        client.config.update(guild.id, NAMESPACE, { nsfw: { sensitivity: level } });
        const explain = {
          strict: 'substring matching (most aggressive — more false positives).',
          normal: 'word-boundary matching (balanced default).',
          relaxed: 'whitespace-delimited whole words only (fewest false positives).',
        };
        return ok('Sensitivity updated', `NSFW matching is now **${level}** — ${explain[level]}`);
      }

      if (sub === 'word-add') {
        const word = normalizeWord(interaction.options.getString('word', true));
        if (!word) return bad('Invalid word', 'Words must be 2-40 characters (letters, digits, spaces, `.*_-`).');
        const custom = Array.isArray(cfg.nsfw?.customWords) ? [...cfg.nsfw.customWords] : [];
        const removed = Array.isArray(cfg.nsfw?.removedWords) ? [...cfg.nsfw.removedWords] : [];
        const isBuiltin = BUILTIN_WORDS.map((w) => w.toLowerCase()).includes(word);
        if (custom.includes(word) || (isBuiltin && !removed.includes(word))) {
          return bad('Already filtered', `\`${word}\` is already in the NSFW filter.`);
        }
        if (custom.length >= MAX_WORDS) return bad('List full', `The custom wordlist is capped at **${MAX_WORDS}**.`);
        const patch = { nsfw: { removedWords: removed.filter((w) => w !== word) } };
        if (!isBuiltin) patch.nsfw.customWords = [...custom, word];
        client.config.update(guild.id, NAMESPACE, patch);
        return ok('Word added', `\`${word}\` will now be filtered as NSFW.`);
      }

      if (sub === 'word-remove') {
        const word = normalizeWord(interaction.options.getString('word', true));
        if (!word) return bad('Invalid word', 'Enter the exact word to remove.');
        const custom = Array.isArray(cfg.nsfw?.customWords) ? [...cfg.nsfw.customWords] : [];
        const removed = Array.isArray(cfg.nsfw?.removedWords) ? [...cfg.nsfw.removedWords] : [];
        const isBuiltin = BUILTIN_WORDS.map((w) => w.toLowerCase()).includes(word);
        if (custom.includes(word)) {
          client.config.update(guild.id, NAMESPACE, { nsfw: { customWords: custom.filter((w) => w !== word) } });
          return ok('Word removed', `\`${word}\` was removed from your custom wordlist.`);
        }
        if (isBuiltin) {
          if (removed.includes(word)) return bad('Already suppressed', `The built-in word \`${word}\` is already suppressed.`);
          client.config.update(guild.id, NAMESPACE, { nsfw: { removedWords: [...removed, word] } });
          return ok('Built-in word suppressed', `The built-in word \`${word}\` will no longer be filtered.`);
        }
        return bad('Not found', `\`${word}\` is not a custom or built-in NSFW word.`);
      }

      // words (list)
      const custom = Array.isArray(cfg.nsfw?.customWords) ? cfg.nsfw.customWords : [];
      const removed = Array.isArray(cfg.nsfw?.removedWords) ? cfg.nsfw.removedWords : [];
      const embed = client.brand
        .embed(guild)
        .setTitle('🔞 NSFW wordlist')
        .setDescription(
          `Text-only filter with **${SENSITIVITIES.includes(cfg.nsfw?.sensitivity) ? cfg.nsfw.sensitivity : 'normal'}** matching. ` +
            'No image/attachment scanning — this is a wordlist matcher and is imperfect by design.',
        )
        .addFields(
          { name: `Built-in words (${BUILTIN_WORDS.length - removed.length}/${BUILTIN_WORDS.length} active)`, value: 'Moderate built-in list of explicit terms and adult-site names.', inline: false },
          { name: `Custom words (${custom.length})`, value: custom.length ? truncate(custom.map((w) => `\`${w}\``).join(', '), 1024) : 'None', inline: false },
          { name: `Suppressed built-ins (${removed.length})`, value: removed.length ? truncate(removed.map((w) => `\`${w}\``).join(', '), 1024) : 'None', inline: false },
        );
      return info(embed);
    }

    // --------------------------------------------------------------- raid
    if (group === 'raid' && sub === 'settings') {
      const patch = {};
      const enabled = interaction.options.getBoolean('enabled');
      const threshold = interaction.options.getInteger('threshold');
      const seconds = interaction.options.getInteger('seconds');
      const response = interaction.options.getString('response');
      const duration = interaction.options.getInteger('duration');
      const minAge = interaction.options.getInteger('min_account_age');
      if (enabled !== null) patch.enabled = enabled;
      if (threshold !== null) patch.joinThreshold = clamp(threshold, 2, 500);
      if (seconds !== null) patch.windowSeconds = clamp(seconds, 5, 3600);
      if (response !== null) {
        if (!RAID_RESPONSES.includes(response)) return bad('Invalid response', 'Choose alert, lockdown, kick, or lockdown-kick.');
        patch.response = response;
      }
      if (duration !== null) patch.durationMinutes = clamp(duration, 1, 720);
      if (minAge !== null) patch.minAccountAgeDays = clamp(minAge, 0, 3650);
      if (!Object.keys(patch).length) return bad('Nothing to change', 'Provide at least one raid setting to update.');
      client.config.update(guild.id, NAMESPACE, { raid: patch });
      const node = settings.getConfig(client, guild.id).raid ?? {};
      return ok(
        'Raid settings updated',
        `${node.enabled ? '🟢 Enabled' : '⚫ Disabled'} — ${node.joinThreshold} joins / ${node.windowSeconds}s → **${node.response}** (raid mode ${node.durationMinutes}m, kick accounts < ${node.minAccountAgeDays}d).`,
      );
    }

    // ------------------------------------------------------------ strikes
    if (group === 'strikes' && sub === 'settings') {
      const patch = {};
      const enabled = interaction.options.getBoolean('enabled');
      const threshold = interaction.options.getInteger('threshold');
      const minutes = interaction.options.getInteger('minutes');
      const action = interaction.options.getString('action');
      if (enabled !== null) patch.enabled = enabled;
      if (threshold !== null) patch.threshold = clamp(threshold, 2, 50);
      if (minutes !== null) patch.windowMinutes = clamp(minutes, 1, 1440);
      if (action !== null) {
        if (!ESCALATION_ACTIONS.includes(action)) return bad('Invalid action', 'Escalation must be timeout, kick, or ban.');
        patch.action = action;
      }
      if (!Object.keys(patch).length) return bad('Nothing to change', 'Provide at least one strike setting to update.');
      client.config.update(guild.id, NAMESPACE, { strikes: patch });
      const node = settings.getConfig(client, guild.id).strikes ?? {};
      return ok(
        'Strike escalation updated',
        node.enabled
          ? `After **${node.threshold}** violations within **${node.windowMinutes}m**, escalate to **${node.action}**.`
          : 'Strike escalation is now **disabled**.',
      );
    }

    // ------------------------------------------------------------ timeout
    if (group === 'timeout' && sub === 'set') {
      const minutes = clamp(interaction.options.getInteger('minutes', true), 1, 40320);
      client.config.update(guild.id, NAMESPACE, { timeoutMinutes: minutes });
      return ok('Timeout duration updated', `The **timeout** action now lasts **${minutes}** minute(s).`);
    }

    return null;
  },
};
