'use strict';

const { Events, PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { config, resolveRole } = require('../services/config');
const verify = require('../services/verify');

/**
 * On join (when verification is enabled): assign the configured unverified role
 * and schedule the auto-kick job. Bots are skipped entirely. Every Discord call
 * is wrapped so missing perms / a deleted role never crash the handler.
 */
module.exports = {
  event: Events.GuildMemberAdd,

  async execute(client, member) {
    try {
      const guild = member?.guild;
      if (!guild?.id || !member?.id) return;
      if (member.user?.bot) return; // bots cannot verify — never gate them

      const cfg = config(client, guild.id);
      if (!cfg.enabled) return;

      // 1) Unverified role (optional).
      if (cfg.unverifiedRoleId) {
        try {
          const me = guild.members.me;
          if (me && me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const role = await resolveRole(guild, cfg.unverifiedRoleId);
            if (
              role &&
              !role.managed &&
              role.id !== guild.roles.everyone.id &&
              me.roles.highest.comparePositionTo(role) > 0 &&
              !member.roles.cache.has(role.id)
            ) {
              await member.roles.add(role, 'SMPbot verification — unverified role on join').catch((err) => {
                log.debug('verification: failed to assign unverified role on join:', err?.message ?? err);
              });
            } else if (role && me.roles.highest.comparePositionTo(role) <= 0) {
              log.warn(
                `verification: cannot assign unverified role in guild ${guild.id} — SMPbot's role is not above it.`,
              );
            }
          }
        } catch (err) {
          log.debug('verification: unverified role assignment failed:', err?.message ?? err);
        }
      }

      // 2) Auto-kick job (optional).
      try {
        verify.scheduleKick(client, guild, member, cfg);
      } catch (err) {
        log.debug('verification: failed to schedule auto-kick:', err?.message ?? err);
      }
    } catch (err) {
      log.warn('verification guildMemberAdd handler failed:', err?.message ?? err);
    }
  },
};
