package com.longswordsmp.totemguardians.guardian;

import com.longswordsmp.totemguardians.config.GuardianTier;
import org.bukkit.entity.Entity;

import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** One player's active guardians, plus the hit list they share. */
public final class GuardianSquad {

    private final UUID squadId = UUID.randomUUID();
    private final UUID ownerId;
    private final GuardianTier tier;
    private final long expiresAt;
    private final Set<UUID> guardianIds = new LinkedHashSet<>();
    private final Map<UUID, Long> threats = new ConcurrentHashMap<>();

    public GuardianSquad(UUID ownerId, GuardianTier tier, long now) {
        this.ownerId = ownerId;
        this.tier = tier;
        this.expiresAt = now + tier.durationMillis();
    }

    public UUID squadId() {
        return squadId;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public GuardianTier tier() {
        return tier;
    }

    public long expiresAt() {
        return expiresAt;
    }

    public long remainingMillis(long now) {
        return Math.max(0L, expiresAt - now);
    }

    public Set<UUID> guardianIds() {
        return guardianIds;
    }

    public void addGuardian(UUID id) {
        guardianIds.add(id);
    }

    public void removeGuardian(UUID id) {
        guardianIds.remove(id);
    }

    public boolean isGuardian(Entity entity) {
        return entity != null && guardianIds.contains(entity.getUniqueId());
    }

    public void markThreat(UUID id, long expiresAt) {
        threats.put(id, expiresAt);
    }

    public boolean isThreat(Entity entity, long now) {
        if (entity == null) {
            return false;
        }
        Long until = threats.get(entity.getUniqueId());
        return until != null && until > now;
    }

    public Set<UUID> threatIds() {
        return threats.keySet();
    }

    public void clearThreat(UUID id) {
        threats.remove(id);
    }

    public void pruneThreats(long now) {
        Iterator<Map.Entry<UUID, Long>> iterator = threats.entrySet().iterator();
        while (iterator.hasNext()) {
            if (iterator.next().getValue() <= now) {
                iterator.remove();
            }
        }
    }
}
