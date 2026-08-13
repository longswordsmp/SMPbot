'use strict';

const { MessageFlags } = require('discord.js');
const log = require('../../../core/logger');
const { truncate, relativeTime } = require('../../../core/utils');
const manager = require('../services/manager');

/**
 * Giveaway entry button — customId `giveaway:enter:<id>`.
 * Fully stateless: everything is rebuilt from the customId + database, so
 * buttons keep working across restarts. Clicking toggles the entry:
 * enter (with full requirement validation) or leave.
 */
module.exports = {
  prefix: 'giveaway',

  async handle(interaction, args) {
    const client = interaction.client;
    const [action, idRaw] = args;
    if (action !== 'enter' || !interaction.isButton() || !interaction.inGuild()) return null;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;

    const giveawayId = Number(idRaw);
    const giveaway = Number.isInteger(giveawayId)
      ? client.db.get('SELECT * FROM giveaways WHERE id = ?', giveawayId)
      : null;
    if (!giveaway || giveaway.guild_id !== interaction.guildId) {
      return interaction
        .editReply({ embeds: [client.brand.warn(guild, 'Giveaway unavailable', 'This giveaway no longer exists.')] })
        .catch(() => null);
    }
    if (giveaway.status === manager.STATUS.PAUSED) {
      return interaction
        .editReply({
          embeds: [client.brand.warn(guild, 'Giveaway paused', 'Entries are temporarily closed — check back soon!')],
        })
        .catch(() => null);
    }
    if (giveaway.status !== manager.STATUS.RUNNING || giveaway.ends_at <= Date.now()) {
      return interaction
        .editReply({ embeds: [client.brand.warn(guild, 'Giveaway ended', 'This giveaway is no longer accepting entries.')] })
        .catch(() => null);
    }

    const remaining = client.cooldowns.hit(`giveaway:enter:${giveaway.id}:${interaction.user.id}`, 3);
    if (remaining > 0) {
      return interaction
        .editReply({ embeds: [client.brand.warn(guild, 'Slow down', 'Please wait a moment before toggling your entry again.')] })
        .catch(() => null);
    }

    let member = interaction.member;
    if (!member?.roles?.cache || !member.user) {
      member = await guild.members.fetch(interaction.user.id).catch(() => null);
    }
    if (!member) {
      return interaction
        .editReply({
          embeds: [client.brand.error(guild, 'Something went wrong', 'Your membership could not be verified — please try again.')],
        })
        .catch(() => null);
    }

    const prize = truncate(giveaway.prize, 200);
    const existing = client.db.get(
      'SELECT 1 AS ok FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?',
      giveaway.id,
      interaction.user.id,
    );

    // Toggle off: clicking again leaves the giveaway.
    if (existing) {
      client.db.run('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?', giveaway.id, interaction.user.id);
      await manager.updateGiveawayMessage(client, guild, giveaway);
      return interaction
        .editReply({
          embeds: [
            client.brand.info(guild, 'Entry withdrawn', `You left the giveaway for **${prize}**. You can re-enter any time before it ends.`),
          ],
        })
        .catch(() => null);
    }

    // Toggle on: validate every requirement and report exactly what failed.
    let failures = [];
    let notes = [];
    try {
      const result = await manager.validateRequirements(client, guild, member, manager.parseRequirements(giveaway));
      failures = result.failures;
      notes = result.notes;
    } catch (err) {
      log.error(`Giveaways: requirement validation failed for giveaway #${giveaway.id}:`, err);
      return interaction
        .editReply({
          embeds: [client.brand.error(guild, 'Something went wrong', 'Your entry could not be checked — please try again.')],
        })
        .catch(() => null);
    }
    if (failures.length) {
      const lines = [...failures];
      if (notes.length) lines.push('', ...notes.map((n) => `ℹ️ ${n}`));
      return interaction
        .editReply({
          embeds: [client.brand.error(guild, 'You cannot enter this giveaway', truncate(lines.join('\n'), 4000))],
        })
        .catch(() => null);
    }

    client.db.run(
      'INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, entered_at) VALUES (?, ?, ?)',
      giveaway.id,
      interaction.user.id,
      Date.now(),
    );
    await manager.updateGiveawayMessage(client, guild, giveaway);

    const lines = [
      `Good luck! You are in the draw for **${prize}**.`,
      `Ends ${relativeTime(giveaway.ends_at)} — click the button again to leave.`,
    ];
    if (notes.length) lines.push('', ...notes.map((n) => `ℹ️ ${n}`));
    return interaction
      .editReply({ embeds: [client.brand.success(guild, 'Entry confirmed 🎉', truncate(lines.join('\n'), 4000))] })
      .catch(() => null);
  },
};
