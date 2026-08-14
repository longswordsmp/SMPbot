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
const {
  parseDuration,
  formatDuration,
  truncate,
  relativeTime,
  absoluteTime,
  safeReply,
} = require('../../../core/utils');
const announcements = require('../services/announcements');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function replyError(interaction, title, description) {
  return safeReply(interaction, eph({ embeds: [interaction.client.brand.error(interaction.guild, title, description)] }));
}

/**
 * Parse the shared `create` options into a draft data object.
 * Returns { data, runAt } on success, or { error } on validation failure.
 */
function parseCreateOptions(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  const channel = interaction.options.getChannel('channel');
  const channelError = announcements.checkChannel(guild, channel);
  if (channelError) return { error: ['Invalid channel', channelError] };

  const title = truncate(String(interaction.options.getString('title') ?? '').trim(), announcements.LIMITS.title);
  if (!title) return { error: ['Invalid title', 'The announcement needs a title.'] };

  const rawDescription = interaction.options.getString('description');
  const description = rawDescription ? truncate(String(rawDescription).trim(), announcements.LIMITS.description) : '';

  const thumbnail = String(interaction.options.getString('thumbnail') ?? '').trim();
  if (thumbnail && !announcements.isHttpUrl(thumbnail)) {
    return { error: ['Invalid thumbnail', 'The thumbnail must be a valid `http(s)://` image URL (max 512 characters).'] };
  }
  const image = String(interaction.options.getString('image') ?? '').trim();
  if (image && !announcements.isHttpUrl(image)) {
    return { error: ['Invalid image', 'The image must be a valid `http(s)://` image URL (max 512 characters).'] };
  }

  const footer = truncate(String(interaction.options.getString('footer') ?? '').trim(), announcements.LIMITS.footer);

  const buttonLabel = truncate(String(interaction.options.getString('button_label') ?? '').trim(), announcements.LIMITS.buttonLabel);
  const buttonUrl = String(interaction.options.getString('button_url') ?? '').trim();
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    return { error: ['Incomplete button', 'A link button needs **both** a label and a URL.'] };
  }
  if (buttonUrl && !announcements.isHttpUrl(buttonUrl)) {
    return { error: ['Invalid button URL', 'The button URL must be a valid `http(s)://` link (max 512 characters).'] };
  }

  // Mention: an explicit role wins over the none/@here/@everyone choice.
  const mentionRole = interaction.options.getRole('mention_role');
  const mentionChoice = interaction.options.getString('mention'); // 'here' | 'everyone' | 'none' | null
  let mention = 'none';
  if (mentionRole) mention = mentionRole.id;
  else if (mentionChoice === 'here' || mentionChoice === 'everyone') mention = mentionChoice;

  // Crosspost only applies to announcement channels.
  const config = client.config.get(guild.id, announcements.ANNOUNCE_NS, announcements.DEFAULTS);
  const crosspostOpt = interaction.options.getBoolean('crosspost');
  const crosspost =
    channel.type === ChannelType.GuildAnnouncement ? (crosspostOpt ?? config.defaultCrosspost ?? true) : false;

  // Optional schedule.
  let runAt = null;
  const scheduleRaw = interaction.options.getString('schedule');
  if (scheduleRaw) {
    const ms = parseDuration(scheduleRaw);
    if (ms === null || ms < announcements.MIN_SCHEDULE_MS || ms > announcements.MAX_SCHEDULE_MS) {
      return {
        error: [
          'Invalid schedule',
          `Use a duration from now between **${formatDuration(announcements.MIN_SCHEDULE_MS)}** and **${formatDuration(
            announcements.MAX_SCHEDULE_MS,
          )}** (e.g. \`30m\`, \`12h\`, \`3d\`).`,
        ],
      };
    }
    runAt = Date.now() + ms;
  }

  const data = {
    channelId: channel.id,
    title,
    description,
    thumbnail: thumbnail || null,
    image: image || null,
    footer: footer || null,
    mention,
    buttonLabel: buttonLabel || null,
    buttonUrl: buttonUrl || null,
    crosspost,
  };
  return { data, runAt };
}

