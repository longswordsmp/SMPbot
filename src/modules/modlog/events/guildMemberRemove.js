'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const { relativeTime, truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Factual leave record to 'members' (roles held, join date, member count). */
module.exports = {
  event: Events.GuildMemberRemove,

  async execute(client, member) {
    try {
      const guild = member?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'members')) return;

      const fields = [
        { name: 'Member', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
        { name: 'Member count', value: `${guild.memberCount ?? '—'}`, inline: true },
      ];
      if (member.joinedTimestamp) fields.push({ name: 'Joined', value: relativeTime(member.joinedTimestamp), inline: true });

      if (!member.partial && member.roles?.cache) {
        const roles = member.roles.cache.filter((r) => r.id !== guild.id);
        if (roles.size) {
          fields.push({
            name: `Roles (${roles.size})`,
            value: truncate(roles.map((r) => `<@&${r.id}>`).join(' '), 1024),
            inline: false,
          });
        }
      }

      const embed = logs.logEmbed(client, guild, {
        colorKind: 'warning',
        emoji: '📤',
        title: 'Member left',
        actor: member.user ?? null,
        fields,
      });
      await client.logs.send(guild, 'members', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog guildMemberRemove failed:', err?.message ?? err);
    }
  },
};
