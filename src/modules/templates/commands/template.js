'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const log = require('../../../core/logger');
const { isGuildOwner } = require('../../../core/permissions');
const { paginate, confirm, chunkArray } = require('../../../core/utils');
const engine = require('../services/engine');
const definitions = require('../services/definitions');

const MODES = [
  { name: 'Add — build alongside your existing channels (safe)', value: 'add' },
  { name: 'Replace — DELETE existing channels first, then build (dangerous)', value: 'replace' },
];

function progressBar(done, total) {
  const segs = 12;
  const ratio = total > 0 ? done / total : 0;
  const filled = Math.max(0, Math.min(segs, Math.round(ratio * segs)));
  return `\`${'█'.repeat(filled)}${'░'.repeat(segs - filled)}\` ${Math.floor(ratio * 100)}%`;
}

function missingBotPerms(guild) {
  const me = guild.members.me;
  const missing = [];
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) missing.push('Manage Channels');
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) missing.push('Manage Roles');
  return missing;
}

module.exports = {
  cooldown: 5,
  permissions: PermissionFlagsBits.Administrator,

  data: new SlashCommandBuilder()
    .setName('template')
    .setDescription('Build your server from one of ten complete SMP templates')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) => sub.setName('list').setDescription('Browse the ten built-in server templates'))
    .addSubcommand((sub) =>
      sub
        .setName('preview')
        .setDescription('Preview a template in full without creating anything')
        .addStringOption((opt) =>
          opt.setName('template').setDescription('Template to preview').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('apply')
        .setDescription('Build your server from a template (server owner only)')
        .addStringOption((opt) =>
          opt.setName('template').setDescription('Template to apply').setRequired(true).setAutocomplete(true),
        )
        .addStringOption((opt) =>
          opt.setName('mode').setDescription('How to build (default: add)').setRequired(false).addChoices(...MODES),
        )
        .addBooleanOption((opt) =>
          opt.setName('prefix_emoji').setDescription('Prefix channel names with emojis').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('customize').setDescription('Rename roles and toggle emoji prefixes on the last applied template'),
    ),

  async autocomplete(interaction) {
    const focused = (interaction.options.getFocused() || '').toLowerCase();
    const choices = definitions
      .list()
      .filter((t) => !focused || t.id.includes(focused) || t.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((t) => ({ name: `${t.emoji} ${t.name}`, value: t.id }));
    return interaction.respond(choices).catch(() => null);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') return listTemplates(interaction);
    if (sub === 'preview') return previewTemplate(interaction);
    if (sub === 'apply') return applyTemplate(interaction);
    if (sub === 'customize') return customizeTemplate(interaction);
    return null;
  },
};

async function listTemplates(interaction) {
  const client = interaction.client;
  const all = definitions.templates;
  const pages = chunkArray(all, 5);
  const embeds = pages.map((group, idx) => {
    const embed = client.brand
      .embed(interaction.guild)
      .setTitle('🏗️ SMPbot Server Templates')
      .setDescription(
        idx === 0
          ? 'Ten complete, ready-to-run server blueprints. Preview any with `/template preview`, then build it with `/template apply` (server owner).'
          : 'More templates…',
      );
    for (const tpl of group) {
      const c = definitions.counts(tpl);
      embed.addFields({
        name: `${tpl.emoji} ${tpl.name}  \`${tpl.id}\``,
        value: `${tpl.description}\n**${c.roles}** roles · **${c.categories}** categories · **${c.channels}** channels`,
      });
    }
    return embed;
  });
  return paginate(interaction, embeds, { ephemeral: true });
}

async function previewTemplate(interaction) {
  const id = interaction.options.getString('template');
  const embeds = engine.preview(interaction.guild, id);
  return paginate(interaction, embeds, { ephemeral: true });
}

async function applyTemplate(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  if (!isGuildOwner(interaction.member)) {
    return interaction.reply({
      embeds: [client.brand.error(guild, 'Owner only', 'Only the **server owner** can build the server from a template.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const id = interaction.options.getString('template');
  const tpl = engine.get(id);
  if (!tpl) {
    return interaction.reply({
      embeds: [client.brand.error(guild, 'Unknown template', `There is no template with id \`${id}\`. Use \`/template list\`.`)],
      flags: MessageFlags.Ephemeral,
    });
  }

  const missing = missingBotPerms(guild);
  if (missing.length) {
    return interaction.reply({
      embeds: [
        client.brand.error(
          guild,
          'Missing permissions',
          `I need the following permission(s) to build a server: ${missing.map((m) => `**${m}**`).join(', ')}.`,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }

  const mode = interaction.options.getString('mode') || 'add';
  const prefixOpt = interaction.options.getBoolean('prefix_emoji');
  const prefixEmoji = prefixOpt === null ? undefined : prefixOpt;
  const c = definitions.counts(tpl);

  const warnLines = [
    `You are about to build **${tpl.emoji} ${tpl.name}**.`,
    '',
    `This creates **${c.roles} roles**, **${c.categories} categories** and **${c.channels} channels**.`,
  ];
  if (mode === 'replace') {
    warnLines.push(
      '',
      '⚠️ **REPLACE MODE** — every existing non-essential channel and category will be **permanently deleted** first. This **cannot be undone**. Community-required channels are skipped.',
    );
  } else {
    warnLines.push('', 'New channels are created **alongside** your existing ones. Nothing is deleted.');
  }
  warnLines.push('', 'Large builds take a minute or two — I pace channel creation to stay within Discord limits.');

  const warnEmbed = client.brand.warn(guild, `Build "${tpl.name}"?`, warnLines.join('\n'));
  const confirmed = await confirm(interaction, {
    embed: warnEmbed,
    danger: mode === 'replace',
    confirmLabel: mode === 'replace' ? 'Delete & build' : 'Build server',
    timeoutMs: 120000,
  });
  if (!confirmed) {
    return interaction.editReply({ embeds: [client.brand.info(guild, 'Cancelled', 'No changes were made.')], components: [] }).catch(() => null);
  }

  await interaction
    .editReply({ embeds: [client.brand.info(guild, 'Building your server…', 'Starting…')], components: [] })
    .catch(() => null);

  let lastEdit = 0;
  const onProgress = async (done, total) => {
    const now = Date.now();
    if (done !== total && now - lastEdit < 2000) return;
    lastEdit = now;
    await interaction
      .editReply({
        embeds: [
          client.brand
            .embed(guild)
            .setTitle('🏗️ Building your server…')
            .setDescription(`${progressBar(done, total)}\nCreating **${done}/${total}**…`),
        ],
      })
      .catch(() => null);
  };

  try {
    const result = await engine.apply(guild, id, {
      mode,
      prefixEmoji,
      roleOverrides: {},
      onProgress,
      protectChannelId: interaction.channelId,
    });

    await client.logs
      ?.send?.(guild, 'server', {
        embeds: [
          client.brand
            .embed(guild, { color: 'success' })
            .setTitle('🏗️ Server template applied')
            .setDescription(
              `**${interaction.user.tag}** applied the **${tpl.name}** template (${mode} mode).\nCreated ${result.createdRoles} roles, ${result.createdCategories} categories, ${result.createdChannels} channels.`,
            ),
        ],
      })
      .catch(() => null);

    const summary = client.brand
      .success(guild, 'Server built', `The **${tpl.emoji} ${tpl.name}** template is live.`)
      .addFields(
        { name: 'Roles', value: String(result.createdRoles), inline: true },
        { name: 'Categories', value: String(result.createdCategories), inline: true },
        { name: 'Channels', value: String(result.createdChannels), inline: true },
      )
      .setFooter({ text: 'Fine-tune role names and emoji prefixes with /template customize.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('template:custopen').setLabel('Customize now').setEmoji('🛠️').setStyle(ButtonStyle.Primary),
    );

    return interaction.editReply({ embeds: [summary], components: [row] }).catch(() => null);
  } catch (err) {
    if (err?.code === 'MISSING_BOT_PERMISSIONS') {
      return interaction
        .editReply({
          embeds: [client.brand.error(guild, 'Missing permissions', 'I lost the **Manage Channels** or **Manage Roles** permission mid-build.')],
          components: [],
        })
        .catch(() => null);
    }
    log.error('templates: apply failed:', err);
    const created = err?.created;
    const embed = client.brand.error(
      guild,
      'Build interrupted',
      'Something went wrong partway through. Nothing was automatically deleted — here is exactly what was created so you can review or clean it up.',
    );
    if (created) {
      embed.addFields(
        { name: 'Roles created', value: String(created.createdRoles ?? 0), inline: true },
        { name: 'Categories created', value: String(created.createdCategories ?? 0), inline: true },
        { name: 'Channels created', value: String(created.createdChannels ?? 0), inline: true },
      );
    }
    return interaction.editReply({ embeds: [embed], components: [] }).catch(() => null);
  }
}

async function customizeTemplate(interaction) {
  const client = interaction.client;
  const customize = require('../services/customize');
  const application = customize.get(client, interaction.guild.id);
  if (!application) {
    return interaction.reply({
      embeds: [
        client.brand.info(
          interaction.guild,
          'No template applied yet',
          'Apply a template first with `/template apply`, then come back to rename roles and toggle emoji prefixes.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  }
  const panel = customize.buildPanel(client, interaction.guild, application);
  return interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
}
