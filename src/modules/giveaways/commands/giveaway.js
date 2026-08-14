'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const log = require('../../../core/logger');
const { isGuildOwner } = require('../../../core/permissions');
const {
  parseDuration,
  formatDuration,
  relativeTime,
  truncate,
  clamp,
  confirm,
  safeReply,
  chunkArray,
  paginate,
} = require('../../../core/utils');
const manager = require('../services/manager');

const GIVEAWAY_REF_DESC = 'Giveaway ID (see /giveaway list), or the giveaway message ID / link';

function replyError(interaction, title, description) {
  return safeReply(interaction, {
    embeds: [interaction.client.brand.error(interaction.guild, title, description)],
    flags: MessageFlags.Ephemeral,
  });
}

function addGiveawayRefOption(sub) {
  return sub.addStringOption((opt) =>
    opt.setName('giveaway').setDescription(GIVEAWAY_REF_DESC).setRequired(true).setAutocomplete(true),
  );
}

module.exports = {
  cooldown: 3,
  // NOTE: no router-level `permissions` / setDefaultMemberPermissions —
  // access is checked in-code so the configured giveaway manager role
  // (which may lack Manage Server) can still use the command.
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Run premium giveaways with invite, level, role, and age requirements')
      .addSubcommand((sub) =>
        sub
          .setName('start')
          .setDescription('Start a new giveaway')
          .addStringOption((opt) => opt.setName('prize').setDescription('What is being given away').setRequired(true).setMaxLength(200))
          .addStringOption((opt) => opt.setName('duration').setDescription('How long it runs, e.g. 30m, 12h, 1d12h, 1w').setRequired(true))
          .addIntegerOption((opt) => opt.setName('winners').setDescription('Number of winners (1-20, default 1)').setMinValue(1).setMaxValue(20))
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel to post the giveaway in (default: this channel)')
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
          )
          .addRoleOption((opt) => opt.setName('required_role').setDescription('Role members must have to enter'))
          .addRoleOption((opt) => opt.setName('blacklisted_role').setDescription('Role that is NOT allowed to enter'))
          .addIntegerOption((opt) => opt.setName('required_level').setDescription('Minimum server level to enter').setMinValue(1).setMaxValue(1000))
          .addIntegerOption((opt) => opt.setName('required_invites').setDescription('Minimum server invites to enter').setMinValue(1).setMaxValue(1000))
          .addStringOption((opt) => opt.setName('min_account_age').setDescription('Minimum Discord account age, e.g. 7d, 1w'))
          .addStringOption((opt) => opt.setName('min_membership').setDescription('Minimum time in this server, e.g. 3d, 2w'))
          .addAttachmentOption((opt) => opt.setName('image').setDescription('Image shown on the giveaway embed'))
          .addStringOption((opt) => opt.setName('image_url').setDescription('Image URL (alternative to the attachment)')),
      )
      .addSubcommand((sub) => addGiveawayRefOption(sub.setName('end').setDescription('End a giveaway now and draw winners')))
      .addSubcommand((sub) =>
        addGiveawayRefOption(sub.setName('reroll').setDescription('Reroll new winner(s) for an ended giveaway')).addIntegerOption((opt) =>
          opt.setName('winners').setDescription('How many new winners to draw (default 1)').setMinValue(1).setMaxValue(20),
        ),
      )
      .addSubcommand((sub) => addGiveawayRefOption(sub.setName('cancel').setDescription('Cancel a giveaway without drawing winners')))
      .addSubcommand((sub) => addGiveawayRefOption(sub.setName('pause').setDescription('Pause a running giveaway (entries close, time freezes)')))
      .addSubcommand((sub) => addGiveawayRefOption(sub.setName('resume').setDescription('Resume a paused giveaway')))
      .addSubcommand((sub) => sub.setName('list').setDescription('List active giveaways in this server'))
      .addSubcommand((sub) =>
        sub
          .setName('config')
          .setDescription('View or set the giveaway manager role')
          .addRoleOption((opt) => opt.setName('manager_role').setDescription('Role allowed to manage giveaways (besides Manage Server)'))
          .addBooleanOption((opt) => opt.setName('clear_manager_role').setDescription('Remove the configured manager role')),
      );
    return builder;
  })(),

  async execute(interaction) {
    const client = interaction.client;
    if (!manager.canManage(client, interaction.member)) {
      return replyError(
        interaction,
        'Missing permissions',
        'You need **Manage Server** or the configured giveaway manager role to manage giveaways.',
      );
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') return subStart(interaction);
    if (sub === 'end') return subEnd(interaction);
    if (sub === 'reroll') return subReroll(interaction);
    if (sub === 'cancel') return subCancel(interaction);
    if (sub === 'pause') return subPause(interaction);
    if (sub === 'resume') return subResume(interaction);
    if (sub === 'list') return subList(interaction);
    if (sub === 'config') return subConfig(interaction);
    return null;
  },

  async autocomplete(interaction) {
    const client = interaction.client;
    const sub = interaction.options.getSubcommand(false);
    const statusBySub = {
      end: ['running', 'paused'],
      cancel: ['running', 'paused'],
      pause: ['running'],
      resume: ['paused'],
      reroll: ['ended'],
    };
    const statuses = statusBySub[sub] ?? ['running', 'paused'];
    const placeholders = statuses.map(() => '?').join(', ');
    const rows = client.db.all(
      `SELECT id, prize, status FROM giveaways WHERE guild_id = ? AND status IN (${placeholders}) ORDER BY id DESC LIMIT 25`,
      interaction.guildId,
      ...statuses,
    );
    const query = String(interaction.options.getFocused() ?? '').toLowerCase();
    const choices = rows
      .filter((r) => !query || String(r.id).includes(query) || r.prize.toLowerCase().includes(query))
      .slice(0, 25)
      .map((r) => ({ name: truncate(`#${r.id} • ${r.prize} (${r.status})`, 100), value: String(r.id) }));
    return interaction.respond(choices).catch(() => null);
  },
};

