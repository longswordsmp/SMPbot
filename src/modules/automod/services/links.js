'use strict';

const { PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { bounded, boundedAction } = require('./settings');

/* ------------------------------------------------------------------ *
 * Static heuristic data. These lists are documented as imperfect:
 * URL abuse is an arms race, and heuristics trade a few false
 * positives/negatives for zero external dependencies. Staff can always
 * whitelist domains via /automod whitelist domain-add.
 * ------------------------------------------------------------------ */

const INVITE_RE = /(?:discord\.gg|discord(?:app)?\.com\/invite|discord\.me|dsc\.gg)\/([\w-]{2,32})/gi;

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

const SHORTENER_HOSTS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'goo.gl', 'cutt.ly', 'rb.gy',
  'shorturl.at', 'tiny.cc', 'v.gd', 'ow.ly', 'buff.ly', 'rebrand.ly',
  'soo.gd', 'bl.ink', 'snip.ly', 'adf.ly', 'sh.st', 'urlz.fr', 's.id',
  't.ly', 'shorte.st', 'clck.ru', 'qr.ae',
]);

// Free/abused TLDs frequently used for throwaway phishing domains.
const SUSPICIOUS_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'buzz', 'click', 'zip', 'mov',
  'country', 'stream', 'download', 'racing', 'loan', 'win',
]);

const BRAND_TOKENS = ['discord', 'steam', 'minecraft', 'mojang', 'nitro'];
const BAIT_TOKENS = ['free', 'gift', 'nitro', 'promo', 'airdrop', 'giveaway'];
const OFFICIAL_BASES = ['discord', 'discordapp', 'steampowered', 'steamcommunity', 'minecraft', 'mojang'];
const OFFICIAL_DOMAINS = new Set([
  'discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'discord.new',
  'discordstatus.com', 'steampowered.com', 'steamcommunity.com',
  'minecraft.net', 'mojang.com', 'minecraftservices.com', 'minecraft-services.net',
]);

// Well-known hosts that must never trip the Minecraft-ad heuristic.
const COMMON_SAFE_HOSTS = new Set([
  'youtube.com', 'youtu.be', 'discord.com', 'discord.gg', 'discordapp.com',
  'discordapp.net', 'twitter.com', 'x.com', 'twitch.tv', 'reddit.com',
  'imgur.com', 'github.com', 'tenor.com', 'giphy.com', 'spotify.com',
  'tiktok.com', 'instagram.com', 'facebook.com', 'medal.tv', 'google.com',
  'minecraft.net', 'mojang.com', 'curseforge.com', 'modrinth.com', 'planetminecraft.com',
]);

const MC_HOST_PREFIXES = ['play.', 'mc.', 'pvp.', 'smp.', 'join.', 'server.'];
const MC_HOSTING_SUFFIXES = ['aternos.me', 'minehut.gg', 'ploudos.com', 'falixsrv.me', 'server.pro', 'mcserverhost.com'];
const MC_PORTS = new Set(['25565', '19132']);

const HOSTLIKE_RE = /\b(?:[a-z0-9-]{1,63}\.)+[a-z]{2,24}(?::\d{2,5})?\b/gi;
const IP_RE = /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{2,5})?\b/g;

// Own-guild invite codes, cached briefly so we don't hammer the API per message.
const ownInviteCache = new Map(); // guildId -> { codes: Set<string>, fetchedAt }
const OWN_INVITE_TTL_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Small non-cryptographic hash used to bound cooldown-key sizes. */
function tinyHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Extract parsed URLs from message content. */
function extractUrls(content) {
  const out = [];
  if (!content) return out;
  for (const match of content.matchAll(URL_RE)) {
    const raw = match[0].replace(/[),.;:!?\]'"]+$/, '');
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      out.push({ raw, url, host: url.hostname.toLowerCase().replace(/^www\./, '') });
    } catch {
      // not a parseable URL — ignore
    }
  }
  return out;
}

/** Naive registrable domain (last two labels). Good enough for heuristics. */
function registrable(host) {
  const parts = String(host).toLowerCase().split('.').filter(Boolean);
  return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
}

function isWhitelistedHost(host, domains) {
  if (!Array.isArray(domains) || !domains.length) return false;
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Map common homoglyph/leet substitutions so lookalikes normalize to the brand. */
function homoglyphNormalize(host) {
  return String(host)
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/vv/g, 'w')
    .replace(/rn/g, 'm');
}

/** Bounded Levenshtein distance (early-outs above `max`). */
function levenshtein(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length > 40 || b.length > 40) return max + 1;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let left = i;
    let diag = i - 1;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const cur = Math.min(prev[j] + 1, left + 1, diag + cost);
      diag = prev[j];
      prev[j] = cur;
      left = cur;
    }
    prev[0] = i;
  }
  return prev[b.length];
}

