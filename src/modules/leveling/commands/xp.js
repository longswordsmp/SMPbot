'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { safeReply, confirm, clamp } = require('../../../core/utils');
const engine = require('../services/engine');

const MAX_XP_OP = 1000000000;

function ephemeral(interaction, embed) {
  return safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
}

/** Read the merged config, mutate it, and persist the whole namespace (supports key deletion). */
function saveConfig(client, guildId, mutator) {
  const cfg = engine.config(client, guildId);
  mutator(cfg);
  client.config.set(guildId, engine.NAMESPACE, cfg);
  return cfg;
}

async function logChange(client, guild, actorId, description, color = 'info') {
  try {
    await client.logs.send(guild, engine.LOG_TYPE, {
      embeds: [
        client.brand.embed(guild, { color }).setTitle('📈 Leveling — staff action').setDescription(`<@${actorId}> ${description}`),
      ],
    });
  } catch {
    // logging must never break the command
  }
}

/** After an admin XP change, reconcile roles and (on a level-up) announce. */
async function reconcile(client, guild, interaction, target, oldLevel, newLevel) {
  const member = await guild.members.fetch(target.id).catch(() => null);
  if (member) await engine.syncMemberRoles(client, guild, member, newLevel);
  if (newLevel > oldLevel) {
    await engine.announceLevelUp(client, guild, interaction.channel, target, oldLevel, newLevel);
  }
}

async function handleAdjust(interaction, sub) {
  const client = interaction.client;
  const guild = interaction.guild;
  const target = interaction.options.getUser('user', true);
  if (target.bot) {
    return ephemeral(interaction, client.brand.error(guild, 'Not allowed', 'Bots do not have XP.'));
  }
  const amount = clamp(interaction.options.getInteger('amount', true), sub === 'set' ? 0 : 1, MAX_XP_OP);

  let result;
  if (sub === 'add') result = engine.addXp(client, guild.id, target.id, amount);
  else if (sub === 'remove') result = engine.addXp(client, guild.id, target.id, -amount);
  else {
    const before = engine.getProfile(client, guild.id, target.id);
    const profile = engine.setXp(client, guild.id, target.id, amount);
    result = { oldXp: before.totalXp, newXp: profile.totalXp, oldLevel: before.level, newLevel: profile.level, profile };
  }
  if (!result) {
    return ephemeral(interaction, client.brand.error(guild, 'Failed', 'Could not update that user’s XP.'));
  }

  await reconcile(client, guild, interaction, target, result.oldLevel, result.newLevel);

  const verb = sub === 'add' ? `Added **${amount.toLocaleString('en-US')}** XP to` : sub === 'remove' ? `Removed **${amount.toLocaleString('en-US')}** XP from` : `Set`;
  const tail =
    sub === 'set'
      ? `<@${target.id}>’s XP to **${result.newXp.toLocaleString('en-US')}**`
      : `<@${target.id}>`;
  await logChange(client, guild, interaction.user.id, `${verb.toLowerCase()} ${tail} (now level ${result.newLevel}).`);

  return ephemeral(
    interaction,
    client.brand.success(
      guild,
      'XP updated',
      `${verb} ${tail}.\nThey are now **level ${result.newLevel}** with **${result.newXp.toLocaleString('en-US')}** total XP.`,
    ),
  );
}

