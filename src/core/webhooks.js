'use strict';

const { WebhookClient, PermissionFlagsBits, ChannelType } = require('discord.js');
const log = require('./logger');

const HOOKABLE_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
]);

/**
 * Webhook-first message delivery. Public-facing messages are sent through a
 * managed SMPbot webhook per channel (custom username + avatar + theme), and
 * gracefully fall back to a normal bot message when webhooks are unavailable.
 *
 * Security: only webhooks created and recorded by SMPbot are ever reused.
 */
class WebhookService {
  constructor(client) {
    this.client = client;
    this.cache = new Map(); // channelId -> WebhookClient
  }

  _targetChannel(channel) {
    if (channel?.isThread?.()) return channel.parent;
    return channel;
  }

  _canUseWebhooks(channel) {
    const target = this._targetChannel(channel);
    if (!target || !HOOKABLE_TYPES.has(target.type)) return false;
    const me = target.guild?.members?.me;
    if (!me) return false;
    return target.permissionsFor(me)?.has(PermissionFlagsBits.ManageWebhooks) ?? false;
  }

  async _getHook(channel) {
    const target = this._targetChannel(channel);
    const cached = this.cache.get(target.id);
    if (cached) return cached;

    const row = this.client.db.get(
      'SELECT webhook_id, token FROM managed_webhooks WHERE guild_id = ? AND channel_id = ?',
      target.guild.id,
      target.id,
    );
    if (row) {
      const hook = new WebhookClient({ id: row.webhook_id, token: row.token });
      this.cache.set(target.id, hook);
      return hook;
    }
    return this._createHook(target);
  }

  async _createHook(target) {
    const brand = this.client.brand.branding(target.guild.id);
    const created = await target.createWebhook({
      name: (brand.webhookName || brand.name || 'SMPbot').slice(0, 80),
      avatar: brand.webhookAvatarPath || brand.webhookAvatarUrl || undefined,
      reason: 'SMPbot managed webhook for branded messages',
    });
    this.client.db.run(
      `INSERT INTO managed_webhooks (guild_id, channel_id, webhook_id, token) VALUES (?, ?, ?, ?)
       ON CONFLICT (guild_id, channel_id) DO UPDATE SET webhook_id = excluded.webhook_id, token = excluded.token`,
      target.guild.id,
      target.id,
      created.id,
      created.token,
    );
    const hook = new WebhookClient({ id: created.id, token: created.token });
    this.cache.set(target.id, hook);
    return hook;
  }

  _dropHook(channel) {
    const target = this._targetChannel(channel);
    this.cache.delete(target.id);
    this.client.db.run('DELETE FROM managed_webhooks WHERE channel_id = ?', target.id);
  }

  /**
   * Send a branded webhook-style message to a channel (or thread).
   * `payload` is a normal message payload ({ content, embeds, components, files }).
   * Optional overrides: { username, avatarURL }.
   * Returns the sent message (or null if everything failed).
   */
  async send(channel, payload = {}, { username, avatarURL } = {}) {
    if (!channel || typeof channel.send !== 'function') return null;
    const guildId = channel.guild?.id;
    const brand = guildId ? this.client.brand.branding(guildId) : null;

    if (guildId && this._canUseWebhooks(channel)) {
      const hookPayload = {
        ...payload,
        username: (username || brand?.webhookName || brand?.name || 'SMPbot').slice(0, 80),
        avatarURL: avatarURL || brand?.webhookAvatarUrl || undefined,
        ...(channel.isThread?.() ? { threadId: channel.id } : {}),
        allowedMentions: payload.allowedMentions ?? { parse: ['users', 'roles'] },
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const hook = await this._getHook(channel);
          return await hook.send(hookPayload);
        } catch (err) {
          if (err?.code === 10015) {
            // Unknown webhook — someone deleted it. Recreate once.
            this._dropHook(channel);
            continue;
          }
          log.debug(`Webhook send failed in #${channel.id}, falling back:`, err?.message ?? err);
          break;
        }
      }
    }

    // Fallback: plain bot message, still fully themed via embeds.
    try {
      const { username: _u, avatarURL: _a, threadId: _t, ...clean } = payload;
      return await channel.send(clean);
    } catch (err) {
      log.warn(`Failed to send message in channel ${channel?.id}:`, err?.message ?? err);
      return null;
    }
  }

  /**
   * Re-apply branding (name/avatar) to every managed webhook in a guild.
   * Called after branding changes so existing webhooks update in place.
   */
  async refreshGuild(guild) {
    const brand = this.client.brand.branding(guild.id);
    const rows = this.client.db.all('SELECT channel_id, webhook_id, token FROM managed_webhooks WHERE guild_id = ?', guild.id);
    for (const row of rows) {
      try {
        const hook = new WebhookClient({ id: row.webhook_id, token: row.token });
        await hook.edit({
          name: (brand.webhookName || brand.name || 'SMPbot').slice(0, 80),
          avatar: brand.webhookAvatarPath || brand.webhookAvatarUrl || null,
        });
        this.cache.set(row.channel_id, hook);
      } catch {
        this.cache.delete(row.channel_id);
        this.client.db.run('DELETE FROM managed_webhooks WHERE channel_id = ?', row.channel_id);
      }
    }
  }

  /** True if a webhook id belongs to SMPbot's managed set (used by security module). */
  isManagedWebhook(webhookId) {
    return Boolean(this.client.db.get('SELECT 1 AS ok FROM managed_webhooks WHERE webhook_id = ?', webhookId));
  }
}

module.exports = { WebhookService };
