package com.longswordsmp.totemguardians.guardian;

import java.util.Locale;

public enum TargetingMode {

    /** Guardians only mark entities that have damaged the owner (or a guardian). */
    DEFEND(false),

    /** Guardians additionally mark whatever the owner attacks. */
    ASSIST(true);

    private final boolean marksOwnerVictims;

    TargetingMode(boolean marksOwnerVictims) {
        this.marksOwnerVictims = marksOwnerVictims;
    }

    public boolean marksOwnerVictims() {
        return marksOwnerVictims;
    }

    public static TargetingMode parse(String raw, TargetingMode fallback) {
        if (raw == null) {
            return fallback;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return fallback;
        }
    }
}
