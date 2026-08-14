'use strict';

const { deepMerge } = require('./utils');
const log = require('./logger');

/**
 * Per-guild, per-namespace JSON configuration store backed by SQLite.
 * Every module keeps its guild settings in its own namespace, e.g.
 * `config.get(guildId, 'tickets', DEFAULTS)`. Values persist across restarts.
 */
class ConfigManager {
  constructor(db) {
    this.db = db;
    this.cache = new Map();
  }

  _key(guildId, namespace) {
    return `${guildId}:${namespace}`;
  }

  _load(guildId, namespace) {
    const key = this._key(guildId, namespace);
    if (this.cache.has(key)) return this.cache.get(key);
    const row = this.db.get('SELECT value FROM guild_config WHERE guild_id = ? AND namespace = ?', guildId, namespace);
    let value = {};
    if (row) {
      try {
        value = JSON.parse(row.value);
      } catch (err) {
        log.warn(`Corrupt config for ${key}, resetting:`, err.message);
      }
    }
    this.cache.set(key, value);
    return value;
  }

  /** Get the stored config merged over `defaults`. Never returns undefined. */
  get(guildId, namespace, defaults = {}) {
    return deepMerge(defaults, this._load(guildId, namespace));
  }

  /** Get only what is stored (no defaults merged). */
  getRaw(guildId, namespace) {
    return this._load(guildId, namespace);
  }

  /** Replace the entire namespace value. */
  set(guildId, namespace, value) {
    const json = JSON.stringify(value ?? {});
    this.db.run(
      `INSERT INTO guild_config (guild_id, namespace, value, updated_at) VALUES (?, ?, ?, unixepoch())
       ON CONFLICT (guild_id, namespace) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
      guildId,
      namespace,
      json,
    );
    this.cache.set(this._key(guildId, namespace), JSON.parse(json));
  }

  /** Deep-merge a patch into the stored value and persist. Returns the new value. */
  update(guildId, namespace, patch) {
    const merged = deepMerge(this._load(guildId, namespace), patch);
    this.set(guildId, namespace, merged);
    return merged;
  }

  delete(guildId, namespace) {
    this.db.run('DELETE FROM guild_config WHERE guild_id = ? AND namespace = ?', guildId, namespace);
    this.cache.delete(this._key(guildId, namespace));
  }

  /** All namespaces for a guild — used by the backup system. */
  allForGuild(guildId) {
    const rows = this.db.all('SELECT namespace, value FROM guild_config WHERE guild_id = ?', guildId);
    const out = {};
    for (const row of rows) {
      try {
        out[row.namespace] = JSON.parse(row.value);
      } catch {
        // skip corrupt rows
      }
    }
    return out;
  }

  /** Bulk import namespaces for a guild — used by backup restore. */
  importForGuild(guildId, namespaces) {
    for (const [namespace, value] of Object.entries(namespaces ?? {})) {
      this.set(guildId, namespace, value);
    }
  }
}

module.exports = { ConfigManager };
