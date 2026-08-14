'use strict';

const { SlashCommandBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const log = require('../../../core/logger');
const manager = require('../services/manager');
const { generateTranscript } = require('../services/transcripts');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

module.exports = {
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket in this channel')
    .addSubcommand((sub) => sub.setName('claim').setDescription('Claim this ticket (staff)'))
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Close this ticket')
        .addStringOption((opt) => opt.setName('reason').setDescription('Why the ticket is being closed').setMaxLength(500)),
    )
    .addSubcommand((sub) => sub.setName('reopen').setDescription('Reopen this closed ticket (staff)'))
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename this ticket channel (staff)')
        .addStringOption((opt) => opt.setName('name').setDescription('New channel name').setRequired(true).setMaxLength(90)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a member to this ticket (staff)')
        .addUserOption((opt) => opt.setName('user').setDescription('Member to add').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a member from this ticket (staff)')
        .addUserOption((opt) => opt.setName('user').setDescription('Member to remove').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('priority')
        .setDescription('Set this ticket\'s priority (staff)')
        .addStringOption((opt) =>
          opt
            .setName('level')
            .setDescription('Priority level')
            .setRequired(true)
            .addChoices(
              { name: '🟢 Low', value: 'low' },
              { name: '⚪ Normal', value: 'normal' },
              { name: '🟠 High', value: 'high' },
              { name: '🔴 Urgent', value: 'urgent' },
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName('transcript').setDescription('Generate a transcript of this ticket')),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    const ticket = manager.getTicketByChannel(client, guild.id, interaction.channelId);
    if (!ticket) {
      return interaction.reply(
        eph({ embeds: [client.brand.error(guild, 'Not a ticket', 'This command only works inside a ticket channel.')] }),
      );
    }
    const category = manager.getCategory(client, guild.id, ticket.category);
    const member = interaction.member;
    const staff = manager.isTicketStaff(member, category);
    const isOpener = interaction.user.id === ticket.opener_id;

    const staffOnly = ['claim', 'reopen', 'rename', 'add', 'remove', 'priority'];
    if (staffOnly.includes(sub) && !staff) {
      return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Staff only', 'Only ticket staff can do that.')] }));
    }

    if (sub === 'claim') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await manager.claimTicket(client, guild, ticket, member);
      return interaction.editReply({
        embeds: [
          res.ok
            ? client.brand.success(guild, 'Ticket claimed', `You are now handling ticket #${manager.pad(res.ticket.num)}.`)
            : client.brand.error(guild, 'Could not claim', res.error),
        ],
      });
    }

    if (sub === 'close') {
      if (!staff && !isOpener) {
        return interaction.reply(
          eph({ embeds: [client.brand.error(guild, 'Not allowed', 'Only the ticket opener or staff can close this ticket.')] }),
        );
      }
      const reason = interaction.options.getString('reason')?.trim() ?? '';
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await manager.closeTicket(client, guild, ticket, interaction.user, reason);
      return interaction.editReply({
        embeds: [
          res.ok
            ? client.brand.success(guild, 'Ticket closed', `Ticket #${manager.pad(res.ticket.num)} has been closed.`)
            : client.brand.error(guild, 'Could not close', res.error),
        ],
      });
    }

    if (sub === 'reopen') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await manager.reopenTicket(client, guild, ticket, interaction.user);
      return interaction.editReply({
        embeds: [
          res.ok
            ? client.brand.success(guild, 'Ticket reopened', `Ticket #${manager.pad(res.ticket.num)} is open again.`)
            : client.brand.error(guild, 'Could not reopen', res.error),
        ],
      });
    }

    if (sub === 'rename') {
      const sanitized = manager.sanitizeChannelName(interaction.options.getString('name'), '');
      if (!sanitized) {
        return interaction.reply(
          eph({ embeds: [client.brand.error(guild, 'Invalid name', 'Use letters, numbers, dashes, and underscores.')] }),
        );
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const settings = manager.getSettings(client, guild.id);
      const finalName = settings.priorityPrefix ? manager.applyPriorityPrefix(sanitized, ticket.priority) : sanitized;
      try {
        await interaction.channel.setName(finalName);
      } catch (err) {
        log.debug('Ticket rename failed:', err?.message ?? err);
        return interaction.editReply({
          embeds: [client.brand.error(guild, 'Rename failed', 'I could not rename the channel (renames are rate-limited by Discord).')],
        });
      }
      await manager.logTicket(client, guild, {
        title: `✏️ Ticket #${manager.pad(ticket.num)} renamed`,
        color: 'info',
        ticket,
        fields: [{ name: 'New name', value: `#${finalName}`, inline: true }],
      });
      return interaction.editReply({ embeds: [client.brand.success(guild, 'Renamed', `This channel is now **#${finalName}**.`)] });
    }

    if (sub === 'add' || sub === 'remove') {
      const user = interaction.options.getUser('user');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (sub === 'remove' && user.id === ticket.opener_id) {
        return interaction.editReply({ embeds: [client.brand.error(guild, 'Not allowed', 'You cannot remove the ticket opener.')] });
      }
      if (user.id === client.user.id) {
        return interaction.editReply({ embeds: [client.brand.error(guild, 'Not allowed', 'I need to stay in the ticket.')] });
      }
      try {
        if (sub === 'add') {
          await interaction.channel.permissionOverwrites.edit(
            user,
            { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true },
            { reason: `Added to ticket #${manager.pad(ticket.num)} by ${interaction.user.tag}` },
          );
        } else {
          await interaction.channel.permissionOverwrites.delete(
            user.id,
            `Removed from ticket #${manager.pad(ticket.num)} by ${interaction.user.tag}`,
          );
        }
      } catch (err) {
        log.debug(`Ticket ${sub} member failed:`, err?.message ?? err);
        return interaction.editReply({
          embeds: [
            sub === 'add'
              ? client.brand.error(guild, 'Could not add member', 'I was unable to update channel permissions.')
              : client.brand.warn(guild, 'Nothing to remove', 'That member had no direct access to this ticket.'),
          ],
        });
      }
      await manager.logTicket(client, guild, {
        title: `👥 Member ${sub === 'add' ? 'added to' : 'removed from'} ticket #${manager.pad(ticket.num)}`,
        color: sub === 'add' ? 'info' : 'warning',
        ticket,
        fields: [
          { name: 'Member', value: `<@${user.id}>`, inline: true },
          { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
        ],
      });
      return interaction.editReply({
        embeds: [
          client.brand.success(
            guild,
            sub === 'add' ? 'Member added' : 'Member removed',
            sub === 'add' ? `<@${user.id}> can now see this ticket.` : `<@${user.id}> no longer has direct access.`,
          ),
        ],
      });
    }

    if (sub === 'priority') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await manager.setPriority(client, guild, ticket, interaction.options.getString('level'), interaction.user);
      return interaction.editReply({
        embeds: [
          res.ok
            ? client.brand.success(guild, 'Priority updated', `Ticket #${manager.pad(res.ticket.num)} is now **${res.priority.label}**.`)
            : client.brand.error(guild, 'Could not update priority', res.error),
        ],
      });
    }

    if (sub === 'transcript') {
      if (!staff && !isOpener) {
        return interaction.reply(eph({ embeds: [client.brand.error(guild, 'Not allowed', 'Only the ticket opener or staff can do that.')] }));
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const { buffer, filename, messageCount } = await generateTranscript(interaction.channel, { ticket, guildName: guild.name });
        await client.logs.send(guild, 'tickets', {
          embeds: [
            client.brand
              .embed(guild, { color: 'info' })
              .setTitle(`📄 Transcript — ticket #${manager.pad(ticket.num)}`)
              .setDescription(`Requested by <@${interaction.user.id}> • ${messageCount} message(s).`),
          ],
          files: [new AttachmentBuilder(buffer, { name: filename })],
        });
        return interaction.editReply({
          embeds: [client.brand.success(guild, 'Transcript generated', `Captured **${messageCount}** message(s).`)],
          files: [new AttachmentBuilder(buffer, { name: filename })],
        });
      } catch (err) {
        log.warn('Ticket transcript failed:', err?.message ?? err);
        return interaction.editReply({
          embeds: [client.brand.error(guild, 'Transcript failed', 'I could not generate the transcript. Please try again.')],
        });
      }
    }

    return null;
  },
};
