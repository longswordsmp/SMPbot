'use strict';

/**
 * Offline smoke test — verifies the whole bot loads without logging in:
 *   • every module, command, event, and component file parses and loads
 *   • every module schema applies cleanly to SQLite
 *   • every command's builder serializes to valid JSON
 *   • command names and component prefixes are unique
 * Run with: npm run smoke
 */

process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const { DatabaseManager } = require('../src/core/database');
const { createBot } = require('../src/bot');

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};

console.log('SMPbot smoke test\n');

let client;
try {
  const database = new DatabaseManager('smoke-test.db');
  client = createBot({ database });
  console.log(`  ✓ Bot constructed: ${client.modules.size} modules, ${client.commands.size} commands, ${client.componentHandlers.size} component handlers`);
} catch (err) {
  console.error('  ✗ Bot failed to construct:');
  console.error(err);
  process.exit(1);
}

for (const [name, command] of client.commands) {
  try {
    const json = command.data.toJSON();
    if (json.name !== name) fail(`Command '${name}' serializes with mismatched name '${json.name}'`);
    if (!json.description && json.type === undefined) fail(`Command '${name}' has no description`);
  } catch (err) {
    fail(`Command '${name}' failed to serialize: ${err.message}`);
  }
}
console.log(`  ✓ ${client.commands.size} command builders serialize`);

const serviceNames = Object.keys(client.services);
console.log(`  ✓ Services registered: ${serviceNames.join(', ') || '(none)'}`);

try {
  client.db.close();
} catch {
  // ignore
}
require('node:fs').rmSync(require('node:path').join(__dirname, '..', 'data', 'smoke-test.db'), { force: true });
require('node:fs').rmSync(require('node:path').join(__dirname, '..', 'data', 'smoke-test.db-wal'), { force: true });
require('node:fs').rmSync(require('node:path').join(__dirname, '..', 'data', 'smoke-test.db-shm'), { force: true });

if (failures > 0) {
  console.error(`\nSmoke test FAILED with ${failures} issue(s).`);
  process.exit(1);
}
console.log('\nSmoke test passed.');
process.exit(0);
