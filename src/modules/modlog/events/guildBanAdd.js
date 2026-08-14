'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/**
 * Ban record to 'members'. Bans issued by SMPbot itself already produce a
 * moderation case log, so those are skipped here to avoid duplicate entries.
 */
module.exports = {
  event: Events.GuildBanAdd,

  async execute(client, ban) {
    try {
      const guild = ban?.guild;
      const user = ban?.user;
      if (!guild || !user) return;
      if (!client.logs.channelIdFor(guild.id, 'members')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.MemberBanAdd, user.id);
      if (attr.executorId && attr.executorId === client.user?.id) return; // logged as a moderation case already

      const reason = ban.reason ?? attr.entry?.reason ?? null;
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'error',
        emoji: '🔨',
        title: 'Member banned',
        actor: user,
        fields: [
          { name: 'User', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
          logs.executorField(attr),
          { name: 'Reason', value: truncate(reason || 'No reason provided', 1024), inline: false },
        ],
      });
      await client.logs.send(guild, 'members', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog guildBanAdd failed:', err?.message ?? err);
    }
  },
};
