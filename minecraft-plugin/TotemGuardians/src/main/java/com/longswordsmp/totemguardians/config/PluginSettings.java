package com.longswordsmp.totemguardians.config;

import com.longswordsmp.totemguardians.guardian.TargetingMode;
import com.longswordsmp.totemguardians.util.Compat;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.attribute.Attribute;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.EntityType;
import org.bukkit.event.entity.EntityDamageEvent.DamageCause;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.PotionEffectType;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.logging.Logger;

/** Immutable snapshot of config.yml, rebuilt on every {@code /tg reload}. */
public final class PluginSettings {

    private static final Map<String, String[]> ATTRIBUTE_FIELDS = Map.of(
            "max-health", new String[]{"MAX_HEALTH", "GENERIC_MAX_HEALTH"},
            "attack-damage", new String[]{"ATTACK_DAMAGE", "GENERIC_ATTACK_DAMAGE"},
            "attack-knockback", new String[]{"ATTACK_KNOCKBACK", "GENERIC_ATTACK_KNOCKBACK"},
            "attack-speed", new String[]{"ATTACK_SPEED", "GENERIC_ATTACK_SPEED"},
            "armor", new String[]{"ARMOR", "GENERIC_ARMOR"},
            "armor-toughness", new String[]{"ARMOR_TOUGHNESS", "GENERIC_ARMOR_TOUGHNESS"},
            "knockback-resistance", new String[]{"KNOCKBACK_RESISTANCE", "GENERIC_KNOCKBACK_RESISTANCE"},
            "movement-speed", new String[]{"MOVEMENT_SPEED", "GENERIC_MOVEMENT_SPEED"},
            "follow-range", new String[]{"FOLLOW_RANGE", "GENERIC_FOLLOW_RANGE"}
    );

    private static final Map<String, EquipmentSlot> EQUIPMENT_SLOTS = Map.of(
            "helmet", EquipmentSlot.HEAD,
            "chestplate", EquipmentSlot.CHEST,
            "leggings", EquipmentSlot.LEGS,
            "boots", EquipmentSlot.FEET,
            "main-hand", EquipmentSlot.HAND,
            "off-hand", EquipmentSlot.OFF_HAND
    );

    private final Set<String> disabledWorlds;
    private final long cooldownMillis;
    private final boolean replaceExistingSquad;
    private final boolean actionBarTimer;
    private final boolean despawnOnOwnerDeath;
    private final boolean despawnOnOwnerQuit;
    private final long threatMemoryMillis;
    private final double threatSearchRadius;
    private final double followDistance;
    private final double leashRadius;
    private final double followSpeed;
    private final int retargetIntervalTicks;
    private final boolean retaliateForSquad;
    private final boolean ignoreCreativePlayers;
    private final Set<DamageCause> immuneDamageCauses;
    private final Sound spawnSound;
    private final Sound despawnSound;
    private final Particle spawnParticle;
    private final Particle despawnParticle;
    private final String totemName;
    private final List<String> totemLore;
    private final NavigableMap<Integer, GuardianTier> tiers;
    private final Map<String, String> messages;

