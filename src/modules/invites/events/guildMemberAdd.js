'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const { relativeTime } = require('../../../core/utils');
const tracker = require('../services/tracker');

/**
 * Attribute every join to the invite that was used (regular invite, vanity
 * URL, or unknown), persist it, and optionally append an entry to the
 * 'invites' guild log.
 */
module.exports = {
  event: Events.GuildMemberAdd,

  async execute(client, member) {
    try {
      const guild = member?.guild;
      if (!guild?.id || !member.id) return;
      if (member.partial) member = await member.fetch().catch(() => member);

      const cfg = tracker.config(client, guild.id);

      // Bots join via OAuth, not invites — record them unattributed and skip the diff.
      if (member.user?.bot) {
        tracker.recordJoin(client, member, { code: null, inviterId: null, vanity: false }, cfg);
        return;
      }

      const attribution = await tracker.attributeJoin(client, member);
      const { fake, reason } = tracker.recordJoin(client, member, attribution, cfg);

      if (!cfg.logJoins) return;

      let invitedBy;
      let statsLine = '';
      if (attribution.inviterId) {
        const stats = tracker.getStats(client, guild.id, attribution.inviterId);
        invitedBy = `<@${attribution.inviterId}>${attribution.code ? ` (code \`${attribution.code}\`)` : ''}`;
        statsLine = `\n<@${attribution.inviterId}> now has **${stats.total}** invite${Math.abs(stats.total) === 1 ? '' : 's'}.`;
      } else if (attribution.vanity) {
        invitedBy = 'the **vanity URL**';
      } else {
        invitedBy = 'an **unknown invite**';
      }

      const embed = client.brand
        .embed(guild, { color: fake ? 'warning' : 'success' })
        .setTitle('📥 Member joined')
        .setDescription(`<@${member.id}> joined; invited by ${invitedBy}.${statsLine}`)
        .addFields({
          name: 'Account created',
          value: Number.isFinite(member.user?.createdTimestamp) ? relativeTime(member.user.createdTimestamp) : 'Unknown',
          inline: true,
        });
      if (fake) embed.addFields({ name: 'Counted as fake', value: reason ?? 'heuristic match', inline: true });
      if (member.user?.displayAvatarURL) embed.setThumbnail(member.user.displayAvatarURL({ size: 128 }));

      await client.logs.send(guild, 'invites', { embeds: [embed] });
    } catch (err) {
      log.warn('invites guildMemberAdd handler failed:', err?.message ?? err);
    }
  },
};
