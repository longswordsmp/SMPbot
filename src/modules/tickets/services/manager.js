'use strict';

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require('discord.js');
const log = require('../../../core/logger');
const { truncate, clamp } = require('../../../core/utils');
const { generateTranscript } = require('./transcripts');

/** Config defaults for the `tickets` namespace (referenced by /setup and templates). */
const DEFAULTS = {
  enabled: true,
  maxOpenPerUser: 3, // across all categories
  dmTranscripts: true, // DM the opener a transcript on close/delete
  logTranscripts: true, // attach a transcript to the tickets log channel on close
  priorityPrefix: true, // prefix the channel name with a priority marker
  closedDeleteAfterMs: null, // auto-delete closed tickets after this long (null = never)
};

const PRIORITIES = {
  low: { key: 'low', label: 'Low', emoji: '🟢', prefix: null },
  normal: { key: 'normal', label: 'Normal', emoji: '⚪', prefix: null },
  high: { key: 'high', label: 'High', emoji: '🟠', prefix: '🟠' },
  urgent: { key: 'urgent', label: 'Urgent', emoji: '🔴', prefix: '🔴' },
};
const PRIORITY_PREFIX_STRINGS = Object.values(PRIORITIES)
  .filter((p) => p.prefix)
  .map((p) => `${p.prefix}-`);

/** Built-in category types. Adding one of these pre-fills sensible defaults. */
const BUILTIN_TYPES = {
  support: {
    label: 'Support',
    emoji: '🛟',
    description: 'General help & questions',
    welcome: 'Hi {user}! Describe your issue in as much detail as you can and our staff will be with you shortly.',
    pattern: 'support-{num}',
  },
  report: {
    label: 'Report',
    emoji: '🚩',
    description: 'Report a player or an issue',
    welcome: 'Thanks for the report, {user}. Please include who or what you are reporting and any evidence (screenshots, coordinates, timestamps).',
    pattern: 'report-{num}',
  },
  partnership: {
    label: 'Partnership',
    emoji: '🤝',
    description: 'Partner with our community',
    welcome: 'Welcome, {user}! Tell us about your server or community and what kind of partnership you have in mind.',
    pattern: 'partner-{num}',
  },
  appeal: {
    label: 'Appeal',
    emoji: '⚖️',
    description: 'Appeal a punishment',
    welcome: 'Hi {user}. Please state the punishment you are appealing, when it happened, and why you believe it should be reconsidered.',
    pattern: 'appeal-{num}',
  },
  purchase: {
    label: 'Purchase',
    emoji: '🛒',
    description: 'Store & payment help',
    welcome: 'Hi {user}! Describe your purchase issue and include your transaction ID if you have one. Never share full payment card details.',
    pattern: 'purchase-{num}',
  },
  staff: {
    label: 'Staff',
    emoji: '🛡️',
    description: 'Contact server leadership privately',
    welcome: 'Hello {user}! This ticket is only visible to leadership. Tell us what you need.',
    pattern: 'staff-{num}',
  },
};

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

function pad(num) {
  return String(num ?? 0).padStart(4, '0');
}

/** Accept a unicode emoji or a <a:name:id> custom emoji string; otherwise null. */
function normalizeEmoji(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^<a?:\w{1,32}:\d{17,20}>$/.test(t)) return t;
  if (t.length <= 8 && !/[a-z0-9\s]/i.test(t)) return t; // unicode emoji-ish
  return null;
}

