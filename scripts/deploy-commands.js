'use strict';

/**
 * Registers every slash command with Discord.
 *   npm run deploy          → global registration (may take up to an hour to propagate)
 *   DEV_GUILD_ID=... set    → instant registration to that guild only (development)
 */

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const devGuildId = process.env.DEV_GUILD_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

function jsFilesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFilesIn(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const modulesDir = path.join(__dirname, '..', 'src', 'modules');
const commands = [];
const seen = new Set();

for (const moduleName of fs.readdirSync(modulesDir)) {
  const commandsDir = path.join(modulesDir, moduleName, 'commands');
  for (const file of jsFilesIn(commandsDir)) {
    const command = require(file);
    if (!command?.data?.toJSON) continue;
    const json = command.data.toJSON();
    if (seen.has(json.name)) {
      console.error(`Duplicate command name '${json.name}' in ${file}`);
      process.exit(1);
    }
    seen.add(json.name);
    commands.push(json);
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash command(s)${devGuildId ? ` to guild ${devGuildId}` : ' globally'}...`);
    const route = devGuildId
      ? Routes.applicationGuildCommands(clientId, devGuildId)
      : Routes.applicationCommands(clientId);
    const data = await rest.put(route, { body: commands });
    console.log(`Successfully registered ${data.length} command(s).`);
  } catch (err) {
    console.error('Command registration failed:', err);
    process.exit(1);
  }
})();
