'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  WebhookClient,
} = require('discord.js');
const log = require('../../../core/logger');
const { isGuildOwner } = require('../../../core/permissions');
const { formatDuration, relativeTime, absoluteTime, truncate } = require('../../../core/utils');

const NAMESPACE = 'giveaways';

/** Config defaults for the `giveaways` namespace (referenced by /setup + templates). */
const DEFAULTS = {
  managerRoleId: null, // role allowed to manage giveaways in addition to Manage Server
};

const STATUS = {
  RUNNING: 'running',
  PAUSED: 'paused',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
};

const MIN_DURATION_MS = 60 * 1000; // 1 minute
const MAX_DURATION_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const MAX_REQ_DURATION_MS = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years for age/membership requirements
const MAX_WINNERS = 20;
const MAX_WINNER_CHECKS = 200; // hard bound on re-validation attempts while drawing

function config(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

/** Manage Server, guild owner, or the configured giveaway manager role. */
function canManage(client, member) {
  if (!member) return false;
  if (isGuildOwner(member)) return true;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageGuild)) return true;
  const { managerRoleId } = config(client, member.guild.id);
  return Boolean(managerRoleId && member.roles?.cache?.has(managerRoleId));
}

function getGiveaway(client, guildId, id) {
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return client.db.get('SELECT * FROM giveaways WHERE guild_id = ? AND id = ?', guildId, numeric) ?? null;
}

/** Resolve a user-supplied reference: giveaway id, message id, or message link. */
function resolveGiveaway(client, guildId, refRaw) {
  const ref = String(refRaw ?? '').trim();
  if (!ref) return null;
  const linkMatch = ref.match(/channels\/\d{17,20}\/\d{17,20}\/(\d{17,20})/);
  const messageId = linkMatch ? linkMatch[1] : /^\d{17,20}$/.test(ref) ? ref : null;
  if (messageId) {
    return client.db.get('SELECT * FROM giveaways WHERE guild_id = ? AND message_id = ?', guildId, messageId) ?? null;
  }
  if (/^\d{1,10}$/.test(ref)) return getGiveaway(client, guildId, ref);
  return null;
}

