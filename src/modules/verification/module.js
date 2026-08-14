'use strict';

const { PermissionFlagsBits } = require('discord.js');
const log = require('../../core/logger');
const { botCanActOn } = require('../../core/permissions');
const { DEFAULTS, config, LOG_TYPE } = require('./services/config');
const verify = require('./services/verify');

/**
 * Verification module — gate new members behind a Verify button or an image
 * captcha before granting access. Optional unverified role on join, minimum
 * account-age gate, per-user cooldowns, and restart-safe auto-kick of members
 * who never verify. All durable state lives in the `verification` config
 * namespace plus the two tables below, so the module is fully restart-safe.
 */
module.exports = {
  name: 'verification',
  DEFAULTS,

  schema: `
CREATE TABLE IF NOT EXISTS verification_pending (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS verification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  verified_at INTEGER NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'button'
);
CREATE INDEX IF NOT EXISTS idx_verification_log_guild ON verification_log (guild_id, verified_at);
`,

  init(client) {
    // Restart-safe auto-kick of members who never verified. The job is scheduled
    // per member at join; this handler is re-registered on every boot.
    client.scheduler.register(verify.KICK_JOB, async (c, job) => {
      try {
        const userId = job.data?.userId;
        if (!userId) return;
        const guild = c.guilds.cache.get(job.guildId) ?? (await c.guilds.fetch(job.guildId).catch(() => null));
        if (!guild) return;

        const cfg = config(c, guild.id);
        // Feature may have been turned off or reconfigured after scheduling.
        if (!cfg.enabled || !cfg.autoKickUnverifiedHours || cfg.autoKickUnverifiedHours <= 0) return;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return; // already left the guild

        // Already verified? Nothing to do.
        if (cfg.verifiedRoleId && member.roles.cache.has(cfg.verifiedRoleId)) return;

        const me = guild.members.me;
        if (!me || !me.permissions.has(PermissionFlagsBits.KickMembers)) {
          log.warn(`verification: cannot auto-kick in guild ${guild.id} — missing Kick Members permission.`);
          return;
        }
        if (!botCanActOn(member)) {
          log.warn(`verification: cannot auto-kick <@${userId}> in guild ${guild.id} — member is above SMPbot or is the owner.`);
          return;
        }

        await member.kick('SMPbot: did not verify within the configured window').catch((err) => {
          log.warn('verification: auto-kick failed:', err?.message ?? err);
        });

        try {
          await c.logs.send(guild, LOG_TYPE, {
            embeds: [
              c.brand
                .embed(guild, { color: 'warning' })
                .setTitle('👢 Auto-kicked unverified member')
                .setDescription(`<@${userId}> (${member.user?.tag ?? userId}) was removed for not verifying in time.`),
            ],
          });
        } catch (err) {
          log.debug('verification: auto-kick log failed:', err?.message ?? err);
        }

        // Clean up any leftover captcha state.
        verify.clearPending(c, guild.id, userId);
      } catch (err) {
        log.error('verification: auto-kick job failed:', err);
      }
    });

    // Cross-module service (accessed defensively by /setup and templates).
    client.services.verification = {
      async publishPanel(guild, channel) {
        return verify.publishPanel(client, guild, channel);
      },
    };
  },
};
