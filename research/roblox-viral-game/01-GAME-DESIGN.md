# The Game
### A concrete design proposal, derived from the strategy brief

---

## The one-line pitch

**Two crews of four. One warehouse each. Everything you own has legs, makes money, and can be carried out the front door by someone on the other team.**

---

## Working title

**SNATCH A STOMPER**

The name does the three jobs the research says a name must do. It states the mechanic in three words. It is alliterative, so it survives being heard once in a YouTube video. And the noun is **invented**, which means you own it — unlike "Brainrot", which is currently the subject of a trademark countersuit, and unlike "Steal a ___", which Sammy paid Killioz to use rather than simply taking.

Alternates, in order of preference: *Yoink a Stomper*, *Stomper Heist*, *Raid a Stomper*, *Stomper Shift*.

**This name is a proposal, not a decision.** Before it goes anywhere: run a trademark search in the relevant classes, search Roblox for existing games, and check the phrase on TikTok. The verb matters more than the noun for search; the noun matters more for ownership.

---

## The mascots: Stompers

**A Stomper is an ordinary object with stubby legs and a face.** A toaster with legs. A traffic cone with legs. A fire hydrant, a washing machine, a mailbox, a vending machine, a porta-potty, a grand piano, a shopping trolley, a jet engine, a church organ — each with the same four stubby legs and two googly eyes.

This is doing a great deal of work at once:

- **It is generative.** Any object plus legs plus eyes is a new character. You will never run out, and neither will your community, which will suggest them endlessly and for free.
- **It is cheap.** One leg rig, one eye pair, one animation set. A new Stomper is a new top mesh. Appendix F's arithmetic: roughly 40 unique meshes across 8 mutation treatments yields **about 320 distinct collectibles**.
- **It reads at 150×150.** A toaster with legs is legible as an icon thumbnail. This matters more than it sounds: the tile is the ad, and qualified play-through rate is the top of the discovery funnel.
- **It is funny in the right register.** Same absurdist juxtaposition that made Italian brainrot work, without borrowing anyone's character.
- **It is unambiguously yours.** Generic household objects are not anyone's copyright. This is a catalogue you can trademark, plush, license, and carry into a standalone app — the thing *Steal a Brainrot* can only do for the characters it controls, and the thing it is currently in court about for the ones it doesn't.
- **It localises for free.** The names are yours, so you add them to the translation table with identical values across all 18 auto-translated languages and the machine translator leaves them alone.

Rarity is expressed through escalating absurdity of scale: Common is a toaster, Secret is a cathedral with legs.

---

## Why this shape and not a straight clone

Every formula game on Roblox treats the other seven people in your server as antagonists. That is the source of the genre's churn problem: being robbed is a solo humiliation, and humiliated players close the app. Under the old 7-day ranker that didn't matter, because the spike paid for itself before the churn showed up. Under the 28-day ranker it matters enormously.

Meanwhile "intentional co-play" is a **headline signal** in the June 2026 discovery algorithm.

So: keep the theft, but put a teammate on either side of it. You are robbed *as a crew* and defended *by a crew*. Loss becomes a shared event with a rescue attempt in it, rather than a private loss with a rage-quit at the end. That single structural change converts the genre's biggest retention weakness into alignment with the exact signal the platform now rewards, and no incumbent can copy it without rebuilding the loop that currently prints money for them.

---

## The first sixty seconds

This sequence is the whole design and should be protected at all costs.

| Time | What happens |
|---|---|
| 0:00 | You spawn on your crew's warehouse floor, standing next to a teammate. A shared counter above the door reads the crew's total income per second. |
| 0:05 | A Stomper walks down the street outside on the conveyor. A price tag floats above it: **$25**. You have $50. |
| 0:10 | You tap it. It waddles into your warehouse and climbs onto a podium. A counter above its head starts ticking: **+$1/sec**. You now own a thing that makes money, and you have been playing for ten seconds. |
| 0:25 | You buy a second one. The floor counter goes up. A teammate places one next to yours. |
| 0:40 | A siren. Red text: **THE RUSTBUCKETS ARE RAIDING.** Across the room, an enemy player is running out of your door carrying your teammate's washing machine, glowing red, visibly slow. |
| 0:50 | You chase and tackle them. They drop it. It waddles home on its own. Your teammate types "ty". |
| 1:00 | You tap **LOCK** on the wall. The door shutters for 45 seconds. Your crew is safe and you did that. |

Nothing in that minute needs explaining and every beat of it is clippable.

---

## Core systems

### The street (acquisition)

A conveyor runs down the middle of the map, visible from both warehouses. Stompers walk along it with price tags. Weighted random spawns, server-side rolls, pity timers per rarity so a Legendary is guaranteed roughly every five minutes and a Mythic roughly every fifteen — matching the pacing the reference game uses.