function descriptionModal(customId, prefill = {}) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Announcement text')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000)
          .setValue(prefill.description ? String(prefill.description).slice(0, 4000) : ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('footer')
          .setLabel('Footer (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(2048)
          .setValue(prefill.footer ? String(prefill.footer).slice(0, 2048) : ''),
      ),
    );
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create, schedule, and manage rich announcements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create an announcement (with an optional live preview)')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post the announcement in')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((opt) => opt.setName('title').setDescription('Announcement title').setRequired(true).setMaxLength(256))
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Announcement body (leave empty to open a text editor)').setMaxLength(4000),
        )
        .addStringOption((opt) =>
          opt
            .setName('mention')
            .setDescription('Who to ping')
            .addChoices({ name: 'None', value: 'none' }, { name: '@here', value: 'here' }, { name: '@everyone', value: 'everyone' }),
        )
        .addRoleOption((opt) => opt.setName('mention_role').setDescription('Ping a specific role (overrides the mention choice)'))
        .addStringOption((opt) => opt.setName('thumbnail').setDescription('Thumbnail image URL').setMaxLength(512))
        .addStringOption((opt) => opt.setName('image').setDescription('Large image URL').setMaxLength(512))
        .addStringOption((opt) => opt.setName('footer').setDescription('Custom footer text').setMaxLength(2048))
        .addStringOption((opt) => opt.setName('button_label').setDescription('Text for an optional link button').setMaxLength(80))
        .addStringOption((opt) => opt.setName('button_url').setDescription('URL for the optional link button').setMaxLength(512))
        .addStringOption((opt) => opt.setName('schedule').setDescription('Post later — duration from now, e.g. 30m, 12h, 3d'))
        .addBooleanOption((opt) =>
          opt.setName('crosspost').setDescription('Auto-publish to followers (announcement channels only)'),
        )
        .addBooleanOption((opt) => opt.setName('preview').setDescription('Show a preview before sending (default: true)')),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('scheduled')
        .setDescription('Manage scheduled announcements')
        .addSubcommand((sub) => sub.setName('list').setDescription('List announcements scheduled for later'))
        .addSubcommand((sub) =>
          sub
            .setName('cancel')
            .setDescription('Cancel a scheduled announcement')
            .addStringOption((opt) =>
              opt.setName('announcement').setDescription('Which scheduled announcement to cancel').setRequired(true).setAutocomplete(true),
            ),
        ),
    ),

  async autocomplete(interaction) {
    const client = interaction.client;
    const rows = announcements.listScheduled(client, interaction.guildId);
    const query = String(interaction.options.getFocused() ?? '').toLowerCase();
    const choices = rows
      .map((r) => ({ row: r, data: announcements.parseData(r) }))
      .filter(({ row, data }) => !query || String(row.id).includes(query) || (data.title || '').toLowerCase().includes(query))
      .slice(0, 25)
      .map(({ row, data }) => ({
        name: truncate(`#${row.id} • ${data.title || '(untitled)'} • ${new Date(row.run_at).toISOString().slice(0, 16).replace('T', ' ')}`, 100),
        value: String(row.id),
      }));
    return interaction.respond(choices).catch(() => null);
  },

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    if (group === 'scheduled') return handleScheduled(interaction);
    return handleCreate(interaction);
  },
};

async function handleCreate(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  const parsed = parseCreateOptions(interaction);
  if (parsed.error) return replyError(interaction, parsed.error[0], parsed.error[1]);
  const { data, runAt } = parsed;

  // Enforce the scheduled-announcement cap up front for scheduled posts.
  if (runAt && announcements.countScheduled(client, guild.id) >= announcements.MAX_SCHEDULED_PER_GUILD) {
    return replyError(
      interaction,
      'Too many scheduled announcements',
      `This server already has **${announcements.MAX_SCHEDULED_PER_GUILD}** announcements scheduled. Cancel one with \`/announce scheduled cancel\` first.`,
    );
  }

  // No description supplied → open the text editor first (modal must be the
  // first response, so we persist a draft, then collect the body).
  if (!data.description) {
    const draft = announcements.createDraft(client, guild.id, data.channelId, interaction.user.id, data, runAt);
    if (!draft) return replyError(interaction, 'Something went wrong', 'The draft could not be created. Please try again.');
    return interaction.showModal(descriptionModal(`announce:createmodal:${draft.id}`, data));
  }

  const draft = announcements.createDraft(client, guild.id, data.channelId, interaction.user.id, data, runAt);
  if (!draft) return replyError(interaction, 'Something went wrong', 'The draft could not be created. Please try again.');

  const wantsPreview = interaction.options.getBoolean('preview') !== false;
  if (wantsPreview) {
    return interaction.reply(eph(announcements.buildPreview(client, guild, data, draft.id, { scheduled: Boolean(runAt), runAt })));
  }

  // preview:false → commit immediately.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  return commitDraft(interaction, draft);
}

