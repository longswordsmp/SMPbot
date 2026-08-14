'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeReply, truncate, clamp } = require('../../../core/utils');
const engine = require('../services/engine');

function ephemeral(interaction, embed) {
  return safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function logChange(client, guild, actorId, description) {
  try {
    await client.logs.send(guild, engine.LOG_TYPE, {
      embeds: [
        client.brand
          .embed(guild, { color: 'info' })
          .setTitle('🏅 Level roles updated')
          .setDescription(`<@${actorId}> ${description}`),
      ],
    });
  } catch {
    // logging must never break the command
  }
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('Manage level-reward roles (staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Reward a role when members reach a level')
        .addIntegerOption((opt) =>
          opt.setName('level').setDescription('Level to reward at').setRequired(true).setMinValue(1).setMaxValue(engine.LIMITS.maxLevel),
        )
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to grant').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove the reward role for a level')
        .addIntegerOption((opt) =>
          opt.setName('level').setDescription('Level whose reward to remove').setRequired(true).setMinValue(1).setMaxValue(engine.LIMITS.maxLevel),
        ),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all configured level-reward roles'))
    .addSubcommand((sub) =>
      sub
        .setName('mode')
        .setDescription('Choose whether reward roles stack or replace the previous one')
        .addStringOption((opt) =>
          opt
            .setName('mode')
            .setDescription('How reward roles are granted')
            .setRequired(true)
            .addChoices(
              { name: 'Stack — keep every reward role earned', value: 'stack' },
              { name: 'Replace — keep only the highest reward role', value: 'replace' },
            ),
        ),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const level = clamp(interaction.options.getInteger('level', true), 1, engine.LIMITS.maxLevel);
      const role = interaction.options.getRole('role', true);

      if (role.id === guild.id) {
        return ephemeral(interaction, client.brand.error(guild, 'Invalid role', 'You cannot use `@everyone` as a level reward.'));
      }
      if (role.managed) {
        return ephemeral(
          interaction,
          client.brand.error(guild, 'Invalid role', 'That role is managed by an integration and cannot be assigned manually.'),
        );
      }
      const me = guild.members.me;
      if (me && me.roles.highest.comparePositionTo(role) <= 0) {
        return ephemeral(
          interaction,
          client.brand.warn(
            guild,
            'Role too high',
            `I cannot assign <@&${role.id}> because it is higher than or equal to my highest role. Move my role above it, then this reward will work.`,
          ),
        );
      }

      const ok = engine.setLevelRole(client, guild.id, level, role.id);
      if (!ok) {
        return ephemeral(
          interaction,
          client.brand.error(
            guild,
            'Could not save',
            `You have reached the maximum of **${engine.LIMITS.maxLevelRoles}** level-reward roles.`,
          ),
        );
      }
      await logChange(client, guild, interaction.user.id, `set the **level ${level}** reward to <@&${role.id}>.`);
      return ephemeral(
        interaction,
        client.brand.success(guild, 'Level reward saved', `Members who reach **level ${level}** will now receive <@&${role.id}>.`),
      );
    }

    if (sub === 'remove') {
      const level = interaction.options.getInteger('level', true);
      const removed = engine.removeLevelRole(client, guild.id, level);
      if (!removed) {
        return ephemeral(interaction, client.brand.info(guild, 'Nothing to remove', `There is no reward role set for **level ${level}**.`));
      }
      await logChange(client, guild, interaction.user.id, `removed the **level ${level}** reward role.`);
      return ephemeral(interaction, client.brand.success(guild, 'Level reward removed', `The reward for **level ${level}** has been removed.`));
    }

    if (sub === 'mode') {
      const mode = interaction.options.getString('mode', true);
      client.config.update(guild.id, engine.NAMESPACE, { roleMode: mode });
      const desc =
        mode === 'replace'
          ? 'Members will keep **only their highest** earned reward role. Lower reward roles are removed on level-up.'
          : 'Reward roles **stack** — members keep every reward role they earn.';
      await logChange(client, guild, interaction.user.id, `set level-role mode to **${mode}**.`);
      return ephemeral(interaction, client.brand.success(guild, `Mode set to ${mode}`, desc));
    }

    // list
    const rows = engine.listLevelRoles(client, guild.id);
    const cfg = engine.config(client, guild.id);
    if (!rows.length) {
      return ephemeral(
        interaction,
        client.brand.info(
          guild,
          'No level rewards',
          'No level-reward roles are configured. Add one with `/levelroles add <level> <role>`.',
        ),
      );
    }
    const lines = rows.map((r) => {
      const exists = guild.roles.cache.has(r.role_id);
      return `• **Level ${r.level}** → ${exists ? `<@&${r.role_id}>` : `~~deleted role~~ \`${r.role_id}\``}`;
    });
    const embed = client.brand
      .embed(guild)
      .setTitle('🏅 Level-reward roles')
      .setDescription(truncate(lines.join('\n'), 4000))
      .addFields({ name: 'Mode', value: cfg.roleMode === 'replace' ? 'Replace (highest only)' : 'Stack (keep all)', inline: true });
    return ephemeral(interaction, embed);
  },
};
