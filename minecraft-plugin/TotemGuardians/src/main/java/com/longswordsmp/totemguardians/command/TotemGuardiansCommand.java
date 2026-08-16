package com.longswordsmp.totemguardians.command;

import com.longswordsmp.totemguardians.TotemGuardiansPlugin;
import com.longswordsmp.totemguardians.config.GuardianTier;
import com.longswordsmp.totemguardians.guardian.DespawnReason;
import com.longswordsmp.totemguardians.guardian.GuardianSquad;
import com.longswordsmp.totemguardians.guardian.SummonResult;
import com.longswordsmp.totemguardians.guardian.TargetingMode;
import com.longswordsmp.totemguardians.util.Compat;
import com.longswordsmp.totemguardians.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class TotemGuardiansCommand implements CommandExecutor, TabCompleter {

    private static final String[] ROMAN = {"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};

    private final TotemGuardiansPlugin plugin;

    public TotemGuardiansCommand(TotemGuardiansPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("totemguardians.command")) {
            plugin.message(sender, "no-permission");
            return true;
        }
        if (args.length == 0) {
            sendHelp(sender, label);
            return true;
        }

        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "give" -> handleGive(sender, args);
            case "summon" -> handleSummon(sender, args);
            case "despawn" -> handleDespawn(sender, args);
            case "reload" -> handleReload(sender);
            case "info" -> handleInfo(sender);
            default -> sendHelp(sender, label);
        }
        return true;
    }

    private void sendHelp(CommandSender sender, String label) {
        plugin.raw(sender, "&7Commands:");
        sender.sendMessage(Text.color("&8 - &f/" + label + " give <player> [level] [amount] &7give a guardian totem"));
        sender.sendMessage(Text.color("&8 - &f/" + label + " summon <player> [level] &7summon a squad directly"));
        sender.sendMessage(Text.color("&8 - &f/" + label + " despawn <player|all> &7dismiss guardians"));
        sender.sendMessage(Text.color("&8 - &f/" + label + " info &7list configured tiers"));
        sender.sendMessage(Text.color("&8 - &f/" + label + " reload &7reload config.yml"));
    }

    private void handleGive(CommandSender sender, String[] args) {
        if (!sender.hasPermission("totemguardians.give")) {
            plugin.message(sender, "no-permission");
            return;
        }
        if (args.length < 2) {
            plugin.raw(sender, "&cUsage: /tg give <player> [level] [amount]");
            return;
        }
        Player target = Bukkit.getPlayerExact(args[1]);
        if (target == null) {
            plugin.raw(sender, "&cPlayer '" + args[1] + "' is not online.");
            return;
        }
        int level = parseInt(args, 2, highestTierLevel());
        int amount = Math.max(1, Math.min(64, parseInt(args, 3, 1)));

        GuardianTier tier = plugin.settings().tierFor(level);
        if (tier == null) {
            plugin.raw(sender, "&cNo tier is configured for Unbreaking " + level + ".");
            return;
        }
        ItemStack totem = buildTotem(tier, level, amount);
        if (totem == null) {
            plugin.raw(sender, "&cThis server version does not expose the Unbreaking enchantment.");
            return;
        }
        for (ItemStack leftover : target.getInventory().addItem(totem).values()) {
            target.getWorld().dropItemNaturally(target.getLocation(), leftover);
        }
        plugin.raw(sender, "&7Gave &f" + amount + "x &7Unbreaking " + roman(level) + " totem to &f" + target.getName() + "&7.");
    }

    private void handleSummon(CommandSender sender, String[] args) {
        if (!sender.hasPermission("totemguardians.summon")) {
            plugin.message(sender, "no-permission");
            return;
        }
        Player target;
        if (args.length >= 2) {
            target = Bukkit.getPlayerExact(args[1]);
            if (target == null) {
                plugin.raw(sender, "&cPlayer '" + args[1] + "' is not online.");
                return;
            }
        } else if (sender instanceof Player player) {
            target = player;
        } else {
            plugin.raw(sender, "&cUsage: /tg summon <player> [level]");
            return;
        }

        int level = parseInt(args, 2, highestTierLevel());
        GuardianTier tier = plugin.settings().tierFor(level);
        SummonResult result = plugin.manager().summon(target, tier, false);
        if (result == SummonResult.SUCCESS) {
            plugin.raw(sender, "&7Summoned &f" + tier.count() + " " + tier.displayName() + "s &7for &f" + target.getName() + "&7.");
        } else {
            plugin.raw(sender, "&cCould not summon guardians: " + result.name().toLowerCase(Locale.ROOT).replace('_', ' ') + ".");
        }
    }

    private void handleDespawn(CommandSender sender, String[] args) {
        if (!sender.hasPermission("totemguardians.despawn")) {
            plugin.message(sender, "no-permission");
            return;
        }
        if (args.length < 2) {
            plugin.raw(sender, "&cUsage: /tg despawn <player|all>");
            return;
        }
        if (args[1].equalsIgnoreCase("all")) {
            int removed = plugin.manager().despawnAll(DespawnReason.DISMISSED);
            removed += plugin.manager().sweepStaleEverywhere();
            plugin.raw(sender, "&7Dismissed &f" + removed + " &7squad(s) and swept any strays.");
            return;
        }
        Player target = Bukkit.getPlayerExact(args[1]);
        if (target == null) {
            plugin.raw(sender, "&cPlayer '" + args[1] + "' is not online.");
            return;
        }
        boolean removed = plugin.manager().despawnFor(target.getUniqueId(), DespawnReason.DISMISSED);
        plugin.raw(sender, removed
                ? "&7Dismissed the guardians of &f" + target.getName() + "&7."
                : "&7&o" + target.getName() + " has no active guardians.");
    }

    private void handleReload(CommandSender sender) {
        if (!sender.hasPermission("totemguardians.reload")) {
            plugin.message(sender, "no-permission");
            return;
        }
        plugin.reload();
        plugin.raw(sender, "&7Configuration reloaded. &8(" + plugin.settings().tiers().size() + " tier(s))");
    }

    private void handleInfo(CommandSender sender) {
        plugin.raw(sender, "&7Configured tiers:");
        for (Map.Entry<Integer, GuardianTier> entry : plugin.settings().tiers().entrySet()) {
            GuardianTier tier = entry.getValue();
            sender.sendMessage(Text.color("&8 - &cUnbreaking " + roman(entry.getKey()) + " &8| &f" + tier.count()
                    + "x " + tier.displayName() + " &8| &7" + Text.duration(tier.durationSeconds())
                    + " &8| &7" + tier.targeting().name().toLowerCase(Locale.ROOT)
                    + " &8| &7" + tier.entityType().name().toLowerCase(Locale.ROOT)));
        }
        long active = plugin.manager().activeSquads().size();
        plugin.raw(sender, "&7Active squads: &f" + active);
        if (sender instanceof Player player) {
            GuardianSquad squad = plugin.manager().squadOfOwner(player.getUniqueId());
            if (squad != null) {
                plugin.raw(sender, "&7Yours: &f" + squad.guardianIds().size() + " &7alive, &f"
                        + Text.clock(squad.remainingMillis(System.currentTimeMillis())) + " &7left.");
            }
        }
    }

    private ItemStack buildTotem(GuardianTier tier, int level, int amount) {
        Enchantment unbreaking = Compat.enchantment("unbreaking");
        if (unbreaking == null) {
            return null;
        }
        ItemStack item = new ItemStack(Material.TOTEM_OF_UNDYING, amount);
        ItemMeta meta = item.getItemMeta();
        if (meta == null) {
            return item;
        }
        // ignoreLevelRestriction, because a totem is not normally an enchantable item.
        meta.addEnchant(unbreaking, level, true);

        Map<String, String> placeholders = Map.of(
                "level", roman(level),
                "tier", tier.displayName(),
                "count", String.valueOf(tier.count()),
                "duration", Text.duration(tier.durationSeconds()),
                "targeting", plugin.settings().rawMessage(
                        tier.targeting() == TargetingMode.ASSIST ? "targeting-assist" : "targeting-defend"));

        meta.setDisplayName(Text.fill(plugin.settings().totemName(), placeholders));
        List<String> lore = new ArrayList<>();
        for (String line : plugin.settings().totemLore()) {
            lore.add(Text.fill(line, placeholders));
        }
        meta.setLore(lore);
        item.setItemMeta(meta);
        return item;
    }

    private int highestTierLevel() {
        return plugin.settings().tiers().isEmpty() ? 1 : plugin.settings().tiers().lastKey();
    }

    private int parseInt(String[] args, int index, int fallback) {
        if (args.length <= index) {
            return fallback;
        }
        try {
            return Integer.parseInt(args[index]);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String roman(int value) {
        return value >= 0 && value < ROMAN.length ? ROMAN[value] : String.valueOf(value);
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("totemguardians.command")) {
            return Collections.emptyList();
        }
        if (args.length == 1) {
            return filter(List.of("give", "summon", "despawn", "info", "reload"), args[0]);
        }
        String sub = args[0].toLowerCase(Locale.ROOT);
        if (args.length == 2 && (sub.equals("give") || sub.equals("summon") || sub.equals("despawn"))) {
            List<String> names = new ArrayList<>();
            if (sub.equals("despawn")) {
                names.add("all");
            }
            for (Player player : Bukkit.getOnlinePlayers()) {
                names.add(player.getName());
            }
            return filter(names, args[1]);
        }
        if (args.length == 3 && (sub.equals("give") || sub.equals("summon"))) {
            List<String> levels = new ArrayList<>();
            for (Integer level : plugin.settings().tiers().keySet()) {
                levels.add(String.valueOf(level));
            }
            return filter(levels, args[2]);
        }
        return Collections.emptyList();
    }

    private List<String> filter(List<String> options, String prefix) {
        String lowered = prefix.toLowerCase(Locale.ROOT);
        List<String> matches = new ArrayList<>();
        for (String option : options) {
            if (option.toLowerCase(Locale.ROOT).startsWith(lowered)) {
                matches.add(option);
            }
        }
        return matches;
    }
}