function getSettings(client, guildId) {
  const cfg = client.config.get(guildId, 'tickets', DEFAULTS);
  cfg.maxOpenPerUser = clamp(Number(cfg.maxOpenPerUser) || DEFAULTS.maxOpenPerUser, 1, 25);
  return cfg;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function rowToCategory(row) {
  if (!row) return null;
  let staffRoleIds = [];
  try {
    const parsed = JSON.parse(row.staff_role_ids || '[]');
    if (Array.isArray(parsed)) staffRoleIds = parsed.filter((id) => typeof id === 'string');
  } catch {
    staffRoleIds = [];
  }
  return {
    key: row.key,
    label: row.label,
    emoji: row.emoji || null,
    description: row.description || null,
    parentId: row.parent_id || null,
    staffRoleIds,
    pattern: row.name_pattern || '{category}-{num}',
    welcome: row.welcome || null,
    cooldownSeconds: clamp(Number(row.cooldown_seconds) || 0, 0, 86400),
    maxOpen: clamp(Number(row.max_open) || 1, 1, 10),
  };
}

function listCategories(client, guildId) {
  return client.db
    .all('SELECT * FROM ticket_categories WHERE guild_id = ? ORDER BY key ASC', guildId)
    .map(rowToCategory);
}

function getCategory(client, guildId, key) {
  if (!key) return null;
  return rowToCategory(client.db.get('SELECT * FROM ticket_categories WHERE guild_id = ? AND key = ?', guildId, key));
}

function saveCategory(client, guildId, cat) {
  client.db.run(
    `INSERT INTO ticket_categories
       (guild_id, key, label, emoji, description, parent_id, staff_role_ids, name_pattern, welcome, cooldown_seconds, max_open)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (guild_id, key) DO UPDATE SET
       label = excluded.label,
       emoji = excluded.emoji,
       description = excluded.description,
       parent_id = excluded.parent_id,
       staff_role_ids = excluded.staff_role_ids,
       name_pattern = excluded.name_pattern,
       welcome = excluded.welcome,
       cooldown_seconds = excluded.cooldown_seconds,
       max_open = excluded.max_open`,
    guildId,
    cat.key,
    cat.label,
    cat.emoji ?? null,
    cat.description ?? null,
    cat.parentId ?? null,
    JSON.stringify(cat.staffRoleIds ?? []),
    cat.pattern || '{category}-{num}',
    cat.welcome ?? null,
    clamp(Number(cat.cooldownSeconds) || 0, 0, 86400),
    clamp(Number(cat.maxOpen) || 1, 1, 10),
  );
}

function deleteCategory(client, guildId, key) {
  return client.db.run('DELETE FROM ticket_categories WHERE guild_id = ? AND key = ?', guildId, key).changes > 0;
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function rowToPanel(row) {
  if (!row) return null;
  let categories = [];
  try {
    const parsed = JSON.parse(row.categories || '[]');
    if (Array.isArray(parsed)) categories = parsed.filter((k) => typeof k === 'string');
  } catch {
    categories = [];
  }
  return { ...row, categories };
}

function listPanels(client, guildId) {
  return client.db.all('SELECT * FROM ticket_panels WHERE guild_id = ? ORDER BY id ASC', guildId).map(rowToPanel);
}

function getPanel(client, guildId, id) {
  return rowToPanel(client.db.get('SELECT * FROM ticket_panels WHERE guild_id = ? AND id = ?', guildId, id));
}

function createPanel(client, guildId, { name, title, description, categories }) {
  const res = client.db.run(
    'INSERT INTO ticket_panels (guild_id, name, title, description, categories) VALUES (?, ?, ?, ?, ?)',
    guildId,
    name,
    title,
    description ?? '',
    JSON.stringify(categories ?? []),
  );
  return getPanel(client, guildId, Number(res.lastInsertRowid));
}

function deletePanelRow(client, guildId, id) {
  return client.db.run('DELETE FROM ticket_panels WHERE guild_id = ? AND id = ?', guildId, id).changes > 0;
}

/** Resolve the categories a panel should display (empty list on the panel = all configured). */
function panelCategories(client, guildId, panel) {
  const all = listCategories(client, guildId);
  if (!panel.categories.length) return all;
  const byKey = new Map(all.map((c) => [c.key, c]));
  return panel.categories.map((k) => byKey.get(k)).filter(Boolean);
}

function panelComponents(cats) {
  if (cats.length <= 5) {
    const row = new ActionRowBuilder();
    for (const cat of cats) {
      const button = new ButtonBuilder()
        .setCustomId(`ticket:open:${cat.key}`)
        .setLabel(truncate(cat.label, 80))
        .setStyle(ButtonStyle.Primary);
      const emoji = normalizeEmoji(cat.emoji);
      if (emoji) {
        try {
          button.setEmoji(emoji);
        } catch {
          // ignore unusable emoji
        }
      }
      row.addComponents(button);
    }
    return [row];
  }
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:openselect')
    .setPlaceholder('Select a ticket category…')
    .setMinValues(1)
    .setMaxValues(1);
  for (const cat of cats.slice(0, 25)) {
    const option = { label: truncate(cat.label, 100), value: cat.key };
    if (cat.description) option.description = truncate(cat.description, 100);
    const emoji = normalizeEmoji(cat.emoji);
    try {
      menu.addOptions(emoji ? { ...option, emoji } : option);
    } catch {
      menu.addOptions(option);
    }
  }
  return [new ActionRowBuilder().addComponents(menu)];
}

/** Publish (or republish) a panel to a channel via the branded webhook pipeline. */
async function publishPanel(client, guild, panel, channel) {
  const cats = panelCategories(client, guild.id, panel);
  if (!cats.length) {
    return { ok: false, error: 'This panel has no valid categories. Add some with `/ticketconfig category add` first.' };
  }

  // Remove the previous panel message so buttons are never duplicated.
  if (panel.channel_id && panel.message_id) {
    try {
      const oldChannel =
        guild.channels.cache.get(panel.channel_id) ?? (await guild.channels.fetch(panel.channel_id).catch(() => null));
      const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(panel.message_id).catch(() => null) : null;
      if (oldMessage) await oldMessage.delete().catch(() => null);
    } catch (err) {
      log.debug(`Could not remove old panel message ${panel.message_id}:`, err?.message ?? err);
    }
  }

  const parts = [];
  if (panel.description) parts.push(panel.description, '');
  parts.push(...cats.map((c) => `${normalizeEmoji(c.emoji) ?? '🎫'} **${c.label}**${c.description ? ` — ${c.description}` : ''}`));
  const embed = client.brand
    .embed(guild)
    .setTitle(truncate(panel.title, 256))
    .setDescription(truncate(parts.join('\n'), 4000));

  const message = await client.hooks.send(channel, { embeds: [embed], components: panelComponents(cats) });
  if (!message) return { ok: false, error: 'I could not post the panel in that channel. Check my permissions there.' };

  client.db.run('UPDATE ticket_panels SET channel_id = ?, message_id = ? WHERE id = ?', channel.id, message.id, panel.id);
  await logTicket(client, guild, {
    title: '📋 Ticket panel published',
    color: 'info',
    description: `Panel **${panel.name}** published in <#${channel.id}>.`,
  });
  return { ok: true, message };
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

function getTicket(client, id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return client.db.get('SELECT * FROM tickets WHERE id = ?', id) ?? null;
}

function getTicketByChannel(client, guildId, channelId) {
  return (
    client.db.get(
      "SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ? AND status != 'deleted' ORDER BY id DESC LIMIT 1",
      guildId,
      channelId,
    ) ?? null
  );
}

function countOpenForUser(client, guildId, userId, categoryKey = null) {
  const row = categoryKey
    ? client.db.get(
        "SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND opener_id = ? AND category = ? AND status = 'open'",
        guildId,
        userId,
        categoryKey,
      )
    : client.db.get(
        "SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND opener_id = ? AND status = 'open'",
        guildId,
        userId,
      );
  return row?.n ?? 0;
}

function createTicketRow(client, guildId, openerId, categoryKey) {
  const txn = client.db.transaction(() => {
    const row = client.db.get('SELECT COALESCE(MAX(num), 0) + 1 AS n FROM tickets WHERE guild_id = ?', guildId);
    const num = row?.n ?? 1;
    const res = client.db.run(
      "INSERT INTO tickets (guild_id, channel_id, opener_id, category, status, priority, opened_at, num) VALUES (?, NULL, ?, ?, 'open', 'normal', ?, ?)",
      guildId,
      openerId,
      categoryKey,
      Date.now(),
      num,
    );
    return { id: Number(res.lastInsertRowid), num };
  });
  return txn();
}

function sanitizeChannelName(input, fallback = 'ticket') {
  const cleaned = String(input ?? '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 95);
  return cleaned || fallback;
}

/** Strip any known priority marker, then re-apply the one for `priority`. */
function applyPriorityPrefix(name, priority) {
  let base = String(name ?? '');
  for (const prefix of PRIORITY_PREFIX_STRINGS) {
    if (base.startsWith(prefix)) base = base.slice(prefix.length);
  }
  const p = PRIORITIES[priority];
  return p?.prefix ? `${p.prefix}-${base}`.slice(0, 99) : base;
}

function buildChannelName(category, user, num, priority, settings) {
  const numStr = pad(num);
  const raw = (category.pattern || '{category}-{num}')
    .replaceAll('{num}', numStr)
    .replaceAll('{user}', user.username ?? 'user')
    .replaceAll('{username}', user.username ?? 'user')
    .replaceAll('{category}', category.key);
  let name = sanitizeChannelName(raw, `ticket-${numStr}`);
  if (settings.priorityPrefix) name = applyPriorityPrefix(name, priority);
  return name;
}

function renderTemplate(text, { user, guild, category }) {
  return String(text ?? '')
    .replaceAll('{user}', `<@${user.id}>`)
    .replaceAll('{username}', user.username ?? 'there')
    .replaceAll('{server}', guild.name ?? 'this server')
    .replaceAll('{category}', category.label ?? category.key);
}

function buildOverwrites(guild, category, openerId) {
  const memberAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
  ];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: openerId, allow: memberAllow },
  ];
  const me = guild.members.me;
  if (me) {
    overwrites.push({
      id: me.id,
      allow: [
        ...memberAllow,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageWebhooks,
      ],
    });
  }
  for (const roleId of category.staffRoleIds) {
    if (guild.roles.cache.has(roleId)) {
      overwrites.push({ id: roleId, allow: [...memberAllow, PermissionFlagsBits.ManageMessages] });
    }
  }
  return overwrites;
}

/** Staff = guild owner, Manage Server, or holder of one of the category's staff roles. */
function isTicketStaff(member, category) {
  if (!member?.guild) return false;
  if (member.guild.ownerId === member.id) return true;
  if (member.permissions?.has?.(PermissionFlagsBits.ManageGuild)) return true;
  const roles = category?.staffRoleIds ?? [];
  return roles.some((id) => member.roles?.cache?.has(id));
}

async function fetchTicketChannel(guild, ticket) {
  if (!ticket?.channel_id) return null;
  const cached = guild.channels.cache.get(ticket.channel_id);
  if (cached) return cached.isTextBased?.() ? cached : null;
  const fetched = await guild.channels.fetch(ticket.channel_id).catch(() => null);
  return fetched?.isTextBased?.() ? fetched : null;
}

function ticketButtons(ticketId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:claim:${ticketId}`).setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket:priomenu:${ticketId}`).setLabel('Priority').setEmoji('🚦').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:rename:${ticketId}`).setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:members:${ticketId}`).setLabel('Members').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:transcript:${ticketId}`).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function closedButtons(ticketId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket:reopen:${ticketId}`).setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket:transcript:${ticketId}`).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket:delete:${ticketId}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    ),
  ];
}

/** Send an entry to the guild's tickets log channel. Never throws. */
async function logTicket(client, guild, { title, color = 'info', description = null, ticket = null, fields = [] }) {
  try {
    const embed = client.brand.embed(guild, { color }).setTitle(title);
    if (description) embed.setDescription(description);
    const auto = [];
    if (ticket) {
      auto.push({ name: 'Ticket', value: `#${pad(ticket.num)} (${ticket.category})`, inline: true });
      auto.push({ name: 'Opener', value: `<@${ticket.opener_id}>`, inline: true });
      if (ticket.channel_id) auto.push({ name: 'Channel', value: `<#${ticket.channel_id}>`, inline: true });
    }
    const all = [...auto, ...fields].slice(0, 25);
    if (all.length) embed.addFields(all);
    await client.logs.send(guild, 'tickets', { embeds: [embed] });
  } catch (err) {
    log.debug('tickets log failed:', err?.message ?? err);
  }
}

