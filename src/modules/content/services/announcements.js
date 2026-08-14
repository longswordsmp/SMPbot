'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const log = require('../../../core/logger');
const { truncate, isSnowflake, relativeTime, absoluteTime } = require('../../../core/utils');

// Content limits (kept comfortably inside Discord's hard caps).
const LIMITS = {
  title: 256,
  description: 4000,
  footer: 2048,
  buttonLabel: 80,
  url: 512,
};

// Announcements may be scheduled at most this far into the future.
const MAX_SCHEDULE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const MIN_SCHEDULE_MS = 30 * 1000; // 30 seconds
const MAX_SCHEDULED_PER_GUILD = 25;

// Draft rows abandoned for longer than this are swept away on boot.
const DRAFT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

const ANNOUNCE_NS = 'announce';
const DEFAULTS = {
  // Namespace kept intentionally small — announcements themselves live in the
  // `announcements` table; this is only for guild-wide defaults.
  defaultCrosspost: true,
};

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value) && value.length <= LIMITS.url;
}

/** Build the branded announcement embed from stored payload data. */
function buildEmbed(client, guild, data) {
  const embed = client.brand.embed(guild);
  if (data.title) embed.setTitle(truncate(String(data.title), LIMITS.title));
  if (data.description) embed.setDescription(truncate(String(data.description), LIMITS.description));
  if (isHttpUrl(data.thumbnail)) embed.setThumbnail(data.thumbnail);
  if (isHttpUrl(data.image)) embed.setImage(data.image);
  if (data.footer) embed.setFooter({ text: truncate(String(data.footer), LIMITS.footer) });
  return embed;
}

/** Optional single link-button row, or null when no valid button is set. */
function buildLinkRow(data) {
  if (data.buttonLabel && isHttpUrl(data.buttonUrl)) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(truncate(String(data.buttonLabel), LIMITS.buttonLabel))
        .setURL(data.buttonUrl),
    );
  }
  return null;
}

/** Resolve the mention prefix + allowedMentions for a stored mention value. */
function mentionContent(data) {
  const mention = data.mention;
  if (mention === 'here') return { content: '@here', allowedMentions: { parse: ['everyone'] } };
  if (mention === 'everyone') return { content: '@everyone', allowedMentions: { parse: ['everyone'] } };
  if (isSnowflake(mention)) return { content: `<@&${mention}>`, allowedMentions: { roles: [mention] } };
  return { content: undefined, allowedMentions: { parse: [] } };
}

/** Full message payload used to actually post the announcement. */
function buildPublishPayload(client, guild, data) {
  const { content, allowedMentions } = mentionContent(data);
  const row = buildLinkRow(data);
  return {
    content,
    embeds: [buildEmbed(client, guild, data)],
    components: row ? [row] : [],
    allowedMentions,
  };
}

/**
 * Human-readable, ping-free preview payload (embed + control buttons). The
 * mention is shown as text but never actually pings (allowedMentions parse []).
 */
function buildPreview(client, guild, data, draftId, { scheduled = false, runAt = null } = {}) {
  const { content } = mentionContent(data);
  const embed = buildEmbed(client, guild, data);
  const info = client.brand
    .embed(guild, { color: 'info' })
    .setTitle('👁️ Announcement preview')
    .setDescription(
      [
        `**Channel:** <#${data.channelId}>`,
        `**Mention:** ${mentionLabel(data)}`,
        data.crosspost ? '**Auto-publish:** enabled (announcement channel)' : null,
        scheduled && runAt ? `**Scheduled for:** ${absoluteTime(runAt)} (${relativeTime(runAt)})` : null,
        '',
        scheduled
          ? 'Press **Schedule** to queue this announcement, **Edit** to change the text, or **Cancel** to discard it.'
          : 'Press **Publish** to send it now, **Edit** to change the text, or **Cancel** to discard it.',
      ]
        .filter((l) => l !== null)
        .join('\n'),
    );

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`announce:publish:${draftId}`)
      .setLabel(scheduled ? 'Schedule' : 'Publish')
      .setEmoji(scheduled ? '🕒' : '📢')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`announce:edit:${draftId}`).setLabel('Edit').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`announce:cancel:${draftId}`).setLabel('Cancel').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );

  const linkRow = buildLinkRow(data);
  const components = linkRow ? [linkRow, controls] : [controls];
  return { content: content ? `Preview — will mention: ${content}` : undefined, embeds: [info, embed], components, allowedMentions: { parse: [] } };
}