function parseRequirements(giveaway) {
  try {
    return JSON.parse(giveaway?.requirements ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function parseWinners(giveaway) {
  try {
    const arr = JSON.parse(giveaway?.winner_ids ?? '[]');
    return Array.isArray(arr) ? arr.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function entryCount(client, giveawayId) {
  return client.db.get('SELECT COUNT(*) AS n FROM giveaway_entries WHERE giveaway_id = ?', giveawayId)?.n ?? 0;
}

function messageLink(giveaway) {
  return `https://discord.com/channels/${giveaway.guild_id}/${giveaway.channel_id}/${giveaway.message_id}`;
}

/** Human-readable requirement bullet list for the giveaway embed. */
function requirementLines(requirements) {
  const lines = [];
  if (requirements.requiredRoleId) lines.push(`• Must have the <@&${requirements.requiredRoleId}> role`);
  if (requirements.blacklistedRoleId) lines.push(`• Must **not** have the <@&${requirements.blacklistedRoleId}> role`);
  if (Number(requirements.requiredLevel) > 0) lines.push(`• Server level **${Number(requirements.requiredLevel)}+**`);
  if (Number(requirements.requiredInvites) > 0) lines.push(`• **${Number(requirements.requiredInvites)}+** server invites`);
  if (Number(requirements.minAccountAgeMs) > 0) {
    lines.push(`• Account older than **${formatDuration(Number(requirements.minAccountAgeMs))}**`);
  }
  if (Number(requirements.minMembershipMs) > 0) {
    lines.push(`• Server member for **${formatDuration(Number(requirements.minMembershipMs))}+**`);
  }
  return lines;
}

function brandedFooter(client, guild, embed, giveawayId) {
  const brand = client.brand.branding(guild.id);
  embed.setFooter({
    text: truncate(`Giveaway #${giveawayId} • ${brand.footer || brand.name || 'SMPbot'}`, 2048),
    iconURL: brand.logoUrl ?? undefined,
  });
  return embed;
}

/** The live (running / paused) giveaway panel embed. */
function buildGiveawayEmbed(client, guild, giveaway, count) {
  const requirements = parseRequirements(giveaway);
  const paused = giveaway.status === STATUS.PAUSED;
  const embed = client.brand
    .embed(guild, { color: paused ? 'warning' : 'primary' })
    .setTitle(truncate(`🎉 ${giveaway.prize}`, 256))
    .setDescription(
      paused
        ? '⏸️ **This giveaway is paused.** Entries are temporarily closed — hang tight!'
        : 'Press the **🎉 Enter** button below to join the draw. Press it again to leave.',
    )
    .addFields(
      { name: '🏆 Winners', value: `**${giveaway.winners}**`, inline: true },
      {
        name: paused ? '⏸️ Paused' : '⏰ Ends',
        value: paused
          ? `**${formatDuration(Number(giveaway.paused_remaining_ms) || 0)}** remaining`
          : `${relativeTime(giveaway.ends_at)}\n${absoluteTime(giveaway.ends_at)}`,
        inline: true,
      },
      { name: '🎪 Host', value: `<@${giveaway.host_id}>`, inline: true },
    );
  const lines = requirementLines(requirements);
  if (lines.length) embed.addFields({ name: '📋 Requirements', value: truncate(lines.join('\n'), 1024) });
  if (giveaway.image_url) embed.setImage(giveaway.image_url);
  return brandedFooter(client, guild, embed, giveaway.id);
}

/** The finished-state embed (winners listed or no valid entries). */
function buildEndedEmbed(client, guild, giveaway, winnerIds, count) {
  const embed = client.brand
    .embed(guild, { color: winnerIds.length ? 'success' : 'warning' })
    .setTitle(truncate(`🎉 ${giveaway.prize}`, 256))
    .setDescription(
      winnerIds.length
        ? '🎊 **This giveaway has ended!** Congratulations to the winner(s)!'
        : '**This giveaway has ended.** No valid entries were found.',
    )
    .addFields(
      {
        name: '🏆 Winners',
        value: winnerIds.length ? truncate(winnerIds.map((id) => `<@${id}>`).join(', '), 1024) : 'No valid entries',
      },
      { name: '⏰ Ended', value: relativeTime(giveaway.ends_at), inline: true },
      { name: '🎪 Host', value: `<@${giveaway.host_id}>`, inline: true },
      { name: '👥 Entries', value: `**${count}**`, inline: true },
    );
  if (giveaway.image_url) embed.setImage(giveaway.image_url);
  return brandedFooter(client, guild, embed, giveaway.id);
}

function buildCancelledEmbed(client, guild, giveaway, count) {
  const embed = client.brand
    .embed(guild, { color: 'error' })
    .setTitle(truncate(`🎉 ${giveaway.prize}`, 256))
    .setDescription('🚫 **This giveaway was cancelled.** No winners were drawn.')
    .addFields(
      { name: '🎪 Host', value: `<@${giveaway.host_id}>`, inline: true },
      { name: '👥 Entries', value: `**${count}**`, inline: true },
    );
  return brandedFooter(client, guild, embed, giveaway.id);
}

/** Entry button row — live entry count on the label, disabled when paused/ended. */
function buildEntryRow(giveaway, count) {
  const entries = `${count} ${count === 1 ? 'entry' : 'entries'}`;
  const button = new ButtonBuilder().setCustomId(`giveaway:enter:${giveaway.id}`).setEmoji('🎉');
  if (giveaway.status === STATUS.RUNNING) {
    button.setLabel(`Enter • ${entries}`).setStyle(ButtonStyle.Primary);
  } else if (giveaway.status === STATUS.PAUSED) {
    button.setLabel(`Paused • ${entries}`).setStyle(ButtonStyle.Secondary).setDisabled(true);
  } else {
    button.setLabel(`Ended • ${entries}`).setStyle(ButtonStyle.Secondary).setDisabled(true);
  }
  return new ActionRowBuilder().addComponents(button);
}

/**
 * Re-render the original giveaway message from the DB row and edit it in
 * place. Handles webhook-authored messages (the normal case) and bot-authored
 * fallback messages. Never throws.
 */
async function updateGiveawayMessage(client, guild, giveaway) {
  const count = entryCount(client, giveaway.id);
  let payload;
  if (giveaway.status === STATUS.RUNNING || giveaway.status === STATUS.PAUSED) {
    payload = {
      embeds: [buildGiveawayEmbed(client, guild, giveaway, count)],
      components: [buildEntryRow(giveaway, count)],
    };
  } else if (giveaway.status === STATUS.ENDED) {
    payload = {
      embeds: [buildEndedEmbed(client, guild, giveaway, parseWinners(giveaway), count)],
      components: [buildEntryRow(giveaway, count)],
    };
  } else {
    payload = { embeds: [buildCancelledEmbed(client, guild, giveaway, count)], components: [] };
  }
  return editOriginalMessage(client, giveaway, payload);
}

async function editOriginalMessage(client, giveaway, payload) {
  if (!giveaway.message_id) return null;
  try {
    const guild =
      client.guilds.cache.get(giveaway.guild_id) ?? (await client.guilds.fetch(giveaway.guild_id).catch(() => null));
    if (!guild) return null;
    const channel =
      guild.channels.cache.get(giveaway.channel_id) ??
      (await guild.channels.fetch(giveaway.channel_id).catch(() => null));
    if (!channel?.messages) return null;
    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (!message) return null;

    if (message.webhookId) {
      // Normal case: the panel was posted through SMPbot's managed webhook.
      const row = client.db.get(
        'SELECT webhook_id, token FROM managed_webhooks WHERE guild_id = ? AND channel_id = ?',
        giveaway.guild_id,
        giveaway.channel_id,
      );
      if (row?.webhook_id === message.webhookId && row?.token) {
        try {
          const hook = new WebhookClient({ id: row.webhook_id, token: row.token });
          return await hook.editMessage(giveaway.message_id, payload);
        } catch (err) {
          log.debug(`Giveaways: managed webhook edit failed for #${giveaway.id}:`, err?.message ?? err);
        }
      }
      const webhook = await message.fetchWebhook().catch(() => null);
      if (webhook?.token) return await webhook.editMessage(giveaway.message_id, payload).catch(() => null);
      return null;
    }

    // Fallback case: hooks.send degraded to a plain bot message.
    if (message.author?.id === client.user?.id) return await message.edit(payload).catch(() => null);
    return null;
  } catch (err) {
    log.debug(`Giveaways: failed to edit message for giveaway #${giveaway?.id}:`, err?.message ?? err);
    return null;
  }
}

/**
 * Validate a member against a giveaway's requirements.
 * Returns { failures: string[], notes: string[] } — failures name the exact
 * requirement and the member's current value; notes explain skipped checks
 * (e.g. a cross-module service being unavailable).
 */
async function validateRequirements(client, guild, member, requirements) {
  const failures = [];
  const notes = [];
  if (!requirements || typeof requirements !== 'object') return { failures, notes };

  if (requirements.blacklistedRoleId && guild.roles.cache.has(requirements.blacklistedRoleId)) {
    if (member.roles?.cache?.has(requirements.blacklistedRoleId)) {
      failures.push(`You have the <@&${requirements.blacklistedRoleId}> role, which is blocked from this giveaway.`);
    }
  }

  if (requirements.requiredRoleId) {
    if (!guild.roles.cache.has(requirements.requiredRoleId)) {
      notes.push('The required role no longer exists, so that requirement was skipped.');
    } else if (!member.roles?.cache?.has(requirements.requiredRoleId)) {
      failures.push(`**Requirement:** the <@&${requirements.requiredRoleId}> role — you do not have it.`);
    }
  }

  const requiredLevel = Number(requirements.requiredLevel) || 0;
  if (requiredLevel > 0) {
    const leveling = client.services?.leveling;
    if (typeof leveling?.getLevel === 'function') {
      let level = 0;
      try {
        level = Number(await leveling.getLevel(guild.id, member.id)) || 0;
      } catch (err) {
        log.debug('Giveaways: leveling.getLevel failed:', err?.message ?? err);
      }
      if (level < requiredLevel) {
        failures.push(`**Requirement:** server level ${requiredLevel} — you are currently: **${level} / ${requiredLevel}**`);
      }
    } else {
      notes.push('The level requirement was skipped — the leveling module is unavailable.');
    }
  }

  const requiredInvites = Number(requirements.requiredInvites) || 0;
  if (requiredInvites > 0) {
    const invites = client.services?.invites;
    if (typeof invites?.getStats === 'function') {
      let total = 0;
      try {
        const stats = await invites.getStats(guild.id, member.id);
        total = Number(stats?.total) || 0;
      } catch (err) {
        log.debug('Giveaways: invites.getStats failed:', err?.message ?? err);
      }
      if (total < requiredInvites) {
        failures.push(
          `**Requirement:** ${requiredInvites} server invites — you currently have: **${total} / ${requiredInvites}**`,
        );
      }
    } else {
      notes.push('The invite requirement was skipped — the invites module is unavailable.');
    }
  }

  const minAccountAgeMs = Number(requirements.minAccountAgeMs) || 0;
  if (minAccountAgeMs > 0) {
    const age = Date.now() - member.user.createdTimestamp;
    if (age < minAccountAgeMs) {
      failures.push(
        `**Requirement:** account older than ${formatDuration(minAccountAgeMs)} — yours is **${formatDuration(age)}** old.`,
      );
    }
  }

  const minMembershipMs = Number(requirements.minMembershipMs) || 0;
  if (minMembershipMs > 0) {
    const joined = member.joinedTimestamp;
    if (!joined) {
      notes.push('Could not verify how long you have been a member, so that requirement was skipped.');
    } else {
      const tenure = Date.now() - joined;
      if (tenure < minMembershipMs) {
        failures.push(
          `**Requirement:** server member for ${formatDuration(minMembershipMs)} — you joined **${formatDuration(tenure)}** ago.`,
        );
      }
    }
  }

  return { failures, notes };
}

/**
 * Draw unique random winners from the entry pool, RE-validating every
 * candidate against the giveaway requirements at selection time. Candidates
 * that left the server or no longer qualify are automatically skipped
 * (auto-reroll) with a hard bound on total validation attempts.
 */
async function pickWinners(client, guild, giveaway, count, excludeIds = new Set()) {
  const requirements = parseRequirements(giveaway);
  const rows = client.db.all(
    'SELECT user_id FROM giveaway_entries WHERE giveaway_id = ? ORDER BY RANDOM()',
    giveaway.id,
  );
  const winners = [];
  const wanted = Math.max(1, Math.min(Number(count) || 1, MAX_WINNERS));
  const maxChecks = Math.min(Math.max(50, wanted * 25), MAX_WINNER_CHECKS);
  let checks = 0;
  for (const row of rows) {
    if (winners.length >= wanted || checks >= maxChecks) break;
    if (excludeIds.has(row.user_id)) continue;
    checks += 1;
    const member = await guild.members.fetch(row.user_id).catch(() => null);
    if (!member) continue; // left the server — auto-rerolled
    try {
      const { failures } = await validateRequirements(client, guild, member, requirements);
      if (failures.length === 0) winners.push(row.user_id);
    } catch (err) {
      log.debug(`Giveaways: winner re-validation failed for ${row.user_id}:`, err?.message ?? err);
    }
  }
  return winners;
}

/** Persist the end job and remember its id so pause/cancel can revoke it. */
function scheduleEnd(client, giveaway) {
  const jobId = client.scheduler.schedule({
    guildId: giveaway.guild_id,
    type: 'giveaway:end',
    runAt: giveaway.ends_at,
    data: { giveawayId: giveaway.id },
  });
  client.db.run('UPDATE giveaways SET job_id = ? WHERE id = ?', jobId, giveaway.id);
  giveaway.job_id = jobId;
  return jobId;
}

/** Scheduler handler for 'giveaway:end' jobs. */
async function handleEndJob(client, job) {
  const id = Number(job?.data?.giveawayId);
  if (!Number.isInteger(id) || id <= 0) return;
  const giveaway = client.db.get('SELECT * FROM giveaways WHERE id = ?', id);
  if (!giveaway || giveaway.status !== STATUS.RUNNING) return;
  await endGiveaway(client, giveaway);
}

/**
 * End a giveaway: freeze entries, draw + re-validate winners, update the
 * original message, announce winners in-channel, and log. Idempotent — a
 * giveaway that is already ended/cancelled is left alone.
 */
async function endGiveaway(client, giveawayRow, { endedById = null } = {}) {
  const fresh = client.db.get('SELECT * FROM giveaways WHERE id = ?', giveawayRow.id);
  if (!fresh || (fresh.status !== STATUS.RUNNING && fresh.status !== STATUS.PAUSED)) return null;
  if (fresh.job_id) client.scheduler.cancel(fresh.job_id);

  // Freeze entries first so late clicks can't slip into the draw.
  const endsAt = Math.min(fresh.ends_at, Date.now());
  client.db.run(
    `UPDATE giveaways SET status = 'ended', ends_at = ?, paused_remaining_ms = NULL, job_id = NULL WHERE id = ?`,
    endsAt,
    fresh.id,
  );
  fresh.status = STATUS.ENDED;
  fresh.ends_at = endsAt;
  fresh.job_id = null;

  const guild =
    client.guilds.cache.get(fresh.guild_id) ?? (await client.guilds.fetch(fresh.guild_id).catch(() => null));
  if (!guild) {
    log.warn(`Giveaways: guild ${fresh.guild_id} unavailable — giveaway #${fresh.id} marked ended without a draw.`);
    return { winners: [], guild: null };
  }

  const winnerIds = await pickWinners(client, guild, fresh, fresh.winners);
  client.db.run('UPDATE giveaways SET winner_ids = ? WHERE id = ?', JSON.stringify(winnerIds), fresh.id);
  fresh.winner_ids = JSON.stringify(winnerIds);

  await updateGiveawayMessage(client, guild, fresh);
  await announceWinners(client, guild, fresh, winnerIds, { rerolled: false });

  await logAction(
    client,
    guild,
    [
      `🏁 Giveaway **#${fresh.id}** — **${truncate(fresh.prize, 100)}** ended${endedById ? ` early by <@${endedById}>` : ''}.`,
      winnerIds.length
        ? `Winner(s): ${truncate(winnerIds.map((id) => `<@${id}>`).join(', '), 800)}`
        : 'No valid entries — no winners were drawn.',
      `Entries: **${entryCount(client, fresh.id)}**`,
    ].join('\n'),
  );

  return { winners: winnerIds, guild };
}

/** Post the winner announcement in the giveaway channel via the branded webhook. */
async function announceWinners(client, guild, giveaway, winnerIds, { rerolled = false } = {}) {
  try {
    const channel =
      guild.channels.cache.get(giveaway.channel_id) ??
      (await guild.channels.fetch(giveaway.channel_id).catch(() => null));
    if (!channel) return null;
    const prize = truncate(giveaway.prize, 200);
    const mentionList = truncate(winnerIds.map((id) => `<@${id}>`).join(', '), 1000);
    const embed = client.brand
      .embed(guild, { color: winnerIds.length ? 'success' : 'warning' })
      .setTitle(rerolled ? '🎲 Giveaway rerolled' : '🎉 Giveaway ended')
      .setDescription(
        winnerIds.length
          ? `${rerolled ? 'New winner(s)' : 'Winner(s)'} of **${prize}**:\n${mentionList}\n\n[Jump to giveaway](${messageLink(giveaway)})`
          : `No valid entries could be selected for **${prize}**.\n\n[Jump to giveaway](${messageLink(giveaway)})`,
      );
    brandedFooter(client, guild, embed, giveaway.id);
    const payload = { embeds: [embed], allowedMentions: { users: winnerIds } };
    if (winnerIds.length) {
      payload.content = `🎉 Congratulations ${winnerIds.map((id) => `<@${id}>`).join(' ')} — you won **${prize}**!`;
    }
    return await client.hooks.send(channel, payload);
  } catch (err) {
    log.debug(`Giveaways: winner announcement failed for #${giveaway?.id}:`, err?.message ?? err);
    return null;
  }
}

/** Emit a 'giveaways' guild log entry. Never breaks the calling flow. */
async function logAction(client, guild, description) {
  try {
    const embed = client.brand
      .embed(guild, { color: 'info' })
      .setTitle('🎉 Giveaways')
      .setDescription(truncate(description, 4000));
    await client.logs.send(guild, 'giveaways', { embeds: [embed] });
  } catch (err) {
    log.debug('Giveaways: log entry failed:', err?.message ?? err);
  }
}

module.exports = {
  NAMESPACE,
  DEFAULTS,
  STATUS,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  MAX_REQ_DURATION_MS,
  MAX_WINNERS,
  config,
  canManage,
  getGiveaway,
  resolveGiveaway,
  parseRequirements,
  parseWinners,
  entryCount,
  messageLink,
  requirementLines,
  buildGiveawayEmbed,
  buildEndedEmbed,
  buildCancelledEmbed,
  buildEntryRow,
  updateGiveawayMessage,
  editOriginalMessage,
  validateRequirements,
  pickWinners,
  scheduleEnd,
  handleEndJob,
  endGiveaway,
  announceWinners,
  logAction,
};
