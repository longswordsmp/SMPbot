'use strict';

const log = require('../../../core/logger');

const MAX_MESSAGES = 500;

function fmtTime(ms) {
  try {
    return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch {
    return String(ms);
  }
}

function padNum(num) {
  return String(num ?? 0).padStart(4, '0');
}

/** Fetch up to `limit` messages from a channel, oldest first. Failures degrade to whatever was fetched. */
async function fetchAllMessages(channel, limit = MAX_MESSAGES) {
  const collected = [];
  let before;
  while (collected.length < limit) {
    const size = Math.min(100, limit - collected.length);
    let batch;
    try {
      batch = await channel.messages.fetch({ limit: size, ...(before ? { before } : {}) });
    } catch (err) {
      log.debug(`Transcript fetch failed in channel ${channel?.id}:`, err?.message ?? err);
      break;
    }
    if (!batch?.size) break;
    const arr = [...batch.values()]; // newest -> oldest
    collected.push(...arr);
    before = arr[arr.length - 1].id;
    if (batch.size < size) break;
  }
  collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return collected;
}

/**
 * Generate a clean .txt transcript of a ticket channel.
 * Returns { buffer, filename, messageCount }.
 */
async function generateTranscript(channel, { ticket = null, guildName = '' } = {}) {
  const messages = await fetchAllMessages(channel);
  const lines = [];
  lines.push('='.repeat(62));
  lines.push(`Ticket transcript — #${channel?.name ?? 'unknown-channel'}`);
  if (guildName) lines.push(`Server: ${guildName}`);
  if (ticket) {
    lines.push(`Ticket: #${padNum(ticket.num)} (${ticket.category})`);
    lines.push(`Opened by: ${ticket.opener_id} at ${fmtTime(ticket.opened_at)}`);
    if (ticket.claimer_id) lines.push(`Claimed by: ${ticket.claimer_id}`);
    if (ticket.closed_at) {
      lines.push(`Closed at: ${fmtTime(ticket.closed_at)}${ticket.close_reason ? ` — ${ticket.close_reason}` : ''}`);
    }
  }
  lines.push(`Generated: ${fmtTime(Date.now())} • ${messages.length} message(s) (max ${MAX_MESSAGES})`);
  lines.push('='.repeat(62));
  lines.push('');

  for (const msg of messages) {
    const author = msg.author ? `${msg.author.tag ?? msg.author.username} (${msg.author.id})` : 'Unknown author';
    lines.push(`[${fmtTime(msg.createdTimestamp)}] ${author}${msg.webhookId ? ' [webhook]' : ''}`);
    if (msg.content) {
      for (const line of String(msg.content).split('\n')) lines.push(`    ${line}`);
    }
    for (const att of msg.attachments?.values?.() ?? []) {
      lines.push(`    [attachment] ${att.name} — ${att.url}`);
    }
    for (const embed of msg.embeds ?? []) {
      const title = embed.title || embed.author?.name || 'embed';
      const desc = embed.description ? ` — ${String(embed.description).slice(0, 200).replace(/\n/g, ' ')}` : '';
      lines.push(`    [embed] ${title}${desc}`);
    }
    for (const sticker of msg.stickers?.values?.() ?? []) {
      lines.push(`    [sticker] ${sticker.name}`);
    }
    lines.push('');
  }

  const text = lines.join('\n');
  const filename = ticket ? `ticket-${padNum(ticket.num)}-transcript.txt` : 'ticket-transcript.txt';
  return { buffer: Buffer.from(text, 'utf8'), filename, messageCount: messages.length };
}

module.exports = { generateTranscript, MAX_MESSAGES };