    private PluginSettings(JavaPlugin plugin) {
        FileConfiguration config = plugin.getConfig();
        Logger log = plugin.getLogger();

        ConfigurationSection settings = section(config, "settings");

        Set<String> worlds = new java.util.HashSet<>();
        for (String world : settings.getStringList("disabled-worlds")) {
            worlds.add(world.toLowerCase(Locale.ROOT));
        }
        this.disabledWorlds = Collections.unmodifiableSet(worlds);

        this.cooldownMillis = Math.max(0L, settings.getLong("cooldown-seconds", 0L)) * 1000L;
        this.replaceExistingSquad = settings.getBoolean("replace-existing-squad", true);
        this.actionBarTimer = settings.getBoolean("action-bar-timer", true);
        this.despawnOnOwnerDeath = settings.getBoolean("despawn-on-owner-death", true);
        this.despawnOnOwnerQuit = settings.getBoolean("despawn-on-owner-quit", true);
        this.threatMemoryMillis = Math.max(1L, settings.getLong("target-memory-seconds", 20L)) * 1000L;
        this.threatSearchRadius = Math.max(4.0D, settings.getDouble("threat-search-radius", 32.0D));
        this.followDistance = Math.max(2.0D, settings.getDouble("follow-distance", 6.0D));
        this.leashRadius = Math.max(followDistance + 2.0D, settings.getDouble("leash-radius", 24.0D));
        this.followSpeed = Math.max(0.1D, settings.getDouble("follow-speed", 1.25D));
        this.retargetIntervalTicks = Math.max(1, settings.getInt("retarget-interval-ticks", 10));
        this.retaliateForSquad = settings.getBoolean("retaliate-for-squad", true);
        this.ignoreCreativePlayers = settings.getBoolean("ignore-creative-players", true);

        Set<DamageCause> causes = EnumSet.noneOf(DamageCause.class);
        for (String raw : settings.getStringList("immune-damage-causes")) {
            try {
                causes.add(DamageCause.valueOf(raw.trim().toUpperCase(Locale.ROOT)));
            } catch (IllegalArgumentException ignored) {
                log.warning("Unknown damage cause '" + raw + "' in settings.immune-damage-causes.");
            }
        }
        this.immuneDamageCauses = Collections.unmodifiableSet(causes);

        this.spawnSound = Compat.sound(settings.getString("spawn-sound", ""));
        this.despawnSound = Compat.sound(settings.getString("despawn-sound", ""));
        this.spawnParticle = Compat.particle(settings.getStringList("spawn-particle"));
        this.despawnParticle = Compat.particle(settings.getStringList("despawn-particle"));

        ConfigurationSection totem = section(config, "totem-item");
        this.totemName = totem.getString("name", "&8&lGuardian Totem");
        this.totemLore = Collections.unmodifiableList(new ArrayList<>(totem.getStringList("lore")));

        this.tiers = Collections.unmodifiableNavigableMap(loadTiers(config, log));
        this.messages = Collections.unmodifiableMap(loadMessages(config));

        if (tiers.isEmpty()) {
            log.severe("No usable tiers were loaded from config.yml - popping an enchanted totem will do nothing.");
        }
    }

    public static PluginSettings load(JavaPlugin plugin) {
        return new PluginSettings(plugin);
    }

    private static ConfigurationSection section(ConfigurationSection parent, String path) {
        ConfigurationSection child = parent.getConfigurationSection(path);
        return child != null ? child : parent.createSection(path);
    }

    private NavigableMap<Integer, GuardianTier> loadTiers(FileConfiguration config, Logger log) {
        NavigableMap<Integer, GuardianTier> loaded = new TreeMap<>();
        ConfigurationSection root = config.getConfigurationSection("tiers");
        if (root == null) {
            return loaded;
        }
        for (String key : root.getKeys(false)) {
            ConfigurationSection tierSection = root.getConfigurationSection(key);
            if (tierSection == null) {
                continue;
            }
            int level;
            try {
                level = Integer.parseInt(key.trim());
            } catch (NumberFormatException ignored) {
                log.warning("Tier key '" + key + "' is not a number - skipping.");
                continue;
            }
            GuardianTier tier = loadTier(level, tierSection, log);
            if (tier != null) {
                loaded.put(level, tier);
            }
        }
        return loaded;
    }

