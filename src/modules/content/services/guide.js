'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');

const MINECRAFT_NS = 'minecraft';

const DEFAULTS = {
  javaIp: '',
  bedrockIp: '',
  bedrockPort: 19132,
  serverName: '',
  // Tracked so the guide can be cleanly republished in place.
  guideChannelId: null,
  guideMessageId: null,
};

const LIMITS = { host: 253, serverName: 100 };

// Hostname (RFC-ish) or IPv4.
const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const IPV4_RE = /^(?:\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})\.(?:\d{1,3})$/;

function isValidHost(host) {
  if (typeof host !== 'string') return false;
  const h = host.trim();
  if (!h || h.length > LIMITS.host) return false;
  if (IPV4_RE.test(h)) return h.split('.').every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
  return HOST_RE.test(h);
}

/**
 * Parse a Java address which may include an optional `:port` suffix.
 * Returns the normalized address string, or null when invalid.
 */
function parseJavaAddress(input) {
  const raw = String(input ?? '').trim();
  if (!raw || raw.length > LIMITS.host + 6) return null;
  let host = raw;
  let port = null;
  const idx = raw.lastIndexOf(':');
  if (idx > 0 && /^\d{1,5}$/.test(raw.slice(idx + 1))) {
    host = raw.slice(0, idx);
    port = Number(raw.slice(idx + 1));
  }
  if (!isValidHost(host)) return null;
  if (port !== null && (port < 1 || port > 65535)) return null;
  return port !== null ? `${host}:${port}` : host;
}

function parsePort(input) {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

function getConfig(client, guildId) {
  return client.config.get(guildId, MINECRAFT_NS, DEFAULTS);
}

function saveConfig(client, guildId, patch) {
  return client.config.update(guildId, MINECRAFT_NS, patch);
}

function isConfigured(config) {
  return Boolean((config.javaIp && config.javaIp.trim()) || (config.bedrockIp && config.bedrockIp.trim()));
}

function displayName(client, guild, config) {
  const brand = client.brand.branding(guild.id);
  return (config.serverName && String(config.serverName).trim()) || brand.name || guild.name;
}

/**
 * Full "how to join" connection guide embed. Returns null when nothing is
 * configured yet.
 */
function buildGuideEmbed(client, guild, config) {
  if (!isConfigured(config)) return null;
  const name = displayName(client, guild, config);
  const embed = client.brand
    .embed(guild)
    .setTitle('🎮 HOW TO JOIN OUR SMP')
    .setDescription(`Connect to **${truncate(name, 200)}** — copy the address for your edition below and hop in!`);

  if (config.javaIp && config.javaIp.trim()) {
    embed.addFields({
      name: '☕ Java Edition',
      value: [
        '```' + config.javaIp.trim() + '```',
        '**How to join:**',
        '`1.` Open Minecraft: Java Edition',
        '`2.` Click **Multiplayer → Add Server**',
        '`3.` Paste the address above into **Server Address**',
        '`4.` Save, then **Join Server** and play!',
      ].join('\n'),
    });
  }

  if (config.bedrockIp && config.bedrockIp.trim()) {
    const port = parsePort(config.bedrockPort) ?? 19132;
    embed.addFields({
      name: '📱 Bedrock Edition',
      value: [
        '**Server IP**',
        '```' + config.bedrockIp.trim() + '```',
        '**Port**',
        '```' + port + '```',
        '**How to join:**',
        '`1.` Open Minecraft: Bedrock Edition',
        '`2.` Go to **Play → Servers → Add Server**',
        '`3.` Enter the **IP** and **Port** shown above',
        '`4.` Save, then join the server and play!',
      ].join('\n'),
    });
  }

  embed.addFields({
    name: '❓ Need help?',
    value: 'Having trouble connecting? Open a support ticket and our staff will help you get in.',
  });

  return embed;
}

/** Compact IP-only embed used by the public `/ip` command. */
function buildCompactEmbed(client, guild, config) {
  if (!isConfigured(config)) return null;
  const name = displayName(client, guild, config);
  const embed = client.brand.embed(guild).setTitle(`🎮 ${truncate(name, 200)} — Server IP`);
  if (config.javaIp && config.javaIp.trim()) {
    embed.addFields({ name: '☕ Java Edition', value: '```' + config.javaIp.trim() + '```', inline: true });
  }
  if (config.bedrockIp && config.bedrockIp.trim()) {
    const port = parsePort(config.bedrockPort) ?? 19132;
    embed.addFields({ name: '📱 Bedrock Edition', value: '```' + `${config.bedrockIp.trim()}:${port}` + '```', inline: true });
  }
  return embed;
}

/**
 * Publish (or republish) the connection guide to a channel via the branded
 * webhook pipeline. Cleans up the previous guide message first.
 * Returns { ok, message?, error? }.
 */
async function publishGuide(client, guild, channel) {
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    return { ok: false, error: 'The guide can only be published to a text or announcement channel.' };
  }
  if (channel.guildId !== guild.id) return { ok: false, error: 'That channel is not in this server.' };
  const me = guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
    return { ok: false, error: `I cannot send messages in ${channel}. Check my channel permissions.` };
  }

  const config = getConfig(client, guild.id);
  const embed = buildGuideEmbed(client, guild, config);
  if (!embed) {
    return { ok: false, error: 'The server connection info is not set up yet. Run `/server setup` first.' };
  }

  // Remove the previous guide message so republishing stays clean.
  if (config.guideChannelId && config.guideMessageId) {
    try {
      const oldChannel =
        guild.channels.cache.get(config.guideChannelId) ??
        (await guild.channels.fetch(config.guideChannelId).catch(() => null));
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(config.guideMessageId).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => null);
    } catch (err) {
      log.debug(`Could not delete old guide message ${config.guideMessageId}:`, err?.message ?? err);
    }
  }

  const message = await client.hooks.send(channel, { embeds: [embed], allowedMentions: { parse: [] } });
  if (!message?.id) {
    return { ok: false, error: `I could not post the guide in ${channel}. Check my permissions there.` };
  }

  saveConfig(client, guild.id, { guideChannelId: channel.id, guideMessageId: message.id });

  try {
    await client.logs.send(guild, 'server', {
      embeds: [
        client.brand
          .embed(guild, { color: 'info' })
          .setTitle('🎮 Connection guide published')
          .setDescription(`The Minecraft connection guide was published in <#${channel.id}>.`),
      ],
    });
  } catch (err) {
    log.debug('Guide publish log failed:', err?.message ?? err);
  }

  return { ok: true, message };
}

module.exports = {
  MINECRAFT_NS,
  DEFAULTS,
  LIMITS,
  isValidHost,
  parseJavaAddress,
  parsePort,
  getConfig,
  saveConfig,
  isConfigured,
  displayName,
  buildGuideEmbed,
  buildCompactEmbed,
  publishGuide,
};
