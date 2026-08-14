'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { confirm, truncate, parseDuration, formatDuration, clamp } = require('../../../core/utils');
const manager = require('../services/manager');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

/** Parse a cooldown option: 'off'/'none'/'0' → 0 seconds; else a duration up to 1 day. Returns null when invalid. */
function parseCooldownSeconds(raw) {
  const t = String(raw).trim().toLowerCase();
  if (['off', 'none', '0', '0s'].includes(t)) return 0;
  const ms = parseDuration(t);
  if (ms === null || ms > 24 * 60 * 60 * 1000) return null;
  return Math.floor(ms / 1000);
}

function normalizePattern(raw, key) {
  let pattern = String(raw ?? '').trim().slice(0, 60);
  if (!pattern) return `${key}-{num}`;
  if (!pattern.includes('{num}')) pattern += '-{num}';
  return pattern;
}

function categoryOptions(sub) {
  return sub
    .addStringOption((opt) => opt.setName('label').setDescription('Button label shown on panels').setMaxLength(80))
    .addStringOption((opt) => opt.setName('emoji').setDescription('Emoji shown on the panel button').setMaxLength(64))
    .addChannelOption((opt) =>
      opt.setName('parent').setDescription('Discord category new ticket channels are created under').addChannelTypes(ChannelType.GuildCategory),
    )
    .addRoleOption((opt) => opt.setName('staff-role').setDescription('Staff role that can see and handle these tickets'))
    .addRoleOption((opt) => opt.setName('staff-role-2').setDescription('Additional staff role'))
    .addStringOption((opt) => opt.setName('description').setDescription('Short description shown on panels').setMaxLength(100))
    .addStringOption((opt) =>
      opt.setName('welcome').setDescription('Welcome message — placeholders: {user} {server} {category}').setMaxLength(1000),
    )
    .addStringOption((opt) => opt.setName('pattern').setDescription('Channel name pattern, e.g. support-{num}').setMaxLength(60))
    .addStringOption((opt) => opt.setName('cooldown').setDescription('Per-user cooldown between tickets (e.g. 10m, off)').setMaxLength(20))
    .addIntegerOption((opt) => opt.setName('max-open').setDescription('Max open tickets per user in this category').setMinValue(1).setMaxValue(10));
}