/**
 * Open a ticket for a member in a category. Returns { ok, ticket?, channel?, error? }.
 * Cooldown checking is the caller's job (it needs the remaining time for its reply).
 */
async function openTicket(client, guild, member, category) {
  const settings = getSettings(client, guild.id);
  if (!settings.enabled) return { ok: false, error: 'The ticket system is currently disabled on this server.' };

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return { ok: false, error: 'I am missing the **Manage Channels** permission, so I cannot create ticket channels.' };
  }

  const openGlobal = countOpenForUser(client, guild.id, member.id);
  if (openGlobal >= settings.maxOpenPerUser) {
    return { ok: false, error: `You already have **${openGlobal}** open ticket(s) — the server limit is **${settings.maxOpenPerUser}**.` };
  }
  const openInCategory = countOpenForUser(client, guild.id, member.id, category.key);
  if (openInCategory >= category.maxOpen) {
    return {
      ok: false,
      error: `You already have **${openInCategory}** open **${category.label}** ticket(s) — the limit is **${category.maxOpen}**.`,
    };
  }

  const { id, num } = createTicketRow(client, guild.id, member.id, category.key);

  // Category-specific parent first, then the guild-wide default that
  // templates/setup write into the 'tickets' config namespace.
  let parentId;
  const defaultParentId = client.config.get(guild.id, 'tickets', {}).defaultParentId ?? null;
  for (const candidateId of [category.parentId, defaultParentId]) {
    if (!candidateId) continue;
    const parent =
      guild.channels.cache.get(candidateId) ?? (await guild.channels.fetch(candidateId).catch(() => null));
    if (parent?.type === ChannelType.GuildCategory) {
      parentId = parent.id;
      break;
    }
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: buildChannelName(category, member.user, num, 'normal', settings),
      type: ChannelType.GuildText,
      parent: parentId,
      topic: `🎫 Ticket #${pad(num)} • ${category.label} • opened by ${member.user.tag ?? member.user.username}`,
      permissionOverwrites: buildOverwrites(guild, category, member.id),
      reason: `Ticket #${pad(num)} opened by ${member.user.tag ?? member.user.username}`,
    });
  } catch (err) {
    client.db.run('DELETE FROM tickets WHERE id = ?', id);
    log.warn(`Ticket channel creation failed in guild ${guild.id}:`, err?.message ?? err);
    return { ok: false, error: 'I could not create the ticket channel. Check my permissions and the configured Discord category.' };
  }

  client.db.run('UPDATE tickets SET channel_id = ? WHERE id = ?', channel.id, id);
  const ticket = getTicket(client, id);

  const welcomeText = renderTemplate(
    category.welcome || 'Hi {user}! Thanks for opening a **{category}** ticket — tell us what you need and our team will respond soon.',
    { user: member.user, guild, category },
  );
  const embed = client.brand
    .embed(guild)
    .setTitle(`${normalizeEmoji(category.emoji) ?? '🎫'} ${category.label} — Ticket #${pad(num)}`)
    .setDescription(truncate(welcomeText, 2000))
    .addFields(
      { name: 'Opened by', value: `<@${member.id}>`, inline: true },
      { name: 'Category', value: category.label, inline: true },
      { name: 'Priority', value: `${PRIORITIES.normal.emoji} Normal`, inline: true },
    );
  const mentions = [`<@${member.id}>`, ...category.staffRoleIds.filter((r) => guild.roles.cache.has(r)).map((r) => `<@&${r}>`)];
  await client.hooks.send(channel, { content: mentions.join(' '), embeds: [embed], components: ticketButtons(id) });

  await logTicket(client, guild, {
    title: `🎫 Ticket #${pad(num)} opened`,
    color: 'success',
    ticket,
    fields: [{ name: 'Category', value: category.label, inline: true }],
  });
  return { ok: true, ticket, channel };
}

