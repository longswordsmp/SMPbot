'use strict';

const { MessageFlags } = require('discord.js');
const log = require('../../../core/logger');
const { isGuildOwner, isBotOwner } = require('../../../core/permissions');
const manager = require('../services/manager');

const SCOPE_LABELS = {
  config: 'Config only',
  missing: 'Missing structure',
  full: 'Full structure',
};

module.exports = {
  prefix: 'backup',

  async handle(interaction, args) {
    const client = interaction.client;
    const [action, backupId] = args;

    if (action !== 'restore' || !interaction.isStringSelectMenu()) return null;

    const guild = interaction.guild;
    // Restore is guild-owner only — re-check here since the router only guards commands.
    if (!guild || (!isGuildOwner(interaction.member) && !isBotOwner(interaction.user.id))) {
      return interaction
        .reply({
          embeds: [client.brand.error(guild, 'Owner only', 'Only the **server owner** can restore from a backup.')],
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => null);
    }

    const scope = interaction.values?.[0];
    if (!manager.RESTORE_SCOPES.has(scope)) {
      return interaction
        .update({ embeds: [client.brand.error(guild, 'Invalid choice', 'That restore scope is not recognised.')], components: [] })
        .catch(() => null);
    }

    const snapshot = manager.getBackup(client, guild.id, backupId);
    if (!snapshot) {
      return interaction
        .update({
          embeds: [client.brand.error(guild, 'Backup unavailable', 'This backup no longer exists — it may have been deleted or rotated out.')],
          components: [],
        })
        .catch(() => null);
    }

    await interaction.deferUpdate().catch(() => null);

    // Throttled progress reporting so we do not hit rate limits mid-restore.
    let lastEdit = 0;
    const onProgress = async (result, phase) => {
      const now = Date.now();
      if (now - lastEdit < 1500) return;
      lastEdit = now;
      await interaction
        .editReply({
          embeds: [
            client.brand
              .embed(guild, { color: 'warning' })
              .setTitle('⏳ Restoring backup…')
              .setDescription(
                [
                  `Scope: **${SCOPE_LABELS[scope]}** • Backup \`${snapshot.id}\``,
                  `Phase: **${phase}**`,
                  '',
                  `Roles created: **${result.createdRoles}**`,
                  `Channels created: **${result.createdChannels}**`,
                  `Channels updated: **${result.updatedChannels}**`,
                  `Skipped: **${result.skipped}**`,
                ].join('\n'),
              ),
          ],
          components: [],
        })
        .catch(() => null);
    };

    let result;
    try {
      result = await manager.performRestore(client, guild, snapshot, scope, onProgress);
    } catch (err) {
      log.error(`backup: restore failed for guild ${guild.id} (backup ${snapshot.id}):`, err?.message ?? err);
      return interaction
        .editReply({
          embeds: [
            client.brand.error(
              guild,
              'Restore failed',
              'Something went wrong partway through the restore. Any changes already applied were kept. Please review the server and try again.',
            ),
          ],
          components: [],
        })
        .catch(() => null);
    }

    const summaryLines =
      scope === 'config'
        ? [result.config ? 'SMPbot configuration was reapplied from the backup.' : 'No configuration could be imported.']
        : [
            `Roles created: **${result.createdRoles}**`,
            `Channels created: **${result.createdChannels}**`,
            ...(scope === 'full' ? [`Channels updated: **${result.updatedChannels}**`] : []),
            `Skipped (already present / unmappable): **${result.skipped}**`,
            '',
            '_Member role assignments are not restored — recreated roles start empty._',
          ];

    await client.logs
      .send(guild, 'server', {
        embeds: [
          client.brand
            .embed(guild, { color: 'warning' })
            .setTitle('💾 Backup restored')
            .setDescription(
              `Backup \`${snapshot.id}\` restored (**${SCOPE_LABELS[scope]}**) by <@${interaction.user.id}> — ` +
                `+${result.createdRoles} roles, +${result.createdChannels} channels, ~${result.updatedChannels} updated, ${result.skipped} skipped.`,
            ),
        ],
      })
      .catch(() => null);

    return interaction
      .editReply({
        embeds: [client.brand.success(guild, `Restore complete — ${SCOPE_LABELS[scope]}`, summaryLines.join('\n'))],
        components: [],
      })
      .catch(() => null);
  },
};
