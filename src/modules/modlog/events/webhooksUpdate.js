'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const logs = require('../services/logs');

/**
 * Log webhook create/delete/update to 'webhooks'. The gateway event only says
 * "something changed in this channel", so the specifics come from the audit log
 * (~10s window). SMPbot's own managed webhooks are ignored, and each audit
 * entry is processed only once across repeated gateway fires.
 */
module.exports = {
  event: Events.WebhooksUpdate,

  async execute(client, channel) {
    try {
      const guild = channel?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'webhooks')) return;

      const checks = [
        { type: AuditLogEvent.WebhookCreate, verb: 'created', color: 'success', emoji: '🪝' },
        { type: AuditLogEvent.WebhookDelete, verb: 'deleted', color: 'error', emoji: '🗑️' },
        { type: AuditLogEvent.WebhookUpdate, verb: 'updated', color: 'warning', emoji: '🔧' },
      ];

      for (const { type, verb, color, emoji } of checks) {
        const attr = await logs.attribute(guild, type, null);
        if (!attr.entry) continue;

        const webhookId = attr.entry.targetId ?? attr.entry.target?.id ?? null;
        if (webhookId && client.hooks?.isManagedWebhook?.(webhookId)) continue; // ignore our own delivery hooks
        if (attr.executorId && attr.executorId === client.user?.id) continue;
        if (logs.auditSeen(client, attr.entry.id)) continue; // once per audit entry

        const embed = logs.logEmbed(client, guild, {
          colorKind: color,
          emoji,
          title: `Webhook ${verb}`,
          fields: [
            { name: 'Channel', value: `<#${channel.id}>`, inline: true },
            logs.executorField(attr),
            { name: 'Webhook ID', value: `\`${webhookId ?? 'unknown'}\``, inline: true },
          ],
        });
        await client.logs.send(guild, 'webhooks', { embeds: [embed] });
      }
    } catch (err) {
      log.debug('modlog webhooksUpdate failed:', err?.message ?? err);
    }
  },
};
