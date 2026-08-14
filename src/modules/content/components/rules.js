'use strict';

const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate } = require('../../../core/utils');
const rulesService = require('../services/rules');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function lacksPermission(interaction) {
  return !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Rules components (prefix `rules`): the starter-pack select menu and the
 * add/edit section modals. All rule data lives in the `rules` config namespace.
 */
module.exports = {
  prefix: 'rules',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    const [action, sectionId] = args;

    if (!interaction.inGuild()) return null;
    if (lacksPermission(interaction)) {
      return interaction
        .reply(eph({ embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to manage the rules.')] }))
        .catch(() => null);
    }

    if (action === 'setup' && interaction.isStringSelectMenu()) {
      const keys = interaction.values ?? [];
      const added = rulesService.applyStarters(client, guild.id, keys);
      if (!added.length) {
        return interaction
          .update({
            embeds: [client.brand.info(guild, 'Nothing added', 'Those starter packs were already present. Add custom sections with `/rules add`.')],
            components: [],
          })
          .catch(() => null);
      }
      const list = added.map((s, i) => `**${i + 1}.** ${s.emoji ? `${s.emoji} ` : ''}${truncate(s.title, 80)}`).join('\n');
      return interaction
        .update({
          embeds: [
            client.brand.success(
              guild,
              'Starter packs added',
              `Added **${added.length}** rule section(s):\n${list}\n\nEdit them with \`/rules edit\`, then publish with \`/rules publish\`.`,
            ),
          ],
          components: [],
        })
        .catch(() => null);
    }

    if (action === 'addmodal' && interaction.isModalSubmit()) {
      const result = rulesService.addSection(client, guild.id, {
        emoji: interaction.fields.getTextInputValue('emoji'),
        title: interaction.fields.getTextInputValue('title'),
        body: interaction.fields.getTextInputValue('body'),
      });
      return interaction
        .reply(
          eph({
            embeds: [
              result.ok
                ? client.brand.success(guild, 'Section added', `**${truncate(result.section.title, 100)}** was added. Publish with \`/rules publish\` when ready.`)
                : client.brand.error(guild, 'Could not add section', result.error),
            ],
          }),
        )
        .catch(() => null);
    }

    if (action === 'editmodal' && interaction.isModalSubmit()) {
      const result = rulesService.editSection(client, guild.id, sectionId, {
        emoji: interaction.fields.getTextInputValue('emoji'),
        title: interaction.fields.getTextInputValue('title'),
        body: interaction.fields.getTextInputValue('body'),
      });
      return interaction
        .reply(
          eph({
            embeds: [
              result.ok
                ? client.brand.success(guild, 'Section updated', `**${truncate(result.section.title, 100)}** was updated. Republish with \`/rules publish\` to update the channel.`)
                : client.brand.error(guild, 'Could not update section', result.error),
            ],
          }),
        )
        .catch(() => null);
    }

    return null;
  },
};