async function subStart(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  const prize = truncate(String(interaction.options.getString('prize') ?? '').trim(), 200);
  if (!prize) return replyError(interaction, 'Invalid prize', 'The prize cannot be empty.');

  const durationMs = parseDuration(interaction.options.getString('duration'));
  if (durationMs === null) {
    return replyError(interaction, 'Invalid duration', 'Use formats like `30m`, `12h`, `1d12h`, or `1w`.');
  }
  if (durationMs < manager.MIN_DURATION_MS || durationMs > manager.MAX_DURATION_MS) {
    return replyError(
      interaction,
      'Duration out of range',
      `The duration must be between **${formatDuration(manager.MIN_DURATION_MS)}** and **${formatDuration(manager.MAX_DURATION_MS)}**.`,
    );
  }

  const winners = clamp(interaction.options.getInteger('winners') ?? 1, 1, manager.MAX_WINNERS);

  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
    return replyError(interaction, 'Invalid channel', 'Giveaways can only be posted in text or announcement channels.');
  }
  const me = guild.members.me;
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
    return replyError(interaction, 'Missing bot permissions', `I cannot send messages in ${channel}. Check my channel permissions.`);
  }

  const requirements = {};
  const requiredRole = interaction.options.getRole('required_role');
  const blacklistedRole = interaction.options.getRole('blacklisted_role');
  if (requiredRole && blacklistedRole && requiredRole.id === blacklistedRole.id) {
    return replyError(interaction, 'Invalid requirements', 'The required role and blacklisted role cannot be the same role.');
  }
  if (requiredRole) requirements.requiredRoleId = requiredRole.id;
  if (blacklistedRole) requirements.blacklistedRoleId = blacklistedRole.id;

  const requiredLevel = interaction.options.getInteger('required_level');
  if (requiredLevel) requirements.requiredLevel = clamp(requiredLevel, 1, 1000);
  const requiredInvites = interaction.options.getInteger('required_invites');
  if (requiredInvites) requirements.requiredInvites = clamp(requiredInvites, 1, 1000);

  for (const [option, key, label] of [
    ['min_account_age', 'minAccountAgeMs', 'minimum account age'],
    ['min_membership', 'minMembershipMs', 'minimum membership time'],
  ]) {
    const raw = interaction.options.getString(option);
    if (!raw) continue;
    const ms = parseDuration(raw);
    if (ms === null || ms > manager.MAX_REQ_DURATION_MS) {
      return replyError(interaction, `Invalid ${label}`, 'Use formats like `7d`, `2w`, or `1d12h` (max 5 years).');
    }
    requirements[key] = ms;
  }

  let imageUrl = null;
  const attachment = interaction.options.getAttachment('image');
  if (attachment) {
    if (attachment.contentType && !attachment.contentType.startsWith('image/')) {
      return replyError(interaction, 'Invalid image', 'The attached file must be an image (PNG, JPG, GIF, or WebP).');
    }
    imageUrl = attachment.url;
  } else {
    const rawUrl = String(interaction.options.getString('image_url') ?? '').trim();
    if (rawUrl) {
      if (!/^https?:\/\/\S+$/i.test(rawUrl) || rawUrl.length > 512) {
        return replyError(interaction, 'Invalid image URL', 'Provide a valid `http(s)://` image URL (max 512 characters).');
      }
      imageUrl = rawUrl;
    }
  }

  // Warn the host up-front about requirements that cannot be enforced.
  const warnings = [];
  if (requirements.requiredInvites && typeof client.services?.invites?.getStats !== 'function') {
    warnings.push('The invites module is unavailable — the invite requirement will be skipped at entry time.');
  }
  if (requirements.requiredLevel && typeof client.services?.leveling?.getLevel !== 'function') {
    warnings.push('The leveling module is unavailable — the level requirement will be skipped at entry time.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const endsAt = Date.now() + durationMs;
  const inserted = client.db.run(
    `INSERT INTO giveaways (guild_id, channel_id, prize, winners, ends_at, status, requirements, host_id, image_url)
     VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)`,
    guild.id,
    channel.id,
    prize,
    winners,
    endsAt,
    JSON.stringify(requirements),
    interaction.user.id,
    imageUrl,
  );
  const giveaway = client.db.get('SELECT * FROM giveaways WHERE id = ?', Number(inserted.lastInsertRowid));

  const message = await client.hooks.send(channel, {
    embeds: [manager.buildGiveawayEmbed(client, guild, giveaway, 0)],
    components: [manager.buildEntryRow(giveaway, 0)],
  });
  if (!message) {
    client.db.run('DELETE FROM giveaways WHERE id = ?', giveaway.id);
    return safeReply(interaction, {
      embeds: [client.brand.error(guild, 'Could not post giveaway', `I was unable to post in ${channel}. Check my permissions and try again.`)],
    });
  }
  client.db.run('UPDATE giveaways SET message_id = ? WHERE id = ?', message.id, giveaway.id);
  giveaway.message_id = message.id;
  manager.scheduleEnd(client, giveaway);

  await manager.logAction(
    client,
    guild,
    [
      `🚀 Giveaway **#${giveaway.id}** started by <@${interaction.user.id}> in <#${channel.id}>.`,
      `Prize: **${truncate(prize, 200)}** • Winners: **${winners}** • Ends ${relativeTime(endsAt)}`,
    ].join('\n'),
  );

  const lines = [
    `**Prize:** ${prize}`,
    `**Winners:** ${winners}`,
    `**Ends:** ${relativeTime(endsAt)}`,
    `**Channel:** ${channel}`,
    `[Jump to giveaway](${manager.messageLink(giveaway)})`,
  ];
  if (warnings.length) lines.push('', ...warnings.map((w) => `⚠️ ${w}`));
  return safeReply(interaction, {
    embeds: [client.brand.success(guild, `Giveaway #${giveaway.id} started`, lines.join('\n'))],
  });
}

async function subEnd(interaction) {
  const client = interaction.client;
  const giveaway = manager.resolveGiveaway(client, interaction.guildId, interaction.options.getString('giveaway'));
  if (!giveaway) {
    return replyError(interaction, 'Giveaway not found', 'Provide a giveaway ID from `/giveaway list`, or its message ID / link.');
  }
  if (giveaway.status === manager.STATUS.ENDED) {
    return replyError(interaction, 'Already ended', `Giveaway **#${giveaway.id}** has already ended. Use \`/giveaway reroll\` to pick new winners.`);
  }
  if (giveaway.status === manager.STATUS.CANCELLED) {
    return replyError(interaction, 'Cancelled giveaway', `Giveaway **#${giveaway.id}** was cancelled and cannot be ended.`);
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await manager.endGiveaway(client, giveaway, { endedById: interaction.user.id });
  const winners = result?.winners ?? [];
  return safeReply(interaction, {
    embeds: [
      client.brand.success(
        interaction.guild,
        `Giveaway #${giveaway.id} ended`,
        winners.length
          ? `Winner(s): ${truncate(winners.map((id) => `<@${id}>`).join(', '), 1000)}`
          : 'No valid entries — no winners could be drawn.',
      ),
    ],
  });
}

async function subReroll(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const giveaway = manager.resolveGiveaway(client, interaction.guildId, interaction.options.getString('giveaway'));
  if (!giveaway) {
    return replyError(interaction, 'Giveaway not found', 'Provide an ended giveaway ID, or its message ID / link.');
  }
  if (giveaway.status !== manager.STATUS.ENDED) {
    return replyError(interaction, 'Not ended yet', 'Only ended giveaways can be rerolled. Use `/giveaway end` first.');
  }
  const count = clamp(interaction.options.getInteger('winners') ?? 1, 1, manager.MAX_WINNERS);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const previous = manager.parseWinners(giveaway);
  const winners = await manager.pickWinners(client, guild, giveaway, count, new Set(previous));
  if (!winners.length) {
    return safeReply(interaction, {
      embeds: [
        client.brand.warn(guild, 'No valid entries', 'Everyone who entered has either already won, left the server, or no longer meets the requirements.'),
      ],
    });
  }
  client.db.run('UPDATE giveaways SET winner_ids = ? WHERE id = ?', JSON.stringify([...previous, ...winners]), giveaway.id);

  await manager.announceWinners(client, guild, giveaway, winners, { rerolled: true });
  await manager.logAction(
    client,
    guild,
    `🎲 Giveaway **#${giveaway.id}** (**${truncate(giveaway.prize, 100)}**) rerolled by <@${interaction.user.id}> — new winner(s): ${truncate(
      winners.map((id) => `<@${id}>`).join(', '),
      800,
    )}`,
  );
  return safeReply(interaction, {
    embeds: [
      client.brand.success(guild, `Giveaway #${giveaway.id} rerolled`, `New winner(s): ${truncate(winners.map((id) => `<@${id}>`).join(', '), 1000)}`),
    ],
  });
}

async function subCancel(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const giveaway = manager.resolveGiveaway(client, interaction.guildId, interaction.options.getString('giveaway'));
  if (!giveaway) {
    return replyError(interaction, 'Giveaway not found', 'Provide a giveaway ID from `/giveaway list`, or its message ID / link.');
  }
  if (giveaway.status !== manager.STATUS.RUNNING && giveaway.status !== manager.STATUS.PAUSED) {
    return replyError(interaction, 'Nothing to cancel', `Giveaway **#${giveaway.id}** is already **${giveaway.status}**.`);
  }

  const count = manager.entryCount(client, giveaway.id);
  const confirmed = await confirm(interaction, {
    embed: client.brand.warn(
      guild,
      'Cancel giveaway?',
      `This will permanently cancel giveaway **#${giveaway.id}** — **${truncate(giveaway.prize, 150)}** (${count} ${count === 1 ? 'entry' : 'entries'}).\nNo winners will be drawn. This cannot be undone.`,
    ),
    confirmLabel: 'Cancel giveaway',
    cancelLabel: 'Keep it',
    danger: true,
  });
  if (!confirmed) {
    return interaction
      .editReply({ embeds: [client.brand.info(guild, 'Cancellation aborted', `Giveaway **#${giveaway.id}** is untouched.`)], components: [] })
      .catch(() => null);
  }

  const fresh = manager.getGiveaway(client, guild.id, giveaway.id);
  if (!fresh || (fresh.status !== manager.STATUS.RUNNING && fresh.status !== manager.STATUS.PAUSED)) {
    return interaction
      .editReply({ embeds: [client.brand.warn(guild, 'Too late', 'This giveaway already ended or was cancelled in the meantime.')], components: [] })
      .catch(() => null);
  }
  if (fresh.job_id) client.scheduler.cancel(fresh.job_id);
  client.db.run(`UPDATE giveaways SET status = 'cancelled', job_id = NULL, paused_remaining_ms = NULL WHERE id = ?`, fresh.id);
  fresh.status = manager.STATUS.CANCELLED;
  await manager.updateGiveawayMessage(client, guild, fresh);
  await manager.logAction(client, guild, `🚫 Giveaway **#${fresh.id}** (**${truncate(fresh.prize, 100)}**) cancelled by <@${interaction.user.id}>.`);
  return interaction
    .editReply({ embeds: [client.brand.success(guild, `Giveaway #${fresh.id} cancelled`, 'The giveaway message has been updated and no winners will be drawn.')], components: [] })
    .catch(() => null);
}

async function subPause(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const giveaway = manager.resolveGiveaway(client, interaction.guildId, interaction.options.getString('giveaway'));
  if (!giveaway) {
    return replyError(interaction, 'Giveaway not found', 'Provide a running giveaway ID, or its message ID / link.');
  }
  if (giveaway.status !== manager.STATUS.RUNNING) {
    return replyError(interaction, 'Cannot pause', `Only running giveaways can be paused — **#${giveaway.id}** is **${giveaway.status}**.`);
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (giveaway.job_id) client.scheduler.cancel(giveaway.job_id);
  const fresh = manager.getGiveaway(client, guild.id, giveaway.id);
  if (!fresh || fresh.status !== manager.STATUS.RUNNING) {
    return safeReply(interaction, { embeds: [client.brand.warn(guild, 'Too late', 'This giveaway already ended in the meantime.')] });
  }
  const remaining = Math.max(fresh.ends_at - Date.now(), 10_000);
  client.db.run(`UPDATE giveaways SET status = 'paused', paused_remaining_ms = ?, job_id = NULL WHERE id = ?`, remaining, fresh.id);
  fresh.status = manager.STATUS.PAUSED;
  fresh.paused_remaining_ms = remaining;
  fresh.job_id = null;
  await manager.updateGiveawayMessage(client, guild, fresh);
  await manager.logAction(
    client,
    guild,
    `⏸️ Giveaway **#${fresh.id}** (**${truncate(fresh.prize, 100)}**) paused by <@${interaction.user.id}> with **${formatDuration(remaining)}** remaining.`,
  );
  return safeReply(interaction, {
    embeds: [
      client.brand.success(
        guild,
        `Giveaway #${fresh.id} paused`,
        `Entries are closed and **${formatDuration(remaining)}** of runtime is frozen. Use \`/giveaway resume\` to continue.`,
      ),
    ],
  });
}

async function subResume(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const giveaway = manager.resolveGiveaway(client, interaction.guildId, interaction.options.getString('giveaway'));
  if (!giveaway) {
    return replyError(interaction, 'Giveaway not found', 'Provide a paused giveaway ID, or its message ID / link.');
  }
  if (giveaway.status !== manager.STATUS.PAUSED) {
    return replyError(interaction, 'Cannot resume', `Only paused giveaways can be resumed — **#${giveaway.id}** is **${giveaway.status}**.`);
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const remaining = Math.max(Number(giveaway.paused_remaining_ms) || 60_000, 10_000);
  const endsAt = Date.now() + remaining;
  client.db.run(`UPDATE giveaways SET status = 'running', ends_at = ?, paused_remaining_ms = NULL WHERE id = ?`, endsAt, giveaway.id);
  giveaway.status = manager.STATUS.RUNNING;
  giveaway.ends_at = endsAt;
  giveaway.paused_remaining_ms = null;
  manager.scheduleEnd(client, giveaway);
  await manager.updateGiveawayMessage(client, guild, giveaway);
  await manager.logAction(
    client,
    guild,
    `▶️ Giveaway **#${giveaway.id}** (**${truncate(giveaway.prize, 100)}**) resumed by <@${interaction.user.id}> — ends ${relativeTime(endsAt)}.`,
  );
  return safeReply(interaction, {
    embeds: [client.brand.success(guild, `Giveaway #${giveaway.id} resumed`, `Entries are open again — it now ends ${relativeTime(endsAt)}.`)],
  });
}

async function subList(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const rows = client.db.all(
    `SELECT * FROM giveaways WHERE guild_id = ? AND status IN ('running', 'paused') ORDER BY ends_at ASC`,
    guild.id,
  );
  if (!rows.length) {
    return safeReply(interaction, {
      embeds: [client.brand.info(guild, 'No active giveaways', 'Start one with `/giveaway start`.')],
      flags: MessageFlags.Ephemeral,
    });
  }
  const chunks = chunkArray(rows, 6);
  const embeds = chunks.map((chunk) =>
    client.brand
      .embed(guild)
      .setTitle('🎉 Active giveaways')
      .setDescription(
        chunk
          .map((g) => {
            const count = manager.entryCount(client, g.id);
            const when =
              g.status === manager.STATUS.PAUSED
                ? `⏸️ paused — **${formatDuration(Number(g.paused_remaining_ms) || 0)}** left`
                : `ends ${relativeTime(g.ends_at)}`;
            return `**#${g.id}** — ${truncate(g.prize, 60)}\n└ <#${g.channel_id}> • 🏆 ${g.winners} • 👥 ${count} ${count === 1 ? 'entry' : 'entries'} • ${when}`;
          })
          .join('\n\n'),
      ),
  );
  return paginate(interaction, embeds, { ephemeral: true });
}

async function subConfig(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  // Config changes require real Manage Server — the manager role cannot grant itself.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !isGuildOwner(interaction.member)) {
    return replyError(interaction, 'Missing permissions', 'Only members with **Manage Server** can change giveaway settings.');
  }
  const role = interaction.options.getRole('manager_role');
  const clear = interaction.options.getBoolean('clear_manager_role');
  if (clear) {
    client.config.update(guild.id, manager.NAMESPACE, { managerRoleId: null });
    await manager.logAction(client, guild, `⚙️ Giveaway manager role cleared by <@${interaction.user.id}>.`);
    return safeReply(interaction, {
      embeds: [client.brand.success(guild, 'Manager role cleared', 'Only members with **Manage Server** can manage giveaways now.')],
      flags: MessageFlags.Ephemeral,
    });
  }
  if (role) {
    if (role.managed || role.id === guild.roles.everyone.id) {
      return replyError(interaction, 'Invalid role', 'Pick a normal server role — not `@everyone` or a bot/integration role.');
    }
    client.config.update(guild.id, manager.NAMESPACE, { managerRoleId: role.id });
    await manager.logAction(client, guild, `⚙️ Giveaway manager role set to <@&${role.id}> by <@${interaction.user.id}>.`);
    return safeReply(interaction, {
      embeds: [client.brand.success(guild, 'Manager role set', `Members with ${role} can now manage giveaways (in addition to **Manage Server**).`)],
      flags: MessageFlags.Ephemeral,
    });
  }
  const cfg = manager.config(client, guild.id);
  const current = cfg.managerRoleId && guild.roles.cache.has(cfg.managerRoleId) ? `<@&${cfg.managerRoleId}>` : 'None configured';
  return safeReply(interaction, {
    embeds: [
      client.brand.info(
        guild,
        'Giveaway settings',
        `**Manager role:** ${current}\n\nSet one with \`/giveaway config manager_role:@Role\` or clear it with \`clear_manager_role:True\`.`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}
