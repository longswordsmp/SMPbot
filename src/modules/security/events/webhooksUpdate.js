'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const engine = require('../services/engine');

/**
 * Webhook protection: WebhooksUpdate only says "something changed in this
 * channel", so the create/delete is resolved from the audit log (~10s window).
 * SMPbot's own managed webhooks are ignored, and each audit entry is only
 * processed once even though the gateway event can fire multiple times.
 */
module.exports = {
  event: Events.WebhooksUpdate,

  async execute(client, channel) {
    const guild = channel?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    const checks = [
      { type: AuditLogEvent.WebhookCreate, actionKey: 'webhookCreate', verb: 'created' },
      { type: AuditLogEvent.WebhookDelete, actionKey: 'webhookDelete', verb: 'deleted' },
    ];

    for (const { type, actionKey, verb } of checks) {
      const attr = await engine.attribute(guild, type, null);
      if (!attr.entry) continue;

      const webhookId = attr.entry.targetId ?? attr.entry.target?.id ?? null;
      // Ignore SMPbot's own branded delivery webhooks.
      if (webhookId && client.hooks?.isManagedWebhook?.(webhookId)) continue;
      if (attr.executorId && attr.executorId === client.user?.id) continue;
      // Each audit entry is handled exactly once across repeated gateway events.
      if (client.cooldowns.hit(`security:audit:${attr.entry.id}`, 600) > 0) continue;

      const summary = `Webhook ${verb} in <#${channel.id}> (webhook \`${webhookId ?? 'unknown'}\`)`;
      const embed = client.brand
        .warn(guild, `Webhook ${verb}`, summary)
        .addFields({ name: 'By', value: attr.executorId ? `<@${attr.executorId}>` : 'Unknown', inline: true });
      await client.logs.send(guild, 'webhooks', { embeds: [embed] });

      await engine.recordAction(client, guild, actionKey, attr.executorId, {
        summary,
        attributionNote: attr.reason,
      });
    }
  },
};