/** Schedule or publish a committed draft and report the result. */
async function commitDraft(interaction, draft) {
  const client = interaction.client;
  const guild = interaction.guild;
  const data = announcements.parseData(draft);

  if (draft.run_at && draft.run_at > Date.now()) {
    if (announcements.countScheduled(client, guild.id) >= announcements.MAX_SCHEDULED_PER_GUILD) {
      client.db.run("UPDATE announcements SET status = 'cancelled' WHERE id = ?", draft.id);
      return safeReply(interaction, {
        embeds: [client.brand.error(guild, 'Too many scheduled announcements', 'Cancel an existing scheduled announcement first.')],
      });
    }
    announcements.scheduleAnnouncement(client, draft);
    return safeReply(interaction, {
      components: [],
      embeds: [
        client.brand.success(
          guild,
          `Announcement #${draft.id} scheduled`,
          [
            `**Title:** ${truncate(data.title, 200)}`,
            `**Channel:** <#${data.channelId}>`,
            `**Posts:** ${absoluteTime(draft.run_at)} (${relativeTime(draft.run_at)})`,
          ].join('\n'),
        ),
      ],
    });
  }

  const result = await announcements.publishAnnouncement(client, draft);
  if (!result.ok) {
    return safeReply(interaction, { components: [], embeds: [client.brand.error(guild, 'Could not publish', result.error)] });
  }
  const link = `https://discord.com/channels/${guild.id}/${data.channelId}/${result.message.id}`;
  return safeReply(interaction, {
    components: [],
    embeds: [
      client.brand.success(
        guild,
        'Announcement published',
        [`**Title:** ${truncate(data.title, 200)}`, `**Channel:** <#${data.channelId}>`, `[Jump to message](${link})`].join('\n'),
      ),
    ],
  });
}

// Exported so the component handler can reuse the commit flow.
module.exports.commitDraft = commitDraft;
module.exports.descriptionModal = descriptionModal;

async function handleScheduled(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    const rows = announcements.listScheduled(client, guild.id);
    if (!rows.length) {
      return interaction.reply(
        eph({ embeds: [client.brand.info(guild, 'No scheduled announcements', 'Schedule one with `/announce create` and a `schedule` value.')] }),
      );
    }
    const embed = client.brand.embed(guild).setTitle('🕒 Scheduled announcements');
    for (const row of rows.slice(0, 25)) {
      const data = announcements.parseData(row);
      embed.addFields({
        name: `#${row.id} • ${truncate(data.title || '(untitled)', 80)}`,
        value: truncate(`Channel: <#${row.channel_id}>\nPosts: ${absoluteTime(row.run_at)} (${relativeTime(row.run_at)})`, 1024),
      });
    }
    return interaction.reply(eph({ embeds: [embed] }));
  }

  // cancel
  const raw = String(interaction.options.getString('announcement') ?? '').trim();
  const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
  const row = Number.isInteger(id) ? announcements.getAnnouncement(client, id) : null;
  if (!row || row.guild_id !== guild.id || row.status !== 'scheduled') {
    return replyError(interaction, 'Not found', 'No scheduled announcement matches that selection.');
  }
  announcements.cancelScheduled(client, row);
  const data = announcements.parseData(row);
  return interaction.reply(
    eph({
      embeds: [client.brand.success(guild, 'Announcement cancelled', `Scheduled announcement **#${row.id}** (${truncate(data.title || '(untitled)', 100)}) was cancelled.`)],
    }),
  );
}
