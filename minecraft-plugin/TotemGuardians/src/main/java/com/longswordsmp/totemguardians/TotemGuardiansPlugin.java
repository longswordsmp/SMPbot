package com.longswordsmp.totemguardians;

import com.longswordsmp.totemguardians.command.TotemGuardiansCommand;
import com.longswordsmp.totemguardians.config.PluginSettings;
import com.longswordsmp.totemguardians.guardian.GuardianManager;
import com.longswordsmp.totemguardians.listener.CombatListener;
import com.longswordsmp.totemguardians.listener.GuardianLifecycleListener;
import com.longswordsmp.totemguardians.listener.TotemListener;
import com.longswordsmp.totemguardians.util.Keys;
import com.longswordsmp.totemguardians.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Map;

public final class TotemGuardiansPlugin extends JavaPlugin {

    private Keys keys;
    private PluginSettings settings;
    private GuardianManager manager;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.keys = new Keys(this);
        this.settings = PluginSettings.load(this);
        this.manager = new GuardianManager(this);

        Bukkit.getPluginManager().registerEvents(new TotemListener(this), this);
        Bukkit.getPluginManager().registerEvents(new CombatListener(this), this);
        Bukkit.getPluginManager().registerEvents(new GuardianLifecycleListener(this), this);

        PluginCommand command = getCommand("totemguardians");
        if (command != null) {
            TotemGuardiansCommand executor = new TotemGuardiansCommand(this);
            command.setExecutor(executor);
            command.setTabCompleter(executor);
        }

        int swept = manager.sweepStaleEverywhere();
        if (swept > 0) {
            getLogger().info("Removed " + swept + " guardian(s) left over from a previous session.");
        }
        manager.start();
    }

    @Override
    public void onDisable() {
        if (manager != null) {
            manager.shutdown();
        }
    }

    public void reload() {
        reloadConfig();
        this.settings = PluginSettings.load(this);
        if (manager != null) {
            manager.restart();
        }
    }

    public Keys keys() {
        return keys;
    }

    public PluginSettings settings() {
        return settings;
    }

    public GuardianManager manager() {
        return manager;
    }

    public String format(String key, Map<String, String> placeholders) {
        return Text.fill(settings.rawMessage(key), placeholders);
    }

    public void message(CommandSender target, String key, Map<String, String> placeholders) {
        String raw = settings.rawMessage(key);
        if (raw == null || raw.isEmpty()) {
            return;
        }
        target.sendMessage(Text.color(settings.prefix()) + Text.fill(raw, placeholders));
    }

    public void message(CommandSender target, String key) {
        message(target, key, Map.of());
    }

    public void raw(CommandSender target, String message) {
        target.sendMessage(Text.color(settings.prefix()) + Text.color(message));
    }
}