    private GuardianTier loadTier(int level, ConfigurationSection section, Logger log) {
        String typeName = section.getString("entity-type", "WITHER_SKELETON");
        EntityType entityType;
        try {
            entityType = EntityType.valueOf(typeName.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            log.warning("Tier " + level + " has unknown entity-type '" + typeName + "' - falling back to WITHER_SKELETON.");
            entityType = EntityType.WITHER_SKELETON;
        }

        Map<EquipmentSlot, ItemStack> equipment = new LinkedHashMap<>();
        ConfigurationSection equipmentSection = section.getConfigurationSection("equipment");
        if (equipmentSection != null) {
            for (Map.Entry<String, EquipmentSlot> entry : EQUIPMENT_SLOTS.entrySet()) {
                ConfigurationSection itemSection = equipmentSection.getConfigurationSection(entry.getKey());
                if (itemSection == null) {
                    continue;
                }
                ItemStack item = buildItem(itemSection, log, "tier " + level + " " + entry.getKey());
                if (item != null) {
                    equipment.put(entry.getValue(), item);
                }
            }
        }

        Map<Attribute, Double> attributes = new LinkedHashMap<>();
        ConfigurationSection attributeSection = section.getConfigurationSection("attributes");
        if (attributeSection != null) {
            for (String key : attributeSection.getKeys(false)) {
                String[] fields = ATTRIBUTE_FIELDS.get(key.toLowerCase(Locale.ROOT));
                if (fields == null) {
                    log.warning("Tier " + level + " lists unknown attribute '" + key + "' - skipping.");
                    continue;
                }
                Attribute attribute = Compat.attribute(fields);
                if (attribute == null) {
                    log.warning("Attribute '" + key + "' is not available on this server version - skipping.");
                    continue;
                }
                attributes.put(attribute, attributeSection.getDouble(key));
            }
        }

        Map<PotionEffectType, Integer> effects = new LinkedHashMap<>();
        ConfigurationSection effectSection = section.getConfigurationSection("effects");
        if (effectSection != null) {
            for (String key : effectSection.getKeys(false)) {
                PotionEffectType type = Compat.potionEffect(key);
                if (type == null) {
                    log.warning("Tier " + level + " lists unknown potion effect '" + key + "' - skipping.");
                    continue;
                }
                effects.put(type, Math.max(0, effectSection.getInt(key)));
            }
        }

        return new GuardianTier(
                level,
                section.getString("display-name", "Guardian"),
                Math.max(1, section.getInt("count", 5)),
                Math.max(1, section.getInt("duration-seconds", 300)),
                TargetingMode.parse(section.getString("targeting"), TargetingMode.DEFEND),
                entityType,
                section.getDouble("scale", 1.0D),
                Collections.unmodifiableMap(equipment),
                Collections.unmodifiableMap(attributes),
                Collections.unmodifiableMap(effects)
        );
    }

    private ItemStack buildItem(ConfigurationSection section, Logger log, String context) {
        String materialName = section.getString("material", "");
        Material material = Material.matchMaterial(materialName);
        if (material == null || material.isAir()) {
            log.warning("Unknown material '" + materialName + "' for " + context + " - skipping.");
            return null;
        }
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        if (meta != null) {
            meta.setUnbreakable(section.getBoolean("unbreakable", true));
            ConfigurationSection enchantments = section.getConfigurationSection("enchantments");
            if (enchantments != null) {
                for (String key : enchantments.getKeys(false)) {
                    org.bukkit.enchantments.Enchantment enchantment = Compat.enchantment(key);
                    if (enchantment == null) {
                        log.warning("Unknown enchantment '" + key + "' for " + context + " - skipping.");
                        continue;
                    }
                    meta.addEnchant(enchantment, Math.max(1, enchantments.getInt(key)), true);
                }
            }
            meta.addItemFlags(ItemFlag.HIDE_ENCHANTS, ItemFlag.HIDE_ATTRIBUTES);
            item.setItemMeta(meta);
        }
        return item;
    }

    private Map<String, String> loadMessages(FileConfiguration config) {
        Map<String, String> loaded = new HashMap<>();
        ConfigurationSection section = config.getConfigurationSection("messages");
        if (section != null) {
            for (String key : section.getKeys(false)) {
                loaded.put(key, section.getString(key, ""));
            }
        }
        return loaded;
    }

    /** Highest configured tier at or below {@code level}, so Unbreaking IV still resolves to tier 3. */
    public GuardianTier tierFor(int level) {
        Map.Entry<Integer, GuardianTier> entry = tiers.floorEntry(level);
        return entry == null ? null : entry.getValue();
    }

    public GuardianTier exactTier(int level) {
        return tiers.get(level);
    }

    public NavigableMap<Integer, GuardianTier> tiers() {
        return tiers;
    }

    public boolean isWorldDisabled(String worldName) {
        return disabledWorlds.contains(worldName.toLowerCase(Locale.ROOT));
    }

    public String rawMessage(String key) {
        return messages.getOrDefault(key, "");
    }

    public String prefix() {
        return messages.getOrDefault("prefix", "");
    }

    public long cooldownMillis() {
        return cooldownMillis;
    }

    public boolean replaceExistingSquad() {
        return replaceExistingSquad;
    }

    public boolean actionBarTimer() {
        return actionBarTimer;
    }

    public boolean despawnOnOwnerDeath() {
        return despawnOnOwnerDeath;
    }

    public boolean despawnOnOwnerQuit() {
        return despawnOnOwnerQuit;
    }

    public long threatMemoryMillis() {
        return threatMemoryMillis;
    }

    public double threatSearchRadius() {
        return threatSearchRadius;
    }

    public double followDistance() {
        return followDistance;
    }

    public double leashRadius() {
        return leashRadius;
    }

    public double followSpeed() {
        return followSpeed;
    }

    public int retargetIntervalTicks() {
        return retargetIntervalTicks;
    }

    public boolean retaliateForSquad() {
        return retaliateForSquad;
    }

    public boolean ignoreCreativePlayers() {
        return ignoreCreativePlayers;
    }

    public Set<DamageCause> immuneDamageCauses() {
        return immuneDamageCauses;
    }

    public Sound spawnSound() {
        return spawnSound;
    }

    public Sound despawnSound() {
        return despawnSound;
    }

    public Particle spawnParticle() {
        return spawnParticle;
    }

    public Particle despawnParticle() {
        return despawnParticle;
    }

    public String totemName() {
        return totemName;
    }

    public List<String> totemLore() {
        return totemLore;
    }
}
