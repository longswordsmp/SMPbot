'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const log = require('./logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const CORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id   TEXT NOT NULL,
  namespace  TEXT NOT NULL,
  value      TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (guild_id, namespace)
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT,
  type       TEXT NOT NULL,
  run_at     INTEGER NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_jobs_run_at ON scheduled_jobs (run_at);

CREATE TABLE IF NOT EXISTS managed_webhooks (
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  token      TEXT NOT NULL,
  PRIMARY KEY (guild_id, channel_id)
);
`;

/**
 * SQLite-backed persistence. Every module stores ALL durable state here so
 * the bot is fully restart-safe. Modules register their own tables via
 * `registerSchema` from their module.js file.
 */
class DatabaseManager {
  constructor(filename = 'smpbot.db') {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.db = new Database(path.join(DATA_DIR, filename));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this._stmts = new Map();
    this.registerSchema(CORE_SCHEMA);
  }

  /** Execute idempotent DDL (CREATE TABLE IF NOT EXISTS ...). */
  registerSchema(sql) {
    this.db.exec(sql);
  }

  /** Prepared-statement cache. */
  stmt(sql) {
    let s = this._stmts.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this._stmts.set(sql, s);
    }
    return s;
  }

  get(sql, ...params) {
    return this.stmt(sql).get(...params);
  }

  all(sql, ...params) {
    return this.stmt(sql).all(...params);
  }

  run(sql, ...params) {
    return this.stmt(sql).run(...params);
  }

  transaction(fn) {
    return this.db.transaction(fn);
  }

  close() {
    try {
      this.db.close();
    } catch (err) {
      log.error('Failed to close database:', err);
    }
  }
}

module.exports = { DatabaseManager, DATA_DIR };
