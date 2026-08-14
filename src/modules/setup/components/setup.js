'use strict';

const { MessageFlags } = require('discord.js');
const log = require('../../../core/logger');
const { confirm } = require('../../../core/utils');
const w = require('../services/wizard');
const { STEPS } = require('../services/steps');

/**
 * Every `/setup` component (buttons, selects, modals) routes through here.
 * The wizard holds NO in-memory session state — everything needed is either in
 * the `setup` config namespace or encoded in the customId, so it survives a
 * restart mid-flight.
 *
 * customId scheme (prefix `setup`):
 *   setup:home                      → overview dashboard
 *   setup:jump            (select)  → jump to values[0]
 *   setup:goto:<stepId>             → jump to a step
 *   setup:continue                  → next incomplete step (or finish)
 *   setup:finish                    → finish screen
 *   setup:reset                     → reset progress (confirm)
 *   setup:mark:<stepId>:done|skip   → set a step's status, return to overview
 *   setup:step:<stepId>:<action>…   → step-specific action / modal
 */
module.exports = {
  prefix: 'setup',

  async handle(interaction, args) {
    const client = interaction.client;

    if (!interaction.inGuild()) {
      return interaction.reply({
        embeds: [client.brand.error(null, 'Server only', 'The setup wizard only works inside a server.')],
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!w.authorized(interaction)) {
      return interaction.reply({
        embeds: [client.brand.error(interaction.guild, 'Owner only', 'Only the **server owner** can use the setup wizard.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const guild = interaction.guild;
    const ctx = { client, guild, interaction, member: interaction.member };
    const [action, ...rest] = args;

    try {
      switch (action) {
        case 'home':
          return await interaction.update(w.buildHome(client, guild));

        case 'jump': {
          const stepId = interaction.isStringSelectMenu() ? interaction.values[0] : null;
          return await renderStep(interaction, ctx, stepId);
        }

        case 'goto':
          return await renderStep(interaction, ctx, rest[0]);

        case 'continue': {
          const next = w.nextIncomplete(client, guild.id);
          if (!next) return await interaction.update(w.buildFinish(client, guild));
          return await renderStep(interaction, ctx, next);
        }

        case 'finish':
          return await interaction.update(w.buildFinish(client, guild));

        case 'reset': {
          const ok = await confirm(interaction, {
            embed: client.brand.warn(guild, 'Reset setup progress?', 'This clears which steps are marked done or skipped. It does **not** undo anything already configured (roles, channels, settings stay).'),
            confirmLabel: 'Reset progress',
            danger: true,
          });
          if (!ok) return null;
          w.resetProgress(client, guild.id);
          return await interaction.editReply(w.buildHome(client, guild)).catch(() => null);
        }

        case 'mark': {
          const stepId = rest[0];
          const state = rest[1] === 'skip' ? 'skipped' : 'done';
          if (w.STEP_INDEX.has(stepId)) w.setStepState(client, guild.id, stepId, state);
          return await interaction.update(w.buildHome(client, guild));
        }

        case 'step': {
          const stepId = rest[0];
          const stepAction = rest[1];
          const step = STEPS[stepId];
          if (!step) {
            return interaction.reply({
              embeds: [client.brand.warn(guild, 'Unknown step', 'That setup step is not available.')],
              flags: MessageFlags.Ephemeral,
            });
          }
          return await step.handle(ctx, stepAction, rest.slice(2));
        }

        default:
          return interaction.reply({
            embeds: [client.brand.warn(guild, 'Expired', 'This wizard control is no longer active. Run `/setup` again.')],
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (err) {
      log.error(`setup component '${interaction.customId}' failed:`, err);
      // Let the core router render the branded error if we never responded.
      if (!interaction.replied && !interaction.deferred) throw err;
      return null;
    }
  },
};

/** Render a step screen in place, degrading gracefully for a bad/missing id. */
async function renderStep(interaction, ctx, stepId) {
  const { client, guild } = ctx;
  const step = STEPS[stepId];
  if (!step) return interaction.update(w.buildHome(client, guild)).catch(() => null);
  const view = step.view(ctx);
  return interaction.update(view).catch(() => null);
}
