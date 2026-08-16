package com.longswordsmp.totemguardians.util;

import org.bukkit.NamespacedKey;
import org.bukkit.Particle;
import org.bukkit.Registry;
import org.bukkit.Sound;
import org.bukkit.attribute.Attribute;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.potion.PotionEffectType;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Every lookup in here goes through reflection on purpose.
 * <p>
 * Between 1.20.4 and 1.21.3 Mojang renamed most of the registry entries this plugin needs
 * ({@code GENERIC_MAX_HEALTH} to {@code MAX_HEALTH}, {@code DURABILITY} to {@code UNBREAKING},
 * {@code INCREASE_DAMAGE} to {@code STRENGTH}, and so on) and turned several Bukkit enums into
 * registry-backed interfaces. Referencing those constants directly would pin the jar to one
 * narrow range of server versions; resolving them by name at runtime keeps a single build
 * working from 1.20.1 all the way through current Paper.
 */
public final class Compat {

    private static final Map<String, List<String>> ENCHANTMENT_ALIASES = Map.ofEntries(
            Map.entry("protection", List.of("PROTECTION_ENVIRONMENTAL")),
            Map.entry("fire_protection", List.of("PROTECTION_FIRE")),
            Map.entry("blast_protection", List.of("PROTECTION_EXPLOSIONS")),
            Map.entry("projectile_protection", List.of("PROTECTION_PROJECTILE")),
            Map.entry("feather_falling", List.of("PROTECTION_FALL")),
            Map.entry("thorns", List.of("PROTECTION_THORNS")),
            Map.entry("respiration", List.of("OXYGEN")),
            Map.entry("aqua_affinity", List.of("WATER_WORKER")),
            Map.entry("sharpness", List.of("DAMAGE_ALL")),
            Map.entry("smite", List.of("DAMAGE_UNDEAD")),
            Map.entry("bane_of_arthropods", List.of("DAMAGE_ARTHROPODS")),
            Map.entry("looting", List.of("LOOT_BONUS_MOBS")),
            Map.entry("sweeping_edge", List.of("SWEEPING_EDGE", "SWEEPING")),
            Map.entry("unbreaking", List.of("DURABILITY")),
            Map.entry("efficiency", List.of("DIG_SPEED")),
            Map.entry("fortune", List.of("LOOT_BONUS_BLOCKS")),
            Map.entry("power", List.of("ARROW_DAMAGE")),
            Map.entry("punch", List.of("ARROW_KNOCKBACK")),
            Map.entry("flame", List.of("ARROW_FIRE")),
            Map.entry("infinity", List.of("ARROW_INFINITE")),
            Map.entry("luck_of_the_sea", List.of("LUCK")),
            Map.entry("lure", List.of("LURE"))
    );

    private static final Map<String, List<String>> EFFECT_ALIASES = Map.ofEntries(
            Map.entry("strength", List.of("INCREASE_DAMAGE")),
            Map.entry("resistance", List.of("DAMAGE_RESISTANCE")),
            Map.entry("haste", List.of("FAST_DIGGING")),
            Map.entry("mining_fatigue", List.of("SLOW_DIGGING")),
            Map.entry("jump_boost", List.of("JUMP")),
            Map.entry("slowness", List.of("SLOW")),
            Map.entry("nausea", List.of("CONFUSION")),
            Map.entry("instant_health", List.of("HEAL")),
            Map.entry("instant_damage", List.of("HARM")),
            Map.entry("weakness", List.of("WEAKNESS")),
            Map.entry("speed", List.of("SPEED"))
    );

    private Compat() {
    }

    /** Resolves an attribute, trying the modern name first and the {@code GENERIC_} name second. */
    public static Attribute attribute(String... candidateFieldNames) {
        for (String name : candidateFieldNames) {
            Object value = staticField(Attribute.class, name);
            if (value instanceof Attribute attribute) {
                return attribute;
            }
        }
        return null;
    }

