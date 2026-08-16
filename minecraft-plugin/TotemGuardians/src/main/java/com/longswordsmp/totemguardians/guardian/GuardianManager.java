package com.longswordsmp.totemguardians.guardian;

import com.longswordsmp.totemguardians.TotemGuardiansPlugin;
import com.longswordsmp.totemguardians.config.GuardianTier;
import com.longswordsmp.totemguardians.config.PluginSettings;
import com.longswordsmp.totemguardians.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Mob;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Owns every live squad: spawning, targeting, following, expiry and cleanup. */
public final class GuardianManager {

    private final TotemGuardiansPlugin plugin;
    private final GuardianFactory factory;
    private final Random random = new Random();

    private final Map<UUID, GuardianSquad> squadsByOwner = new ConcurrentHashMap<>();
    private final Map<UUID, GuardianSquad> squadsByGuardian = new ConcurrentHashMap<>();
    private final Map<UUID, Long> cooldowns = new HashMap<>();

    private BukkitTask task;
    private boolean pathfinderAvailable = true;

    public GuardianManager(TotemGuardiansPlugin plugin) {
        this.plugin = plugin;
        this.factory = new GuardianFactory(plugin.keys());
    }

    // ------------------------------------------------------------------ lifecycle

    public void start() {
        stop();
        int interval = plugin.settings().retargetIntervalTicks();
        this.task = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, interval, interval);
    }

    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    public void restart() {
        start();
    }

    public void shutdown() {
        stop();
        for (GuardianSquad squad : new ArrayList<>(squadsByOwner.values())) {
            despawn(squad, DespawnReason.SHUTDOWN);
        }
        squadsByOwner.clear();
        squadsByGuardian.clear();
    }

    // ------------------------------------------------------------------ summoning

    public SummonResult summon(Player owner, GuardianTier tier, boolean enforceRules) {
        if (tier == null) {
            return SummonResult.NO_TIER;
        }
        PluginSettings settings = plugin.settings();
        if (enforceRules && settings.isWorldDisabled(owner.getWorld().getName())) {
            return SummonResult.WORLD_DISABLED;
        }

        long now = System.currentTimeMillis();
        if (enforceRules && cooldownRemainingMillis(owner, now) > 0L) {
            return SummonResult.ON_COOLDOWN;
        }

        GuardianSquad existing = squadsByOwner.get(owner.getUniqueId());
        if (existing != null) {
            if (enforceRules && !settings.replaceExistingSquad()) {
                return SummonResult.ALREADY_ACTIVE;
            }
            despawn(existing, DespawnReason.REPLACED);
        }

        GuardianSquad squad = new GuardianSquad(owner.getUniqueId(), tier, now);
        Location origin = owner.getLocation();
        for (int index = 0; index < tier.count(); index++) {
            Mob guardian = factory.spawn(squad, origin, index, tier.count());
            if (guardian != null) {
                squad.addGuardian(guardian.getUniqueId());
                squadsByGuardian.put(guardian.getUniqueId(), squad);
            }
        }
        if (squad.guardianIds().isEmpty()) {
            return SummonResult.SPAWN_FAILED;
        }

        squadsByOwner.put(owner.getUniqueId(), squad);
        if (enforceRules && settings.cooldownMillis() > 0L) {
            cooldowns.put(owner.getUniqueId(), now + settings.cooldownMillis());
        }

        playEffects(origin, settings.spawnSound(), settings.spawnParticle());
        plugin.message(owner, "summoned", Map.of(
                "count", String.valueOf(squad.guardianIds().size()),
                "tier", tier.displayName(),
                "duration", Text.duration(tier.durationSeconds())));
        return SummonResult.SUCCESS;
    }

    public long cooldownRemainingMillis(Player owner, long now) {
        if (plugin.settings().cooldownMillis() <= 0L || owner.hasPermission("totemguardians.bypass.cooldown")) {
            return 0L;
        }
        Long until = cooldowns.get(owner.getUniqueId());
        return until == null ? 0L : Math.max(0L, until - now);
    }

    // ------------------------------------------------------------------ per-tick work

    private void tick() {
        long now = System.currentTimeMillis();
        PluginSettings settings = plugin.settings();

        for (GuardianSquad squad : new ArrayList<>(squadsByOwner.values())) {
            Player owner = Bukkit.getPlayer(squad.ownerId());
            if (owner == null || !owner.isOnline()) {
                if (settings.despawnOnOwnerQuit()) {
                    despawn(squad, DespawnReason.OWNER_OFFLINE);
                }
                continue;
            }
            if (now >= squad.expiresAt()) {
                despawn(squad, DespawnReason.EXPIRED);
                continue;
            }

            squad.pruneThreats(now);
            updateGuardians(squad, owner, now, settings);

            if (squad.guardianIds().isEmpty()) {
                despawn(squad, DespawnReason.WIPED);
                continue;
            }
            if (settings.actionBarTimer()) {
                Text.actionBar(owner, plugin.format("action-bar", Map.of(
                        "count", String.valueOf(squad.guardianIds().size()),
                        "time", Text.clock(squad.remainingMillis(now)),
                        "tier", squad.tier().displayName())));
            }
        }
    }

    private void updateGuardians(GuardianSquad squad, Player owner, long now, PluginSettings settings) {
        for (UUID guardianId : new ArrayList<>(squad.guardianIds())) {
            Entity entity = Bukkit.getEntity(guardianId);
            if (!(entity instanceof Mob guardian) || !guardian.isValid()) {
                squad.removeGuardian(guardianId);
                squadsByGuardian.remove(guardianId);
                continue;
            }

            LivingEntity target = pickTarget(squad, guardian, now, settings);
            if (target != null) {
                if (guardian.getTarget() != target) {
                    guardian.setTarget(target);
                }
                continue;
            }
            if (guardian.getTarget() != null) {
                guardian.setTarget(null);
            }
            follow(guardian, owner, settings);
        }
    }

    private LivingEntity pickTarget(GuardianSquad squad, Mob guardian, long now, PluginSettings settings) {
        double radiusSquared = settings.threatSearchRadius() * settings.threatSearchRadius();

        LivingEntity current = guardian.getTarget();
        if (isEngageable(current, guardian, squad, now, radiusSquared)) {
            return current;
        }

        LivingEntity best = null;
        double bestDistanceSquared = Double.MAX_VALUE;
        for (UUID threatId : new ArrayList<>(squad.threatIds())) {
            Entity entity = Bukkit.getEntity(threatId);
            if (!(entity instanceof LivingEntity living) || living.isDead() || !living.isValid()) {
                squad.clearThreat(threatId);
                continue;
            }
            if (!isEngageable(living, guardian, squad, now, radiusSquared)) {
                continue;
            }
            double distanceSquared = living.getLocation().distanceSquared(guardian.getLocation());
            if (distanceSquared < bestDistanceSquared) {
                bestDistanceSquared = distanceSquared;
                best = living;
            }
        }
        return best;
    }

    private boolean isEngageable(LivingEntity candidate, Mob guardian, GuardianSquad squad, long now, double radiusSquared) {
        if (candidate == null || candidate.isDead() || !candidate.isValid()) {
            return false;
        }
        if (!squad.isThreat(candidate, now)) {
            return false;
        }
        if (!candidate.getWorld().equals(guardian.getWorld())) {
            return false;
        }
        return candidate.getLocation().distanceSquared(guardian.getLocation()) <= radiusSquared;
    }

    private void follow(Mob guardian, Player owner, PluginSettings settings) {
        Location ownerLocation = owner.getLocation();
        if (!guardian.getWorld().equals(owner.getWorld())) {
            guardian.teleport(scatter(ownerLocation));
            return;
        }
        double distance = guardian.getLocation().distance(ownerLocation);
        if (distance > settings.leashRadius()) {
            guardian.teleport(scatter(ownerLocation));
            return;
        }
        if (distance > settings.followDistance()) {
            moveTo(guardian, ownerLocation, settings.followSpeed());
        }
    }

    private void moveTo(Mob guardian, Location destination, double speed) {
        if (!pathfinderAvailable) {
            return;
        }
        try {
            guardian.getPathfinder().moveTo(destination, speed);
        } catch (Throwable ignored) {
            // Paper's Pathfinder API is missing (plain Spigot); fall back to leash teleports only.
            pathfinderAvailable = false;
        }
    }

    private Location scatter(Location base) {
        return base.clone().add(
                (random.nextDouble() - 0.5D) * 3.0D,
                0.0D,
                (random.nextDouble() - 0.5D) * 3.0D);
    }

    // ------------------------------------------------------------------ threats

    public void markThreat(GuardianSquad squad, Entity target) {
        if (squad == null || target == null) {
            return;
        }
        if (target.getUniqueId().equals(squad.ownerId()) || squad.isGuardian(target)) {
            return;
        }
        if (!(target instanceof LivingEntity living) || living.isDead()) {
            return;
        }
        if (living instanceof Player player) {
            if (plugin.settings().ignoreCreativePlayers() && isNonCombatant(player)) {
                return;
            }
            if (player.getUniqueId().equals(squad.ownerId())) {
                return;
            }
        }
        squad.markThreat(living.getUniqueId(), System.currentTimeMillis() + plugin.settings().threatMemoryMillis());
    }

    private boolean isNonCombatant(Player player) {
        switch (player.getGameMode()) {
            case CREATIVE:
            case SPECTATOR:
                return true;
            default:
                return false;
        }
    }

    // ------------------------------------------------------------------ despawning

    public void despawn(GuardianSquad squad, DespawnReason reason) {
        if (squad == null) {
            return;
        }
        squadsByOwner.remove(squad.ownerId(), squad);

        PluginSettings settings = plugin.settings();
        boolean allResolved = true;
        Location lastKnown = null;
        for (UUID guardianId : new ArrayList<>(squad.guardianIds())) {
            squadsByGuardian.remove(guardianId);
            Entity entity = Bukkit.getEntity(guardianId);
            if (entity == null) {
                allResolved = false;
                continue;
            }
            lastKnown = entity.getLocation();
            entity.remove();
        }
        squad.guardianIds().clear();

        if (!allResolved) {
            // Some guardians were in unloaded chunks; hunt them down by squad tag instead.
            removeTaggedEntities(squad.squadId().toString());
        }
        if (lastKnown != null) {
            playEffects(lastKnown, settings.despawnSound(), settings.despawnParticle());
        }

        String messageKey = reason.messageKey();
        if (messageKey != null) {
            Player owner = Bukkit.getPlayer(squad.ownerId());
            if (owner != null && owner.isOnline()) {
                plugin.message(owner, messageKey, Map.of("tier", squad.tier().displayName()));
            }
        }
    }

    public boolean despawnFor(UUID ownerId, DespawnReason reason) {
        GuardianSquad squad = squadsByOwner.get(ownerId);
        if (squad == null) {
            return false;
        }
        despawn(squad, reason);
        return true;
    }

    public int despawnAll(DespawnReason reason) {
        int count = 0;
        for (GuardianSquad squad : new ArrayList<>(squadsByOwner.values())) {
            despawn(squad, reason);
            count++;
        }
        return count;
    }

    private void removeTaggedEntities(String squadId) {
        for (World world : Bukkit.getWorlds()) {
            for (Entity entity : world.getEntities()) {
                if (!GuardianFactory.isGuardian(entity, plugin.keys())) {
                    continue;
                }
                if (squadId == null || squadId.equals(GuardianFactory.readSquadId(entity, plugin.keys()))) {
                    entity.remove();
                }
            }
        }
    }

    /**
     * Removes guardians whose squad no longer exists - leftovers from a crash, a /reload,
     * or a chunk that unloaded while its squad expired.
     */
    public int sweepStale(Collection<Entity> candidates) {
        int removed = 0;
        for (Entity entity : candidates) {
            if (!GuardianFactory.isGuardian(entity, plugin.keys())) {
                continue;
            }
            if (squadsByGuardian.containsKey(entity.getUniqueId())) {
                continue;
            }
            entity.remove();
            removed++;
        }
        return removed;
    }

    public int sweepStaleEverywhere() {
        int removed = 0;
        for (World world : Bukkit.getWorlds()) {
            removed += sweepStale(new ArrayList<>(world.getEntities()));
        }
        return removed;
    }

    private void playEffects(Location location, Sound sound, Particle particle) {
        World world = location.getWorld();
        if (world == null) {
            return;
        }
        try {
            if (sound != null) {
                world.playSound(location, sound, 1.0F, 0.8F);
            }
            if (particle != null) {
                world.spawnParticle(particle, location.clone().add(0.0D, 1.0D, 0.0D), 40, 1.2D, 1.0D, 1.2D, 0.02D);
            }
        } catch (Throwable ignored) {
            // Cosmetic only.
        }
    }

    // ------------------------------------------------------------------ lookups

    public GuardianSquad squadOfOwner(UUID ownerId) {
        return squadsByOwner.get(ownerId);
    }

    public GuardianSquad squadOfGuardian(Entity entity) {
        return entity == null ? null : squadsByGuardian.get(entity.getUniqueId());
    }

    public boolean isTrackedGuardian(Entity entity) {
        return entity != null && squadsByGuardian.containsKey(entity.getUniqueId());
    }

    public Collection<GuardianSquad> activeSquads() {
        return new ArrayList<>(squadsByOwner.values());
    }

    public List<GuardianSquad> squadsThreatening(Entity entity) {
        List<GuardianSquad> matches = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (GuardianSquad squad : squadsByOwner.values()) {
            if (squad.isThreat(entity, now)) {
                matches.add(squad);
            }
        }
        return matches;
    }
}
