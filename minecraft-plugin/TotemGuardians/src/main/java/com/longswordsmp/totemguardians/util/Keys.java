package com.longswordsmp.totemguardians.util;

import org.bukkit.NamespacedKey;
import org.bukkit.plugin.Plugin;

/** Persistent-data keys stamped onto every guardian so they survive a restart and can be swept. */
public final class Keys {

    public final NamespacedKey guardian;
    public final NamespacedKey owner;
    public final NamespacedKey squad;

    public Keys(Plugin plugin) {
        this.guardian = new NamespacedKey(plugin, "guardian");
        this.owner = new NamespacedKey(plugin, "owner");
        this.squad = new NamespacedKey(plugin, "squad");
    }
}
