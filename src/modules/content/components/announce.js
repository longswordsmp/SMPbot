'use strict';

const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const announcements = require('../services/announcements');
const announceCommand = require('../commands/announce');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function lacksPermission(interaction) {
  return !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Announcement components (prefix `announce`): the preview control buttons
 * (publish / edit / cancel) and the description text-editor modals. Drafts are
 * persisted in the `announcements` table and referenced by id in the customId,
 * so everything is rebuilt from the database.
 */
module.exports = {
  prefix: 'announce',

  async handle(interaction, args) {
    const client = interaction.client;
    const guild = interaction.guild;
    const [action, idRaw] = args;

    if (!interaction.inGuild()) return null;
    if (lacksPermission(interaction)) {
      return interaction
        .reply(eph({ embeds: [client.brand.error(guild, 'Missing permissions', 'You need **Manage Server** to manage announcements.')] }))
        .catch(() => null);
    }

    const id = /^\d+$/.test(String(idRaw ?? '')) ? Number(idRaw) : NaN;
    const draft = Number.isInteger(id) ? announcements.getAnnouncement(client, id) : null;
    const missing = !draft || draft.guild_id !== interaction.guildId;

    // --- Modals ------------------------------------------------------------
    if (action === 'createmodal' || action === 'editmodal') {
      if (!interaction.isModalSubmit()) return null;
      if (missing) {
        return interaction.reply(eph({ embeds: [client.brand.warn(guild, 'Draft expired', 'This announcement draft is no longer available.')] })).catch(() => null);
      }
      const data = announcements.parseData(draft);
      const description = String(interaction.fields.getTextInputValue('description') ?? '').trim();
      let footer = '';
      try {
        footer = String(interaction.fields.getTextInputValue('footer') ?? '').trim();
      } catch {
        footer = data.footer || '';
      }
      data.description = description.slice(0, announcements.LIMITS.description);
      data.footer = footer ? footer.slice(0, announcements.LIMITS.footer) : null;
      announcements.updateDraftData(client, draft.id, data, draft.run_at);
      return interaction
        .reply(eph(announcements.buildPreview(client, guild, data, draft.id, { scheduled: Boolean(draft.run_at), runAt: draft.run_at })))
        .catch(() => null);
    }

    // --- Buttons -----------------------------------------------------------
    if (!interaction.isButton()) return null;

    if (missing || draft.status !== 'draft') {
      return interaction
        .update({ embeds: [client.brand.warn(guild, 'Draft unavailable', 'This announcement draft is no longer active.')], components: [] })
        .catch(() => null);
    }

    if (action === 'cancel') {
      client.db.run('DELETE FROM announcements WHERE id = ?', draft.id);
      return interaction
        .update({ embeds: [client.brand.info(guild, 'Cancelled', 'The announcement was discarded.')], components: [] })
        .catch(() => null);
    }

    if (action === 'edit') {
      const data = announcements.parseData(draft);
      return interaction.showModal(announceCommand.descriptionModal(`announce:editmodal:${draft.id}`, data)).catch(() => null);
    }

    if (action === 'publish') {
      await interaction.deferUpdate().catch(() => null);
      return announceCommand.commitDraft(interaction, draft);
    }

    return null;
  },
};
