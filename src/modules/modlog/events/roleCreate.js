'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { dangerousPermissionNames, hasDangerousPermissions } = require('../../../core/permissions');
const logs = require('../services/logs');

/** Log role creation to 'roles' with best-effort executor attribution. */
module.exports = {
  event: Events.GuildRoleCreate,

  async execute(client, role) {
    try {
      const guild = role?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'roles')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.RoleCreate, role.id);
      const fields = [
        { name: 'Role', value: `<@&${role.id}> (\`${role.id}\`)`, inline: true },
        logs.executorField(attr),
      ];
      if (hasDangerousPermissions(role.permissions)) {
        fields.push({ name: '⚠️ Dangerous permissions', value: dangerousPermissionNames(role.permissions).join(', '), inline: false });
      }
      const embed = logs.logEmbed(client, guild, { colorKind: 'success', emoji: '✨', title: 'Role created', fields });
      await client.logs.send(guild, 'roles', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog roleCreate failed:', err?.message ?? err);
    }
  },
};
