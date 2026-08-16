package com.longswordsmp.totemguardians.config;

import com.longswordsmp.totemguardians.guardian.TargetingMode;
import org.bukkit.attribute.Attribute;
import org.bukkit.entity.EntityType;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffectType;

import java.util.Map;

/**
 * One Unbreaking level's worth of guardians: how many spawn, what they wear, how hard they hit
 * and how they pick their fights.
 */
public record GuardianTier(
        int level,
        String displayName,
        int count,
        int durationSeconds,
        TargetingMode targeting,
        EntityType entityType,
        double scale,
        Map<EquipmentSlot, ItemStack> equipment,
        Map<Attribute, Double> attributes,
        Map<PotionEffectType, Integer> effects
) {

    public long durationMillis() {
        return durationSeconds * 1000L;
    }
}