/**
 * Phishing heuristic: lookalike domains for Discord/Steam/Minecraft plus
 * brand names on suspicious TLDs or paired with bait wording. Imperfect by
 * design — documented in the status UI and log entries.
 */
function looksPhishy(host) {
  const reg = registrable(host);
  if (OFFICIAL_DOMAINS.has(reg)) return null;
  const norm = homoglyphNormalize(host);
  const base = homoglyphNormalize(reg).split('.')[0] ?? '';
  const tld = host.split('.').pop() ?? '';

  for (const official of OFFICIAL_BASES) {
    if (base !== official && levenshtein(base, official, 1) <= 1) {
      return `lookalike of “${official}” (homoglyph/typo domain)`;
    }
  }
  const flat = norm.replace(/-/g, '');
  if (BRAND_TOKENS.some((t) => flat.includes(t))) {
    if (SUSPICIOUS_TLDS.has(tld)) return `brand name on suspicious .${tld} domain`;
    if (BAIT_TOKENS.some((t) => flat.includes(t))) return 'brand name combined with bait wording (free/gift/nitro)';
    for (const official of OFFICIAL_BASES) {
      if (base !== official && levenshtein(base, official, 2) <= 2) {
        return `near-match of “${official}” domain`;
      }
    }
  }
  return null;
}

/** Fetch (and briefly cache) invite codes that belong to this guild. */
async function ownGuildInviteCodes(guild) {
  const cached = ownInviteCache.get(guild.id);
  if (cached && Date.now() - cached.fetchedAt < OWN_INVITE_TTL_MS) return cached.codes;
  const codes = new Set();
  try {
    if (guild.vanityURLCode) codes.add(guild.vanityURLCode);
    if (guild.members.me?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      const invites = await guild.invites.fetch();
      for (const invite of invites.values()) if (invite.code) codes.add(invite.code);
    }
  } catch (err) {
    log.debug(`automod: could not fetch own invites for guild ${guild.id}:`, err?.message ?? err);
  }
  ownInviteCache.set(guild.id, { codes, fetchedAt: Date.now() });
  return codes;
}

/** Hosts/IPs the guild explicitly allows for Minecraft advertising. */
function allowedMcHosts(client, guildId, node) {
  const allowed = new Set();
  for (const ip of node.allowedIps ?? []) {
    const v = String(ip).toLowerCase().trim();
    if (!v) continue;
    allowed.add(v);
    allowed.add(v.split(':')[0]);
  }
  // The guild's own server (from the 'minecraft' namespace) is ALWAYS allowed.
  try {
    const mc = client.config.get(guildId, 'minecraft', {});
    for (const value of [mc?.javaIp, mc?.bedrockIp]) {
      if (typeof value === 'string' && value.trim()) {
        const v = value.toLowerCase().trim();
        allowed.add(v);
        allowed.add(v.split(':')[0]);
      }
    }
  } catch {
    // minecraft namespace unavailable — degrade silently
  }
  return allowed;
}

/**
 * Minecraft server advertising heuristic. Flags server-style hostnames
 * (play./mc./…), known MC hosting domains, MC ports, "ip:" patterns, and
 * "join my server" phrasing paired with an address. Imperfect by design.
 */
function detectMinecraftAd(client, cfg, message, node) {
  const content = message.content ?? '';
  const candidates = new Set(
    [...(content.match(HOSTLIKE_RE) ?? []), ...(content.match(IP_RE) ?? [])].map((s) => s.toLowerCase()),
  );
  if (!candidates.size) return null;

  const allowed = allowedMcHosts(client, message.guild.id, node);
  const whitelist = cfg.links?.whitelistDomains ?? [];
  const phrasing =
    /\b(?:join|play on|come play|hop on|check out)\b/i.test(content) && /\b(?:server|smp|realm|network)\b/i.test(content);

  for (const raw of candidates) {
    const [hostPart, portPart] = raw.split(':');
    if (allowed.has(raw) || allowed.has(hostPart)) continue;
    if (isWhitelistedHost(hostPart, whitelist)) continue;
    if (COMMON_SAFE_HOSTS.has(registrable(hostPart)) && !MC_PORTS.has(portPart ?? '')) continue;

    let why = null;
    if (MC_HOST_PREFIXES.some((p) => hostPart.startsWith(p))) why = 'server-style hostname';
    else if (MC_HOSTING_SUFFIXES.some((sfx) => hostPart === sfx || hostPart.endsWith(`.${sfx}`))) why = 'known MC hosting domain';
    else if (MC_PORTS.has(portPart ?? '')) why = 'Minecraft server port';
    else if (new RegExp(`\\b(?:ip|address)\\s*[:=]\\s*${escapeRegex(raw)}`, 'i').test(content)) why = '"ip:" advertisement pattern';
    else if (phrasing) why = '"join my server" phrasing with an address';
    if (why) return { matched: raw, why };
  }
  return null;
}

