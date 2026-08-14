'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const { relativeTime } = require('../../../core/utils');
const logs = require('../services/logs');

/**
 * Factual join record to 'members'. The welcome module posts the richer
 * greeting; this is the audit trail (account age, member count).
 */
module.exports = {
  event: Events.GuildMemberAdd,

  async execute(client, member) {
    try {
      const guild = member?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'members')) return;

      const created = member.user?.createdTimestamp;
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'success',
        emoji: '📥',
        title: 'Member joined',
        actor: member.user ?? null,
        fields: [
          { name: 'Member', value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
          { name: 'Account created', value: created ? relativeTime(created) : 'Unknown', inline: true },
          { name: 'Member count', value: `${guild.memberCount ?? '—'}`, inline: true },
        ],
      });
      if (member.user?.bot) embed.setDescription('🤖 This account is a bot.');
      await client.logs.send(guild, 'members', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog guildMemberAdd failed:', err?.message ?? err);
    }
  },
};