async function claimTicket(client, guild, ticket, member) {
  const fresh = getTicket(client, ticket.id);
  if (!fresh || fresh.status !== 'open') return { ok: false, error: 'Only open tickets can be claimed.' };
  if (fresh.claimer_id === member.id) return { ok: false, error: 'You already claimed this ticket.' };
  if (fresh.claimer_id) return { ok: false, error: `This ticket is already claimed by <@${fresh.claimer_id}>.` };

  client.db.run('UPDATE tickets SET claimer_id = ? WHERE id = ?', member.id, fresh.id);
  const updated = getTicket(client, fresh.id);

  const channel = await fetchTicketChannel(guild, updated);
  if (channel) {
    const embed = client.brand
      .embed(guild, { color: 'info' })
      .setTitle('🙋 Ticket claimed')
      .setDescription(`<@${member.id}> will be handling this ticket.`);
    await client.hooks.send(channel, { embeds: [embed] });
  }
  await logTicket(client, guild, {
    title: `🙋 Ticket #${pad(updated.num)} claimed`,
    color: 'info',
    ticket: updated,
    fields: [{ name: 'Claimed by', value: `<@${member.id}>`, inline: true }],
  });
  return { ok: true, ticket: updated };
}

async function closeTicket(client, guild, ticket, closer, reason) {
  const fresh = getTicket(client, ticket.id);
  if (!fresh || fresh.status !== 'open') return { ok: false, error: 'This ticket is not open.' };

  const now = Date.now();
  client.db.run(
    "UPDATE tickets SET status = 'closed', closed_at = ?, closed_by = ?, close_reason = ? WHERE id = ?",
    now,
    closer?.id ?? null,
    reason ? truncate(reason, 500) : null,
    fresh.id,
  );
  const updated = getTicket(client, fresh.id);
  const settings = getSettings(client, guild.id);

  const channel = await fetchTicketChannel(guild, updated);
  if (channel) {
    await channel.permissionOverwrites
      .edit(updated.opener_id, { SendMessages: false }, { reason: `Ticket #${pad(updated.num)} closed` })
      .catch(() => null);
    const embed = client.brand
      .embed(guild, { color: 'warning' })
      .setTitle(`🔒 Ticket #${pad(updated.num)} closed`)
      .setDescription(reason ? `**Reason:** ${truncate(reason, 500)}` : 'No reason provided.')
      .addFields({ name: 'Closed by', value: closer ? `<@${closer.id}>` : 'System', inline: true });
    await client.hooks.send(channel, { embeds: [embed], components: closedButtons(updated.id) });
  }

  await deliverTranscript(client, guild, updated, channel, {
    toLog: settings.logTranscripts,
    toOpener: settings.dmTranscripts,
  });

  if (settings.closedDeleteAfterMs && Number(settings.closedDeleteAfterMs) > 0) {
    client.scheduler.schedule({
      guildId: guild.id,
      type: 'tickets:delete',
      runAt: now + Number(settings.closedDeleteAfterMs),
      data: { ticketId: updated.id },
    });
  }

  await logTicket(client, guild, {
    title: `🔒 Ticket #${pad(updated.num)} closed`,
    color: 'warning',
    ticket: updated,
    fields: [
      { name: 'Closed by', value: closer ? `<@${closer.id}>` : 'System', inline: true },
      { name: 'Reason', value: reason ? truncate(reason, 1000) : 'None', inline: true },
    ],
  });
  return { ok: true, ticket: updated };
}

