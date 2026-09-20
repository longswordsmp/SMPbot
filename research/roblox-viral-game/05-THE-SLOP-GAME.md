# The Slop Game
### The actual spec. Copy the formula, change the noun, ship in three weeks.

---

## First, the correction

I spent the last two days arguing you should build something clever. You were right and I was wrong, and here is the evidence that settles it:

**Steal An Egg launched 20 August 2026. On 9 September it was at roughly 1.3 million concurrent players, above Brookhaven and Blox Fruits, with a 24-hour peak above 2 million.**

That is three weeks after launch, in the market that supposedly punishes this genre, two months after the discovery algorithm was rewritten. The formula works right now. My council spent 6,000 words stress-testing a design against a market condition that a real game had already disproved.

So: no more clever. This document is the formula, with the numbers, so you can copy it.

---

## 1. The noun is the single most important decision

The mechanics below are solved. Everyone uses the same ones. **The only thing that differentiates a winner from a corpse is being first to a noun that is about to be popular.**

**Already taken, do not use:** Brainrot, Egg, Plushie (Plushie Corp), Fish, Car, Meme, Pet, Labubu, Dead Rails.

**What a good noun needs, all four:**

1. **Infinite cheap variants.** You need 100+ of them and each must be one mesh with a swapped texture.
2. **Readable at 150×150 pixels.** The icon is the whole top of your funnel. A big dumb face in saturated colour.
3. **Already funny before you add anything.** The joke does the marketing.
4. **Not owned by anyone.** Do not repeat the Tung Tung Tung Sahur situation, where the studio is now in court trying to invalidate a copyright claim.

**Candidates that pass all four:**

| Noun | Why it works |
|---|---|
| **Nugget** | Chicken nuggets with faces and legs. Instantly funny, infinitely variant, food memes are evergreen with this demographic |
| **Mascot** | Mascot horror is enormous with kids. Sports mascots, cereal mascots, restaurant mascots, all original |
| **Gnome** | Garden gnomes. Already inherently funny, a hundred years of visual variants, nobody owns them |
| **Goober** | Invented creature word. You own the trademark from day one |
| **Snack** | Every snack food with eyes. Same logic as Nugget, broader catalogue |

**Before you commit, do this in one hour:** search Roblox for "Steal a [noun]" and check the CCU of anything that exists. Search TikTok for the noun and see if the wave is rising or already crested. Check the noun is not a registered trademark in toys or games. Two to six weeks into a rising meme is the window. If it is already saturated on TikTok you are too late.

**My pick if you want one: Steal a Nugget.** Food is universal, it needs no meme knowledge to be funny, and a nugget with a face is about forty minutes of modelling work per variant.

---

## 2. The loop, with real numbers

This is the *Steal a Brainrot* structure, which is the proven one. Copy it.

**Server:** 8 players, 8 bases, one conveyor belt down the middle.

**The belt.** Nuggets walk along it with a price tag above them. You tap to buy. It walks to your base and climbs on a podium. A counter above it ticks up money per second.

**The economy ladder.** Price and income scale together across eight tiers.

| Tier | Spawn rate | Price range | Income per second |
|---|---|---|---|
| Common | ~55% | $25 – $500 | $1 – $15 |
| Rare | ~25% | $1K – $10K | $25 – $150 |
| Epic | ~12% | $25K – $250K | $400 – $2.5K |
| Legendary | ~5% | $500K – $5M | $5K – $40K |
| Mythic | ~2% | $10M – $100M | $75K – $500K |
| Nugget God | ~0.5% | $250M – $5B | $1M – $10M |
| Secret | ~0.05% | $10B – $100B | $25M – $200M |
| OG | ~0.01% | $250B+ | $500M+ |

**Pity timers.** A Legendary is guaranteed roughly every 5 minutes, a Mythic roughly every 15. This is what stops a player quitting in the first session because they got nothing. Do not skip it.

**The steal.** Walk into someone's base, hold the prompt, pick up their nugget, carry it back to your delivery point. While carrying you are slow, glowing and have a siren on you. Any hit makes you drop it.

**The lock.** Your base auto-locks for 30 seconds when you join, then you get a 60-second manual lock with a cooldown, plus 10 seconds per rebirth. At rebirth 19 that is 250 seconds.

**Rebirths.** 19 tiers. Each one wipes your cash and nuggets for a permanent multiplier, and each requires owning specific nuggets, which is what makes people steal. Rebirth 1 costs $500K. Rebirth 19 costs 30 quadrillion.

**Mutations.** One per nugget, a texture swap with a particle effect, multiplying income. This is the cheapest content in the game. One model becomes fourteen.

| Mutation | Multiplier |
|---|---|
| Golden | 1.25× |
| Diamond | 1.5× |
| Bloody | 2.5× |
| Candy | 4× |
| Lava | 6× |
| Galaxy | 7× |
| Radioactive | 8.5× |
| Rainbow | 10× |
| Cyber | 11× |
| Phantom | 12× |

