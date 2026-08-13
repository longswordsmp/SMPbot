'use strict';

const { Events } = require('discord.js');
const engine = require('../services/engine');

/**
 * Mass-mention protection: count @everyone/@here pings per author in a sliding
 * window. No audit-log attribution is needed — the message author IS the
 * verified executor. Cheap early exits keep this hot path fast.
 */
module.exports = {
  event: Events.MessageCreate,

  async execute(client, message) {
    if (!message?.mentions?.everyone) return;
    const guild = message.guild;
    if (!guild) return;
    if (message.author?.id === client.user?.id) return;
    if (message.webhookId && client.hooks?.isManagedWebhook?.(message.webhookId)) return;
    if (!engine.isEnabled(client, guild.id)) return;

    const executorId = message.author?.id ?? null;
    await engine.recordAction(client, guild, 'everyoneMention', executorId, {
      summary: `Mass mention (@everyone/@here) in <#${message.channelId}> by **${message.author?.tag ?? 'unknown'}**`,
    });
  },
};