async function reopenTicket(client, guild, ticket, actor) {
  const fresh = getTicket(client, ticket.id);
  if (!fresh || fresh.status !== 'closed') return { ok: false, error: 'Only closed tickets can be reopened.' };

  client.db.run("UPDATE tickets SET status = 'open', closed_at = NULL, closed_by = NULL, close_reason = NULL WHERE id = ?", fresh.id);
  cancelScheduledDeletes(client, guild.id, fresh.id);
  const updated = getTicket(client, fresh.id);

  const channel = await fetchTicketChannel(guild, updated);
  if (channel) {
    await channel.permissionOverwrites
      .edit(updated.opener_id, { SendMessages: null }, { reason: `Ticket #${pad(updated.num)} reopened` })
      .catch(() => null);
    const embed = client.brand
      .embed(guild, { color: 'success' })
      .setTitle(`🔓 Ticket #${pad(updated.num)} reopened`)
      .setDescription(`Reopened by ${actor ? `<@${actor.id}>` : 'staff'} — <@${updated.opener_id}> can reply again.`);
    await client.hooks.send(channel, { embeds: [embed], components: ticketButtons(updated.id) });
  }
  await logTicket(client, guild, {
    title: `🔓 Ticket #${pad(updated.num)} reopened`,
    color: 'success',
    ticket: updated,
    fields: [{ name: 'Reopened by', value: actor ? `<@${actor.id}>` : 'System', inline: true }],
  });
  return { ok: true, ticket: updated };
}

