'use strict';

const { Events, PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const { config, resolveChannel, DEFAULTS, LOG_TYPE } = require('../services/config');
const render = require('../services/render');

/**
 * On join: assign configured auto-roles, post the themed welcome message
 * (webhook-first), optionally DM the member, and log the join to the members
 * log. Every Discord call is wrapped — missing perms / deleted channels /
 * closed DMs degrade with a log entry and never crash the handler.
 */
async function applyAutoroles(client, guild, member, cfg) {
  try {
    const roleIds = Array.isArray(cfg.autoroles) ? cfg.autoroles : [];
    if (!roleIds.length) return;
    if (member.user?.bot && cfg.skipBots) return;

    const me = guild.members.me;
    if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) return;

    const everyoneId = guild.roles.everyone.id;
    const toAdd = [];
    for (const id of roleIds) {
      const role = guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
      if (!role) continue; // deleted role — skip gracefully
      if (role.managed || role.id === everyoneId) continue; // unassignable
      if (me.roles.highest.comparePositionTo(role) <= 0) continue; // above the bot — skip
      if (member.roles.cache.has(role.id)) continue;
      toAdd.push(role.id);
    }
    if (!toAdd.length) return;
    await member.roles
      .add(toAdd, 'SMPbot welcome auto-role')
      .catch((err) => log.debug('welcome: auto-role assignment failed:', err?.message ?? err));
  } catch (err) {
    log.debug('welcome: applyAutoroles failed:', err?.message ?? err);
  }
}

module.exports = {
  event: Events.GuildMemberAdd,

  async execute(client, member) {
    try {
      const guild = member?.guild;
      if (!guild?.id || !member?.id) return;
      if (member.partial) member = await member.fetch().catch(() => member);

      const cfg = config(client, guild.id);

      // 1) Auto-roles (independent of the welcome message toggle).
      await applyAutoroles(client, guild, member, cfg);

      // 2) Welcome message.
      if (cfg.enabled && cfg.channelId) {
        const channel = await resolveChannel(guild, cfg.channelId);
        if (channel) {
          try {
            const payload = await render.buildWelcomePayload(client, guild, member, cfg);
            await client.hooks.send(channel, payload);
          } catch (err) {
            log.warn('welcome: failed to send welcome message:', err?.message ?? err);
          }
        }
      }

      // 3) DM welcome (never DM bots; closed DMs are tolerated).
      if (cfg.dm?.enabled && !member.user?.bot) {
        try {
          const text = render.renderMessage(client, guild, member, cfg.dm.message || DEFAULTS.dm.message);
          const dmEmbed = client.brand.embed(guild).setDescription(truncate(text, 4096));
          await member.send({ embeds: [dmEmbed] }).catch((err) => log.debug('welcome: DM failed (likely closed DMs):', err?.message ?? err));
        } catch (err) {
          log.debug('welcome: DM build failed:', err?.message ?? err);
        }
      }

      // 4) Members log.
      try {
        await client.logs.send(guild, LOG_TYPE, { embeds: [render.buildJoinLog(client, guild, member)] });
      } catch (err) {
        log.debug('welcome: join log failed:', err?.message ?? err);
      }
    } catch (err) {
      log.warn('welcome guildMemberAdd handler failed:', err?.message ?? err);
    }
  },
};
