'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { truncate, relativeTime, chunkArray, paginate, confirm } = require('../../../core/utils');
const engine = require('../services/engine');

function punishedBadge(punished) {
  if (punished === 'ban') return '🔨 banned';
  if (punished === 'kick') return '👢 kicked';
  if (punished === 'quarantine') return '🛡️ quarantined';
  return '⚠️ alert only';
}

module.exports = {
  cooldown: 3,
  permissions: PermissionFlagsBits.ManageGuild,
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Security overview, incident history, and malicious-bot protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('status').setDescription('Overview of every security system in this server'))
    .addSubcommand((sub) =>
      sub
        .setName('incidents')
        .setDescription('Browse recorded security incidents')
        .addUserOption((opt) => opt.setName('user').setDescription('Only show incidents attributed to this user')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('unquarantine')
        .setDescription('Restore the roles removed from a quarantined user')
        .addUserOption((opt) => opt.setName('user').setDescription('The quarantined user').setRequired(true)),
    )
    .addSubcommandGroup((group) =>
      group
        .setName('bots')
        .setDescription('Malicious-bot protection')
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Whitelist a bot so it can be added without alerts or enforcement')
            .addUserOption((opt) => opt.setName('bot').setDescription('The bot to whitelist').setRequired(true)),
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('Remove a bot from the whitelist')
            .addUserOption((opt) => opt.setName('bot').setDescription('The bot to remove').setRequired(true)),
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('Show the bot whitelist and current protection settings'))
        .addSubcommand((sub) =>
          sub
            .setName('action')
            .setDescription('What happens when a non-whitelisted bot is added')
            .addStringOption((opt) =>
              opt
                .setName('mode')
                .setDescription('Response to unauthorized bot additions')
                .setRequired(true)
                .addChoices(
                  { name: 'Alert only (default, recommended)', value: 'alert' },
                  { name: 'Kick the bot', value: 'kick' },
                  { name: 'Ban the bot', value: 'ban' },
                ),
            )
            .addBooleanOption((opt) =>
              opt.setName('quarantine_adder').setDescription('Also quarantine whoever added the bot (when enforcing)'),
            ),
        ),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    // ------------------------------------------------------------- bots group
    if (group === 'bots') {
      const cfg = engine.config(client, guild.id);
      const whitelist = Array.isArray(cfg.bots?.whitelist) ? [...cfg.bots.whitelist] : [];

      if (sub === 'add' || sub === 'remove') {
        const bot = interaction.options.getUser('bot');
        if (!bot?.bot) {
          return interaction.reply({
            embeds: [client.brand.error(guild, 'Not a bot', `<@${bot?.id ?? '?'}> is not a bot account.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        if (sub === 'add') {
          if (whitelist.includes(bot.id)) {
            return interaction.reply({
              embeds: [client.brand.warn(guild, 'Already whitelisted', `<@${bot.id}> is already on the whitelist.`)],
              flags: MessageFlags.Ephemeral,
            });
          }
          if (whitelist.length >= engine.MAX_WHITELIST) {
            return interaction.reply({
              embeds: [client.brand.error(guild, 'Whitelist full', `The whitelist is capped at **${engine.MAX_WHITELIST}** bots.`)],
              flags: MessageFlags.Ephemeral,
            });
          }
          client.config.update(guild.id, engine.NAMESPACE, { bots: { whitelist: [...whitelist, bot.id] } });
          await client.logs.send(guild, 'bots', {
            embeds: [client.brand.info(guild, 'Bot whitelisted', `<@${bot.id}> was whitelisted by <@${interaction.user.id}>.`)],
          });
          return interaction.reply({
            embeds: [client.brand.success(guild, 'Bot whitelisted', `<@${bot.id}> can now be added without alerts or enforcement.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        // remove
        if (!whitelist.includes(bot.id)) {
          return interaction.reply({
            embeds: [client.brand.warn(guild, 'Not whitelisted', `<@${bot.id}> is not on the whitelist.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
        client.config.update(guild.id, engine.NAMESPACE, { bots: { whitelist: whitelist.filter((id) => id !== bot.id) } });
        await client.logs.send(guild, 'bots', {
          embeds: [client.brand.info(guild, 'Bot removed from whitelist', `<@${bot.id}> was removed by <@${interaction.user.id}>.`)],
        });
        return interaction.reply({
          embeds: [client.brand.success(guild, 'Whitelist updated', `<@${bot.id}> was removed from the whitelist.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === 'action') {
        const mode = interaction.options.getString('mode');
        const quarantineAdder = interaction.options.getBoolean('quarantine_adder');
        if (!engine.BOT_ACTIONS.includes(mode)) {
          return interaction.reply({
            embeds: [client.brand.error(guild, 'Invalid mode', 'Choose alert, kick, or ban.')],
            flags: MessageFlags.Ephemeral,
          });
        }
        const patch = { bots: { action: mode } };
        if (quarantineAdder !== null) patch.bots.quarantineAdder = quarantineAdder;
        client.config.update(guild.id, engine.NAMESPACE, patch);
        return interaction.reply({
          embeds: [
            client.brand.success(
              guild,
              'Bot protection updated',
              `Unauthorized bot additions will now: **${mode === 'alert' ? 'alert the owner only' : `${mode} the bot`}**.` +
                (quarantineAdder !== null ? `\nQuarantine the adder: **${quarantineAdder ? 'Yes' : 'No'}**` : ''),
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }

      // list
      const value = whitelist.length ? whitelist.map((id) => `• <@${id}> (\`${id}\`)`).join('\n') : 'No bots whitelisted.';
      const embed = client.brand
        .embed(guild)
        .setTitle('🤖 Bot protection')
        .setDescription(
          `**Action on unauthorized bot:** \`${engine.BOT_ACTIONS.includes(cfg.bots?.action) ? cfg.bots.action : 'alert'}\`\n` +
            `**Quarantine the adder:** ${cfg.bots?.quarantineAdder ? 'Yes' : 'No'}`,
        )
        .addFields({ name: `Whitelist (${whitelist.length}/${engine.MAX_WHITELIST})`, value: truncate(value, 1024) });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // ---------------------------------------------------------------- status
    if (sub === 'status') {
      return interaction.reply({
        embeds: [engine.buildStatusEmbed(client, guild)],
        components: [engine.buildStatusRow(client, guild)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ------------------------------------------------------------- incidents
    if (sub === 'incidents') {
      const user = interaction.options.getUser('user');
      const rows = engine.listIncidents(client, guild.id, { executorId: user?.id ?? null, limit: 90 });
      if (!rows.length) {
        return interaction.reply({
          embeds: [
            client.brand.info(
              guild,
              'No incidents',
              user ? `No incidents attributed to <@${user.id}>.` : 'No security incidents recorded. Quiet is good.',
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
      const pages = chunkArray(rows, 6).map((chunk, idx, all) => {
        const embed = client.brand
          .embed(guild)
          .setTitle(`🚨 Security incidents${user ? ` — ${user.tag}` : ''}`)
          .setDescription(`**${rows.length}** most recent incident(s)${all.length > 1 ? ` • page ${idx + 1}/${all.length}` : ''}`);
        for (const row of chunk) {
          const label = engine.ACTIONS[row.action]?.label ?? (row.action === 'botAdd' ? 'Unauthorized bot addition' : row.action);
          embed.addFields({
            name: `#${row.id} • ${label}`,
            value: truncate(
              `${relativeTime(row.created_at)} • ${row.executor_id ? `<@${row.executor_id}>` : 'Unknown executor'} • ×${row.count} • ${punishedBadge(row.punished)}\n${row.details || '—'}`,
              1024,
            ),
          });
        }
        return embed;
      });
      return paginate(interaction, pages, { ephemeral: true });
    }

    // ---------------------------------------------------------- unquarantine
    if (sub === 'unquarantine') {
      const user = interaction.options.getUser('user', true);
      const row = client.db.get('SELECT role_ids FROM security_quarantine WHERE guild_id = ? AND user_id = ?', guild.id, user.id);
      if (!row) {
        return interaction.reply({
          embeds: [client.brand.warn(guild, 'Not quarantined', `<@${user.id}> has no quarantine record.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
      const ok = await confirm(interaction, {
        embed: client.brand.warn(
          guild,
          'Restore quarantined roles?',
          `This will give <@${user.id}> back **all** roles removed by the anti-nuke system — including any dangerous ones. Are you sure?`,
        ),
        confirmLabel: 'Restore roles',
        danger: true,
      });
      if (!ok) {
        return interaction.editReply({
          embeds: [client.brand.info(guild, 'Cancelled', 'No roles were restored.')],
        });
      }
      const result = await engine.releaseQuarantine(client, guild, user.id);
      const embed = result.ok
        ? client.brand.success(guild, 'Quarantine lifted', `${result.note}`)
        : client.brand.error(guild, 'Could not restore', result.note);
      if (result.ok) {
        await client.logs.send(guild, 'security', {
          embeds: [client.brand.info(guild, 'Quarantine lifted', `<@${user.id}> released by <@${interaction.user.id}>. ${result.note}`)],
        });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    return null;
  },
};
