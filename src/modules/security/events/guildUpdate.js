'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const { truncate } = require('../../../core/utils');
const engine = require('../services/engine');

/** Server-setting tampering: log every change and threshold repeated changes. */
module.exports = {
  event: Events.GuildUpdate,

  async execute(client, oldGuild, newGuild) {
    if (!newGuild?.id || !engine.isEnabled(client, newGuild.id)) return;

    const changes = [];
    if (oldGuild?.name !== newGuild.name) changes.push(`name: **${truncate(oldGuild?.name ?? '?', 60)}** → **${truncate(newGuild.name ?? '?', 60)}**`);
    if (oldGuild?.icon !== newGuild.icon) changes.push('server icon changed');
    if (oldGuild?.banner !== newGuild.banner) changes.push('server banner changed');
    if (oldGuild?.vanityURLCode !== newGuild.vanityURLCode) {
      changes.push(`vanity URL: \`${oldGuild?.vanityURLCode ?? '—'}\` → \`${newGuild.vanityURLCode ?? '—'}\``);
    }
    if (oldGuild?.ownerId !== newGuild.ownerId) changes.push(`ownership transferred to <@${newGuild.ownerId}>`);
    if (oldGuild?.verificationLevel !== newGuild.verificationLevel) changes.push('verification level changed');
    if (oldGuild?.systemChannelId !== newGuild.systemChannelId) changes.push('system channel changed');
    if (!changes.length) return;

    const attr = await engine.attribute(newGuild, AuditLogEvent.GuildUpdate, newGuild.id);
    const summary = changes.join(', ');

    const embed = client.brand
      .warn(newGuild, 'Server settings changed', truncate(summary, 2000))
      .addFields({ name: 'By', value: attr.executorId ? `<@${attr.executorId}>` : 'Unknown', inline: true });
    await client.logs.send(newGuild, 'security', { embeds: [embed] });

    await engine.recordAction(client, newGuild, 'guildUpdate', attr.executorId, {
      summary: `Server settings changed: ${summary}`,
      attributionNote: attr.reason,
    });
  },
};
