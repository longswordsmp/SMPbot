'use strict';

/**
 * Built-in moderate NSFW wordlist for the AutoMod text filter.
 *
 * Scope: sexually explicit terms and adult-site names only — this is an
 * NSFW-content filter, not a profanity or slur filter. The list is
 * intentionally moderate: it aims for terms that are almost always sexual in
 * a Minecraft-community context, and avoids broad words ("naked", "hot",
 * "adult") that would generate constant false positives.
 *
 * Server owners can extend or trim this list per guild via
 * `/automod nsfw words` (custom additions and removals are stored in the
 * guild's `automod` config namespace — the file itself is never modified).
 *
 * Honest limits: word lists can never fully understand context. "Strict"
 * substring matching will flag words hidden inside other words (and may
 * false-positive, e.g. matching inside place names), while "relaxed"
 * matching only catches clean word-boundary uses. There is no image/embed
 * scanning — this filter is text-only.
 */
const BUILTIN_WORDS = [
  // explicit acts / terms
  'anal',
  'blowjob',
  'handjob',
  'rimjob',
  'deepthroat',
  'creampie',
  'cumshot',
  'bukkake',
  'gangbang',
  'threesome',
  'orgy',
  'orgasm',
  'masturbate',
  'masturbation',
  'masturbating',
  'fingering',
  'bdsm',
  'bondage',
  'fetish',
  'femdom',
  'dominatrix',
  'incest',
  'bestiality',
  'rape',
  'raping',
  // body/slang
  'cum',
  'jizz',
  'dick',
  'dicks',
  'cock',
  'cocks',
  'pussy',
  'pussies',
  'tits',
  'titties',
  'boobs',
  'boobies',
  'nudes',
  'dildo',
  'buttplug',
  'milf',
  'slut',
  'sluts',
  'whore',
  'whores',
  'hooker',
  'horny',
  'smut',
  'erotic',
  'erotica',
  'lewd',
  'lewds',
  'sexting',
  // anime/furry adult terms
  'hentai',
  'ahegao',
  'ecchi',
  'futa',
  'futanari',
  'yiff',
  'lolicon',
  'shotacon',
  'rule34',
  // adult sites / platforms
  'porn',
  'porno',
  'pornography',
  'pornhub',
  'xvideos',
  'xhamster',
  'xnxx',
  'redtube',
  'youporn',
  'spankbang',
  'brazzers',
  'bangbros',
  'motherless',
  'literotica',
  'nhentai',
  'e621',
  'onlyfans',
  'fansly',
  'chaturbate',
  'stripchat',
  'camgirl',
  'camwhore',
  'xxx',
];

module.exports = { BUILTIN_WORDS };
