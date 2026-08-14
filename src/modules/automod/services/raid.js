'use strict';

const { PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const corePerms = require('../../../core/permissions');
const { truncate, relativeTime } = require('../../../core/utils');
const { getConfig, bounded, NAMESPACE, RAID_RESPONSES } = require('./settings');

/** Scheduler job type that ends raid mode (registered in module.js init). */
const RAID_END_TYPE = 'automod:raid-end';
const MAX_RAID_MINUTES = 720; // 12h

/** Current raid-mode row for a guild (or null). */
function raidRow(client, guildId) {
  return (
    client.db.get('SELECT guild_id, response, started_at, ends_at, joins FROM automod_raid WHERE guild_id = ?', guildId) ?? null
  );
}

/** True if the guild is currently in AutoMod raid mode. */
function isRaidActive(client, guildId) {
  const row = raidRow(client, guildId);
  return Boolean(row && Number(row.ends_at) > Date.now());
}

function accountAgeMs(user) {
  return Date.now() - (user?.createdTimestamp ?? Date.now());
}

/** Kick a member if their account is younger than `minDays`. Never throws. */
async function kickYoung(client, guild, member, minDays, reasonLabel) {
  try {
    if (!member || member.user?.bot) return { kicked: false, note: 'skipped (bot or missing member)' };
    if (accountAgeMs(member.user) >= minDays * 86400000) return { kicked: false, note: 'account old enough' };
    const me = guild.members.me;
    if (!me?.permissions?.has(PermissionFlagsBits.KickMembers) || !corePerms.botCanActOn(member)) {
      return { kicked: false, note: 'cannot kick (permissions/hierarchy)' };
    }
    await member.kick(truncate(`SMPbot AutoMod raid mode: ${reasonLabel}`, 400));
    return { kicked: true };
  } catch (err) {
    log.debug(`automod: raid kick failed for ${member?.id} in guild ${guild?.id}:`, err?.message ?? err);
    return { kicked: false, note: 'kick failed' };
  }
}

/** Persist raid-mode state and (re)arm the scheduled end. */
function persistRaidMode(client, guild, { response, durationMinutes, joins }) {
  const now = Date.now();
  const endsAt = now + durationMinutes * 60000;
  client.db.run(
    `INSERT INTO automod_raid (guild_id, response, started_at, ends_at, joins) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (guild_id) DO UPDATE SET response = excluded.response, started_at = excluded.started_at, ends_at = excluded.ends_at, joins = excluded.joins`,
    guild.id,
    response,
    now,
    endsAt,
    joins,
  );
  client.scheduler.cancelWhere(guild.id, RAID_END_TYPE);
  client.scheduler.schedule({ guildId: guild.id, type: RAID_END_TYPE, runAt: endsAt, data: {} });
  return endsAt;
}

/** Trigger raid mode: persist state, apply the configured response, alert 'security'. */
async function activateRaidMode(client, guild, { raid, response, count, threshold, windowMs, minAge, triggerMember }) {
  const durationMinutes = bounded(raid.durationMinutes, 10, 1, MAX_RAID_MINUTES);
  const endsAt = persistRaidMode(client, guild, { response, durationMinutes, joins: count });

  const notes = [];

  if (response === 'lockdown' || response === 'lockdown-kick') {
    const lockFn = client.services.security?.lockdown;
    if (typeof lockFn === 'function') {
      try {
        const res = await client.services.security.lockdown(guild, {
          reason: 'AutoMod raid detection',
          minutes: durationMinutes,
        });
        if (res?.ok) notes.push('Server locked down (auto-unlock scheduled).');
        else if (res?.already) notes.push('Server was already locked down.');
        else notes.push(`Lockdown skipped: ${res?.note ?? 'unavailable'}.`);
      } catch (err) {
        log.warn(`automod: raid lockdown failed in guild ${guild.id}:`, err?.message ?? err);
        notes.push('Lockdown failed (security service error).');
      }
    } else {
      notes.push('Lockdown requested, but the security module is unavailable.');
    }
  }

  if (response === 'kick' || response === 'lockdown-kick') {
    if (minAge > 0) {
      const r = await kickYoung(client, guild, triggerMember, minAge, 'raid trigger');
      notes.push(
        r.kicked
          ? 'Kicked the account that tripped the threshold.'
          : `Triggering account not kicked (${r.note}).`,
      );
      notes.push(`New joins from accounts younger than **${minAge}d** will be kicked for **${durationMinutes}m**.`);
    } else {
      notes.push('Auto-kick disabled (minimum account age is 0).');
    }
  }

  const embed = client.brand
    .embed(guild, { color: 'error' })
    .setTitle('🛡️ Raid detected')
    .setDescription(`**${count}** joins within **${Math.round(windowMs / 1000)}s** exceeded the threshold of **${threshold}**.`)
    .addFields(
      { name: 'Response', value: `\`${response}\``, inline: true },
      { name: 'Raid mode', value: `Active until ${relativeTime(endsAt)}`, inline: true },
      { name: 'Actions taken', value: truncate(notes.length ? notes.map((n) => `• ${n}`).join('\n') : '• Alert only.', 1024) },
    );
  await client.logs.send(guild, 'security', { embeds: [embed] });
  log.warn(
    `automod: raid mode activated in guild ${guild.id} (${count} joins/${Math.round(windowMs / 1000)}s) → ${response}`,
  );
}

/**
 * Handle a member join for raid detection. Counts guild-wide joins in a sliding
 * window; on threshold breach it activates raid mode. While raid mode is active,
 * new young accounts are auto-kicked when the response includes kicking. Default
 * response is alert-only. Bots are ignored (the security module handles those).
 */
async function handleJoin(client, member) {
  const guild = member.guild;
  if (!guild) return;
  if (member.user?.bot) return;

  const cfg = getConfig(client, guild.id);
  if (!cfg.enabled) return;
  const raid = cfg.raid ?? {};
  if (!raid.enabled) return;

  const response = RAID_RESPONSES.includes(raid.response) ? raid.response : 'alert';
  const minAge = bounded(raid.minAccountAgeDays, 7, 0, 3650);
  const windowMs = bounded(raid.windowSeconds, 60, 5, 3600) * 1000;
  const threshold = bounded(raid.joinThreshold, 10, 2, 500);

  // Record this join in the guild-wide sliding window.
  const count = client.cooldowns.count(`automod:joins:${guild.id}`, windowMs);

  // Already in raid mode → enforce ongoing auto-kick of young accounts.
  if (isRaidActive(client, guild.id)) {
    if ((response === 'kick' || response === 'lockdown-kick') && minAge > 0) {
      const r = await kickYoung(client, guild, member, minAge, 'new account during active raid');
      if (r.kicked) {
        await client.logs
          .send(guild, 'security', {
            embeds: [
              client.brand
                .embed(guild, { color: 'warning' })
                .setTitle('🛡️ Raid mode — account kicked')
                .setDescription(`Kicked <@${member.id}> (\`${member.id}\`): account younger than **${minAge}d** during active raid mode.`),
            ],
          })
          .catch(() => null);
      }
    }
    return;
  }

  if (count < threshold) return;

  // One activation per window — avoid re-triggering on every subsequent join.
  if (client.cooldowns.hit(`automod:raidtrip:${guild.id}`, Math.round(windowMs / 1000)) > 0) return;

  await activateRaidMode(client, guild, { raid, response, count, threshold, windowMs, minAge, triggerMember: member });
}

module.exports = {
  RAID_END_TYPE,
  MAX_RAID_MINUTES,
  NAMESPACE,
  raidRow,
  isRaidActive,
  handleJoin,
};