async function deleteTicket(client, guild, ticket, actor, note = null) {
  const fresh = getTicket(client, ticket.id);
  if (!fresh || fresh.status === 'deleted') return { ok: false, error: 'This ticket was already deleted.' };

  const settings = getSettings(client, guild.id);
  const channel = await fetchTicketChannel(guild, fresh);
  if (channel) {
    await deliverTranscript(client, guild, fresh, channel, { toLog: true, toOpener: settings.dmTranscripts });
  }

  client.db.run(
    "UPDATE tickets SET status = 'deleted', closed_at = COALESCE(closed_at, ?), closed_by = COALESCE(closed_by, ?), close_reason = COALESCE(close_reason, ?) WHERE id = ?",
    Date.now(),
    actor?.id ?? null,
    note ?? null,
    fresh.id,
  );
  cancelScheduledDeletes(client, guild.id, fresh.id);

  if (channel) {
    await channel
      .delete(`Ticket #${pad(fresh.num)} deleted${actor ? ` by ${actor.tag ?? actor.id}` : ' (auto-delete)'}`)
      .catch((err) => log.debug(`Ticket channel delete failed:`, err?.message ?? err));
  }

  await logTicket(client, guild, {
    title: `🗑️ Ticket #${pad(fresh.num)} deleted`,
    color: 'error',
    ticket: { ...fresh, channel_id: null },
    fields: [
      { name: 'Deleted by', value: actor ? `<@${actor.id}>` : 'System (auto-delete)', inline: true },
      { name: 'Channel', value: `#${channel?.name ?? 'already gone'}`, inline: true },
    ],
  });
  return { ok: true, ticket: fresh };
}