Both crews can see and buy from the same street. This is deliberate: you watch the enemy buy the thing you wanted, and you now know they have it and where it is.

### The warehouse (income)

Each crew shares one warehouse with individual podiums. Your Stompers are yours; the floor is collective.

Income accrues **lazily, never on a tick**: `cash = floor((now - lastCollect) * rate)`, computed on the server when you claim and mirrored on the client for the display so the counter animates with zero network traffic. Offline accrual is computed once on load from the persisted timestamp, capped by progression tier — **two hours at the start, rising to twelve**. Keep the cap tight; it protects the economy and keeps the permanent multiplier the real long-term lever.

### The raid (the social trigger)

Walk into the enemy warehouse, grab a Stomper, carry it out and across to your own delivery point.

- Carrying makes you **slow, loud and glowing.** You are a target and everyone can see you.
- **Any hit from a defender makes you drop it**, and it waddles home by itself. Nothing is destroyed. The victim's loss is temporary if their crew is awake.
- The victim's crew gets a siren and a marker. Defence is always possible, which is what makes it a team game rather than a tax.
- **Successful theft transfers the Stomper permanently.** The stakes have to be real or the defence means nothing.

Server-side validation is non-negotiable and is specified in the production plan: bounds checks, travel-time plausibility, single-use action IDs, rate limiting. Appendix F documents dozens of public cheat scripts targeting exactly this mechanic in the reference game, including `firetouchinterest` on the delivery hitbox.

### The lock (the reason to have teammates)

A shared crew shutter. **Any crew member can trigger it**; it protects everyone; it has a cooldown and a charge that recharges over time. A crew with four people online can keep the door shut almost continuously. A solo player cannot.

This is the mechanical expression of the whole thesis: **being online with your crew is directly, legibly valuable.**

### Clock Out (the reset)

The rebirth equivalent, themed as ending your shift. Trade all your cash and Stompers for a permanent multiplier. **Fifteen tiers.** Each tier also requires owning specific Stompers, which is what generates the collection pressure that makes raiding worthwhile — you raid because you need a specific washing machine, not just because you want money.

Rewards escalate: multiplier, an extra podium slot from tier 2, longer lock charge, and one exclusive Stomper per tier.

### Mutations (content for free)

One mutation per Stomper, expressed as a texture and particle treatment, multiplying income. Roughly eight at launch: **Rusty ×1.25, Chrome ×1.5, Neon ×2, Soggy ×3, Molten ×5, Void ×7, Prismatic ×10, Ancient ×15.** Event mutations are time-gated and never return, which is where the collection status comes from.

This is the single best cost-to-perceived-content ratio in the genre and Roblox's own documentation recommends it by name.

### Crews (the day-8-to-28 engine)

This is the part that does not exist in any competitor and the part that makes the ranker work for you.

- A **Crew** is persistent across sessions, up to 20 members, backed by a Roblox Community.
- **Crew Level** rises with contributed earnings, unlocking perks: faster lock recharge, an extra floor slot for every member, crew-exclusive Stompers, a crew banner in the warehouse.
- **The Weekly League.** Crews are ranked by earnings and successful raids over a seven-day window, resetting Saturday. Top crews get an exclusive mutation for that week only.
- Joining a server with crewmates puts you on the same side. `Player.PartyId` and `SocialService:GetPartyAsync()` make "play with your friends" a one-tap action, and an 8-player server means a party of four fills an entire side.

The League is the answer to "why would someone open this on day twenty". It is also, not coincidentally, a machine for producing exactly the co-play and return-visit signals the June 2026 algorithm measures.

### Trading

Shipped at launch, because the research is unambiguous that a trading economy is what gives these games their long tail — and equally unambiguous that trading is the largest dupe surface in the genre.

Therefore, non-negotiably: server-side escrow, UUID-tagged items, both parties re-confirm after any change with a three-second lock, atomic transfer under session lock, every completed trade logged with both user IDs and item UUIDs, rate-limited prompts, and a trade cooldown for new accounts. *Grow a Garden*'s dupe-and-rollback cycle is the cautionary tale; it is named in the research as a direct cause of trust erosion.

---

## Progression mapped to the algorithm

The June 2026 ranker scores retention in three buckets. Design each one deliberately.

| Bucket | What has to happen | The system that does it |
|---|---|---|
| **Day 1** | Own something that earns within 10 seconds. Be useful to another person within 60. First Clock Out inside 15 minutes. | The street, the tackle-save, cheap first reset |
| **Day 2–7** | A collection with visible holes. A rarity you have seen but not owned. A floor with empty podiums. | Collection index, mutations, floor expansion, Clock Out tiers 2–6 |
| **Day 8–28** | A social obligation and a weekly reset. Someone expects you on Saturday. | **Crews, the Weekly League, seasons, trading** |