function describeCategory(cat, guild) {
  const roles = cat.staffRoleIds.length ? cat.staffRoleIds.map((id) => `<@&${id}>`).join(' ') : '_none (Manage Server only)_';
  const parent = cat.parentId ? (guild.channels.cache.has(cat.parentId) ? `<#${cat.parentId}>` : '⚠️ deleted category') : '_none_';
  return [
    `Staff: ${roles}`,
    `Parent: ${parent}`,
    `Pattern: \`${cat.pattern}\` • Cooldown: ${cat.cooldownSeconds ? formatDuration(cat.cooldownSeconds * 1000) : 'off'} • Max open: ${cat.maxOpen}`,
  ].join('\n');
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('ticketconfig')
    .setDescription('Configure the ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) => {
      group.setName('category').setDescription('Manage ticket categories');
      group.addSubcommand((sub) => {
        sub
          .setName('add')
          .setDescription('Add a ticket category')
          .addStringOption((opt) =>
            opt
              .setName('type')
              .setDescription('Built-in category type, or custom')
              .setRequired(true)
              .addChoices(
                { name: '🛟 General Support', value: 'support' },
                { name: '🐛 Bug Report', value: 'bug' },
                { name: '🚩 Player Report', value: 'player-report' },
                { name: '🛑 Staff Report', value: 'staff-report' },
                { name: '🤝 Partnership', value: 'partnership' },
                { name: '🛒 Purchase Support', value: 'purchase' },
                { name: '❓ Rule Clarification', value: 'rule-clarification' },
                { name: '⚖️ Ban Appeal', value: 'appeal' },
                { name: '🛡️ Contact Staff', value: 'staff' },
                { name: '✨ Custom', value: 'custom' },
              ),
          )
          .addStringOption((opt) =>
            opt.setName('key').setDescription('Unique key (a-z, 0-9, -, _) — required for custom categories').setMaxLength(32),
          );
        return categoryOptions(sub);
      });
      group.addSubcommand((sub) => {
        sub
          .setName('edit')
          .setDescription('Edit a ticket category')
          .addStringOption((opt) => opt.setName('key').setDescription('Category to edit').setRequired(true).setAutocomplete(true))
          .addRoleOption((opt) => opt.setName('remove-staff-role').setDescription('Staff role to remove from this category'))
          .addBooleanOption((opt) => opt.setName('clear-parent').setDescription('Clear the configured parent category'));
        return categoryOptions(sub);
      });
      group.addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a ticket category')
          .addStringOption((opt) => opt.setName('key').setDescription('Category to remove').setRequired(true).setAutocomplete(true)),
      );
      group.addSubcommand((sub) => sub.setName('list').setDescription('List this server\'s ticket categories'));
      return group;
    })
    .addSubcommand((sub) =>
      sub
        .setName('settings')
        .setDescription('View or change ticket system settings')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('Enable or disable the whole ticket system'))
        .addIntegerOption((opt) =>
          opt.setName('max-open').setDescription('Max open tickets per user across all categories').setMinValue(1).setMaxValue(25),
        )
        .addBooleanOption((opt) => opt.setName('dm-transcripts').setDescription('DM the opener a transcript when their ticket closes'))
        .addBooleanOption((opt) => opt.setName('log-transcripts').setDescription('Attach a transcript to the ticket log on close'))
        .addBooleanOption((opt) => opt.setName('priority-prefix').setDescription('Prefix ticket channel names with a priority marker'))
        .addStringOption((opt) =>
          opt.setName('auto-delete').setDescription('Delete closed tickets after this long (e.g. 3d, off)').setMaxLength(20),
        ),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'key') return interaction.respond([]);
    const query = String(focused.value ?? '').toLowerCase();
    const categories = manager.listCategories(interaction.client, interaction.guildId);
    return interaction.respond(
      categories
        .filter((c) => !query || c.key.includes(query) || c.label.toLowerCase().includes(query))
        .slice(0, 25)
        .map((c) => ({ name: truncate(`${c.label} (${c.key})`, 100), value: c.key })),
    );
  },

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    // ----- /ticketconfig settings ------------------------------------------
    if (!group && sub === 'settings') {
      const enabled = interaction.options.getBoolean('enabled');
      const maxOpen = interaction.options.getInteger('max-open');
      const dmTranscripts = interaction.options.getBoolean('dm-transcripts');
      const logTranscripts = interaction.options.getBoolean('log-transcripts');
      const priorityPrefix = interaction.options.getBoolean('priority-prefix');
      const autoDeleteRaw = interaction.options.getString('auto-delete');

      const patch = {};
      if (enabled !== null) patch.enabled = enabled;
      if (maxOpen !== null) patch.maxOpenPerUser = clamp(maxOpen, 1, 25);
      if (dmTranscripts !== null) patch.dmTranscripts = dmTranscripts;
      if (logTranscripts !== null) patch.logTranscripts = logTranscripts;
      if (priorityPrefix !== null) patch.priorityPrefix = priorityPrefix;
      if (autoDeleteRaw !== null) {
        const t = autoDeleteRaw.trim().toLowerCase();
        if (['off', 'none', 'never', '0'].includes(t)) {
          patch.closedDeleteAfterMs = null;
        } else {
          const ms = parseDuration(t);
          if (ms === null || ms < 5 * 60 * 1000 || ms > 28 * 24 * 60 * 60 * 1000) {
            return interaction.reply(
              eph({
                embeds: [
                  client.brand.error(guild, 'Invalid duration', 'Auto-delete must be between **5m** and **4w** (e.g. `12h`, `3d`), or `off`.'),
                ],
              }),
            );
          }
          patch.closedDeleteAfterMs = ms;
        }
      }

      const changed = Object.keys(patch).length > 0;
      if (changed) client.config.update(guild.id, 'tickets', patch);
      const settings = manager.getSettings(client, guild.id);
      const embed = client.brand
        .embed(guild)
        .setTitle('🎫 Ticket settings')
        .setDescription(changed ? 'Settings updated.' : 'Current settings — pass options to change them.')
        .addFields(
          { name: 'Enabled', value: settings.enabled ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Max open / user', value: `${settings.maxOpenPerUser}`, inline: true },
          { name: 'Priority name prefix', value: settings.priorityPrefix ? 'On' : 'Off', inline: true },
          { name: 'DM transcripts', value: settings.dmTranscripts ? 'On' : 'Off', inline: true },
          { name: 'Log transcripts', value: settings.logTranscripts ? 'On' : 'Off', inline: true },
          {
            name: 'Auto-delete closed',
            value: settings.closedDeleteAfterMs ? `After ${formatDuration(settings.closedDeleteAfterMs)}` : 'Off',
            inline: true,
          },
        );
      return interaction.reply(eph({ embeds: [embed] }));
    }

    // ----- /ticketconfig category * ----------------------------------------
    if (group !== 'category') return null;

    if (sub === 'add' || sub === 'edit') {
      let existing = null;
      let key;
      if (sub === 'add') {
        const type = interaction.options.getString('type');
        key = interaction.options.getString('key')?.trim().toLowerCase() || (type !== 'custom' ? type : null);
        if (!key) {
          return interaction.reply(
            eph({ embeds: [client.brand.error(guild, 'Key required', 'Custom categories need a `key` (e.g. `media-apps`).')] }),
          );
        }
        if (!manager.KEY_RE.test(key)) {
          return interaction.reply(
            eph({
              embeds: [
                client.brand.error(guild, 'Invalid key', 'Keys must be 1–32 characters of lowercase letters, numbers, `-`, or `_`.'),
              ],
            }),
          );
        }
        if (manager.getCategory(client, guild.id, key)) {
          return interaction.reply(
            eph({ embeds: [client.brand.error(guild, 'Key taken', `Category \`${key}\` already exists — use \`/ticketconfig category edit\`.`)] }),
          );
        }
        if (manager.listCategories(client, guild.id).length >= 25) {
          return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Too many categories', 'This server already has 25 categories.')] }));
        }
      } else {
        key = interaction.options.getString('key').trim().toLowerCase();
        existing = manager.getCategory(client, guild.id, key);
        if (!existing) {
          return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Not found', `No category with key \`${key}\` exists.`)] }));
        }
      }

      const base = sub === 'add' ? manager.BUILTIN_TYPES[interaction.options.getString('type')] ?? {} : existing;

      const emojiRaw = interaction.options.getString('emoji');
      if (emojiRaw !== null && !manager.normalizeEmoji(emojiRaw)) {
        return interaction.reply(
          eph({ embeds: [client.brand.error(guild, 'Invalid emoji', 'Use a standard emoji or a custom one like `<:name:id>`.')] }),
        );
      }

      const cooldownRaw = interaction.options.getString('cooldown');
      let cooldownSeconds = sub === 'add' ? 60 : existing.cooldownSeconds;
      if (cooldownRaw !== null) {
        const parsed = parseCooldownSeconds(cooldownRaw);
        if (parsed === null) {
          return interaction.reply(
            eph({ embeds: [client.brand.error(guild, 'Invalid cooldown', 'Use a duration up to 1 day (e.g. `10m`, `2h`) or `off`.')] }),
          );
        }
        cooldownSeconds = parsed;
      }

      const parent = interaction.options.getChannel('parent');
      const clearParent = sub === 'edit' ? interaction.options.getBoolean('clear-parent') : null;
      const addRoles = [interaction.options.getRole('staff-role'), interaction.options.getRole('staff-role-2')]
        .filter(Boolean)
        .map((r) => r.id);
      const removeRole = sub === 'edit' ? interaction.options.getRole('remove-staff-role') : null;
      let staffRoleIds = [...new Set([...(existing?.staffRoleIds ?? []), ...addRoles])];
      if (removeRole) staffRoleIds = staffRoleIds.filter((id) => id !== removeRole.id);

      const patternRaw = interaction.options.getString('pattern');
      const category = {
        key,
        label: truncate(interaction.options.getString('label')?.trim() || existing?.label || base.label || key, 80),
        emoji: emojiRaw !== null ? manager.normalizeEmoji(emojiRaw) : existing?.emoji ?? manager.normalizeEmoji(base.emoji) ?? null,
        description: truncate(
          interaction.options.getString('description')?.trim() ?? existing?.description ?? base.description ?? null,
          100,
        ),
        parentId: clearParent ? null : parent?.id ?? existing?.parentId ?? null,
        staffRoleIds,
        pattern: patternRaw !== null ? normalizePattern(patternRaw, key) : existing?.pattern ?? base.pattern ?? `${key}-{num}`,
        welcome: truncate(interaction.options.getString('welcome')?.trim() ?? existing?.welcome ?? base.welcome ?? null, 1000),
        cooldownSeconds,
        maxOpen: interaction.options.getInteger('max-open') ?? existing?.maxOpen ?? 1,
      };
      manager.saveCategory(client, guild.id, category);

      const saved = manager.getCategory(client, guild.id, key);
      const embed = client.brand
        .success(guild, sub === 'add' ? 'Category added' : 'Category updated', `${saved.emoji ?? '🎫'} **${saved.label}** (\`${saved.key}\`)`)
        .addFields({ name: 'Configuration', value: truncate(describeCategory(saved, guild), 1024) });
      if (!saved.staffRoleIds.length) {
        embed.addFields({
          name: '💡 Tip',
          value: 'No staff roles are set — only members with **Manage Server** can handle these tickets. Add one with `staff-role`.',
        });
      }
      return interaction.reply(eph({ embeds: [embed] }));
    }

    if (sub === 'remove') {
      const key = interaction.options.getString('key').trim().toLowerCase();
      const category = manager.getCategory(client, guild.id, key);
      if (!category) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Not found', `No category with key \`${key}\` exists.`)] }));
      }
      const confirmed = await confirm(interaction, {
        embed: client.brand.warn(
          guild,
          'Remove category?',
          `**${category.label}** (\`${key}\`) will be removed. Existing tickets stay, but panels showing it need republishing.`,
        ),
        confirmLabel: 'Remove category',
        danger: true,
      });
      if (!confirmed) {
        return interaction.editReply({ embeds: [client.brand.info(guild, 'Cancelled', 'The category was not removed.')] }).catch(() => null);
      }
      manager.deleteCategory(client, guild.id, key);
      await manager.logTicket(client, guild, {
        title: '🗂️ Ticket category removed',
        color: 'warning',
        description: `Category **${category.label}** (\`${key}\`) was removed by <@${interaction.user.id}>.`,
      });
      return interaction
        .editReply({
          embeds: [
            client.brand.success(guild, 'Category removed', `\`${key}\` is gone. Republish affected panels with \`/ticketpanel publish\`.`),
          ],
        })
        .catch(() => null);
    }

    if (sub === 'list') {
      const categories = manager.listCategories(client, guild.id);
      if (!categories.length) {
        return interaction.reply(
          eph({
            embeds: [
              client.brand.info(
                guild,
                'No categories yet',
                'Add your first with `/ticketconfig category add` — built-in types: support, report, partnership, appeal, purchase, staff.',
              ),
            ],
          }),
        );
      }
      const embed = client.brand.embed(guild).setTitle('🗂️ Ticket categories');
      for (const cat of categories.slice(0, 25)) {
        embed.addFields({
          name: `${cat.emoji ?? '🎫'} ${cat.label} (\`${cat.key}\`)`,
          value: truncate(describeCategory(cat, guild), 1024),
        });
      }
      return interaction.reply(eph({ embeds: [embed] }));
    }

    return null;
  },
};
