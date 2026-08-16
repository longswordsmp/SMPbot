package com.longswordsmp.totemguardians.listener;

import com.longswordsmp.totemguardians.TotemGuardiansPlugin;
import com.longswordsmp.totemguardians.guardian.DespawnReason;
import com.longswordsmp.totemguardians.guardian.GuardianFactory;
import org.bukkit.Bukkit;
import org.bukkit.entity.Entity;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityCombustEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.entity.EntityTransformEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.world.ChunkLoadEvent;

import java.util.Arrays;

/** Keeps guardians from becoming loot, scenery casualties, drowned zombies, or orphans. */
public final class GuardianLifecycleListener implements Listener {

    private final TotemGuardiansPlugin plugin;

    public GuardianLifecycleListener(TotemGuardiansPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onEnvironmentalDamage(EntityDamageEvent event) {
        if (!isGuardian(event.getEntity())) {
            return;
        }
        if (plugin.settings().immuneDamageCauses().contains(event.getCause())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onCombust(EntityCombustEvent event) {
        if (isGuardian(event.getEntity())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onTransform(EntityTransformEvent event) {
        if (isGuardian(event.getEntity())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onPickup(EntityPickupItemEvent event) {
        if (isGuardian(event.getEntity())) {
            event.setCancelled(true);
        }
    }

    /** Netherite kits are temporary props, never drops. */
    @EventHandler(priority = EventPriority.HIGHEST)
    public void onDeath(EntityDeathEvent event) {
        if (!isGuardian(event.getEntity())) {
            return;
        }
        event.getDrops().clear();
        event.setDroppedExp(0);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onOwnerDeath(PlayerDeathEvent event) {
        if (plugin.settings().despawnOnOwnerDeath()) {
            plugin.manager().despawnFor(event.getEntity().getUniqueId(), DespawnReason.OWNER_DIED);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onOwnerQuit(PlayerQuitEvent event) {
        if (plugin.settings().despawnOnOwnerQuit()) {
            plugin.manager().despawnFor(event.getPlayer().getUniqueId(), DespawnReason.OWNER_OFFLINE);
        }
    }

    /**
     * A squad can expire while some of its guardians sit in unloaded chunks. When those chunks
     * come back, any guardian without a live squad is swept up.
     */
    @EventHandler
    public void onChunkLoad(ChunkLoadEvent event) {
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!event.getChunk().isLoaded()) {
                return;
            }
            plugin.manager().sweepStale(Arrays.asList(event.getChunk().getEntities()));
        });
    }

    private boolean isGuardian(Entity entity) {
        return GuardianFactory.isGuardian(entity, plugin.keys());
    }
}
