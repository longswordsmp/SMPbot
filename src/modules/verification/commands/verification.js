'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { clamp, truncate } = require('../../../core/utils');
const { config, resolveChannel, LIMITS, NAMESPACE } = require('../services/config');
const verify = require('../services/verify');
const wizard = require('../services/wizard');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('verification')
    .setDescription('Configure member verification for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('setup').setDescription('Guided setup — roles, channel, mode, and publish the panel'))
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Publish or re-publish the verification panel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post the panel in (default: the configured channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) => sub.setName('config').setDescription('View the current verification configuration'))
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable verification'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable verification'))
    .addSubcommand((sub) => sub.setName('stats').setDescription('Verification stats (verified members in the last 30 days)'))
    .addSubcommandGroup((group) =>
      group
        .setName('set')
        .setDescription('Change individual verification settings')
        .addSubcommand((sub) =>
          sub
            .setName('account-age')
            .setDescription('Minimum Discord account age required to verify')
            .addIntegerOption((opt) =>
              opt.setName('days').setDescription('Account age in days (0 = off)').setRequired(true).setMinValue(0).setMaxValue(LIMITS.minAccountAgeDaysMax),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('cooldown')
            .setDescription('Per-user cooldown between verify attempts')
            .addIntegerOption((opt) =>
              opt.setName('seconds').setDescription('Cooldown in seconds (0 = none)').setRequired(true).setMinValue(0).setMaxValue(LIMITS.cooldownSecondsMax),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('autokick')
            .setDescription('Auto-kick members who never verify')
            .addIntegerOption((opt) =>
              opt.setName('hours').setDescription('Hours before an unverified member is kicked (0 = off)').setRequired(true).setMinValue(0).setMaxValue(LIMITS.autoKickHoursMax),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('mode')
            .setDescription('How members verify')
            .addStringOption((opt) =>
              opt
                .setName('mode')
                .setDescription('Verification mode')
                .setRequired(true)
                .addChoices({ name: '✅ Button (instant)', value: 'button' }, { name: '🧩 Captcha (solve a code)', value: 'captcha' }),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('dm')
            .setDescription('Direct-message members when they verify')
            .addBooleanOption((opt) => opt.setName('enabled').setDescription('Send a DM on successful verification').setRequired(true))
            .addStringOption((opt) => opt.setName('message').setDescription('DM text — {server}, {username}, {user}, {membercount}').setMaxLength(LIMITS.dmMax)),
        ),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (group === 'set') return handleSet(interaction, sub);

    if (sub === 'setup') {
      return interaction.reply(eph(wizard.stepVerified(client, guild)));
    }

    if (sub === 'panel') {
      const cfg = config(client, guild.id);
      const channel = interaction.options.getChannel('channel') ?? (await resolveChannel(guild, cfg.channelId)) ?? interaction.channel;
      if (!channel?.isTextBased?.() || channel.guildId !== guild.id) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Invalid channel', 'Pick a text channel in this server, or run `/verification setup` first.')] }));
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await verify.publishPanel(client, guild, channel);
      return interaction.editReply({
        embeds: [
          res.ok
            ? client.brand.success(guild, 'Panel published', `The verification panel is live in <#${channel.id}>. Its Verify button survives restarts.`)
            : client.brand.error(guild, 'Publish failed', res.error),
        ],
      });
    }

    if (sub === 'config') {
      const cfg = config(client, guild.id);
      const roleTxt = (id) => (id ? `<@&${id}>` : '*not set*');
      const chanTxt = (id) => (id ? `<#${id}>` : '*not set*');
      const embed = client.brand
        .embed(guild, { color: 'info' })
        .setTitle('🔐 Verification configuration')
        .setDescription(cfg.enabled ? '**Status:** ✅ Enabled' : '**Status:** ⛔ Disabled')
        .addFields(
          { name: 'Mode', value: wizard.modeLabel(cfg.mode), inline: true },
          { name: 'Channel', value: chanTxt(cfg.channelId), inline: true },
          { name: 'Panel', value: cfg.panelMessageId ? `Published in ${chanTxt(cfg.panelChannelId)}` : '*not published*', inline: true },
          { name: 'Verified role', value: roleTxt(cfg.verifiedRoleId), inline: true },
          { name: 'Unverified role', value: roleTxt(cfg.unverifiedRoleId), inline: true },
          { name: 'Min account age', value: cfg.minAccountAgeDays > 0 ? `${cfg.minAccountAgeDays} day(s)` : 'Off', inline: true },
          { name: 'Attempt cooldown', value: cfg.cooldownSeconds > 0 ? `${cfg.cooldownSeconds}s` : 'None', inline: true },
          { name: 'Auto-kick unverified', value: cfg.autoKickUnverifiedHours > 0 ? `${cfg.autoKickUnverifiedHours} hour(s)` : 'Off', inline: true },
          { name: 'Verify DM', value: cfg.dm?.enabled ? '✅ On' : '⛔ Off', inline: true },
        );
      if (cfg.dm?.enabled && cfg.dm?.message) {
        embed.addFields({ name: 'DM message', value: truncate(cfg.dm.message, 1024) });
      }
      return interaction.reply(eph({ embeds: [embed] }));
    }

    if (sub === 'enable') {
      const cfg = config(client, guild.id);
      if (!cfg.verifiedRoleId) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Cannot enable yet', 'Set a verified role first — run `/verification setup`.')] }));
      }
      client.config.update(guild.id, NAMESPACE, { enabled: true });
      return interaction.reply(eph({ embeds: [client.brand.success(guild, 'Verification enabled', 'New members will now be gated behind verification.')] }));
    }

    if (sub === 'disable') {
      client.config.update(guild.id, NAMESPACE, { enabled: false });
      return interaction.reply(eph({ embeds: [client.brand.success(guild, 'Verification disabled', 'Verification is now off. The published panel (if any) still exists — re-enable any time with `/verification enable`.')] }));
    }

    if (sub === 'stats') {
      const cutoff = Date.now() - 30 * DAY_MS;
      const last30 = client.db.get('SELECT COUNT(*) AS c FROM verification_log WHERE guild_id = ? AND verified_at >= ?', guild.id, cutoff)?.c ?? 0;
      const total = client.db.get('SELECT COUNT(*) AS c FROM verification_log WHERE guild_id = ?', guild.id)?.c ?? 0;
      const byCaptcha = client.db.get('SELECT COUNT(*) AS c FROM verification_log WHERE guild_id = ? AND mode = ? AND verified_at >= ?', guild.id, 'captcha', cutoff)?.c ?? 0;
      const byButton = Math.max(0, last30 - byCaptcha);
      const pending = client.db.get('SELECT COUNT(*) AS c FROM verification_pending WHERE guild_id = ?', guild.id)?.c ?? 0;
      const embed = client.brand
        .embed(guild, { color: 'primary' })
        .setTitle('📊 Verification stats')
        .addFields(
          { name: 'Verified (30 days)', value: `**${last30}**`, inline: true },
          { name: 'Verified (all time)', value: `**${total}**`, inline: true },
          { name: 'Pending captchas', value: `**${pending}**`, inline: true },
          { name: 'Via button (30d)', value: `${byButton}`, inline: true },
          { name: 'Via captcha (30d)', value: `${byCaptcha}`, inline: true },
        );
      return interaction.reply(eph({ embeds: [embed] }));
    }

    return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Unknown option', 'That subcommand is not available.')] }));
  },
};

async function handleSet(interaction, sub) {
  const client = interaction.client;
  const guild = interaction.guild;

  if (sub === 'account-age') {
    const days = clamp(interaction.options.getInteger('days') ?? 0, 0, LIMITS.minAccountAgeDaysMax);
    client.config.update(guild.id, NAMESPACE, { minAccountAgeDays: days });
    return interaction.reply(
      eph({
        embeds: [
          client.brand.success(
            guild,
            'Account-age gate updated',
            days > 0 ? `Members must have an account at least **${days} day(s)** old to verify.` : 'The account-age requirement is now **off**.',
          ),
        ],
      }),
    );
  }

  if (sub === 'cooldown') {
    const seconds = clamp(interaction.options.getInteger('seconds') ?? 0, 0, LIMITS.cooldownSecondsMax);
    client.config.update(guild.id, NAMESPACE, { cooldownSeconds: seconds });
    return interaction.reply(
      eph({
        embeds: [
          client.brand.success(
            guild,
            'Cooldown updated',
            seconds > 0 ? `Members must wait **${seconds}s** between verify attempts.` : 'The per-attempt cooldown is now **off**.',
          ),
        ],
      }),
    );
  }

  if (sub === 'autokick') {
    const hours = clamp(interaction.options.getInteger('hours') ?? 0, 0, LIMITS.autoKickHoursMax);
    client.config.update(guild.id, NAMESPACE, { autoKickUnverifiedHours: hours });
    const note =
      hours > 0
        ? `Members who do not verify within **${hours} hour(s)** of joining will be kicked. This applies to members who join from now on.`
        : 'Auto-kick of unverified members is now **off**. Already-scheduled kicks will not fire.';
    if (hours > 0 && !guild.members.me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply(
        eph({ embeds: [client.brand.warn(guild, 'Auto-kick set — but I lack Kick Members', `${note}\n\n⚠️ I currently do **not** have the **Kick Members** permission, so kicks will be skipped until you grant it.`)] }),
      );
    }
    return interaction.reply(eph({ embeds: [client.brand.success(guild, 'Auto-kick updated', note)] }));
  }

  if (sub === 'mode') {
    const mode = interaction.options.getString('mode');
    client.config.update(guild.id, NAMESPACE, { mode });
    const captchaNote = mode === 'captcha' && !require('../services/captcha').isAvailable() ? '\n\n⚠️ Image rendering is unavailable on this host, so members will get a text code fallback.' : '';
    return interaction.reply(
      eph({ embeds: [client.brand.success(guild, 'Mode updated', `Members now verify with **${wizard.modeLabel(mode)}**. Re-publish the panel with \`/verification panel\` so its instructions match.${captchaNote}`)] }),
    );
  }

  if (sub === 'dm') {
    const enabled = interaction.options.getBoolean('enabled');
    const message = interaction.options.getString('message')?.trim();
    const patch = { dm: { enabled } };
    if (message) patch.dm.message = truncate(message, LIMITS.dmMax);
    client.config.update(guild.id, NAMESPACE, patch);
    return interaction.reply(
      eph({
        embeds: [
          client.brand.success(
            guild,
            'Verify DM updated',
            enabled ? 'Members will receive a DM when they verify. Placeholders: `{server}`, `{username}`, `{user}`, `{membercount}`.' : 'Verify DMs are now **off**.',
          ),
        ],
      }),
    );
  }

  return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Unknown option', 'That setting is not available.')] }));
}
