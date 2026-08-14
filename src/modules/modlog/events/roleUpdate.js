'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate, intToHex } = require('../../../core/utils');
const { dangerousPermissionNames } = require('../../../core/permissions');
const logs = require('../services/logs');

/** Log meaningful role changes (name, color, hoist, mentionable, perms) to 'roles'. */
module.exports = {
  event: Events.GuildRoleUpdate,

  async execute(client, oldRole, newRole) {
    try {
      const guild = newRole?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'roles')) return;

      const changes = [];
      if (oldRole.name !== newRole.name) changes.push({ name: 'Name', value: `${truncate(oldRole.name, 100)} → ${truncate(newRole.name, 100)}`, inline: false });
      if (oldRole.color !== newRole.color) changes.push({ name: 'Color', value: `${intToHex(oldRole.color)} → ${intToHex(newRole.color)}`, inline: true });
      if (oldRole.hoist !== newRole.hoist) changes.push({ name: 'Displayed separately', value: `${oldRole.hoist ? 'Yes' : 'No'} → ${newRole.hoist ? 'Yes' : 'No'}`, inline: true });
      if (oldRole.mentionable !== newRole.mentionable) changes.push({ name: 'Mentionable', value: `${oldRole.mentionable ? 'Yes' : 'No'} → ${newRole.mentionable ? 'Yes' : 'No'}`, inline: true });

      const oldBits = oldRole.permissions?.bitfield ?? 0n;
      const newBits = newRole.permissions?.bitfield ?? 0n;
      if (oldBits !== newBits) {
        // `a.missing(b)` = permissions present in b but absent from a.
        const added = oldRole.permissions.missing(newRole.permissions); // new has, old lacked
        const removed = newRole.permissions.missing(oldRole.permissions); // old had, new lacks
        const danger = dangerousPermissionNames(newRole.permissions);
        const parts = [];
        if (added.length) parts.push(`**+** ${added.join(', ')}`);
        if (removed.length) parts.push(`**−** ${removed.join(', ')}`);
        if (parts.length) changes.push({ name: 'Permissions', value: truncate(parts.join('\n'), 1024), inline: false });
        if (danger.length && added.length) changes.push({ name: '⚠️ Now holds', value: danger.join(', '), inline: false });
      }

      if (!changes.length) return; // nothing meaningful changed

      const attr = await logs.attribute(guild, AuditLogEvent.RoleUpdate, newRole.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'warning',
        emoji: '🎨',
        title: 'Role updated',
        fields: [{ name: 'Role', value: `<@&${newRole.id}>`, inline: true }, logs.executorField(attr), ...changes],
      });
      await client.logs.send(guild, 'roles', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog roleUpdate failed:', err?.message ?? err);
    }
  },
};