function mkViolation(key, node, label, reason) {
  return { key, rule: `links.${key}`, label, action: boundedAction(node.action), reason };
}

function normalizedUrl(u) {
  return `${u.host}${u.url.pathname.replace(/\/+$/, '').toLowerCase()}`;
}

/**
 * Run every enabled anti-link check against a message. Returns the first
 * violation found, or null. Whitelisted domains are exempt from every check
 * except Discord invites (which have their own own-guild allowlist).
 */
async function checkLinks(client, cfg, message) {
  const l = cfg.links ?? {};
  const content = message.content ?? '';
  if (!content) return null;
  const guildId = message.guild.id;
  const userId = message.author.id;
  const whitelist = Array.isArray(l.whitelistDomains) ? l.whitelistDomains : [];

  // 1) Discord invite links
  const inv = l.invites ?? {};
  if (inv.enabled) {
    const codes = [...content.matchAll(INVITE_RE)].map((m) => m[1]);
    if (codes.length) {
      const allowedCodes = inv.allowOwnGuild !== false ? await ownGuildInviteCodes(message.guild) : new Set();
      const foreign = codes.filter((code) => !allowedCodes.has(code));
      if (foreign.length) {
        return mkViolation(
          'invites',
          inv,
          'Discord invite links',
          `posted ${foreign.length} foreign invite code(s): ${foreign.slice(0, 3).map((c) => `\`${c}\``).join(', ')}`,
        );
      }
    }
  }

  // 2) Minecraft server advertising
  const mc = l.minecraft ?? {};
  if (mc.enabled) {
    const found = detectMinecraftAd(client, cfg, message, mc);
    if (found) {
      return mkViolation('minecraft', mc, 'Minecraft server advertising', `${found.why}: \`${found.matched}\``);
    }
  }

  const urls = extractUrls(content);
  const external = urls.filter((u) => !isWhitelistedHost(u.host, whitelist));
  if (!external.length) return null;

  // 3) URL flooding (per message + per window)
  const uf = l.urlflood ?? {};
  if (uf.enabled) {
    const maxPerMessage = bounded(uf.maxPerMessage, 4, 1, 50);
    if (external.length > maxPerMessage) {
      return mkViolation('urlflood', uf, 'URL flooding', `${external.length} links in one message (limit ${maxPerMessage})`);
    }
    const windowMs = bounded(uf.windowSeconds, 60, 2, 3600) * 1000;
    const maxPerWindow = bounded(uf.maxPerWindow, 8, 1, 200);
    let total = 0;
    for (let i = 0; i < external.length; i++) {
      total = client.cooldowns.count(`automod:urls:${guildId}:${userId}`, windowMs);
    }
    if (total > maxPerWindow) {
      return mkViolation('urlflood', uf, 'URL flooding', `${total} links in ${Math.round(windowMs / 1000)}s (limit ${maxPerWindow})`);
    }
  }

  // 4) Repeated same link
  const rep = l.repeatedlink ?? {};
  if (rep.enabled) {
    const windowMs = bounded(rep.windowSeconds, 120, 2, 3600) * 1000;
    const maxRepeats = bounded(rep.maxRepeats, 3, 2, 20);
    for (const u of external) {
      const n = client.cooldowns.count(`automod:replink:${guildId}:${userId}:${tinyHash(normalizedUrl(u))}`, windowMs);
      if (n >= maxRepeats) {
        return mkViolation('repeatedlink', rep, 'Repeated links', `posted \`${u.host}\` ${n}× in ${Math.round(windowMs / 1000)}s`);
      }
    }
  }

  // 5) Link shorteners
  if (l.shorteners?.enabled) {
    for (const u of external) {
      if (SHORTENER_HOSTS.has(u.host) || SHORTENER_HOSTS.has(registrable(u.host))) {
        return mkViolation('shorteners', l.shorteners, 'Link shorteners', `shortened link via \`${u.host}\``);
      }
    }
  }

  // 6) Phishing-like URLs (heuristic — documented as imperfect)
  if (l.phishing?.enabled) {
    for (const u of external) {
      const why = looksPhishy(u.host);
      if (why) return mkViolation('phishing', l.phishing, 'Phishing-like link', `\`${u.host}\` — ${why}`);
    }
  }

  return null;
}

module.exports = {
  checkLinks,
  extractUrls,
  escapeRegex,
  tinyHash,
  registrable,
  isWhitelistedHost,
  looksPhishy,
  detectMinecraftAd,
  ownGuildInviteCodes,
  SHORTENER_HOSTS,
};
