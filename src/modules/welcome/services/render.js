'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const log = require('../../../core/logger');
const { truncate, relativeTime, absoluteTime, formatDuration } = require('../../../core/utils');
const { DEFAULTS } = require('./config');
const banner = require('./banner');

const PLACEHOLDER_KEYS = ['user', 'username', 'server', 'membercount', 'userid', 'level', 'invites'];

/** The GuildMember / User object a join or leave event handed us. */
function resolveUser(member) {
  return member?.user ?? member ?? {};
}

/** Read a number from a cross-module service defensively — never throws. */
function safeNumber(fn, fallback = 0) {
  try {
    const v = fn();
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Substitute the welcome placeholders in a template. The single implementation
 * used everywhere (and exposed as `client.services.welcome.renderMessage`).
 *
 *   {user} {username} {server} {membercount} {userid} {level} {invites}
 *
 * {level} resolves via the leveling service (default 0 when absent) and
 * {invites} via the invites service total (default 0 when absent) — both
 * accessed defensively so a missing module degrades to 0 rather than crashing.
 */
function renderMessage(client, guild, member, template) {
  if (typeof template !== 'string' || !template) return '';
  const user = resolveUser(member);
  const guildId = guild?.id;

  const level = guildId && user.id ? safeNumber(() => client.services?.leveling?.getLevel?.(guildId, user.id) ?? 0) : 0;
  const invites =
    guildId && user.id
      ? safeNumber(() => {
          const stats = client.services?.invites?.getStats?.(guildId, user.id);
          return stats ? stats.total : 0;
        })
      : 0;

  const values = {
    user: user.id ? `<@${user.id}>` : 'there',
    username: user.username ?? 'member',
    server: guild?.name ?? 'the server',
    membercount: String(guild?.memberCount ?? 0),
    userid: user.id ?? '',
    level: String(level),
    invites: String(invites),
  };

  // Function replacement avoids `$`-pattern surprises from usernames.
  return template.replace(/\{(user|username|server|membercount|userid|level|invites)\}/g, (_, key) => String(values[key] ?? ''));
}

/** Build the link-button action row for the welcome message (max 5, http(s) only). */
function buildButtonRows(buttons) {
  const rows = [];
  if (!Array.isArray(buttons) || !buttons.length) return rows;
  const valid = buttons
    .filter((b) => b && typeof b.label === 'string' && typeof b.url === 'string' && /^https?:\/\/\S+$/i.test(b.url))
    .slice(0, 5);
  if (!valid.length) return rows;
  const row = new ActionRowBuilder();
  for (const b of valid) {
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(truncate(b.label, 80))
        .setURL(b.url),
    );
  }
  rows.push(row);
  return rows;
}

/**
 * Build the full welcome message payload for a joining member. Async because a
 * banner may be rendered. Never throws — image/banner failures degrade to a
 * plainer embed.
 */
async function buildWelcomePayload(client, guild, member, cfg) {
  const user = resolveUser(member);
  const count = guild?.memberCount ?? 0;

  const embed = client.brand
    .embed(guild)
    .setTitle(truncate(renderMessage(client, guild, member, cfg.title || DEFAULTS.title), 256))
    .setDescription(truncate(renderMessage(client, guild, member, cfg.description || DEFAULTS.description), 4096))
    .setFooter({ text: `Member #${count}` });

  const avatarUrl = user.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null;
  if (avatarUrl) embed.setThumbnail(avatarUrl);

  if (cfg.serverIcon) {
    const icon = guild?.iconURL?.({ size: 128 }) ?? null;
    embed.setAuthor({ name: truncate(guild?.name ?? 'Server', 256), iconURL: icon ?? undefined });
  }

  const payload = { embeds: [embed] };
  const files = [];
  let bannerSet = false;

  if (cfg.banner && banner.isAvailable()) {
    try {
      const theme = client.themes.get(guild.id);
      const buf = await banner.renderBanner({
        username: user.username ?? 'member',
        avatarUrl,
        memberCount: count,
        primaryColor: theme.colors.primary,
        accentColor: theme.colors.accent,
        serverName: guild?.name ?? '',
      });
      if (buf) {
        files.push(new AttachmentBuilder(buf, { name: 'welcome.png' }));
        embed.setImage('attachment://welcome.png');
        bannerSet = true;
      }
    } catch (err) {
      log.debug('welcome: banner render failed, falling back:', err?.message ?? err);
    }
  }
  if (!bannerSet && cfg.imageUrl) embed.setImage(cfg.imageUrl);

  const components = buildButtonRows(cfg.buttons);
  if (files.length) payload.files = files;
  if (components.length) payload.components = components;

  // An embed mention never pings; if the template asks for {user}, ping via content.
  if (user.id && /\{user\}/.test(`${cfg.title ?? ''} ${cfg.description ?? ''}`)) {
    payload.content = `<@${user.id}>`;
  }

  return payload;
}

/** Build the (plainer) leave message payload — no banner, no buttons. */
function buildLeavePayload(client, guild, member, cfg) {
  const user = resolveUser(member);
  const count = guild?.memberCount ?? 0;
  const leave = cfg.leave || DEFAULTS.leave;

  const embed = client.brand
    .embed(guild, { color: 'secondary' })
    .setTitle(truncate(renderMessage(client, guild, member, leave.title || DEFAULTS.leave.title), 256))
    .setDescription(truncate(renderMessage(client, guild, member, leave.description || DEFAULTS.leave.description), 4096))
    .setFooter({ text: `${count} members` });

  const avatarUrl = user.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null;
  if (avatarUrl) embed.setThumbnail(avatarUrl);

  return { embeds: [embed] };
}

/**
 * A defensive "invite attribution" line for the members log. Prefers a real
 * inviter lookup if the invites module ever exposes one; otherwise falls back
 * to the member's tracked invite standing. Returns null when no invites
 * service is present.
 */
function inviteAttributionLine(client, guild, member) {
  const svc = client.services?.invites;
  if (!svc) return null;
  const user = resolveUser(member);
  if (!user.id) return null;

  try {
    const inviter = svc.getInviter?.(guild.id, user.id);
    if (inviter?.inviterId) {
      return `Invited by <@${inviter.inviterId}>${inviter.code ? ` (code \`${inviter.code}\`)` : ''}`;
    }
  } catch {
    /* ignore — degrade to the stats fallback */
  }

  try {
    const stats = svc.getStats?.(guild.id, user.id);
    if (stats && Number.isFinite(stats.total)) {
      const n = stats.total;
      return `Invite tracking active — this member has **${n}** invite${Math.abs(n) === 1 ? '' : 's'}.`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Members-log embed for a join (account age + optional invite attribution). */
function buildJoinLog(client, guild, member) {
  const user = resolveUser(member);
  const embed = client.brand
    .embed(guild, { color: 'success' })
    .setTitle('📥 Member joined')
    .setDescription(`<@${user.id}> \`${user.tag ?? user.username ?? user.id}\` joined the server.`)
    .addFields(
      {
        name: 'Account created',
        value: Number.isFinite(user.createdTimestamp)
          ? `${relativeTime(user.createdTimestamp)} (${absoluteTime(user.createdTimestamp, 'D')})`
          : 'Unknown',
        inline: true,
      },
      { name: 'Member count', value: String(guild?.memberCount ?? 0), inline: true },
    );

  const line = inviteAttributionLine(client, guild, member);
  if (line) embed.addFields({ name: 'Invites', value: truncate(line, 1024), inline: false });

  const avatarUrl = user.displayAvatarURL?.({ size: 128 }) ?? null;
  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
}

/** Members-log embed for a leave (account age + membership duration). */
function buildLeaveLog(client, guild, member) {
  const user = resolveUser(member);
  const embed = client.brand
    .embed(guild, { color: 'warning' })
    .setTitle('📤 Member left')
    .setDescription(`<@${user.id}> \`${user.tag ?? user.username ?? user.id}\` left the server.`)
    .addFields({
      name: 'Account created',
      value: Number.isFinite(user.createdTimestamp) ? relativeTime(user.createdTimestamp) : 'Unknown',
      inline: true,
    });

  const joinedTs = member?.joinedTimestamp;
  if (Number.isFinite(joinedTs)) {
    embed.addFields(
      { name: 'Joined', value: relativeTime(joinedTs), inline: true },
      { name: 'Membership', value: formatDuration(Date.now() - joinedTs) || '< 1s', inline: true },
    );
  }

  // Roles held at departure (skip @everyone), best-effort.
  try {
    const roles = member?.roles?.cache;
    if (roles && typeof roles.filter === 'function') {
      const list = roles
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`);
      if (list.length) embed.addFields({ name: `Roles (${list.length})`, value: truncate(list.join(' '), 1024), inline: false });
    }
  } catch {
    /* partial members may not carry roles — ignore */
  }

  const avatarUrl = user.displayAvatarURL?.({ size: 128 }) ?? null;
  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
}

module.exports = {
  PLACEHOLDER_KEYS,
  renderMessage,
  buildButtonRows,
  buildWelcomePayload,
  buildLeavePayload,
  buildJoinLog,
  buildLeaveLog,
  inviteAttributionLine,
};
