'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log role deletion to 'roles' with best-effort executor attribution. */
module.exports = {
  event: Events.GuildRoleDelete,

  async execute(client, role) {
    try {
      const guild = role?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'roles')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.RoleDelete, role.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'error',
        emoji: '🗑️',
        title: 'Role deleted',
        fields: [
          { name: 'Role', value: `${truncate(role.name ?? 'unknown', 200)} (\`${role.id}\`)`, inline: true },
          logs.executorField(attr),
        ],
      });
      await client.logs.send(guild, 'roles', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog roleDelete failed:', err?.message ?? err);
    }
  },
};