async function setPriority(client, guild, ticket, priorityKey, actor) {
  const priority = PRIORITIES[priorityKey];
  if (!priority) return { ok: false, error: 'Unknown priority level.' };
  const fresh = getTicket(client, ticket.id);
  if (!fresh || fresh.status !== 'open') return { ok: false, error: 'Priority can only be changed on open tickets.' };

  client.db.run('UPDATE tickets SET priority = ? WHERE id = ?', priority.key, fresh.id);
  const updated = getTicket(client, fresh.id);
  const settings = getSettings(client, guild.id);

  const channel = await fetchTicketChannel(guild, updated);
  if (channel) {
    if (settings.priorityPrefix) {
      const newName = applyPriorityPrefix(channel.name, priority.key);
      if (newName !== channel.name) await channel.setName(newName).catch(() => null);
    }
    const embed = client.brand
      .embed(guild, { color: priority.key === 'high' || priority.key === 'urgent' ? 'warning' : 'info' })
      .setTitle(`${priority.emoji} Priority set to ${priority.label}`)
      .setDescription(actor ? `Set by <@${actor.id}>.` : null);
    await client.hooks.send(channel, { embeds: [embed] });
  }
  await logTicket(client, guild, {
    title: `${priority.emoji} Ticket #${pad(updated.num)} priority → ${priority.label}`,
    color: 'info',
    ticket: updated,
  });
  return { ok: true, ticket: updated, priority };
}