function mentionLabel(data) {
  if (data.mention === 'here') return '@here';
  if (data.mention === 'everyone') return '@everyone';
  if (isSnowflake(data.mention)) return `<@&${data.mention}>`;
  return 'none';
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function getAnnouncement(client, id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return client.db.get('SELECT * FROM announcements WHERE id = ?', id) ?? null;
}

function parseData(row) {
  try {
    return JSON.parse(row.payload ?? '{}');
  } catch {
    return {};
  }
}

function createDraft(client, guildId, channelId, authorId, data, runAt) {
  const result = client.db.run(
    `INSERT INTO announcements (guild_id, channel_id, author_id, payload, status, run_at)
     VALUES (?, ?, ?, ?, 'draft', ?)`,
    guildId,
    channelId,
    authorId,
    JSON.stringify(data ?? {}),
    runAt ?? null,
  );
  return getAnnouncement(client, Number(result.lastInsertRowid));
}

function updateDraftData(client, id, data, runAt) {
  client.db.run('UPDATE announcements SET payload = ?, run_at = ? WHERE id = ?', JSON.stringify(data ?? {}), runAt ?? null, id);
}

function listScheduled(client, guildId) {
  return client.db.all(
    "SELECT * FROM announcements WHERE guild_id = ? AND status = 'scheduled' ORDER BY run_at ASC",
    guildId,
  );
}

function countScheduled(client, guildId) {
  return client.db.get("SELECT COUNT(*) AS n FROM announcements WHERE guild_id = ? AND status = 'scheduled'", guildId)?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Publishing + scheduling
// ---------------------------------------------------------------------------

async function logAnnouncement(client, guild, embed) {
  try {
    await client.logs.send(guild, 'server', { embeds: [embed] });
  } catch (err) {
    log.debug('Announcement log failed:', err?.message ?? err);
  }
}

/**
 * Post an announcement row now. Idempotent per row: a row already published or
 * cancelled is left untouched. Returns { ok, message?, error? }.
 */
async function publishAnnouncement(client, row) {
  const fresh = getAnnouncement(client, row.id);
  if (!fresh) return { ok: false, error: 'This announcement no longer exists.' };
  if (fresh.status === 'published') return { ok: false, error: 'This announcement was already published.' };
  if (fresh.status === 'cancelled') return { ok: false, error: 'This announcement was cancelled.' };

  const data = parseData(fresh);
  const guild = client.guilds.cache.get(fresh.guild_id) ?? (await client.guilds.fetch(fresh.guild_id).catch(() => null));
  if (!guild) {
    client.db.run("UPDATE announcements SET status = 'cancelled' WHERE id = ?", fresh.id);
    return { ok: false, error: 'The server is no longer reachable.' };
  }
  const channel =
    guild.channels.cache.get(fresh.channel_id) ?? (await guild.channels.fetch(fresh.channel_id).catch(() => null));
  if (!channel || typeof channel.send !== 'function') {
    client.db.run("UPDATE announcements SET status = 'cancelled' WHERE id = ?", fresh.id);
    await logAnnouncement(
      client,
      guild,
      client.brand.warn(guild, 'Announcement failed', `The target channel for announcement #${fresh.id} no longer exists.`),
    );
    return { ok: false, error: 'The target channel no longer exists.' };
  }

  const payload = buildPublishPayload(client, guild, data);
  const message = await client.hooks.send(channel, payload);
  if (!message) {
    return { ok: false, error: `I could not post in ${channel}. Check my permissions there.` };
  }

  client.db.run("UPDATE announcements SET status = 'published', message_id = ?, job_id = NULL WHERE id = ?", message.id, fresh.id);

  // Auto-crosspost when requested and the channel is an announcement channel.
  if (data.crosspost && channel.type === ChannelType.GuildAnnouncement) {
    try {
      const full = await channel.messages.fetch(message.id).catch(() => null);
      if (full && typeof full.crosspost === 'function') await full.crosspost();
    } catch (err) {
      log.debug(`Auto-crosspost failed for announcement #${fresh.id}:`, err?.message ?? err);
    }
  }

  await logAnnouncement(
    client,
    guild,
    client.brand
      .embed(guild, { color: 'info' })
      .setTitle('📢 Announcement published')
      .setDescription(
        [
          `**Title:** ${truncate(data.title || '(untitled)', 200)}`,
          `**Channel:** <#${channel.id}>`,
          `[Jump to message](https://discord.com/channels/${guild.id}/${channel.id}/${message.id})`,
        ].join('\n'),
      ),
  );

  return { ok: true, message };
}

/** Persist and arm a scheduled announcement job. */
function scheduleAnnouncement(client, row) {
  const jobId = client.scheduler.schedule({
    guildId: row.guild_id,
    type: 'announce:publish',
    runAt: row.run_at,
    data: { announcementId: row.id },
  });
  client.db.run("UPDATE announcements SET status = 'scheduled', job_id = ? WHERE id = ?", jobId, row.id);
  return jobId;
}

/** Cancel a scheduled announcement (revokes its job). */
function cancelScheduled(client, row) {
  if (row.job_id) client.scheduler.cancel(row.job_id);
  client.db.run("UPDATE announcements SET status = 'cancelled', job_id = NULL WHERE id = ?", row.id);
}

/** Scheduler handler for 'announce:publish' jobs. */
async function handlePublishJob(client, job) {
  const id = Number(job?.data?.announcementId);
  if (!Number.isInteger(id) || id <= 0) return;
  const row = getAnnouncement(client, id);
  if (!row || row.status !== 'scheduled') return;
  try {
    await publishAnnouncement(client, row);
  } catch (err) {
    log.error(`announce:publish job for announcement #${id} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Boot sweep
// ---------------------------------------------------------------------------

async function sweep(client) {
  // Remove stale drafts.
  try {
    const cutoff = Math.floor((Date.now() - DRAFT_TTL_MS) / 1000);
    client.db.run("DELETE FROM announcements WHERE status = 'draft' AND created_at < ?", cutoff);
  } catch (err) {
    log.debug('Announcement draft sweep failed:', err?.message ?? err);
  }

  // Belt-and-braces: every scheduled announcement must have a pending job.
  try {
    const scheduled = client.db.all("SELECT * FROM announcements WHERE status = 'scheduled'");
    const jobsByGuild = new Map();
    for (const row of scheduled) {
      if (!jobsByGuild.has(row.guild_id)) {
        jobsByGuild.set(row.guild_id, client.scheduler.pending(row.guild_id, 'announce:publish'));
      }
      const jobs = jobsByGuild.get(row.guild_id) ?? [];
      if (jobs.some((j) => Number(j.data?.announcementId) === row.id)) continue;
      if (!row.run_at || row.run_at <= Date.now()) {
        log.info(`Announcements: publishing orphaned overdue announcement #${row.id}.`);
        try {
          await publishAnnouncement(client, row);
        } catch (err) {
          log.error(`Announcements: failed to publish orphaned announcement #${row.id}:`, err);
        }
      } else {
        log.info(`Announcements: re-scheduling missing job for announcement #${row.id}.`);
        scheduleAnnouncement(client, row);
      }
    }
  } catch (err) {
    log.error('Announcements sweep failed:', err);
  }
}

/** Validate a target channel for posting: bot can view + send. */
function checkChannel(guild, channel) {
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    return 'Announcements can only be posted in text or announcement channels.';
  }
  if (channel.guildId !== guild.id) return 'That channel is not in this server.';
  const me = guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
    return `I cannot send messages in ${channel}. Check my channel permissions.`;
  }
  return null;
}

module.exports = {
  LIMITS,
  MAX_SCHEDULE_MS,
  MIN_SCHEDULE_MS,
  MAX_SCHEDULED_PER_GUILD,
  ANNOUNCE_NS,
  DEFAULTS,
  isHttpUrl,
  buildEmbed,
  buildLinkRow,
  buildPublishPayload,
  buildPreview,
  mentionLabel,
  getAnnouncement,
  parseData,
  createDraft,
  updateDraftData,
  listScheduled,
  countScheduled,
  publishAnnouncement,
  scheduleAnnouncement,
  cancelScheduled,
  handlePublishJob,
  sweep,
  checkChannel,
};
