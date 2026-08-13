'use strict';

require('dotenv').config();

const log = require('./core/logger');

if (!process.env.DISCORD_TOKEN) {
  log.error('Missing DISCORD_TOKEN. Copy .env.example to .env and add your bot token.');
  process.exit(1);
}

const { createBot } = require('./bot');

const client = createBot();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info(`Received ${signal}, shutting down gracefully...`);
  try {
    client.scheduler.stop();
    await client.destroy();
  } catch (err) {
    log.error('Error during shutdown:', err);
  }
  try {
    client.db.close();
  } catch {
    // already logged inside close()
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (err) => {
  log.error('Unhandled promise rejection:', err);
});

process.on('uncaughtException', (err) => {
  // Log and keep running for transient errors; a supervisor (pm2/systemd/Docker)
  // should restart the process on repeated crashes.
  log.error('Uncaught exception:', err);
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  log.error('Failed to log in — check your DISCORD_TOKEN:', err?.message ?? err);
  process.exit(1);
});