Most formula games are built entirely in the first row. That was rational in 2025 and is now a throttle.

---

## Monetization

Price points below are anchored to the real observed ladder in Appendix D. The design principle is **non-blocking**: every purchase accelerates, none gates. The August 2026 ranker test rewards games strong on retention *and* monetization together, which means predatory monetization that drives players away now costs you reach as well as goodwill.

| Item | Type | Robux | Notes |
|---|---|---|---|
| Starter Shift | Pack | **79** | First-purchase hook: cash, a Rare Stomper, one floor slot |
| Double Pay | Pass | **199** | The core multiplier |
| Auto-Collect | Pass | **249** | Quality of life, high conversion |
| Crew VIP | Pass | **399** | Income boost, faster lock recharge, warehouse tag |
| Extra Floor Slots | Pass | **299** | Repeatable tiers |
| Crew Banner | Pass | **149** | Pure cosmetic, crew-visible |
| Lucky Shift 15 min | Dev product | **99 / 249 / 599** | Server-wide luck multiplier — the whole server benefits, which makes buying it a *social* act |
| Season Pass | Pass | **749** | ~1 month, 10 tiers, free and premium tracks |
| Tier Skip | Dev product | **49** | |

**The Lucky Shift being server-wide is deliberate.** It converts the highest-converting product category into a visible act of generosity that the other seven players thank you for. It monetizes and generates co-play at the same time.

**Compliance, non-negotiable.** Any paid random item must display every outcome with exact percentage odds summing to 100% before purchase, must update odds as one-off outcomes are exhausted, and must respect `PolicyService.ArePaidRandomItemsRestricted` with a non-random path for restricted users. Prefer transparent multipliers to hidden crates throughout — cheaper legally, and it is the mechanic currently attracting regulatory attention.

**Deliberately excluded:** an admin-powers pass (the reference game's 7,499-Robux whale product), hidden-odds crates, anything resembling a media feed or watch-to-earn loop, and any design that assumes under-13 whales.

**Build R15-compliant from the first commit.** Never spawn an R6 avatar. This alone qualifies age-verified US adult spend for the DevEx rate of $0.0054 per Robux rather than $0.0038 — a 42% uplift on that revenue for no design cost.

---

## Live operations

The weekly ritual is the product. Missing it is how these games die.

**Saturday, 1:00 PM ET, every week, without exception.**

- **The update.** Four to six new Stompers, one new mutation, a balance pass. Ship it **time-gated in the previous week's build** so no Friday-night publish is required — content unlocks on server time.
- **Overtime.** A 30 to 45-minute hosted window immediately after: server luck multiplied across every server at once via a single broadcast, event-only Stompers on the street, the developers playing in public servers. This is the "admin abuse" pattern, branded, and it is the most effective and cheapest live-ops tool in the genre.
- **The League reset.** Crew rankings settle, exclusive mutation awarded, new week begins. Everyone has a reason to be there.

Countdown timers in-game, teasers midweek, and the whole playerbase concentrated into one spike that the charts and the recommendation algorithm then amplify.

**Seasons** run about a month with ten tiers and at least a week of rest between, per Roblox's own guidance.

---

## Designing for clips

Moments is a first-party discovery surface as of RDC 2026, and `CaptureService:PromptShareCapture()` produces a native share sheet **carrying an invite link with launch data**. Almost nobody is using this deliberately. Build four moments worth clipping and then ask for the clip:

1. **The tackle-save** — catching a thief at your door
2. **The Secret reveal** — a cathedral with legs walking down the street, announced server-wide
3. **The buzzer-beat lock** — shutter closing with a raider mid-stride
4. **The League win** — crew banner unfurling

Prompt the capture after the moment, never during. Do not reward the sharing with currency — that edges toward the watch-to-earn pattern that got *Steal An Egg* delisted in August 2026.

---

## What would make me abandon this design

Stated in advance, so the decision is made with a clear head rather than sunk costs.

- **Playtesters do not spontaneously help teammates** in the first session. The entire thesis is that co-play is fun here; if it isn't, this is just a worse *Steal a Brainrot*.
- **Day 1 retention below roughly 20%** after icon iteration. The tile and the first minute are the whole top of the funnel. *(Target, not a verified genre benchmark — retention figures for the reference games were not obtainable.)*
- **Someone ships this exact design first.** Fourteen clones appeared within 48 hours of a viral idea being tweeted in 2026. If a crew-based formula game with an owned mascot line launches before you, the correct move is to change the noun and the verb rather than fight for the same search term.
- **Roblox bans or demotes a mechanic this depends on.** The August 2026 media-feed rule was written about nine days after the mechanic went viral. Shared-luck purchases and raid mechanics are not currently at risk, but the precedent is now established and the watch list should be checked before each season.
