package com.longswordsmp.totemguardians.util;

import net.md_5.bungee.api.ChatMessageType;
import net.md_5.bungee.api.chat.TextComponent;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class Text {

    private Text() {
    }

    public static String color(String input) {
        return input == null ? "" : ChatColor.translateAlternateColorCodes('&', input);
    }

    public static List<String> color(List<String> input) {
        List<String> coloured = new ArrayList<>();
        for (String line : input) {
            coloured.add(color(line));
        }
        return coloured;
    }

    public static String fill(String input, Map<String, String> placeholders) {
        String output = input == null ? "" : input;
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            output = output.replace("{" + entry.getKey() + "}", entry.getValue());
        }
        return color(output);
    }

    /** mm:ss, or just seconds once under a minute. */
    public static String clock(long millisRemaining) {
        long totalSeconds = Math.max(0L, (millisRemaining + 999L) / 1000L);
        long minutes = totalSeconds / 60L;
        long seconds = totalSeconds % 60L;
        return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    public static String duration(long totalSeconds) {
        long minutes = totalSeconds / 60L;
        long seconds = totalSeconds % 60L;
        if (minutes > 0 && seconds > 0) {
            return minutes + "m " + seconds + "s";
        }
        return minutes > 0 ? minutes + "m" : seconds + "s";
    }

    public static void actionBar(Player player, String message) {
        try {
            player.spigot().sendMessage(ChatMessageType.ACTION_BAR, new TextComponent(color(message)));
        } catch (Throwable ignored) {
            // Action bars are cosmetic; a server without the bungee-chat API just goes without.
        }
    }
}
