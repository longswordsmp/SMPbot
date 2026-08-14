'use strict';

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const customize = require('../services/customize');

module.exports = {
  prefix: 'template',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    const [action, ...rest] = args;

    if (!guild || !interaction.inGuild()) return null;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Administrator** to customize server templates.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const noApplication = () =>
      interaction.reply({
        embeds: [client.brand.info(guild, 'No template applied yet', 'Apply a template first with `/template apply`.')],
        flags: MessageFlags.Ephemeral,
      });

    // Open the customize panel (from the post-apply summary button).
    if (action === 'custopen' && interaction.isButton()) {
      const application = customize.get(client, guild.id);
      if (!application) return noApplication();
      const panel = customize.buildPanel(client, guild, application);
      return interaction.reply({ ...panel, flags: MessageFlags.Ephemeral });
    }

    // Role rename — the select opens a modal (must be the first response).
    if (action === 'rrole' && interaction.isStringSelectMenu()) {
      const key = interaction.values[0];
      const application = customize.get(client, guild.id);
      const roleId = application?.roles?.[key];
      const role = roleId ? guild.roles.cache.get(roleId) : null;
      if (!role) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Role missing', 'That role no longer exists — it may have been deleted.')],
          flags: MessageFlags.Ephemeral,
        });
      }
      const modal = new ModalBuilder()
        .setCustomId(`template:rrolemodal:${key}`)
        .setTitle('Rename role')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('name')
              .setLabel('New role name')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(100)
              .setValue(role.name.slice(0, 100)),
          ),
        );
      return interaction.showModal(modal);
    }

    if (action === 'rrolemodal' && interaction.isModalSubmit()) {
      const key = rest[0];
      const application = customize.get(client, guild.id);
      if (!application) return noApplication();
      const newName = interaction.fields.getTextInputValue('name');
      const res = await customize.renameRole(client, guild, application, key, newName);
      if (!res.ok) {
        return interaction.reply({
          embeds: [client.brand.error(guild, 'Rename failed', res.error)],
          flags: MessageFlags.Ephemeral,
        });
      }
      return interaction.reply({
        embeds: [client.brand.success(guild, 'Role renamed', `The role is now **${res.name}**.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Toggle emoji prefixes across the created channels.
    if (action === 'emoji' && interaction.isButton()) {
      const application = customize.get(client, guild.id);
      if (!application) return noApplication();
      await interaction.deferUpdate().catch(() => null);
      const res = await customize.toggleEmojiPrefixes(client, guild, application);
      const updated = customize.get(client, guild.id) ?? application;
      await interaction.editReply(customize.buildPanel(client, guild, updated)).catch(() => null);
      return interaction
        .followUp({
          embeds: [
            client.brand.success(
              guild,
              res.enabled ? 'Emoji prefixes added' : 'Emoji prefixes removed',
              `Renamed **${res.renamed}** channel(s)${res.failed ? ` · **${res.failed}** could not be renamed` : ''}.`,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => null);
    }

    return null;
  },
};
