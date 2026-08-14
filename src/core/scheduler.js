'use strict';

const log = require('./logger');

// setTimeout is capped at 2^31-1 ms (~24.8 days); chunk long waits and re-arm.
const MAX_CHUNK_MS = 20 * 24 * 60 * 60 * 1000;

/**
 * Persistent job scheduler. Jobs live in SQLite so giveaway endings, scheduled
 * announcements, temporary punishments, lockdown expiries, etc. all survive
 * restarts. Modules register a handler per job type in their module init:
 *
 *   client.scheduler.register('giveaway:end', async (client, job) => { ... });
 *   const id = client.scheduler.schedule({ guildId, type: 'giveaway:end', runAt: Date.now() + ms, data: {...} });
 */
class Scheduler {
  constructor(client) {
    this.client = client;
    this.handlers = new Map();
    this.timers = new Map(); // jobId -> Timeout
    this.started = false;
  }

  register(type, handler) {
    if (this.handlers.has(type)) log.warn(`Scheduler handler for '${type}' registered twice; overwriting.`);
    this.handlers.set(type, handler);
  }

  /** Persist and arm a job. Returns the job id. `runAt` is a ms epoch. */
  schedule({ guildId = null, type, runAt, data = {} }) {
    const result = this.client.db.run(
      'INSERT INTO scheduled_jobs (guild_id, type, run_at, data) VALUES (?, ?, ?, ?)',
      guildId,
      type,
      Math.floor(runAt),
      JSON.stringify(data ?? {}),
    );
    const id = Number(result.lastInsertRowid);
    if (this.started) this._arm({ id, guild_id: guildId, type, run_at: Math.floor(runAt), data: JSON.stringify(data ?? {}) });
    return id;
  }

  cancel(jobId) {
    const timer = this.timers.get(jobId);
    if (timer) clearTimeout(timer);
    this.timers.delete(jobId);
    this.client.db.run('DELETE FROM scheduled_jobs WHERE id = ?', jobId);
  }

  /** Cancel every pending job of a type for a guild (e.g. when a giveaway is deleted). */
  cancelWhere(guildId, type) {
    const rows = this.client.db.all('SELECT id FROM scheduled_jobs WHERE guild_id = ? AND type = ?', guildId, type);
    for (const row of rows) this.cancel(row.id);
  }

  /** Find pending jobs (for status displays). */
  pending(guildId, type) {
    return this.client.db
      .all('SELECT id, guild_id, type, run_at, data FROM scheduled_jobs WHERE guild_id = ? AND type = ?', guildId, type)
      .map((r) => ({ ...r, data: safeParse(r.data) }));
  }

  /** Load all persisted jobs and arm timers. Called once on clientReady. */
  start() {
    if (this.started) return;
    this.started = true;
    const rows = this.client.db.all('SELECT id, guild_id, type, run_at, data FROM scheduled_jobs ORDER BY run_at ASC');
    log.info(`Scheduler: arming ${rows.length} persisted job(s).`);
    let overdueStagger = 0;
    for (const row of rows) {
      if (row.run_at <= Date.now()) {
        // Fire overdue jobs shortly after startup, staggered to avoid a burst.
        overdueStagger += 750;
        const t = setTimeout(() => this._fire(row), overdueStagger);
        this.timers.set(row.id, t);
      } else {
        this._arm(row);
      }
    }
  }

  _arm(row) {
    const delay = row.run_at - Date.now();
    if (delay > MAX_CHUNK_MS) {
      const t = setTimeout(() => this._arm(row), MAX_CHUNK_MS);
      this.timers.set(row.id, t);
      return;
    }
    const t = setTimeout(() => this._fire(row), Math.max(delay, 0));
    this.timers.set(row.id, t);
  }

  async _fire(row) {
    this.timers.delete(row.id);
    // Delete first so a crashing handler can't loop forever on restart.
    this.client.db.run('DELETE FROM scheduled_jobs WHERE id = ?', row.id);
    const handler = this.handlers.get(row.type);
    if (!handler) {
      log.warn(`Scheduler: no handler registered for job type '${row.type}' (job ${row.id}).`);
      return;
    }
    try {
      await handler(this.client, { id: row.id, guildId: row.guild_id, type: row.type, runAt: row.run_at, data: safeParse(row.data) });
    } catch (err) {
      log.error(`Scheduler job '${row.type}' (${row.id}) failed:`, err);
    }
  }

  stop() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

function safeParse(json) {
  try {
    return JSON.parse(json ?? '{}');
  } catch {
    return {};
  }
}

module.exports = { Scheduler };
