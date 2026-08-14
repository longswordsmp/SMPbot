'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { truncate, safeReply } = require('../../../core/utils');
const { NAMESPACE, DEFAULTS, LIMITS, config } = require('../services/config');
const render = require('../services/render');
const banner = require('../services/banner');

const WELCOME_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

const PLACEHOLDER_HELP =
  '`{user}` `{username}` `{server}` `{membercount}` `{userid}` `{level}` `{invites}`';

function reply(interaction, embed) {
  return safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
}
function ok(interaction, title, desc) {
  return reply(interaction, interaction.client.brand.success(interaction.guild, title, desc));
}
function bad(interaction, title, desc) {
  return reply(interaction, interaction.client.brand.error(interaction.guild, title, desc));
}

/** Validate an http(s) URL and bound its length. Returns the trimmed URL or null. */
function validUrl(raw) {
  const url = String(raw ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(url) || url.length > LIMITS.urlMax) return null;
  return url;
}

function textInput(id, label, style, value, { required = true, maxLength } = {}) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required);
  if (maxLength) input.setMaxLength(maxLength);
  if (value) input.setValue(truncate(String(value), maxLength ?? 4000));
  return new ActionRowBuilder().addComponents(input);
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome & leave messages, auto-roles, banners, and DMs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('status').setDescription('Show the current welcome & leave configuration'))
    .addSubcommand((s) => s.setName('test').setDescription('Preview the welcome message as if you just joined'))
    .addSubcommand((s) =>
      s
        .setName('toggle')
        .setDescription('Enable or disable welcome messages')
        .addBooleanOption((o) => o.setName('on').setDescription('Turn welcome messages on or off').setRequired(true)),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('channel')
        .setDescription('Set or clear the welcome channel')
        .addSubcommand((s) =>
          s
            .setName('set')
            .setDescription('Set the channel welcome messages are posted in')
            .addChannelOption((o) =>
              o
                .setName('channel')
                .setDescription('Text or announcement channel')
                .setRequired(true)
                .addChannelTypes(...WELCOME_CHANNEL_TYPES),
            ),
        )
        .addSubcommand((s) => s.setName('clear').setDescription('Clear the welcome channel')),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('message')
        .setDescription('Edit the welcome message content, image, and banner')
        .addSubcommand((s) => s.setName('edit').setDescription('Edit the welcome title & description (opens a form)'))
        .addSubcommand((s) =>
          s
            .setName('image')
            .setDescription('Set a custom image URL shown on the welcome embed')
            .addStringOption((o) => o.setName('url').setDescription('Direct image URL (https://…)').setRequired(true)),
        )
        .addSubcommand((s) => s.setName('image-clear').setDescription('Remove the custom welcome image'))
        .addSubcommand((s) =>
          s
            .setName('banner')
            .setDescription('Toggle the generated welcome banner image')
            .addBooleanOption((o) => o.setName('on').setDescription('Turn the banner on or off').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('server-icon')
            .setDescription('Show the server icon on the welcome embed')
            .addBooleanOption((o) => o.setName('on').setDescription('Show or hide the server icon').setRequired(true)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('dm')
        .setDescription('Configure the optional welcome DM')
        .addSubcommand((s) =>
          s
            .setName('toggle')
            .setDescription('Enable or disable the welcome DM')
            .addBooleanOption((o) => o.setName('on').setDescription('Turn the welcome DM on or off').setRequired(true)),
        )
        .addSubcommand((s) => s.setName('edit').setDescription('Edit the welcome DM message (opens a form)')),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('autoroles')
        .setDescription('Roles automatically granted to members on join')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add an auto-role')
            .addRoleOption((o) => o.setName('role').setDescription('Role to grant on join').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove an auto-role')
            .addRoleOption((o) => o.setName('role').setDescription('Role to stop granting').setRequired(true)),
        )
        .addSubcommand((s) => s.setName('list').setDescription('List the configured auto-roles'))
        .addSubcommand((s) =>
          s
            .setName('skip-bots')
            .setDescription('Whether bots should be skipped when assigning auto-roles')
            .addBooleanOption((o) => o.setName('on').setDescription('Skip bots (recommended)').setRequired(true)),
        ),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('buttons')
        .setDescription('Link buttons shown under the welcome message (e.g. Rules / Website)')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Add a link button')
            .addStringOption((o) => o.setName('label').setDescription('Button label').setRequired(true).setMaxLength(LIMITS.labelMax))
            .addStringOption((o) => o.setName('url').setDescription('Button URL (https://…)').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Remove a link button by its position')
            .addIntegerOption((o) => o.setName('position').setDescription('Button number from /welcome buttons list').setRequired(true).setMinValue(1).setMaxValue(LIMITS.maxButtons)),
        )
        .addSubcommand((s) => s.setName('list').setDescription('List the configured link buttons')),
    )
    .addSubcommandGroup((g) =>
      g
        .setName('leave')
        .setDescription('Configure the leave (goodbye) message')
        .addSubcommand((s) =>
          s
            .setName('toggle')
            .setDescription('Enable or disable leave messages')
            .addBooleanOption((o) => o.setName('on').setDescription('Turn leave messages on or off').setRequired(true)),
        )
        .addSubcommand((s) =>
          s
            .setName('channel')
            .setDescription('Set the channel leave messages are posted in')
            .addChannelOption((o) =>
              o
                .setName('channel')
                .setDescription('Text or announcement channel')
                .setRequired(true)
                .addChannelTypes(...WELCOME_CHANNEL_TYPES),
            ),
        )
        .addSubcommand((s) => s.setName('channel-clear').setDescription('Clear the leave channel'))
        .addSubcommand((s) => s.setName('edit').setDescription('Edit the leave title & description (opens a form)')),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const cfg = config(client, guild.id);

    // ---- Modal-opening subcommands MUST be the first response (no defer/reply first).
    if (group === 'message' && sub === 'edit') {
      const modal = new ModalBuilder()
        .setCustomId('welcome:msgmodal')
        .setTitle('Welcome message')
        .addComponents(
          textInput('title', 'Title', TextInputStyle.Short, cfg.title || DEFAULTS.title, { maxLength: LIMITS.titleMax }),
          textInput('description', 'Description', TextInputStyle.Paragraph, cfg.description || DEFAULTS.description, { maxLength: LIMITS.descriptionMax }),
        );
      return interaction.showModal(modal);
    }
    if (group === 'dm' && sub === 'edit') {
      const modal = new ModalBuilder()
        .setCustomId('welcome:dmmodal')
        .setTitle('Welcome DM')
        .addComponents(textInput('message', 'DM message', TextInputStyle.Paragraph, cfg.dm?.message || DEFAULTS.dm.message, { maxLength: LIMITS.dmMax }));
      return interaction.showModal(modal);
    }
    if (group === 'leave' && sub === 'edit') {
      const modal = new ModalBuilder()
        .setCustomId('welcome:leavemodal')
        .setTitle('Leave message')
        .addComponents(
          textInput('title', 'Title', TextInputStyle.Short, cfg.leave?.title || DEFAULTS.leave.title, { maxLength: LIMITS.titleMax }),
          textInput('description', 'Description', TextInputStyle.Paragraph, cfg.leave?.description || DEFAULTS.leave.description, { maxLength: LIMITS.descriptionMax }),
        );
      return interaction.showModal(modal);
    }

    // ---- Top-level subcommands.
    if (!group) {
      if (sub === 'status') return subStatus(interaction, cfg);
      if (sub === 'test') return subTest(interaction, cfg);
      if (sub === 'toggle') {
        const on = interaction.options.getBoolean('on', true);
        client.config.update(guild.id, NAMESPACE, { enabled: on });
        if (on && !cfg.channelId) {
          return ok(
            interaction,
            'Welcome messages enabled',
            'No welcome channel is set yet — configure one with `/welcome channel set`.',
          );
        }
        return ok(interaction, `Welcome messages ${on ? 'enabled' : 'disabled'}`, `Welcome messages are now **${on ? 'on' : 'off'}**.`);
      }
      return null;
    }

    // ---- channel group.
    if (group === 'channel') {
      if (sub === 'set') {
        const channel = interaction.options.getChannel('channel', true);
        if (!WELCOME_CHANNEL_TYPES.includes(channel.type)) {
          return bad(interaction, 'Invalid channel', 'Pick a text or announcement channel.');
        }
        client.config.update(guild.id, NAMESPACE, { channelId: channel.id, enabled: true });
        return ok(interaction, 'Welcome channel set', `Welcome messages will be posted in ${channel} and are now **enabled**.`);
      }
      if (sub === 'clear') {
        client.config.update(guild.id, NAMESPACE, { channelId: null });
        return ok(interaction, 'Welcome channel cleared', 'No welcome channel is configured. Set one with `/welcome channel set`.');
      }
      return null;
    }

    // ---- message group (non-modal parts).
    if (group === 'message') {
      if (sub === 'image') {
        const url = validUrl(interaction.options.getString('url', true));
        if (!url) return bad(interaction, 'Invalid image URL', `Provide a valid \`https://\` image URL (max ${LIMITS.urlMax} characters).`);
        client.config.update(guild.id, NAMESPACE, { imageUrl: url });
        const note = cfg.banner ? '\n\n⚠️ The generated banner is on and takes the image slot — disable it with `/welcome message banner on:False` to show this image.' : '';
        return ok(interaction, 'Welcome image set', `The welcome embed will show that image.${note}`);
      }
      if (sub === 'image-clear') {
        client.config.update(guild.id, NAMESPACE, { imageUrl: null });
        return ok(interaction, 'Welcome image cleared', 'The custom welcome image was removed.');
      }
      if (sub === 'banner') {
        const on = interaction.options.getBoolean('on', true);
        client.config.update(guild.id, NAMESPACE, { banner: on });
        if (on && !banner.isAvailable()) {
          return reply(
            interaction,
            client.brand.warn(
              guild,
              'Banner enabled (renderer unavailable)',
              'The banner is enabled, but the image renderer is not available on this host right now, so the welcome will fall back to the custom image (if any). It will start working automatically once the renderer is available.',
            ),
          );
        }
        return ok(interaction, `Welcome banner ${on ? 'enabled' : 'disabled'}`, `The generated welcome banner is now **${on ? 'on' : 'off'}**.`);
      }
      if (sub === 'server-icon') {
        const on = interaction.options.getBoolean('on', true);
        client.config.update(guild.id, NAMESPACE, { serverIcon: on });
        return ok(interaction, 'Server icon updated', `The server icon will ${on ? 'now' : 'no longer'} appear on the welcome embed.`);
      }
      return null;
    }

    // ---- dm group (toggle only; edit handled above).
    if (group === 'dm') {
      if (sub === 'toggle') {
        const on = interaction.options.getBoolean('on', true);
        client.config.update(guild.id, NAMESPACE, { dm: { enabled: on } });
        return ok(interaction, `Welcome DM ${on ? 'enabled' : 'disabled'}`, `New members will ${on ? 'now receive' : 'no longer receive'} a welcome DM.`);
      }
      return null;
    }

    // ---- autoroles group.
    if (group === 'autoroles') {
      const current = Array.isArray(cfg.autoroles) ? [...cfg.autoroles] : [];

      if (sub === 'add') {
        const role = interaction.options.getRole('role', true);
        if (role.managed || role.id === guild.id) {
          return bad(interaction, 'Invalid role', 'Pick a normal server role — not `@everyone` or a bot/integration-managed role.');
        }
        if (current.includes(role.id)) return bad(interaction, 'Already an auto-role', `${role} is already granted on join.`);
        if (current.length >= LIMITS.maxAutoroles) return bad(interaction, 'List full', `You can configure at most **${LIMITS.maxAutoroles}** auto-roles.`);
        client.config.update(guild.id, NAMESPACE, { autoroles: [...current, role.id] });

        const me = guild.members.me;
        const cannotAssign = me && me.roles.highest.comparePositionTo(role) <= 0;
        const warn = cannotAssign
          ? '\n\n⚠️ This role is currently **higher than my top role**, so I cannot assign it yet. Move my role above it in Server Settings → Roles.'
          : '';
        return ok(interaction, 'Auto-role added', `${role} will be granted to new members on join.${warn}`);
      }

      if (sub === 'remove') {
        const role = interaction.options.getRole('role', true);
        if (!current.includes(role.id)) return bad(interaction, 'Not an auto-role', `${role} is not in the auto-role list.`);
        client.config.update(guild.id, NAMESPACE, { autoroles: current.filter((id) => id !== role.id) });
        return ok(interaction, 'Auto-role removed', `${role} will no longer be granted on join.`);
      }

      if (sub === 'list') {
        const embed = client.brand
          .embed(guild)
          .setTitle('🎭 Auto-roles')
          .setDescription(
            current.length
              ? truncate(current.map((id) => (guild.roles.cache.has(id) ? `<@&${id}>` : `\`${id}\` (deleted)`)).join('\n'), 4000)
              : 'No auto-roles configured. Add one with `/welcome autoroles add`.',
          )
          .setFooter({ text: `Skip bots: ${cfg.skipBots ? 'yes' : 'no'} • ${current.length}/${LIMITS.maxAutoroles}` });
        return reply(interaction, embed);
      }

      if (sub === 'skip-bots') {
        const on = interaction.options.getBoolean('on', true);
        client.config.update(guild.id, NAMESPACE, { skipBots: on });
        return ok(interaction, 'Auto-role bot policy updated', `Bots will ${on ? 'be skipped' : 'also receive auto-roles'} on join.`);
      }
      return null;
    }

    // ---- buttons group.
    if (group === 'buttons') {
      const current = Array.isArray(cfg.buttons) ? [...cfg.buttons] : [];

      if (sub === 'add') {
        const label = truncate(String(interaction.options.getString('label', true)).trim(), LIMITS.labelMax);
        const url = validUrl(interaction.options.getString('url', true));
        if (!label) return bad(interaction, 'Invalid label', 'The button needs a non-empty label.');
        if (!url) return bad(interaction, 'Invalid URL', `Provide a valid \`https://\` URL (max ${LIMITS.urlMax} characters).`);
        if (current.length >= LIMITS.maxButtons) return bad(interaction, 'List full', `You can configure at most **${LIMITS.maxButtons}** link buttons.`);
        client.config.update(guild.id, NAMESPACE, { buttons: [...current, { label, url }] });
        return ok(interaction, 'Button added', `Added **${label}** → ${url}`);
      }

      if (sub === 'remove') {
        const position = interaction.options.getInteger('position', true);
        if (position < 1 || position > current.length) {
          return bad(interaction, 'Invalid position', `There ${current.length === 1 ? 'is' : 'are'} **${current.length}** button(s). See \`/welcome buttons list\`.`);
        }
        const [removed] = current.splice(position - 1, 1);
        client.config.update(guild.id, NAMESPACE, { buttons: current });
        return ok(interaction, 'Button removed', `Removed **${truncate(removed?.label ?? 'button', 80)}**.`);
      }

      if (sub === 'list') {
        const embed = client.brand
          .embed(guild)
          .setTitle('🔗 Welcome buttons')
          .setDescription(
            current.length
              ? truncate(current.map((b, i) => `**${i + 1}.** ${truncate(b.label, 80)} → ${b.url}`).join('\n'), 4000)
              : 'No link buttons configured. Add one with `/welcome buttons add`.',
          )
          .setFooter({ text: `${current.length}/${LIMITS.maxButtons}` });
        return reply(interaction, embed);
      }
      return null;
    }

    // ---- leave group (non-modal parts).
    if (group === 'leave') {
      if (sub === 'toggle') {
        const on = interaction.options.getBoolean('on', true);
        client.config.update(guild.id, NAMESPACE, { leave: { enabled: on } });
        if (on && !cfg.leave?.channelId) {
          return ok(interaction, 'Leave messages enabled', 'No leave channel is set yet — configure one with `/welcome leave channel`.');
        }
        return ok(interaction, `Leave messages ${on ? 'enabled' : 'disabled'}`, `Leave messages are now **${on ? 'on' : 'off'}**.`);
      }
      if (sub === 'channel') {
        const channel = interaction.options.getChannel('channel', true);
        if (!WELCOME_CHANNEL_TYPES.includes(channel.type)) {
          return bad(interaction, 'Invalid channel', 'Pick a text or announcement channel.');
        }
        client.config.update(guild.id, NAMESPACE, { leave: { channelId: channel.id, enabled: true } });
        return ok(interaction, 'Leave channel set', `Leave messages will be posted in ${channel} and are now **enabled**.`);
      }
      if (sub === 'channel-clear') {
        client.config.update(guild.id, NAMESPACE, { leave: { channelId: null } });
        return ok(interaction, 'Leave channel cleared', 'No leave channel is configured.');
      }
      return null;
    }

    return null;
  },
};

async function subStatus(interaction, cfg) {
  const client = interaction.client;
  const guild = interaction.guild;

  const channel = cfg.channelId ? (guild.channels.cache.has(cfg.channelId) ? `<#${cfg.channelId}>` : '⚠️ deleted channel') : 'not set';
  const leaveChannel = cfg.leave?.channelId
    ? guild.channels.cache.has(cfg.leave.channelId)
      ? `<#${cfg.leave.channelId}>`
      : '⚠️ deleted channel'
    : 'not set';
  const autoroles = Array.isArray(cfg.autoroles) ? cfg.autoroles : [];
  const buttons = Array.isArray(cfg.buttons) ? cfg.buttons : [];

  const bannerState = cfg.banner ? (banner.isAvailable() ? 'on' : 'on (renderer unavailable)') : 'off';

  const embed = client.brand
    .embed(guild)
    .setTitle('👋 Welcome & leave configuration')
    .addFields(
      {
        name: 'Welcome message',
        value: [
          `Status: **${cfg.enabled ? '🟢 enabled' : '⚫ disabled'}**`,
          `Channel: ${channel}`,
          `Server icon: ${cfg.serverIcon ? 'shown' : 'hidden'}`,
          `Banner: ${bannerState}`,
          `Custom image: ${cfg.imageUrl ? `[set](${cfg.imageUrl})` : 'none'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Welcome DM',
        value: `Status: **${cfg.dm?.enabled ? '🟢 enabled' : '⚫ disabled'}**`,
        inline: true,
      },
      {
        name: 'Auto-roles',
        value: `${autoroles.length}/${LIMITS.maxAutoroles} • skip bots: ${cfg.skipBots ? 'yes' : 'no'}`,
        inline: true,
      },
      {
        name: 'Buttons',
        value: `${buttons.length}/${LIMITS.maxButtons}`,
        inline: true,
      },
      {
        name: 'Leave message',
        value: `Status: **${cfg.leave?.enabled ? '🟢 enabled' : '⚫ disabled'}**\nChannel: ${leaveChannel}`,
        inline: false,
      },
      {
        name: 'Placeholders',
        value: `${PLACEHOLDER_HELP}\nUse them in any title, description, or DM text.`,
        inline: false,
      },
    );

  const svc = [];
  svc.push(`Leveling (\`{level}\`): ${client.services?.leveling?.getLevel ? 'connected' : 'unavailable → 0'}`);
  svc.push(`Invites (\`{invites}\`): ${client.services?.invites?.getStats ? 'connected' : 'unavailable → 0'}`);
  embed.addFields({ name: 'Placeholder data sources', value: svc.join('\n'), inline: false });

  return reply(interaction, embed);
}

async function subTest(interaction, cfg) {
  const client = interaction.client;
  const guild = interaction.guild;
  const member = interaction.member;

  // Build the welcome payload as if the invoker just joined.
  let payload;
  try {
    payload = await render.buildWelcomePayload(client, guild, member, cfg);
  } catch (err) {
    return bad(interaction, 'Preview failed', 'The welcome message could not be rendered. Check the configuration and try again.');
  }

  // If a channel is configured, post the real thing there so staff can verify
  // delivery/permissions, and confirm ephemerally. Otherwise show an ephemeral preview.
  if (cfg.enabled && cfg.channelId) {
    const channel = guild.channels.cache.get(cfg.channelId) ?? (await guild.channels.fetch(cfg.channelId).catch(() => null));
    if (channel) {
      const sent = await client.hooks.send(channel, payload);
      if (sent) {
        return ok(interaction, 'Test welcome sent', `A test welcome was posted to <#${channel.id}> (no auto-roles or DM were applied).`);
      }
      return bad(interaction, 'Could not post', `I was unable to post in <#${channel.id}>. Check my channel permissions.`);
    }
  }

  // Ephemeral preview (channel not set / deleted / disabled).
  return safeReply(interaction, {
    ...payload,
    content: payload.content
      ? `${payload.content}\n-# Preview — welcome messages are not fully configured yet.`
      : '-# Preview — welcome messages are not fully configured yet.',
    flags: MessageFlags.Ephemeral,
  });
}
