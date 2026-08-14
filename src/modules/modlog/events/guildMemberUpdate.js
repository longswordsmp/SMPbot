'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate, relativeTime } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log nickname changes & timeout changes to 'members', role changes to 'roles'. */
module.exports = {
  event: Events.GuildMemberUpdate,

  async execute(client, oldMember, newMember) {
    try {
      const guild = newMember?.guild;
      if (!guild) return;

      // --- Nickname ---------------------------------------------------------
      if (!oldMember?.partial && oldMember?.nickname !== newMember?.nickname && client.logs.channelIdFor(guild.id, 'members')) {
        const attr = await logs.attribute(guild, AuditLogEvent.MemberUpdate, newMember.id);
        const embed = logs.logEmbed(client, guild, {
          colorKind: 'info',
          emoji: '📝',
          title: 'Nickname changed',
          actor: newMember.user ?? null,
          fields: [
            { name: 'Member', value: `<@${newMember.id}>`, inline: true },
            logs.executorField(attr),
            { name: 'Before', value: oldMember.nickname ? truncate(oldMember.nickname, 256) : '*none*', inline: true },
            { name: 'After', value: newMember.nickname ? truncate(newMember.nickname, 256) : '*none*', inline: true },
          ],
        });
        await client.logs.send(guild, 'members', { embeds: [embed] });
      }

      // --- Timeout ----------------------------------------------------------
      const before = oldMember?.communicationDisabledUntilTimestamp ?? 0;
      const after = newMember?.communicationDisabledUntilTimestamp ?? 0;
      if (before !== after && client.logs.channelIdFor(guild.id, 'members')) {
        const cleared = !after || after <= Date.now();
        const attr = await logs.attribute(guild, AuditLogEvent.MemberUpdate, newMember.id);
        const embed = logs.logEmbed(client, guild, {
          colorKind: cleared ? 'success' : 'warning',
          emoji: cleared ? '🔊' : '⏳',
          title: cleared ? 'Timeout removed' : 'Member timed out',
          actor: newMember.user ?? null,
          fields: [
            { name: 'Member', value: `<@${newMember.id}>`, inline: true },
            logs.executorField(attr),
            ...(cleared ? [] : [{ name: 'Until', value: relativeTime(after), inline: true }]),
          ],
        });
        await client.logs.send(guild, 'members', { embeds: [embed] });
      }

      // --- Roles (skip when old state is partial — diff would be unreliable) -
      if (!oldMember?.partial && oldMember?.roles?.cache && client.logs.channelIdFor(guild.id, 'roles')) {
        const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
        const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
        if (added.size || removed.size) {
          const attr = await logs.attribute(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
          const fields = [
            { name: 'Member', value: `<@${newMember.id}>`, inline: true },
            logs.executorField(attr),
          ];
          if (added.size) fields.push({ name: '➕ Added', value: truncate(added.map((r) => `<@&${r.id}>`).join(' '), 1024), inline: false });
          if (removed.size) fields.push({ name: '➖ Removed', value: truncate(removed.map((r) => `<@&${r.id}>`).join(' '), 1024), inline: false });
          const embed = logs.logEmbed(client, guild, {
            colorKind: 'info',
            emoji: '🎭',
            title: 'Member roles updated',
            actor: newMember.user ?? null,
            fields,
          });
          await client.logs.send(guild, 'roles', { embeds: [embed] });
        }
      }
    } catch (err) {
      log.debug('modlog guildMemberUpdate failed:', err?.message ?? err);
    }
  },
};
