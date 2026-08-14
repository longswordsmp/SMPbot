'use strict';

const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const log = require('../../../core/logger');
const { confirm, formatDuration } = require('../../../core/utils');
const manager = require('../services/manager');
const { generateTranscript } = require('../services/transcripts');

function eph(payload) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function denyStaff(interaction) {
  return interaction
    .reply(eph({ embeds: [interaction.client.brand.error(interaction.guild, 'Staff only', 'Only ticket staff can do that.')] }))
    .catch(() => null);
}

async function openTicketFlow(interaction, key) {
  const client = interaction.client;
  const category = manager.getCategory(client, interaction.guildId, key);
  if (!category) {
    return interaction.reply(
      eph({
        embeds: [
          client.brand.error(interaction.guild, 'Category unavailable', 'This ticket category no longer exists. Ask staff to update the panel.'),
        ],
      }),
    );
  }

  const cooldownKey = `tickets:open:${interaction.guildId}:${interaction.user.id}:${category.key}`;
  if (category.cooldownSeconds > 0) {
    const remaining = client.cooldowns.hit(cooldownKey, category.cooldownSeconds);
    if (remaining > 0) {
      return interaction.reply(
        eph({
          embeds: [
            client.brand.warn(
              interaction.guild,
              'Slow down',
              `You can open another **${category.label}** ticket in **${formatDuration(remaining) || '1s'}**.`,
            ),
          ],
        }),
      );
    }
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await manager.openTicket(client, interaction.guild, interaction.member, category);
  if (!result.ok) {
    client.cooldowns.clear(cooldownKey); // failed attempts should not burn the cooldown
    return interaction.editReply({ embeds: [client.brand.error(interaction.guild, 'Could not open ticket', result.error)] });
  }
  return interaction.editReply({
    embeds: [client.brand.success(interaction.guild, 'Ticket created', `Your **${category.label}** ticket is ready: ${result.channel}`)],
  });
}

module.exports = {
  prefix: 'ticket',

  async handle(interaction, args) {
    const client = interaction.client;
    if (!interaction.inGuild() || !interaction.guild) {
      return interaction
        .reply(eph({ embeds: [client.brand.error(null, 'Server only', 'Tickets only work inside a server.')] }))
        .catch(() => null);
    }
    const [action, arg] = args;

    if (action === 'open') return openTicketFlow(interaction, arg);
    if (action === 'openselect') return openTicketFlow(interaction, interaction.values?.[0]);

    const ticket = manager.getTicket(client, Number(arg));
    if (!ticket || ticket.guild_id !== interaction.guildId) {
      return interaction
        .reply(eph({ embeds: [client.brand.warn(interaction.guild, 'Ticket not found', 'This ticket no longer exists.')] }))
        .catch(() => null);
    }
    const guild = interaction.guild;
    const category = manager.getCategory(client, guild.id, ticket.category);
    const member = interaction.member;
    const staff = manager.isTicketStaff(member, category);
    const isOpener = interaction.user.id === ticket.opener_id;

    switch (action) {
      case 'claim': {
        if (!staff) return denyStaff(interaction);
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

      case 'close': {
        if (!staff && !isOpener) return denyStaff(interaction);
        if (ticket.status !== 'open') {
          return interaction.reply(eph({ embeds: [client.brand.warn(guild, 'Not open', 'This ticket is not open.')] }));
        }
        // showModal MUST be the first response — no deferring beforehand.
        const modal = new ModalBuilder()
          .setCustomId(`ticket:closemodal:${ticket.id}`)
          .setTitle(`Close ticket #${manager.pad(ticket.num)}`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(500),
            ),
          );
        return interaction.showModal(modal);
      }

      case 'closemodal': {
        if (!staff && !isOpener) return denyStaff(interaction);
        let reason = '';
        try {
          reason = interaction.fields.getTextInputValue('reason')?.trim() ?? '';
        } catch {
          reason = '';
        }
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

      case 'reopen': {
        if (!staff) return denyStaff(interaction);
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

      case 'delete': {
        if (!staff) return denyStaff(interaction);
        const confirmed = await confirm(interaction, {
          embed: client.brand.warn(
            guild,
            'Delete this ticket?',
            'The channel will be **permanently deleted**. A transcript will be saved to the ticket log first.',
          ),
          confirmLabel: 'Delete ticket',
          danger: true,
        });
        if (!confirmed) {
          return interaction.editReply({ embeds: [client.brand.info(guild, 'Cancelled', 'The ticket was not deleted.')] }).catch(() => null);
        }
        await interaction
          .editReply({ embeds: [client.brand.info(guild, 'Deleting…', 'Saving the transcript and removing the channel.')] })
          .catch(() => null);
        const res = await manager.deleteTicket(client, guild, ticket, interaction.user);
        if (!res.ok) {
          return interaction.editReply({ embeds: [client.brand.error(guild, 'Delete failed', res.error)] }).catch(() => null);
        }
        return null; // channel is gone — nothing left to say there
      }

      case 'transcript': {
        if (!staff && !isOpener) return denyStaff(interaction);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channel = await manager.fetchTicketChannel(guild, ticket);
        if (!channel) {
          return interaction.editReply({ embeds: [client.brand.error(guild, 'No channel', 'The ticket channel no longer exists.')] });
        }
        try {
          const { buffer, filename, messageCount } = await generateTranscript(channel, { ticket, guildName: guild.name });
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
          log.warn('Ticket transcript generation failed:', err?.message ?? err);
          return interaction.editReply({
            embeds: [client.brand.error(guild, 'Transcript failed', 'I could not generate the transcript. Please try again.')],
          });
        }
      }

      case 'priomenu': {
        if (!staff) return denyStaff(interaction);
        const current = manager.PRIORITIES[ticket.priority] ?? manager.PRIORITIES.normal;
        const menu = new StringSelectMenuBuilder()
          .setCustomId(`ticket:priority:${ticket.id}`)
          .setPlaceholder('Choose a priority…')
          .addOptions(
            Object.values(manager.PRIORITIES).map((p) => ({
              label: p.label,
              value: p.key,
              emoji: p.emoji,
              default: p.key === ticket.priority,
            })),
          );
        return interaction.reply(
          eph({
            embeds: [client.brand.info(guild, 'Ticket priority', `Current priority: ${current.emoji} **${current.label}**`)],
            components: [new ActionRowBuilder().addComponents(menu)],
          }),
        );
      }

      case 'priority': {
        if (!staff) return denyStaff(interaction);
        const value = interaction.values?.[0];
        await interaction.deferUpdate().catch(() => null);
        const res = await manager.setPriority(client, guild, ticket, value, interaction.user);
        return interaction
          .editReply({
            embeds: [
              res.ok
                ? client.brand.success(guild, 'Priority updated', `Ticket #${manager.pad(res.ticket.num)} is now **${res.priority.label}**.`)
                : client.brand.error(guild, 'Could not update priority', res.error),
            ],
            components: [],
          })
          .catch(() => null);
      }

      case 'rename': {
        if (!staff) return denyStaff(interaction);
        const input = new TextInputBuilder()
          .setCustomId('name')
          .setLabel('New channel name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(90);
        const currentName = interaction.channel?.name;
        if (currentName) input.setValue(String(currentName).slice(0, 90));
        const modal = new ModalBuilder()
          .setCustomId(`ticket:renamemodal:${ticket.id}`)
          .setTitle('Rename ticket channel')
          .addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      case 'renamemodal': {
        if (!staff) return denyStaff(interaction);
        const raw = interaction.fields.getTextInputValue('name');
        const sanitized = manager.sanitizeChannelName(raw, '');
        if (!sanitized) {
          return interaction.reply(
            eph({ embeds: [client.brand.error(guild, 'Invalid name', 'Use letters, numbers, dashes, and underscores.')] }),
          );
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const settings = manager.getSettings(client, guild.id);
        const finalName = settings.priorityPrefix ? manager.applyPriorityPrefix(sanitized, ticket.priority) : sanitized;
        const channel = await manager.fetchTicketChannel(guild, ticket);
        if (!channel) {
          return interaction.editReply({ embeds: [client.brand.error(guild, 'No channel', 'The ticket channel no longer exists.')] });
        }
        try {
          await channel.setName(finalName);
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

      case 'members': {
        if (!staff) return denyStaff(interaction);
        const addRow = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`ticket:addmember:${ticket.id}`)
            .setPlaceholder('Add a member to this ticket…')
            .setMinValues(1)
            .setMaxValues(1),
        );
        const removeRow = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(`ticket:removemember:${ticket.id}`)
            .setPlaceholder('Remove a member from this ticket…')
            .setMinValues(1)
            .setMaxValues(1),
        );
        return interaction.reply(
          eph({
            embeds: [client.brand.info(guild, 'Ticket members', 'Use the menus below to add or remove a member from this ticket.')],
            components: [addRow, removeRow],
          }),
        );
      }

      case 'addmember': {
        if (!staff) return denyStaff(interaction);
        const userId = interaction.values?.[0];
        await interaction.deferUpdate().catch(() => null);
        const channel = await manager.fetchTicketChannel(guild, ticket);
        if (!channel || !userId) {
          return interaction
            .followUp(eph({ embeds: [client.brand.error(guild, 'Could not add member', 'The ticket channel no longer exists.')] }))
            .catch(() => null);
        }
        const user = interaction.users?.get?.(userId) ?? (await client.users.fetch(userId).catch(() => null));
        try {
          await channel.permissionOverwrites.edit(
            user ?? userId,
            { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true },
            { reason: `Added to ticket #${manager.pad(ticket.num)} by ${interaction.user.tag}` },
          );
        } catch (err) {
          log.debug('Ticket add member failed:', err?.message ?? err);
          return interaction
            .followUp(eph({ embeds: [client.brand.error(guild, 'Could not add member', 'I was unable to update channel permissions.')] }))
            .catch(() => null);
        }
        await manager.logTicket(client, guild, {
          title: `👥 Member added to ticket #${manager.pad(ticket.num)}`,
          color: 'info',
          ticket,
          fields: [{ name: 'Member', value: `<@${userId}>`, inline: true }, { name: 'By', value: `<@${interaction.user.id}>`, inline: true }],
        });
        return interaction
          .followUp(eph({ embeds: [client.brand.success(guild, 'Member added', `<@${userId}> can now see this ticket.`)] }))
          .catch(() => null);
      }

      case 'removemember': {
        if (!staff) return denyStaff(interaction);
        const userId = interaction.values?.[0];
        await interaction.deferUpdate().catch(() => null);
        if (userId === ticket.opener_id) {
          return interaction
            .followUp(eph({ embeds: [client.brand.error(guild, 'Not allowed', 'You cannot remove the ticket opener.')] }))
            .catch(() => null);
        }
        if (userId === client.user.id) {
          return interaction
            .followUp(eph({ embeds: [client.brand.error(guild, 'Not allowed', 'I need to stay in the ticket.')] }))
            .catch(() => null);
        }
        const channel = await manager.fetchTicketChannel(guild, ticket);
        if (!channel || !userId) {
          return interaction
            .followUp(eph({ embeds: [client.brand.error(guild, 'Could not remove member', 'The ticket channel no longer exists.')] }))
            .catch(() => null);
        }
        try {
          await channel.permissionOverwrites.delete(userId, `Removed from ticket #${manager.pad(ticket.num)} by ${interaction.user.tag}`);
        } catch (err) {
          log.debug('Ticket remove member failed:', err?.message ?? err);
          return interaction
            .followUp(eph({ embeds: [client.brand.warn(guild, 'Nothing to remove', 'That member had no direct access to this ticket.')] }))
            .catch(() => null);
        }
        await manager.logTicket(client, guild, {
          title: `👥 Member removed from ticket #${manager.pad(ticket.num)}`,
          color: 'warning',
          ticket,
          fields: [{ name: 'Member', value: `<@${userId}>`, inline: true }, { name: 'By', value: `<@${interaction.user.id}>`, inline: true }],
        });
        return interaction
          .followUp(eph({ embeds: [client.brand.success(guild, 'Member removed', `<@${userId}> no longer has direct access.`)] }))
          .catch(() => null);
      }

      default:
        return null;
    }
  },
};
