package com.longswordsmp.totemguardians.listener;

import com.longswordsmp.totemguardians.TotemGuardiansPlugin;
import com.longswordsmp.totemguardians.config.GuardianTier;
import com.longswordsmp.totemguardians.guardian.SummonResult;
import com.longswordsmp.totemguardians.util.Compat;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityResurrectEvent;
import org.bukkit.inventory.ItemStack;

import java.util.Map;

/** Watches for a Totem of Undying being spent and turns an Unbreaking level into a squad. */
public final class TotemListener implements Listener {

    private final TotemGuardiansPlugin plugin;
    private final Enchantment unbreaking;

    public TotemListener(TotemGuardiansPlugin plugin) {
        this.plugin = plugin;
        this.unbreaking = Compat.enchantment("unbreaking");
        if (unbreaking == null) {
            plugin.getLogger().severe("Could not resolve the Unbreaking enchantment on this server version. "
                    + "Guardians will never be summoned.");
        }
    }

    /**
     * MONITOR + ignoreCancelled means we only act on a totem that is actually being consumed:
     * Bukkit fires this event pre-cancelled when the player has no totem, and other plugins get
     * their chance to veto the resurrection first.
     */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onResurrect(EntityResurrectEvent event) {
        if (unbreaking == null || !(event.getEntity() instanceof Player player)) {
            return;
        }
        if (!player.hasPermission("totemguardians.use")) {
            return;
        }

        int level = unbreakingLevelInHands(player);
        if (level <= 0) {
            return;
        }
        GuardianTier tier = plugin.settings().tierFor(level);
        if (tier == null) {
            return;
        }

        // The totem is still in hand right now; wait a tick so the resurrection has fully resolved.
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!player.isOnline() || player.isDead()) {
                return;
            }
            SummonResult result = plugin.manager().summon(player, tier, true);
            reportFailure(player, result);
        });
    }

    private int unbreakingLevelInHands(Player player) {
        int level = 0;
        ItemStack[] hands = {
                player.getInventory().getItemInMainHand(),
                player.getInventory().getItemInOffHand()
        };
        for (ItemStack item : hands) {
            if (item == null || item.getType() != Material.TOTEM_OF_UNDYING) {
                continue;
            }
            level = Math.max(level, item.getEnchantmentLevel(unbreaking));
        }
        return level;
    }

    private void reportFailure(Player player, SummonResult result) {
        switch (result) {
            case ON_COOLDOWN -> {
                long remaining = plugin.manager().cooldownRemainingMillis(player, System.currentTimeMillis());
                plugin.message(player, "cooldown", Map.of("seconds", String.valueOf((remaining + 999L) / 1000L)));
            }
            case ALREADY_ACTIVE -> plugin.message(player, "already-active");
            case WORLD_DISABLED -> plugin.message(player, "world-disabled");
            case SPAWN_FAILED -> plugin.getLogger().warning("Failed to spawn any guardians for " + player.getName() + ".");
            default -> {
                // SUCCESS and NO_TIER need no feedback here.
            }
        }
    }
}