    public static Enchantment enchantment(String id) {
        String key = normalise(id);

        Enchantment fromRegistry = fromRegistry("ENCHANTMENT", Enchantment.class, key);
        if (fromRegistry != null) {
            return fromRegistry;
        }
        Object byKey = staticMethod(Enchantment.class, "getByKey", NamespacedKey.class, minecraftKey(key));
        if (byKey instanceof Enchantment enchantment) {
            return enchantment;
        }
        for (String alias : ENCHANTMENT_ALIASES.getOrDefault(key, List.of())) {
            if (staticField(Enchantment.class, alias) instanceof Enchantment enchantment) {
                return enchantment;
            }
        }
        return staticField(Enchantment.class, key.toUpperCase(Locale.ROOT)) instanceof Enchantment direct ? direct : null;
    }

    public static PotionEffectType potionEffect(String id) {
        String key = normalise(id);

        for (String registryField : new String[]{"EFFECT", "POTION_EFFECT_TYPE", "MOB_EFFECT"}) {
            PotionEffectType fromRegistry = fromRegistry(registryField, PotionEffectType.class, key);
            if (fromRegistry != null) {
                return fromRegistry;
            }
        }
        for (String alias : EFFECT_ALIASES.getOrDefault(key, List.of())) {
            if (staticField(PotionEffectType.class, alias) instanceof PotionEffectType effect) {
                return effect;
            }
        }
        if (staticField(PotionEffectType.class, key.toUpperCase(Locale.ROOT)) instanceof PotionEffectType direct) {
            return direct;
        }
        Object byName = staticMethod(PotionEffectType.class, "getByName", String.class, key.toUpperCase(Locale.ROOT));
        return byName instanceof PotionEffectType effect ? effect : null;
    }

    public static Sound sound(String id) {
        String key = normalise(id);
        // Sound registry keys are dotted (entity.wither.spawn) while the API constants are
        // underscored (ENTITY_WITHER_SPAWN), so accept either spelling in config.yml.
        for (String candidate : new String[]{key, key.replace('_', '.')}) {
            Sound fromRegistry = fromRegistry("SOUNDS", Sound.class, candidate);
            if (fromRegistry != null) {
                return fromRegistry;
            }
        }
        String constant = key.replace('.', '_').toUpperCase(Locale.ROOT);
        return staticField(Sound.class, constant) instanceof Sound direct ? direct : null;
    }

    /** Particles were renamed in 1.20.5 (SMOKE_LARGE to LARGE_SMOKE), hence the candidate list. */
    public static Particle particle(List<String> candidates) {
        for (String candidate : candidates) {
            String key = normalise(candidate);
            if (staticField(Particle.class, key.toUpperCase(Locale.ROOT)) instanceof Particle direct) {
                return direct;
            }
            Particle fromRegistry = fromRegistry("PARTICLE_TYPE", Particle.class, key);
            if (fromRegistry != null) {
                return fromRegistry;
            }
        }
        return null;
    }

    /** Calls a no-argument method if this server version happens to expose it. */
    public static void invokeNoArg(Object target, String methodName) {
        if (target == null) {
            return;
        }
        try {
            Method method = target.getClass().getMethod(methodName);
            method.invoke(target);
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            // Not available on this version; nothing to do.
        }
    }

    private static String normalise(String id) {
        return id.trim().toLowerCase(Locale.ROOT).replace(' ', '_').replace("minecraft:", "");
    }

    private static NamespacedKey minecraftKey(String key) {
        try {
            return NamespacedKey.minecraft(key);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static <T> T fromRegistry(String registryFieldName, Class<T> type, String key) {
        Object registry = staticField(Registry.class, registryFieldName);
        NamespacedKey namespacedKey = minecraftKey(key);
        if (registry == null || namespacedKey == null) {
            return null;
        }
        try {
            Method get = Registry.class.getMethod("get", NamespacedKey.class);
            Object value = get.invoke(registry, namespacedKey);
            return type.isInstance(value) ? type.cast(value) : null;
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            return null;
        }
    }

    private static Object staticField(Class<?> owner, String name) {
        try {
            Field field = owner.getField(name);
            if (!Modifier.isStatic(field.getModifiers())) {
                return null;
            }
            return field.get(null);
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            return null;
        }
    }

    private static Object staticMethod(Class<?> owner, String name, Class<?> parameterType, Object argument) {
        if (argument == null) {
            return null;
        }
        try {
            Method method = owner.getMethod(name, parameterType);
            if (!Modifier.isStatic(method.getModifiers())) {
                return null;
            }
            return method.invoke(null, argument);
        } catch (ReflectiveOperationException | RuntimeException ignored) {
            return null;
        }
    }
}