async function handleResetUser(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const target = interaction.options.getUser('user', true);

  const confirmed = await confirm(interaction, {
    embed: client.brand.warn(
      guild,
      'Reset this member’s XP?',
      `This will permanently erase all XP and level progress for <@${target.id}>. This cannot be undone.`,
    ),
    confirmLabel: 'Reset',
    danger: true,
  });
  if (!confirmed) {
    return safeReply(interaction, {
      embeds: [client.brand.info(guild, 'Cancelled', 'No XP data was reset.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  engine.resetUser(client, guild.id, target.id);
  await logChange(client, guild, interaction.user.id, `reset all XP for <@${target.id}>.`, 'warning');
  return safeReply(interaction, {
    embeds: [client.brand.success(guild, 'User reset', `All XP and level progress for <@${target.id}> has been erased.`)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleResetServer(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const confirmed = await confirm(interaction, {
    embed: client.brand.warn(
      guild,
      'Reset ALL XP?',
      'This will permanently erase **every** member’s XP and level progress in this server. This cannot be undone.',
    ),
    confirmLabel: 'Reset everything',
    danger: true,
  });
  if (!confirmed) {
    return safeReply(interaction, {
      embeds: [client.brand.info(guild, 'Cancelled', 'No XP data was reset.')],
      flags: MessageFlags.Ephemeral,
    });
  }
  engine.resetGuild(client, guild.id);
  await logChange(client, guild, interaction.user.id, 'reset the XP of the **entire server**.', 'warning');
  return safeReply(interaction, {
    embeds: [client.brand.success(guild, 'Server reset', 'Every member’s XP has been erased.')],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleMultiplierSet(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const role = interaction.options.getRole('role', true);
  const value = clamp(interaction.options.getNumber('multiplier', true), 0.1, engine.LIMITS.multiplier[1]);
  const rounded = Math.round(value * 100) / 100;

  if (role.id === guild.id) {
    return ephemeral(interaction, client.brand.error(guild, 'Invalid role', 'You cannot set a multiplier on `@everyone`.'));
  }

  saveConfig(client, guild.id, (c) => {
    c.roleMultipliers = { ...(c.roleMultipliers || {}), [role.id]: rounded };
    const entries = Object.entries(c.roleMultipliers);
    if (entries.length > engine.LIMITS.maxRoleMultipliers) {
      c.roleMultipliers = Object.fromEntries(entries.slice(-engine.LIMITS.maxRoleMultipliers));
    }
  });
  await logChange(client, guild, interaction.user.id, `set the XP multiplier for <@&${role.id}> to **×${rounded}**.`);
  return ephemeral(
    interaction,
    client.brand.success(
      guild,
      'Multiplier set',
      `Members with <@&${role.id}> now earn **×${rounded}** XP. Multipliers do not stack — the highest applicable one is used.`,
    ),
  );
}

async function handleMultiplierClear(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const role = interaction.options.getRole('role', true);
  const had = Boolean(engine.config(client, guild.id).roleMultipliers?.[role.id]);
  if (!had) {
    return ephemeral(interaction, client.brand.info(guild, 'Nothing to clear', `<@&${role.id}> has no XP multiplier configured.`));
  }
  saveConfig(client, guild.id, (c) => {
    const map = { ...(c.roleMultipliers || {}) };
    delete map[role.id];
    c.roleMultipliers = map;
  });
  await logChange(client, guild, interaction.user.id, `cleared the XP multiplier for <@&${role.id}>.`);
  return ephemeral(interaction, client.brand.success(guild, 'Multiplier cleared', `<@&${role.id}> no longer has a special XP multiplier.`));
}

async function handleNoXp(interaction, kind) {
  const client = interaction.client;
  const guild = interaction.guild;
  const action = interaction.options.getString('action', true);
  const key = kind === 'channel' ? 'noXpChannels' : 'noXpRoles';
  const label = kind === 'channel' ? 'channel' : 'role';
  const entity = kind === 'channel' ? interaction.options.getChannel('channel', true) : interaction.options.getRole('role', true);
  const mention = kind === 'channel' ? `<#${entity.id}>` : `<@&${entity.id}>`;

  let changed = false;
  saveConfig(client, guild.id, (c) => {
    const list = Array.isArray(c[key]) ? [...c[key]] : [];
    const has = list.includes(entity.id);
    if (action === 'add' && !has) {
      if (list.length < engine.LIMITS.maxNoXpEntries) {
        list.push(entity.id);
        changed = true;
      }
    } else if (action === 'remove' && has) {
      c[key] = list.filter((id) => id !== entity.id);
      changed = true;
      return;
    }
    c[key] = list;
  });

  if (!changed) {
    const msg =
      action === 'add'
        ? `${mention} is already on the no-XP ${label} list (or the list is full).`
        : `${mention} was not on the no-XP ${label} list.`;
    return ephemeral(interaction, client.brand.info(guild, 'No change', msg));
  }
  const verb = action === 'add' ? 'added to' : 'removed from';
  await logChange(client, guild, interaction.user.id, `${action === 'add' ? 'added' : 'removed'} ${mention} ${action === 'add' ? 'to' : 'from'} the no-XP ${label} list.`);
  return ephemeral(interaction, client.brand.success(guild, 'No-XP list updated', `${mention} was ${verb} the no-XP ${label} list.`));
}

async function handleConfig(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  const cooldown = interaction.options.getInteger('cooldown');
  const minXp = interaction.options.getInteger('min-xp');
  const maxXp = interaction.options.getInteger('max-xp');
  const dailyCap = interaction.options.getInteger('daily-cap');
  const minLength = interaction.options.getInteger('min-length');
  const booster = interaction.options.getNumber('booster-multiplier');
  const enabled = interaction.options.getBoolean('enabled');
  const announceEnabled = interaction.options.getBoolean('announce-enabled');
  const announceChannel = interaction.options.getChannel('announce-channel');

  const current = engine.config(client, guild.id);
  // Validate min/max coherence against whatever the effective values will be.
  const effectiveMin = minXp !== null ? clamp(minXp, ...engine.LIMITS.perMessageXp) : current.minXp;
  const effectiveMax = maxXp !== null ? clamp(maxXp, ...engine.LIMITS.perMessageXp) : current.maxXp;
  if (effectiveMin > effectiveMax) {
    return ephemeral(
      interaction,
      client.brand.error(
        guild,
        'Invalid XP range',
        `The minimum XP (**${effectiveMin}**) cannot be greater than the maximum XP (**${effectiveMax}**).`,
      ),
    );
  }

  const cfg = saveConfig(client, guild.id, (c) => {
    if (cooldown !== null) c.cooldownSeconds = clamp(cooldown, ...engine.LIMITS.cooldownSeconds);
    if (minXp !== null) c.minXp = clamp(minXp, ...engine.LIMITS.perMessageXp);
    if (maxXp !== null) c.maxXp = clamp(maxXp, ...engine.LIMITS.perMessageXp);
    if (dailyCap !== null) c.dailyCap = clamp(dailyCap, ...engine.LIMITS.dailyCap);
    if (minLength !== null) c.minMessageLength = clamp(minLength, ...engine.LIMITS.minMessageLength);
    if (booster !== null) c.boosterMultiplier = Math.round(clamp(booster, 0, engine.LIMITS.multiplier[1]) * 100) / 100;
    if (enabled !== null) c.enabled = enabled;
    if (!c.announce || typeof c.announce !== 'object') c.announce = { enabled: true, channelId: null };
    if (announceEnabled !== null) c.announce.enabled = announceEnabled;
    if (announceChannel !== null) c.announce.channelId = announceChannel.id;
  });

  const anyChange =
    [cooldown, minXp, maxXp, dailyCap, minLength, booster, enabled, announceEnabled].some((v) => v !== null) ||
    announceChannel !== null;
  if (anyChange) await logChange(client, guild, interaction.user.id, 'updated the leveling settings.');

  const embed = client.brand
    .embed(guild, { color: anyChange ? 'success' : 'info' })
    .setTitle(anyChange ? '✅ Leveling settings updated' : '⚙️ Leveling settings')
    .addFields(
      { name: 'Enabled', value: cfg.enabled ? 'Yes' : 'No', inline: true },
      { name: 'XP per message', value: `${cfg.minXp}–${cfg.maxXp}`, inline: true },
      { name: 'Cooldown', value: `${cfg.cooldownSeconds}s`, inline: true },
      { name: 'Daily cap', value: cfg.dailyCap > 0 ? `${cfg.dailyCap.toLocaleString('en-US')} XP` : 'Disabled', inline: true },
      { name: 'Min message length', value: `${cfg.minMessageLength}`, inline: true },
      { name: 'Booster multiplier', value: cfg.boosterMultiplier > 0 ? `×${cfg.boosterMultiplier}` : 'Disabled', inline: true },
      {
        name: 'Level-up announcements',
        value: cfg.announce?.enabled
          ? cfg.announce?.channelId
            ? `<#${cfg.announce.channelId}>`
            : 'In the level-up channel'
          : 'Disabled',
        inline: true,
      },
      {
        name: 'No-XP channels',
        value: cfg.noXpChannels?.length ? cfg.noXpChannels.slice(0, 15).map((id) => `<#${id}>`).join(' ') : 'None',
        inline: false,
      },
      {
        name: 'No-XP roles',
        value: cfg.noXpRoles?.length ? cfg.noXpRoles.slice(0, 15).map((id) => `<@&${id}>`).join(' ') : 'None',
        inline: false,
      },
    );
  return ephemeral(interaction, embed);
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manage member XP and leveling settings (staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add XP to a member')
        .addUserOption((o) => o.setName('user').setDescription('Member to grant XP to').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('XP to add').setRequired(true).setMinValue(1).setMaxValue(MAX_XP_OP)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove XP from a member')
        .addUserOption((o) => o.setName('user').setDescription('Member to remove XP from').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('XP to remove').setRequired(true).setMinValue(1).setMaxValue(MAX_XP_OP)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription("Set a member's total XP")
        .addUserOption((o) => o.setName('user').setDescription('Member to update').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('New total XP').setRequired(true).setMinValue(0).setMaxValue(MAX_XP_OP)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('resetuser')
        .setDescription("Erase a member's XP and level progress")
        .addUserOption((o) => o.setName('user').setDescription('Member to reset').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('resetserver').setDescription('Erase the XP of every member in this server'))
    .addSubcommand((sub) =>
      sub
        .setName('multiplier-set')
        .setDescription('Give a role an XP multiplier')
        .addRoleOption((o) => o.setName('role').setDescription('Role that receives the multiplier').setRequired(true))
        .addNumberOption((o) =>
          o.setName('multiplier').setDescription('Multiplier, e.g. 2 for double XP').setRequired(true).setMinValue(0.1).setMaxValue(engine.LIMITS.multiplier[1]),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('multiplier-clear')
        .setDescription('Remove a role’s XP multiplier')
        .addRoleOption((o) => o.setName('role').setDescription('Role whose multiplier to clear').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('noxp-channel')
        .setDescription('Add or remove a channel where no XP is earned')
        .addStringOption((o) =>
          o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }),
        )
        .addChannelOption((o) => o.setName('channel').setDescription('Channel (or category) to toggle').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('noxp-role')
        .setDescription('Add or remove a role whose members earn no XP')
        .addStringOption((o) =>
          o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }),
        )
        .addRoleOption((o) => o.setName('role').setDescription('Role to toggle').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('View or change leveling settings')
        .addIntegerOption((o) => o.setName('cooldown').setDescription('Seconds between XP grants per member').setMinValue(0).setMaxValue(engine.LIMITS.cooldownSeconds[1]))
        .addIntegerOption((o) => o.setName('min-xp').setDescription('Minimum XP per message').setMinValue(0).setMaxValue(engine.LIMITS.perMessageXp[1]))
        .addIntegerOption((o) => o.setName('max-xp').setDescription('Maximum XP per message').setMinValue(0).setMaxValue(engine.LIMITS.perMessageXp[1]))
        .addIntegerOption((o) => o.setName('daily-cap').setDescription('Max XP per UTC day (0 disables)').setMinValue(0).setMaxValue(engine.LIMITS.dailyCap[1]))
        .addIntegerOption((o) => o.setName('min-length').setDescription('Ignore messages shorter than this (chars)').setMinValue(0).setMaxValue(engine.LIMITS.minMessageLength[1]))
        .addNumberOption((o) => o.setName('booster-multiplier').setDescription('XP multiplier for boosters (0 disables)').setMinValue(0).setMaxValue(engine.LIMITS.multiplier[1]))
        .addBooleanOption((o) => o.setName('enabled').setDescription('Turn the whole leveling system on or off'))
        .addBooleanOption((o) => o.setName('announce-enabled').setDescription('Announce level-ups'))
        .addChannelOption((o) =>
          o
            .setName('announce-channel')
            .setDescription('Channel for level-up announcements')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add' || sub === 'remove' || sub === 'set') return handleAdjust(interaction, sub);
    if (sub === 'resetuser') return handleResetUser(interaction);
    if (sub === 'resetserver') return handleResetServer(interaction);
    if (sub === 'multiplier-set') return handleMultiplierSet(interaction);
    if (sub === 'multiplier-clear') return handleMultiplierClear(interaction);
    if (sub === 'noxp-channel') return handleNoXp(interaction, 'channel');
    if (sub === 'noxp-role') return handleNoXp(interaction, 'role');
    return handleConfig(interaction);
  },
};
