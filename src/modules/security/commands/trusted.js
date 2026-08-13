'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate } = require('../../../core/utils');
const engine = require('../services/engine');

/**
 * Trusted users/roles bypass ALL anti-nuke monitoring, so managing the list is
 * restricted to the server owner (ownerOnly) — an Administrator must NOT be
 * able to add themselves and then nuke freely.
 */
module.exports = {
  cooldown: 3,
  ownerOnly: true,
  permissions: PermissionFlagsBits.Administrator,
  data: new SlashCommandBuilder()
    .setName('trusted')
    .setDescription('Owner only: manage users/roles exempt from anti-nuke monitoring')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Trust a user or role (they bypass all anti-nuke monitoring)')
        .addUserOption((opt) => opt.setName('user').setDescription('User to trust'))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to trust')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user or role from the trusted list')
        .addUserOption((opt) => opt.setName('user').setDescription('User to un-trust'))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to un-trust')),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Show every trusted user and role')),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const cfg = engine.config(client, guild.id);
    const users = Array.isArray(cfg.trustedUsers) ? [...cfg.trustedUsers] : [];
    const roles = Array.isArray(cfg.trustedRoles) ? [...cfg.trustedRoles] : [];

    if (sub === 'list') {
      const userList = users.length ? users.map((id) => `• <@${id}> (\`${id}\`)`).join('\n') : 'None';
      const roleList = roles.length ? roles.map((id) => `• <@&${id}> (\`${id}\`)`).join('\n') : 'None';
      const embed = client.brand
        .embed(guild)
        .setTitle('🤝 Trusted bypass list')
        .setDescription(
          'These users/roles bypass **all** anti-nuke monitoring. The server owner and SMPbot itself are always trusted.\n⚠️ Administrator permission does **not** bypass monitoring — only this list does.',
        )
        .addFields(
          { name: `Trusted users (${users.length}/${engine.MAX_TRUSTED})`, value: truncate(userList, 1024), inline: false },
          { name: `Trusted roles (${roles.length}/${engine.MAX_TRUSTED})`, value: truncate(roleList, 1024), inline: false },
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    if ((!user && !role) || (user && role)) {
      return interaction.reply({
        embeds: [client.brand.error(guild, 'Pick one', 'Provide exactly **one** of `user` or `role`.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'add') {
      if (user) {
        if (user.id === client.user?.id || user.id === guild.ownerId) {
          return interaction.reply({
            embeds: [client.brand.info(guild, 'Always trusted', 'The server owner and SMPbot are always trusted — nothing to add.')],
            flags: MessageFlags.Ephemeral,
          });
        }
        if (users.includes(user.id)) {
          return interaction.reply({
            embeds: [client.brand.warn(guild, 'Already trusted', `<@${user.id}> is already on the trusted list.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        if (users.length >= engine.MAX_TRUSTED) {
          return interaction.reply({
            embeds: [client.brand.error(guild, 'List full', `The trusted-user list is capped at **${engine.MAX_TRUSTED}**.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        client.config.update(guild.id, engine.NAMESPACE, { trustedUsers: [...users, user.id] });
      } else {
        if (role.id === guild.id) {
          return interaction.reply({
            embeds: [client.brand.error(guild, 'Not allowed', 'Trusting @everyone would disable anti-nuke for the whole server.')],
            flags: MessageFlags.Ephemeral,
          });
        }
        if (roles.includes(role.id)) {
          return interaction.reply({
            embeds: [client.brand.warn(guild, 'Already trusted', `<@&${role.id}> is already on the trusted list.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        if (roles.length >= engine.MAX_TRUSTED) {
          return interaction.reply({
            embeds: [client.brand.error(guild, 'List full', `The trusted-role list is capped at **${engine.MAX_TRUSTED}**.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        client.config.update(guild.id, engine.NAMESPACE, { trustedRoles: [...roles, role.id] });
      }
      const target = user ? `<@${user.id}>` : `<@&${role.id}>`;
      await client.logs.send(guild, 'security', {
        embeds: [client.brand.warn(guild, 'Trusted list updated', `${target} was **added** to the anti-nuke bypass list by <@${interaction.user.id}>.`)],
      });
      return interaction.reply({
        embeds: [
          client.brand.success(
            guild,
            'Now trusted',
            `${target} now bypasses **all** anti-nuke monitoring. Keep this list as short as possible.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // remove
    if (user) {
      if (!users.includes(user.id)) {
        return interaction.reply({
          embeds: [client.brand.warn(guild, 'Not on the list', `<@${user.id}> is not on the trusted list.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      client.config.update(guild.id, engine.NAMESPACE, { trustedUsers: users.filter((id) => id !== user.id) });
    } else {
      if (!roles.includes(role.id)) {
        return interaction.reply({
          embeds: [client.brand.warn(guild, 'Not on the list', `<@&${role.id}> is not on the trusted list.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      client.config.update(guild.id, engine.NAMESPACE, { trustedRoles: roles.filter((id) => id !== role.id) });
    }
    const target = user ? `<@${user.id}>` : `<@&${role.id}>`;
    await client.logs.send(guild, 'security', {
      embeds: [client.brand.info(guild, 'Trusted list updated', `${target} was **removed** from the anti-nuke bypass list by <@${interaction.user.id}>.`)],
    });
    return interaction.reply({
      embeds: [client.brand.success(guild, 'Trust removed', `${target} is monitored by the anti-nuke engine again.`)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
