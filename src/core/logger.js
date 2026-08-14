'use strict';

/**
 * Console logger with levels and timestamps. Keep console output for
 * operators; user-facing errors always go through branded embeds instead.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

const threshold = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function write(level, args) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const color = COLORS[level] || '';
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`${color}[${ts}] [${level.toUpperCase()}]${RESET}`, ...args);
}

module.exports = {
  debug: (...args) => write('debug', args),
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  fatal: (...args) => {
    write('error', args);
  },
};
