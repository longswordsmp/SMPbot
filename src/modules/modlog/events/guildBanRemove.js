'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const logs = require('../services/logs');

/** Unban record to 'members'. SMPbot's own unbans are logged as cases already. */
module.exports = {
  event: Events.GuildBanRemove,

  async execute(client, ban) {
    try {
      const guild = ban?.guild;
      const user = ban?.user;
      if (!guild || !user) return;
      if (!client.logs.channelIdFor(guild.id, 'members')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.MemberBanRemove, user.id);
      if (attr.executorId && attr.executorId === client.user?.id) return;

      const embed = logs.logEmbed(client, guild, {
        colorKind: 'success',
        emoji: '♻️',
        title: 'Member unbanned',
        actor: user,
        fields: [
          { name: 'User', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
          logs.executorField(attr),
        ],
      });
      await client.logs.send(guild, 'members', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog guildBanRemove failed:', err?.message ?? err);
    }
  },
};
