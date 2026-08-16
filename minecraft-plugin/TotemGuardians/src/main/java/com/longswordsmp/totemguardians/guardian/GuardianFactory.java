package com.longswordsmp.totemguardians.guardian;

import com.longswordsmp.totemguardians.config.GuardianTier;
import com.longswordsmp.totemguardians.util.Compat;
import com.longswordsmp.totemguardians.util.Keys;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Mob;
import org.bukkit.entity.Zombie;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

import java.util.Map;
import java.util.UUID;

/** Turns a tier definition into a live, kitted-out, nameless guardian. */
public final class GuardianFactory {

    private static final double SPAWN_RING_RADIUS = 2.0D;

    private final Keys keys;

    public GuardianFactory(Keys keys) {
        this.keys = keys;
    }

    public Mob spawn(GuardianSquad squad, Location around, int index, int total) {
        World world = around.getWorld();
        if (world == null) {
            return null;
        }
        GuardianTier tier = squad.tier();
        Location location = findSpawnLocation(around, index, total);

        Entity spawned = world.spawnEntity(location, tier.entityType());
        if (!(spawned instanceof Mob mob)) {
            spawned.remove();
            return null;
        }

        applyIdentity(mob, squad);
        applyAttributes(mob, tier);
        applyEquipment(mob, tier);
        applyEffects(mob, tier);
        return mob;
    }

    private void applyIdentity(Mob mob, GuardianSquad squad) {
        // No custom name at all: nameless is the point.
        mob.setCustomName(null);
        mob.setCustomNameVisible(false);
        mob.setRemoveWhenFarAway(false);
        mob.setPersistent(true);
        mob.setCanPickupItems(false);
        mob.setAware(true);
        mob.setTarget(null);

        if (mob instanceof Zombie zombie) {
            trySilently(() -> zombie.setShouldBurnInDay(false));
            Compat.invokeNoArg(zombie, "setAdult");
        }

        PersistentDataContainer data = mob.getPersistentDataContainer();
        data.set(keys.guardian, PersistentDataType.BYTE, (byte) 1);
        data.set(keys.owner, PersistentDataType.STRING, squad.ownerId().toString());
        data.set(keys.squad, PersistentDataType.STRING, squad.squadId().toString());
    }

    private void applyAttributes(Mob mob, GuardianTier tier) {
        for (Map.Entry<Attribute, Double> entry : tier.attributes().entrySet()) {
            AttributeInstance instance = mob.getAttribute(entry.getKey());
            if (instance != null) {
                instance.setBaseValue(entry.getValue());
            }
        }

        Attribute scaleAttribute = Compat.attribute("SCALE", "GENERIC_SCALE");
        if (scaleAttribute != null && Math.abs(tier.scale() - 1.0D) > 1.0E-4D) {
            AttributeInstance instance = mob.getAttribute(scaleAttribute);
            if (instance != null) {
                instance.setBaseValue(tier.scale());
            }
        }

        Attribute maxHealth = Compat.attribute("MAX_HEALTH", "GENERIC_MAX_HEALTH");
        if (maxHealth != null) {
            AttributeInstance instance = mob.getAttribute(maxHealth);
            if (instance != null) {
                mob.setHealth(instance.getValue());
            }
        }
    }

    private void applyEquipment(Mob mob, GuardianTier tier) {
        EntityEquipment equipment = mob.getEquipment();
        if (equipment == null) {
            return;
        }
        for (Map.Entry<EquipmentSlot, ItemStack> entry : tier.equipment().entrySet()) {
            equipment.setItem(entry.getKey(), entry.getValue().clone());
        }
        // Guardians are temporary, so their netherite must never become loot.
        equipment.setHelmetDropChance(0.0F);
        equipment.setChestplateDropChance(0.0F);
        equipment.setLeggingsDropChance(0.0F);
        equipment.setBootsDropChance(0.0F);
        equipment.setItemInMainHandDropChance(0.0F);
        equipment.setItemInOffHandDropChance(0.0F);
    }

    private void applyEffects(Mob mob, GuardianTier tier) {
        int duration = tier.durationSeconds() * 20 + 40;
        for (Map.Entry<PotionEffectType, Integer> entry : tier.effects().entrySet()) {
            mob.addPotionEffect(new PotionEffect(entry.getKey(), duration, entry.getValue(), false, false, false));
        }
    }

    private Location findSpawnLocation(Location center, int index, int total) {
        double angle = (2.0D * Math.PI * index) / Math.max(1, total);
        Location base = center.clone().add(
                Math.cos(angle) * SPAWN_RING_RADIUS,
                0.0D,
                Math.sin(angle) * SPAWN_RING_RADIUS);

        for (int offset = 0; offset <= 3; offset++) {
            for (int sign = 1; sign >= -1; sign -= 2) {
                Location candidate = base.clone().add(0.0D, offset * sign, 0.0D);
                if (isPassable(candidate)) {
                    return candidate;
                }
                if (offset == 0) {
                    break;
                }
            }
        }
        return center.clone();
    }

    private boolean isPassable(Location location) {
        Block block = location.getBlock();
        return block.isPassable() && block.getRelative(BlockFace.UP).isPassable();
    }

    /** Guards the handful of setters that only exist on some server versions. */
    private void trySilently(Runnable action) {
        try {
            action.run();
        } catch (Throwable ignored) {
            // Older or trimmed APIs simply skip the tweak.
        }
    }

    public static boolean isGuardian(Entity entity, Keys keys) {
        return entity != null
                && entity.getPersistentDataContainer().has(keys.guardian, PersistentDataType.BYTE);
    }

    public static UUID readOwner(Entity entity, Keys keys) {
        String raw = entity.getPersistentDataContainer().get(keys.owner, PersistentDataType.STRING);
        if (raw == null) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    public static String readSquadId(Entity entity, Keys keys) {
        return entity.getPersistentDataContainer().get(keys.squad, PersistentDataType.STRING);
    }
}
