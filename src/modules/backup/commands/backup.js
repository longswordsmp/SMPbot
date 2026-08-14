'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const log = require('../../../core/logger');
const { isGuildOwner, isBotOwner } = require('../../../core/permissions');
const {
  truncate,
  clamp,
  confirm,
  safeReply,
  chunkArray,
  paginate,
  relativeTime,
  absoluteTime,
  formatDuration,
} = require('../../../core/utils');
const manager = require('../services/manager');

const CREATE_COOLDOWN_SEC = 300;

function replyError(interaction, title, description) {
  return safeReply(interaction, {
    embeds: [interaction.client.brand.error(interaction.guild, title, description)],
    flags: MessageFlags.Ephemeral,
  });
}

function backupLabel(row) {
  const when = new Date(row.created_at ?? row.createdAt).toISOString().slice(0, 16).replace('T', ' ');
  const reason = row.reason ? ` • ${row.reason}` : '';
  const tag = (row.auto === 1 || row.auto === true) ? 'auto' : 'manual';
  return truncate(`${row.id} • ${when} UTC • ${tag}${reason}`, 100);
}

module.exports = {
  // Manage Server for the command; `/backup restore` additionally requires the
  // guild owner (checked in-code). Create's 300s cooldown is applied in-code so
  // it does not also throttle list/info.
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Server structure & configuration backups for anti-nuke recovery')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Take a snapshot of this server (roles, channels, and all SMPbot config)')
        .addStringOption((opt) => opt.setName('reason').setDescription('Why this backup is being taken').setMaxLength(300)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List saved backups for this server'))
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Show the details of a backup')
        .addStringOption((opt) => opt.setName('id').setDescription('Backup id (see /backup list)').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('restore')
        .setDescription('Restore structure or config from a backup (server owner only)')
        .addStringOption((opt) => opt.setName('id').setDescription('Backup id to restore from').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a saved backup')
        .addStringOption((opt) => opt.setName('id').setDescription('Backup id to delete').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('auto')
        .setDescription('Configure automatic recurring backups')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Turn automatic backups on or off'))
        .addIntegerOption((opt) =>
          opt
            .setName('interval_hours')
            .setDescription(`How often to back up, in hours (${manager.MIN_INTERVAL_HOURS}-${manager.MAX_INTERVAL_HOURS})`)
            .setMinValue(manager.MIN_INTERVAL_HOURS)
            .setMaxValue(manager.MAX_INTERVAL_HOURS),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('keep')
            .setDescription(`How many backups to keep (${manager.MIN_KEEP}-${manager.MAX_KEEP})`)
            .setMinValue(manager.MIN_KEEP)
            .setMaxValue(manager.MAX_KEEP),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return subCreate(interaction);
    if (sub === 'list') return subList(interaction);
    if (sub === 'info') return subInfo(interaction);
    if (sub === 'restore') return subRestore(interaction);
    if (sub === 'delete') return subDelete(interaction);
    if (sub === 'auto') return subAuto(interaction);
    return null;
  },

  async autocomplete(interaction) {
    const client = interaction.client;
    const query = String(interaction.options.getFocused() ?? '').toLowerCase();
    let rows = [];
    try {
      rows = manager.listRows(client, interaction.guildId);
    } catch (err) {
      log.debug('backup: autocomplete query failed:', err?.message ?? err);
    }
    const choices = rows
      .filter((r) => !query || r.id.toLowerCase().includes(query) || (r.reason ?? '').toLowerCase().includes(query))
      .slice(0, 25)
      .map((r) => ({ name: backupLabel(r), value: r.id }));
    return interaction.respond(choices).catch(() => null);
  },
};

// ---------------------------------------------------------------------------
// /backup create
// ---------------------------------------------------------------------------

async function subCreate(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  const cdKey = `cmd:backup:create:${guild.id}:${interaction.user.id}`;
  const remaining = client.cooldowns.hit(cdKey, CREATE_COOLDOWN_SEC);
  if (remaining > 0) {
    return replyError(interaction, 'Slow down', `You can take another backup in **${formatDuration(remaining) || '1s'}**.`);
  }

  const reason = interaction.options.getString('reason') ?? null;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let id;
  try {
    id = await manager.create(client, guild, { reason, auto: false });
  } catch (err) {
    // Do not burn the cooldown on a failed backup.
    client.cooldowns.clear(cdKey);
    log.error(`backup: manual backup failed for guild ${guild.id}:`, err?.message ?? err);
    return safeReply(interaction, {
      embeds: [client.brand.error(guild, 'Backup failed', 'The snapshot could not be created. Please try again shortly.')],
    });
  }

  const snapshot = manager.getBackup(client, guild.id, id);
  const categories = snapshot ? manager.countCategories(snapshot) : 0;
  const channels = snapshot ? snapshot.channels.length - categories : 0;
  const roles = snapshot ? snapshot.roles.length : 0;
  const namespaces = snapshot ? Object.keys(snapshot.config ?? {}).length : 0;

  await client.logs
    .send(guild, 'server', {
      embeds: [
        client.brand
          .embed(guild, { color: 'info' })
          .setTitle('💾 Backup created')
          .setDescription(`Backup \`${id}\` was taken by <@${interaction.user.id}>.${reason ? `\nReason: ${truncate(reason, 200)}` : ''}`),
      ],
    })
    .catch(() => null);

  return safeReply(interaction, {
    embeds: [
      client.brand
        .success(guild, `Backup ${id} created`, 'This server has been snapshotted and can be restored with `/backup restore`.')
        .addFields(
          { name: 'Roles', value: String(roles), inline: true },
          { name: 'Channels', value: String(channels), inline: true },
          { name: 'Categories', value: String(categories), inline: true },
          { name: 'Config namespaces', value: String(namespaces), inline: true },
        ),
    ],
  });
}

// ---------------------------------------------------------------------------
// /backup list
// ---------------------------------------------------------------------------

async function subList(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const rows = manager.listRows(client, guild.id);
  if (!rows.length) {
    return safeReply(interaction, {
      embeds: [client.brand.info(guild, 'No backups yet', 'Take one with `/backup create`, or enable scheduled backups with `/backup auto`.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const chunks = chunkArray(rows, 6);
  const embeds = chunks.map((chunk, idx) =>
    client.brand
      .embed(guild)
      .setTitle('💾 Server backups')
      .setDescription(
        chunk
          .map((r) => {
            const tag = r.auto ? '🕒 auto' : '✋ manual';
            const reason = r.reason ? `\n└ ${truncate(r.reason, 120)}` : '';
            return `**\`${r.id}\`** • ${tag} • ${relativeTime(r.created_at)}\n└ 🗂️ ${r.channel_count} channels • 🎭 ${r.role_count} roles${reason}`;
          })
          .join('\n\n'),
      )
      .setFooter({ text: `${rows.length} backup(s) • page ${idx + 1}/${chunks.length}` }),
  );
  return paginate(interaction, embeds, { ephemeral: true });
}

// ---------------------------------------------------------------------------
// /backup info
// ---------------------------------------------------------------------------

async function subInfo(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const id = interaction.options.getString('id');
  const snapshot = manager.getBackup(client, guild.id, id);
  if (!snapshot) {
    return replyError(interaction, 'Backup not found', `There is no backup with id \`${truncate(id, 40)}\` in this server.`);
  }

  const categories = manager.countCategories(snapshot);
  const channels = snapshot.channels.length - categories;
  const namespaces = Object.keys(snapshot.config ?? {}).sort();

  const embed = client.brand
    .embed(guild)
    .setTitle(`💾 Backup ${snapshot.id}`)
    .setDescription(snapshot.reason ? truncate(snapshot.reason, 500) : '_No reason provided._')
    .addFields(
      { name: 'Taken', value: `${absoluteTime(snapshot.createdAt)} (${relativeTime(snapshot.createdAt)})`, inline: false },
      { name: 'Type', value: snapshot.auto ? '🕒 Automatic' : '✋ Manual', inline: true },
      { name: 'Server name', value: truncate(snapshot.meta?.name ?? 'unknown', 100), inline: true },
      { name: 'Roles', value: String(snapshot.roles.length), inline: true },
      { name: 'Channels', value: String(channels), inline: true },
      { name: 'Categories', value: String(categories), inline: true },
      {
        name: `Config namespaces (${namespaces.length})`,
        value: namespaces.length ? truncate(namespaces.map((n) => `\`${n}\``).join(', '), 1024) : '_none captured_',
        inline: false,
      },
    );

  return safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ---------------------------------------------------------------------------
// /backup restore  (owner only)
// ---------------------------------------------------------------------------

async function subRestore(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  if (!isGuildOwner(interaction.member) && !isBotOwner(interaction.user.id)) {
    return replyError(interaction, 'Owner only', 'Only the **server owner** can restore from a backup — it can rebuild roles and channels.');
  }

  const id = interaction.options.getString('id');
  const snapshot = manager.getBackup(client, guild.id, id);
  if (!snapshot) {
    return replyError(interaction, 'Backup not found', `There is no backup with id \`${truncate(id, 40)}\` in this server.`);
  }

  const categories = manager.countCategories(snapshot);
  const channels = snapshot.channels.length - categories;
  const confirmed = await confirm(interaction, {
    embed: client.brand.warn(
      guild,
      '⚠️ DANGER — Restore from backup',
      [
        `You are about to restore from backup **\`${snapshot.id}\`** taken ${relativeTime(snapshot.createdAt)}.`,
        '',
        'Restoring can **recreate roles and channels** and **overwrite SMPbot configuration** for the entire server.',
        `This backup holds **${snapshot.roles.length} roles**, **${channels} channels**, and **${categories} categories**.`,
        '',
        '**Member role assignments cannot be restored** — recreated roles start empty.',
        'Recreated roles and channels get **new IDs**; existing ones are matched by **name**.',
        '',
        'Continue to choose exactly what to restore.',
      ].join('\n'),
    ),
    confirmLabel: 'I understand — continue',
    cancelLabel: 'Cancel',
    danger: true,
  });

  if (!confirmed) {
    return interaction
      .editReply({ embeds: [client.brand.info(guild, 'Restore cancelled', 'Nothing was changed.')], components: [] })
      .catch(() => null);
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`backup:restore:${snapshot.id}`)
    .setPlaceholder('Choose what to restore…')
    .addOptions(
      {
        label: 'Config only',
        value: 'config',
        emoji: '⚙️',
        description: 'Import saved SMPbot settings — no channels or roles change.',
      },
      {
        label: 'Missing structure',
        value: 'missing',
        emoji: '➕',
        description: 'Recreate roles & channels in the backup but missing now.',
      },
      {
        label: 'Full structure',
        value: 'full',
        emoji: '🏗️',
        description: 'Recreate missing + sync existing channel topics & positions.',
      },
    );

  return interaction
    .editReply({
      embeds: [
        client.brand.info(
          guild,
          'Choose a restore scope',
          [
            '**⚙️ Config only** — safest. Reapplies SMPbot config namespaces only.',
            '**➕ Missing structure** — recreates roles/channels that no longer exist (matched by name).',
            '**🏗️ Full structure** — the above, plus updates existing channels to match the snapshot.',
          ].join('\n'),
        ),
      ],
      components: [new ActionRowBuilder().addComponents(menu)],
    })
    .catch(() => null);
}

// ---------------------------------------------------------------------------
// /backup delete
// ---------------------------------------------------------------------------

async function subDelete(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const id = interaction.options.getString('id');
  const row = manager.getRow(client, guild.id, id);
  if (!row) {
    return replyError(interaction, 'Backup not found', `There is no backup with id \`${truncate(id, 40)}\` in this server.`);
  }

  const confirmed = await confirm(interaction, {
    embed: client.brand.warn(
      guild,
      'Delete backup?',
      `This permanently deletes backup **\`${row.id}\`** (${relativeTime(row.created_at)}). This cannot be undone.`,
    ),
    confirmLabel: 'Delete backup',
    cancelLabel: 'Keep it',
    danger: true,
  });
  if (!confirmed) {
    return interaction
      .editReply({ embeds: [client.brand.info(guild, 'Deletion cancelled', `Backup \`${row.id}\` is untouched.`)], components: [] })
      .catch(() => null);
  }

  const ok = manager.deleteBackup(client, guild.id, row.id);
  return interaction
    .editReply({
      embeds: [
        ok
          ? client.brand.success(guild, 'Backup deleted', `Backup \`${row.id}\` has been removed.`)
          : client.brand.warn(guild, 'Nothing deleted', 'That backup no longer exists.'),
      ],
      components: [],
    })
    .catch(() => null);
}

// ---------------------------------------------------------------------------
// /backup auto
// ---------------------------------------------------------------------------

async function subAuto(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  const enabledOpt = interaction.options.getBoolean('enabled');
  const intervalOpt = interaction.options.getInteger('interval_hours');
  const keepOpt = interaction.options.getInteger('keep');

  const current = manager.config(client, guild.id).auto ?? manager.DEFAULTS.auto;

  // No options → show current settings.
  if (enabledOpt === null && intervalOpt === null && keepOpt === null) {
    const next = client.scheduler.pending(guild.id, manager.JOB_TYPE)[0];
    return safeReply(interaction, {
      embeds: [
        client.brand
          .info(
            guild,
            'Automatic backups',
            [
              current.enabled ? 'Automatic backups are **enabled**.' : 'Automatic backups are **disabled**.',
              '',
              'Set them up with `/backup auto enabled:True interval_hours:24 keep:10`.',
            ].join('\n'),
          )
          .addFields(
            { name: 'Interval', value: `${current.intervalHours}h`, inline: true },
            { name: 'Keep', value: `${current.keep} backups`, inline: true },
            { name: 'Next run', value: current.enabled && next ? relativeTime(next.run_at) : '—', inline: true },
          ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  const patch = { auto: {} };
  if (intervalOpt !== null) patch.auto.intervalHours = clamp(intervalOpt, manager.MIN_INTERVAL_HOURS, manager.MAX_INTERVAL_HOURS);
  if (keepOpt !== null) patch.auto.keep = clamp(keepOpt, manager.MIN_KEEP, manager.MAX_KEEP);
  if (enabledOpt !== null) patch.auto.enabled = enabledOpt;

  const updated = client.config.update(guild.id, manager.NAMESPACE, patch).auto;

  // (Re)arm or cancel the scheduler job to match the new state.
  if (updated.enabled) {
    manager.scheduleAuto(client, guild.id, updated.intervalHours);
  } else {
    manager.cancelAuto(client, guild.id);
  }

  const next = client.scheduler.pending(guild.id, manager.JOB_TYPE)[0];
  await client.logs
    .send(guild, 'server', {
      embeds: [
        client.brand
          .embed(guild, { color: 'info' })
          .setTitle('💾 Automatic backups updated')
          .setDescription(
            `${updated.enabled ? 'Enabled' : 'Disabled'} by <@${interaction.user.id}> — every **${updated.intervalHours}h**, keeping **${updated.keep}**.`,
          ),
      ],
    })
    .catch(() => null);

  return safeReply(interaction, {
    embeds: [
      client.brand
        .success(
          guild,
          'Automatic backups updated',
          updated.enabled
            ? `SMPbot will back up this server every **${updated.intervalHours}h** and keep the newest **${updated.keep}**.`
            : 'Automatic backups are now **off**. Existing backups are kept.',
        )
        .addFields(
          { name: 'Status', value: updated.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Interval', value: `${updated.intervalHours}h`, inline: true },
          { name: 'Keep', value: `${updated.keep}`, inline: true },
          { name: 'Next run', value: updated.enabled && next ? relativeTime(next.run_at) : '—', inline: true },
        ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}
