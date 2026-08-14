'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log server-level setting changes to 'server' with executor attribution. */
module.exports = {
  event: Events.GuildUpdate,

  async execute(client, oldGuild, newGuild) {
    try {
      if (!newGuild) return;
      if (!client.logs.channelIdFor(newGuild.id, 'server')) return;

      const changes = [];
      if (oldGuild.name !== newGuild.name) changes.push({ name: 'Name', value: `${truncate(oldGuild.name ?? '—', 100)} → ${truncate(newGuild.name ?? '—', 100)}`, inline: false });
      if ((oldGuild.description ?? '') !== (newGuild.description ?? '')) changes.push({ name: 'Description', value: truncate(`${oldGuild.description || '*none*'} → ${newGuild.description || '*none*'}`, 1024), inline: false });
      if (oldGuild.ownerId !== newGuild.ownerId) changes.push({ name: 'Owner', value: `<@${oldGuild.ownerId}> → <@${newGuild.ownerId}>`, inline: true });
      if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push({ name: 'Verification level', value: `${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`, inline: true });
      if (oldGuild.icon !== newGuild.icon) changes.push({ name: 'Icon', value: 'Server icon was changed.', inline: true });
      if (oldGuild.banner !== newGuild.banner) changes.push({ name: 'Banner', value: 'Server banner was changed.', inline: true });
      if ((oldGuild.vanityURLCode ?? null) !== (newGuild.vanityURLCode ?? null)) changes.push({ name: 'Vanity URL', value: `${oldGuild.vanityURLCode || '*none*'} → ${newGuild.vanityURLCode || '*none*'}`, inline: true });

      if (!changes.length) return;

      const attr = await logs.attribute(newGuild, AuditLogEvent.GuildUpdate, null);
      const embed = logs.logEmbed(client, newGuild, {
        colorKind: 'warning',
        emoji: '🏰',
        title: 'Server updated',
        fields: [logs.executorField(attr), ...changes],
      });
      await client.logs.send(newGuild, 'server', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog guildUpdate failed:', err?.message ?? err);
    }
  },
};
