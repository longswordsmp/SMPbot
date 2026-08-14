'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const engine = require('../services/engine');

/**
 * Anti-nuke: mass kick detection. A member leaving fires the same gateway
 * event as a kick — only removals with a matching MemberKick audit entry
 * within the ~10s window count. No entry → it was a voluntary leave.
 */
module.exports = {
  event: Events.GuildMemberRemove,

  async execute(client, member) {
    const guild = member?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;
    if (member.id === client.user?.id) return;

    const attr = await engine.attribute(guild, AuditLogEvent.MemberKick, member.id);
    if (!attr.entry) return; // ordinary leave, not a kick

    await engine.recordAction(client, guild, 'kick', attr.executorId, {
      summary: `Kicked **${member.user?.tag ?? 'unknown user'}** (\`${member.id}\`)`,
      attributionNote: attr.reason,
    });
  },
};
