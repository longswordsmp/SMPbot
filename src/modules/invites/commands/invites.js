'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeReply, confirm, paginate, chunkArray, relativeTime, clamp } = require('../../../core/utils');
const tracker = require('../services/tracker');

const MEDALS = ['🥇', '🥈', '🥉'];
const LEADERBOARD_SIZE = 15;
const LEADERBOARD_PER_PAGE = 5;
const INFO_PER_PAGE = 12;
const MAX_BONUS = 10000;

function plural(n) {
  return Math.abs(n) === 1 ? '' : 's';
}

function requireManageGuild(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  safeReply(interaction, {
    embeds: [
      interaction.client.brand.error(
        interaction.guild,
        'Missing permissions',
        'You need **Manage Server** to use this subcommand.',
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

async function handleView(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const target = interaction.options.getUser('user') ?? interaction.user;
  const stats = tracker.getStats(client, guild.id, target.id);

  let invitedBy = 'Unknown';
  const join = tracker.latestJoin(client, guild.id, target.id);
  if (join) {
    if (join.inviter_id) invitedBy = `<@${join.inviter_id}>${join.code ? ` (\`${join.code}\`)` : ''}`;
    else if (join.code === tracker.VANITY_CODE) invitedBy = 'Vanity URL';
  }

  const embed = client.brand
    .embed(guild)
    .setTitle(`📨 Invites — ${target.displayName ?? target.username}`)
    .setDescription(`<@${target.id}> has **${stats.total}** invite${plural(stats.total)}.`)
    .addFields(
      { name: 'Regular', value: `${stats.regular}`, inline: true },
      { name: 'Bonus', value: `${stats.bonus}`, inline: true },
      { name: 'Fake', value: `${stats.fake}`, inline: true },
      { name: 'Left', value: `${stats.left}`, inline: true },
      { name: 'Total', value: `**${stats.total}**`, inline: true },
      { name: 'Invited by', value: invitedBy, inline: true },
    );
  if (target.displayAvatarURL) embed.setThumbnail(target.displayAvatarURL({ size: 128 }));
  return safeReply(interaction, { embeds: [embed] });
}

async function handleLeaderboard(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const rows = tracker.leaderboard(client, guild.id, LEADERBOARD_SIZE);
  if (!rows.length) {
    return safeReply(interaction, {
      embeds: [
        client.brand.info(
          guild,
          'No invite data yet',
          'Nobody has any tracked invites in this server yet. Invite some friends and check back!',
        ),
      ],
    });
  }

  const lines = rows.map((row, i) => {
    const rank = MEDALS[i] ?? `**#${i + 1}**`;
    return (
      `${rank} <@${row.userId}> — **${row.total}** invite${plural(row.total)}\n` +
      `> ${row.regular} regular · ${row.bonus} bonus · ${row.fake} fake · ${row.left} left`
    );
  });
  const embeds = chunkArray(lines, LEADERBOARD_PER_PAGE).map((chunk) =>
    client.brand.embed(guild).setTitle('🏆 Invite leaderboard').setDescription(chunk.join('\n\n')),
  );
  return paginate(interaction, embeds);
}

async function handleBonus(interaction, sub) {
  if (!requireManageGuild(interaction)) return null;
  const client = interaction.client;
  const guild = interaction.guild;
  const target = interaction.options.getUser('user', true);
  const rawAmount = clamp(interaction.options.getInteger('amount', true), 1, MAX_BONUS);
  const amount = sub === 'add' ? rawAmount : -rawAmount;

  const stats = tracker.addBonus(client, guild.id, target.id, amount);
  if (!stats) {
    return safeReply(interaction, {
      embeds: [client.brand.error(guild, 'Invalid amount', `The amount must be a whole number between 1 and ${MAX_BONUS}.`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  const verb = sub === 'add' ? 'Added' : 'Removed';
  const preposition = sub === 'add' ? 'to' : 'from';
  await client.logs.send(guild, 'invites', {
    embeds: [
      client.brand
        .embed(guild, { color: 'info' })
        .setTitle('🎟️ Bonus invites adjusted')
        .setDescription(
          `<@${interaction.user.id}> ${verb.toLowerCase()} **${rawAmount}** bonus invite${plural(rawAmount)} ${preposition} <@${target.id}> — they now have **${stats.total}** invite${plural(stats.total)}.`,
        ),
    ],
  });
  return safeReply(interaction, {
    embeds: [
      client.brand.success(
        guild,
        `${verb} bonus invites`,
        `${verb} **${rawAmount}** bonus invite${plural(rawAmount)} ${preposition} <@${target.id}>.\nThey now have **${stats.total}** invite${plural(stats.total)} (${stats.bonus} bonus).`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleReset(interaction) {
  if (!requireManageGuild(interaction)) return null;
  const client = interaction.client;
  const guild = interaction.guild;
  const target = interaction.options.getUser('user');

  const prompt = target
    ? client.brand.warn(
        guild,
        'Reset invites?',
        `This will permanently erase all tracked joins and bonus invites credited to <@${target.id}>. This cannot be undone.`,
      )
    : client.brand.warn(
        guild,
        'Reset ALL invite data?',
        'This will permanently erase **every** tracked join and bonus invite in this server. This cannot be undone.',
      );
  const confirmed = await confirm(interaction, { embed: prompt, confirmLabel: 'Reset', danger: true });
  if (!confirmed) {
    return safeReply(interaction, {
      embeds: [client.brand.info(guild, 'Cancelled', 'No invite data was reset.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (target) tracker.resetUser(client, guild.id, target.id);
  else tracker.resetGuild(client, guild.id);

  const what = target ? `invite stats for <@${target.id}>` : 'the invite stats of the **entire server**';
  await client.logs.send(guild, 'invites', {
    embeds: [
      client.brand
        .embed(guild, { color: 'warning' })
        .setTitle('♻️ Invites reset')
        .setDescription(`<@${interaction.user.id}> reset ${what}.`),
    ],
  });
  return safeReply(interaction, {
    embeds: [client.brand.success(guild, 'Invites reset', `Successfully reset ${what}.`)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleInfo(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const target = interaction.options.getUser('user', true);
  const { rows, count } = tracker.invitedMembers(client, guild.id, target.id);

  if (!rows.length) {
    return safeReply(interaction, {
      embeds: [client.brand.info(guild, 'No invites tracked', `<@${target.id}> has no tracked invites in this server yet.`)],
    });
  }

  const lines = rows.map((row) => {
    const status = row.fake ? '⚠️ fake' : row.left_at ? '🚪 left' : '✅ joined';
    return `${status} — <@${row.member_id}> ${relativeTime(row.joined_at)}${row.code ? ` via \`${row.code}\`` : ''}`;
  });
  const title = `📋 Members invited by ${target.displayName ?? target.username} (${count})`;
  const embeds = chunkArray(lines, INFO_PER_PAGE).map((chunk) =>
    client.brand.embed(guild).setTitle(title).setDescription(chunk.join('\n')),
  );
  if (count > rows.length) {
    embeds[embeds.length - 1].setDescription(
      `${embeds[embeds.length - 1].data.description}\n\n…and **${count - rows.length}** more.`,
    );
  }
  return paginate(interaction, embeds);
}

async function handleConfig(interaction) {
  if (!requireManageGuild(interaction)) return null;
  const client = interaction.client;
  const guild = interaction.guild;
  const fakeAgeDays = interaction.options.getInteger('fake-age-days');
  const logJoins = interaction.options.getBoolean('log-joins');

  const patch = {};
  if (fakeAgeDays !== null) patch.fakeAccountAgeDays = clamp(fakeAgeDays, 0, 365);
  if (logJoins !== null) patch.logJoins = logJoins;
  if (Object.keys(patch).length) client.config.update(guild.id, tracker.NAMESPACE, patch);

  const cfg = tracker.config(client, guild.id);
  const changed = Object.keys(patch).length > 0;
  const embed = client.brand
    .embed(guild, { color: changed ? 'success' : 'info' })
    .setTitle(changed ? '✅ Invite settings updated' : '⚙️ Invite settings')
    .addFields(
      {
        name: 'Fake account age',
        value: cfg.fakeAccountAgeDays > 0 ? `Accounts younger than **${cfg.fakeAccountAgeDays}d** count as fake` : 'Disabled',
        inline: true,
      },
      { name: 'Join log entries', value: cfg.logJoins ? 'Enabled' : 'Disabled', inline: true },
      {
        name: 'Tracking status',
        value: tracker.canTrack(guild)
          ? 'Active'
          : '⚠️ Missing **Manage Server** permission — joins cannot be attributed until it is granted.',
        inline: false,
      },
    );
  return safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Invite tracking — stats, leaderboard, and staff tools')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription("View a member's invite stats")
        .addUserOption((opt) => opt.setName('user').setDescription('Member to look up (defaults to you)')),
    )
    .addSubcommand((sub) => sub.setName('leaderboard').setDescription('Top inviters in this server'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Grant bonus invites to a member (staff)')
        .addUserOption((opt) => opt.setName('user').setDescription('Member to grant bonus invites to').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('How many bonus invites to add').setRequired(true).setMinValue(1).setMaxValue(MAX_BONUS),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove bonus invites from a member (staff)')
        .addUserOption((opt) => opt.setName('user').setDescription('Member to remove bonus invites from').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('How many bonus invites to remove').setRequired(true).setMinValue(1).setMaxValue(MAX_BONUS),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset invite stats for one member, or the entire server (staff)')
        .addUserOption((opt) => opt.setName('user').setDescription('Member to reset — leave empty to reset the ENTIRE server')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('See who a member has invited')
        .addUserOption((opt) => opt.setName('user').setDescription('Member whose invitees to list').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('View or change invite tracking settings (staff)')
        .addIntegerOption((opt) =>
          opt
            .setName('fake-age-days')
            .setDescription('Accounts younger than this many days count as fake (0 disables)')
            .setMinValue(0)
            .setMaxValue(365),
        )
        .addBooleanOption((opt) => opt.setName('log-joins').setDescription('Post join-attribution entries to the invites log')),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'leaderboard') return handleLeaderboard(interaction);
    if (sub === 'add' || sub === 'remove') return handleBonus(interaction, sub);
    if (sub === 'reset') return handleReset(interaction);
    if (sub === 'info') return handleInfo(interaction);
    if (sub === 'config') return handleConfig(interaction);
    return handleView(interaction);
  },
};
