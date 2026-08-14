'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const engine = require('../services/engine');

/** Anti-nuke: mass ban detection. */
module.exports = {
  event: Events.GuildBanAdd,

  async execute(client, ban) {
    const guild = ban?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    const attr = await engine.attribute(guild, AuditLogEvent.MemberBanAdd, ban.user?.id ?? null);
    await engine.recordAction(client, guild, 'ban', attr.executorId, {
      summary: `Banned **${ban.user?.tag ?? 'unknown user'}** (\`${ban.user?.id ?? '?'}\`)`,
      attributionNote: attr.reason,
    });
  },
};
