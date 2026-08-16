package com.longswordsmp.totemguardians.guardian;

public enum DespawnReason {

    EXPIRED("expired"),
    WIPED("wiped"),
    OWNER_DIED("owner-died"),
    OWNER_OFFLINE(null),
    REPLACED("replaced"),
    DISMISSED("despawned"),
    SHUTDOWN(null);

    private final String messageKey;

    DespawnReason(String messageKey) {
        this.messageKey = messageKey;
    }

    /** null when the owner is not around to read it. */
    public String messageKey() {
        return messageKey;
    }
}