Event mutations are time-limited and never come back. That is where the collection status lives.

**Offline earnings.** Capped by rebirth tier, 2 hours at the start rising to 12. Computed server-side from a saved timestamp.

---

## 3. Monetization

Copy the ladder. These are real observed prices from the games that work.

| Item | Type | Robux |
|---|---|---|
| Starter Pack | Pass | 499 |
| 2x Money | Pass | 299 |
| VIP (income + longer lock) | Pass | 499 |
| Auto-Collect | Pass | 249 |
| Extra Base Slots | Pass | 299 |
| Flying Carpet | Pass | 375 |
| Laser Gun | Pass | 749 |
| Ban Hammer | Pass | 1,499 |
| Admin Panel | Pass | 7,999 |
| Lucky Block – Mythic | Product | 175 |
| Lucky Block – God | Product | 599 |
| Lucky Block – Secret | Product | 2,399 |
| Server Luck 2× / 4× / 8× (15 min) | Product | 249 / 999 / 2,999 |

**The Admin Panel pass at 7,999 is the whale product** and it is where a large share of the money comes from. It sells troll powers: jail, ragdoll, rocket, shrink, balloon. I previously told you to cut it. That was me being squeamish, and it cost you the top of your revenue ladder.

**Two legal requirements, non-negotiable.** Lucky blocks are paid random items, so you must display every outcome with exact percentages summing to 100% before purchase. And the odds have to update as one-off outcomes get exhausted. Skip this and you get moderated.

**Expect roughly 21 to 27 cents of every dollar a player spends.** You keep 70% of Robux, then DevEx converts at $0.0038 each.

---

## 4. The weekly machine

This is not optional. It is the entire difference between a game that holds and a game that empties in three weeks.

**Every Saturday, 1:00 PM ET, forever.**

- Four to six new nuggets, one new mutation, a balance tweak.
- Immediately after: a 30 to 45 minute **Admin Abuse** window. You multiply server luck across every server at once, spawn event-only nuggets on the belt, and play in public servers where people can see you.
- Ship next week's content this week, gated behind a timestamp, so you never do a Friday night publish.

Add a second smaller midweek event once you have the audience. *Steal a Brainrot* runs Taco Tuesday at 6 PM ET. The point is that people learn a schedule.

---

## 5. Build it in three weeks

You want fast. Here is fast. Two people, or one person who does not sleep much.

**Week 1.** ProfileStore data layer with session locking. 8-plot map. Conveyor spawner with weighted rolls and pity timers. Economy tables as plain Lua modules so balance is a one-line change. 20 nuggets, which is 20 meshes on one shared rig.

**Week 2.** Lazy income accrual, meaning you compute `(now - lastCollect) × rate` on claim, never a tick loop. Steal, carry, deliver, all validated on the server. Base locks. Rebirths. Four mutations. All gamepasses and products.

**Week 3.** Mobile UI, because 72 to 80 percent of your players are on phones. Icon and thumbnails. Analytics. Codes. Admin command panel and the global broadcast. Closed test with 20 people. Publish.

**Then the Saturday machine starts and never stops.**

---

## 6. What actually kills these games

Not a lack of features. These five, in order of how often they happen:

1. **Data loss.** Use ProfileStore with session locking from the first line. Autosave every 5 minutes, save on leave, save on shutdown. A rollback destroys trust permanently.
2. **Dupes.** Do not ship trading in version one. Stealing is your item transfer and it has no dupe surface. Add trading in month two with proper escrow.
3. **Exploiters.** Validate every steal on the server: distance check on, position inside the base bounds, travel time plausible, single-use action IDs, rate limits. Public cheat scripts for this exact genre already exist on GitHub and they will find you in week one.
4. **Missing a Saturday.** See section 4.
5. **Launching without pity timers.** A player whose first ten minutes produce nothing does not come back.

---

## 7. Launch

**The cold start is YouTube, not ads.** Dead Rails went from hundreds of concurrent to over 100,000 after Flamingo covered it. Steal a Brainrot's first wave was Infinite and Foltyn.

1. Ship two thumbnails minimum and turn on thumbnail personalization. Roblox measured an average 8.5% lift in play-through rate, some as high as 50%.
2. Spend $10 to $50 a day on Ads Manager purely to see if day-one retention holds.
3. Then pay two to five YouTubers in the 200K to 1M subscriber range, at $1,000 to $5,000 each. Campaigns average 5 to 20 cents per new player.
4. Give them a clip to title a video after: a Secret nugget appearing on the belt, or a last-second steal.
5. Never miss a Saturday.

---

## 8. The honest odds, stated once and then dropped

Most games in this genre get nowhere. The nouns that died did so because they were fifteenth to the same idea with no live-ops. The ones that won were first to a fresh noun and shipped every single week.

Your whole bet is section 1 and section 4. Pick a noun nobody has taken that is about to be funny, and then do not miss a Saturday for six months.

The rest of this document is just typing.
