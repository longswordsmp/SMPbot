package com.longswordsmp.totemguardians.listener;

import com.longswordsmp.totemguardians.TotemGuardiansPlugin;
import com.longswordsmp.totemguardians.guardian.GuardianManager;
import com.longswordsmp.totemguardians.guardian.GuardianSquad;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityTargetEvent;
import org.bukkit.projectiles.ProjectileSource;

/** Decides who the squad is allowed to hit, and who put themselves on the hit list. */
public final class CombatListener implements Listener {

    private final TotemGuardiansPlugin plugin;

    public CombatListener(TotemGuardiansPlugin plugin) {
        this.plugin = plugin;
    }

    /** Guardians never trade blows with their owner or with each other. */
    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onFriendlyFire(EntityDamageByEntityEvent event) {
        GuardianManager manager = plugin.manager();
        Entity victim = event.getEntity();
        LivingEntity attacker = resolveAttacker(event.getDamager());
        if (attacker == null) {
            return;
        }

        GuardianSquad attackerSquad = manager.squadOfGuardian(attacker);
        if (attackerSquad != null && isFriendly(attackerSquad, victim)) {
            event.setCancelled(true);
            return;
        }

        GuardianSquad victimSquad = manager.squadOfGuardian(victim);
        if (victimSquad != null && isFriendly(victimSquad, attacker)) {
            event.setCancelled(true);
        }
    }

    /** Anything that lands a hit on (or takes a hit from) a squad owner joins the hit list. */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCombat(EntityDamageByEntityEvent event) {
        GuardianManager manager = plugin.manager();
        Entity victim = event.getEntity();
        LivingEntity attacker = resolveAttacker(event.getDamager());
        if (attacker == null) {
            return;
        }

        // The owner swung first - ASSIST tiers pile in, DEFEND tiers hold.
        if (attacker instanceof Player attackingPlayer) {
            GuardianSquad squad = manager.squadOfOwner(attackingPlayer.getUniqueId());
            if (squad != null && squad.tier().targeting().marksOwnerVictims()) {
                manager.markThreat(squad, victim);
            }
        }

        // Someone hit the owner.
        if (victim instanceof Player victimPlayer) {
            GuardianSquad squad = manager.squadOfOwner(victimPlayer.getUniqueId());
            if (squad != null) {
                manager.markThreat(squad, attacker);
            }
        }

        // Someone hit a guardian.
        GuardianSquad damagedSquad = manager.squadOfGuardian(victim);
        if (damagedSquad != null && plugin.settings().retaliateForSquad()) {
            manager.markThreat(damagedSquad, attacker);
        }

        // A guardian connected - refresh the memory so the target does not slip away mid-fight.
        GuardianSquad strikingSquad = manager.squadOfGuardian(attacker);
        if (strikingSquad != null) {
            manager.markThreat(strikingSquad, victim);
        }
    }

    /** Vanilla mob AI is not allowed to pick targets for a guardian; only the hit list is. */
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onTarget(EntityTargetEvent event) {
        GuardianSquad squad = plugin.manager().squadOfGuardian(event.getEntity());
        if (squad == null) {
            return;
        }
        Entity target = event.getTarget();
        if (target == null) {
            return;
        }
        if (!squad.isThreat(target, System.currentTimeMillis())) {
            event.setCancelled(true);
        }
    }

    private boolean isFriendly(GuardianSquad squad, Entity entity) {
        if (entity == null) {
            return false;
        }
        return entity.getUniqueId().equals(squad.ownerId()) || squad.isGuardian(entity);
    }

    private LivingEntity resolveAttacker(Entity damager) {
        if (damager instanceof LivingEntity living) {
            return living;
        }
        if (damager instanceof Projectile projectile) {
            ProjectileSource shooter = projectile.getShooter();
            return shooter instanceof LivingEntity living ? living : null;
        }
        if (damager instanceof TNTPrimed tnt) {
            return tnt.getSource() instanceof LivingEntity living ? living : null;
        }
        return null;
    }
}