/** Generate a transcript and deliver it to the log channel and/or the opener's DMs. Never throws. */
async function deliverTranscript(client, guild, ticket, channel, { toLog = true, toOpener = false } = {}) {
  if (!channel || (!toLog && !toOpener)) return null;
  try {
    const { buffer, filename, messageCount } = await generateTranscript(channel, { ticket, guildName: guild.name });
    const summary = client.brand
      .embed(guild, { color: 'info' })
      .setTitle(`📄 Transcript — ticket #${pad(ticket.num)}`)
      .setDescription(`${messageCount} message(s) captured from <#${channel.id}>.`)
      .addFields(
        { name: 'Opener', value: `<@${ticket.opener_id}>`, inline: true },
        { name: 'Category', value: String(ticket.category), inline: true },
      );
    if (toLog) {
      await client.logs.send(guild, 'tickets', {
        embeds: [summary],
        files: [new AttachmentBuilder(buffer, { name: filename })],
      });
    }
    if (toOpener) {
      const user = await client.users.fetch(ticket.opener_id).catch(() => null);
      if (user) {
        const dmEmbed = client.brand
          .embed(guild, { color: 'info' })
          .setTitle(`📄 Your ticket transcript — ${guild.name}`)
          .setDescription(`Here is the transcript of your **${ticket.category}** ticket #${pad(ticket.num)}.`);
        await user.send({ embeds: [dmEmbed], files: [new AttachmentBuilder(buffer, { name: filename })] }).catch(() => null);
      }
    }
    return { messageCount };
  } catch (err) {
    log.warn(`Transcript delivery failed for ticket ${ticket?.id}:`, err?.message ?? err);
    return null;
  }
}

function cancelScheduledDeletes(client, guildId, ticketId) {
  try {
    for (const job of client.scheduler.pending(guildId, 'tickets:delete')) {
      if (Number(job.data?.ticketId) === Number(ticketId)) client.scheduler.cancel(job.id);
    }
  } catch (err) {
    log.debug('Cancelling scheduled ticket deletes failed:', err?.message ?? err);
  }
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function stats(client, guildId) {
  const totals =
    client.db.get(
      `SELECT COUNT(*) AS opened,
              COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0) AS open_now,
              COALESCE(SUM(CASE WHEN closed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS closed
       FROM tickets WHERE guild_id = ?`,
      guildId,
    ) ?? {};
  const avgRow = client.db.get(
    'SELECT AVG(closed_at - opened_at) AS avg_ms FROM tickets WHERE guild_id = ? AND closed_at IS NOT NULL',
    guildId,
  );
  const claims = client.db.all(
    'SELECT claimer_id AS user_id, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND claimer_id IS NOT NULL GROUP BY claimer_id ORDER BY count DESC LIMIT 10',
    guildId,
  );
  const closes = client.db.all(
    'SELECT closed_by AS user_id, COUNT(*) AS count FROM tickets WHERE guild_id = ? AND closed_by IS NOT NULL GROUP BY closed_by ORDER BY count DESC LIMIT 10',
    guildId,
  );
  const byCategory = client.db.all(
    'SELECT category, COUNT(*) AS count FROM tickets WHERE guild_id = ? GROUP BY category ORDER BY count DESC LIMIT 15',
    guildId,
  );
  return {
    opened: totals.opened ?? 0,
    openNow: totals.open_now ?? 0,
    closed: totals.closed ?? 0,
    avgCloseMs: avgRow?.avg_ms ?? null,
    claims,
    closes,
    byCategory,
  };
}

module.exports = {
  DEFAULTS,
  PRIORITIES,
  BUILTIN_TYPES,
  KEY_RE,
  pad,
  normalizeEmoji,
  getSettings,
  listCategories,
  getCategory,
  saveCategory,
  deleteCategory,
  listPanels,
  getPanel,
  createPanel,
  deletePanelRow,
  panelCategories,
  panelComponents,
  publishPanel,
  getTicket,
  getTicketByChannel,
  countOpenForUser,
  sanitizeChannelName,
  applyPriorityPrefix,
  isTicketStaff,
  fetchTicketChannel,
  ticketButtons,
  closedButtons,
  logTicket,
  openTicket,
  claimTicket,
  closeTicket,
  reopenTicket,
  deleteTicket,
  setPriority,
  deliverTranscript,
  cancelScheduledDeletes,
  stats,
};
