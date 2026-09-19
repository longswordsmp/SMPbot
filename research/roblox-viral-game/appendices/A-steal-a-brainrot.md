# Steal a Brainrot — Deep-Dive Research Report

**Prepared:** September 19, 2026
**Scope:** Steal a Brainrot (Roblox) and the "Steal a ___" clone family
**Method note:** ~44 web searches. Direct page fetches (Wikipedia, Fandom wiki, Bloomberg, NPR, Rolimon's, RoMonitor, etc.) were blocked by the network egress proxy in this environment, so most figures come from search-result extracts of those pages. Anything I could not cross-check against a second source is marked **(unverified)**. Where two sources disagree, both figures are given.

---

## 0. Executive summary

- **What it is:** A Roblox "steal tycoon" launched **May 16, 2025** by **SpyderSammy (Sam Brakta)**, published under the Roblox group **BRAZILIAN SPYDER**, owned by **Do Big Studios** (Sammy is its Chief Product Officer). Legal entities: **Spyder Games LLC** (Louisiana) and **Speedy Simulator Gaming** (Wyoming) co-hold the copyright.
- **Lineage:** Directly descended from **Steal a Character** (Open Minded Games / dev "Killioz", created April 21, 2025). Sammy bought the rights to the "Steal a" concept in May 2025 and reskinned it with AI-generated "Italian brainrot" meme characters.
- **Records:** Became the first game on any platform to exceed **25 million concurrent players** (October 2025; 25.4M–25.8M depending on source), after breaking Grow a Garden's record with **24,136,040** on **September 13, 2025**. Helped push Roblox to a platform-wide record of **47.4M CCU on August 23, 2025**.
- **Scale:** ~**73 billion visits** and ~**29 million favorites** by September 2026; 65.8B visits in its first 327 days.
- **Status Sept 2026:** Still top-10 on Roblox but well off peak — **365.8K CCU on Sept 5, 2026 (7th on platform)** vs. >1M daily CCU in summer 2026. Weekly updates continue (Update 66 shipped Sept 12, 2026).
- **Money:** Estimates range from **$11M/month** (Creator Exchange, Aug 2025) to **$64M lifetime real-money spend** (Bloomberg, Mar 2026). A Story Kitchen **film adaptation** was announced Jan 2026; official **PhatMojo plush line** launched 2026.
- **Controversy:** Copy accusations (Aug 2025), an AI-art copyright case (**Spyder Games LLC v. Mementum Lab** over Tung Tung Tung Sahur; jury trial set **Nov 8, 2027**), at least four lawsuits *by* the developers against clones since Nov 2025, loot-box/gambling criticism (Lucky Blocks blocked from Robux purchase in Belgium/Austria), and press criticism that the design "makes kids miserable."
- **Clone wave:** Hundreds of "Steal a ___" and "___ for Brainrots" titles. Most died fast (Steal a Fish, Steal a Car, Steal a Meme, Steal a Pet all peaked <20K CCU). The winners that broke out changed the *genre*, not just the noun: Plants vs Brainrots, Escape Tsunami for Brainrots, and the 2026 breakout **Steal An Egg** (4.1B visits in <2 months).

---

## 1. Origin & History

### 1.1 The people and companies

| Entity | Role | Detail (source date) |
|---|---|---|
| **SpyderSammy / Sam Brakta** | Creator, public face, host of Admin Abuse | 24-year-old American developer (per 2026 profiles). Roblox dev roles since 2013; first original project was a 2022 Roblox port of DaniDev's *Crab Game*. Contributed to Blade Ball, Race Clicker, Schedule, Fisch. Chief Product Officer of Do Big Studios since **January 2024** (LinkedIn). |
| **Do Big Studios (DBS)** | Owner/publisher | Founded **May 20, 2020** as Do_Big Games by CEO **John Cannata**. Acquires and operates Roblox games; acquired Race Clicker, Sword Fighters Simulator and Blade Ball in 2023. **do_small ("Const")**, a Brazilian developer, is Head of Studio. |
| **BRAZILIAN SPYDER** | Roblox group that hosts the experience | Experience ID 109983668079237. |
| **Spyder Games LLC** (Louisiana) + **Speedy Simulator Gaming** (Wyoming) | Copyright holders; plaintiffs in the anti-clone lawsuits | Per Bloomberg (Mar 24, 2026): "created by Spyder Games in collaboration with Speedy Simulator Gaming." The "Spedy" name in the brief almost certainly refers to this Wyoming entity **(unverified who the natural person behind it is)**. |
| **Killioz (killiozz)** | Developer of predecessor *Steal a Character* | Sold the "Steal a" concept rights to Sammy in May 2025; wiki says he "was compensated very well." |
| **Steak, Caylus** | Co-hosts of Admin Abuse events | Steak is a staff/host; Caylus is a YouTuber who guest-hosts. |

**Team size:** No verified headcount. Wikis say the game was "developed by SpyderSammy and a few others" with Do Big Studios' staff behind it. **(unverified)**

### 1.2 What it was cloned from

- **Steal a Character** — Roblox game by **Open Minded Games (OMG)**, created **April 21, 2025** (~3.5 weeks before SAB). Same loop: buy characters off a conveyor, they generate cash, steal from other players' bases. Rolimon's lists it as "[UPD4] Steal a Character," i.e., it received only a handful of updates.
- Sammy publicly said SAB "was itself inspired by Steal a Character," that he **acquired the rights** to the earlier game and improved on it (Bloomberg / Wikipedia).
- The wider template — 8-player servers, a passive-income "tycoon" base, weekly Saturday-afternoon updates with a live countdown, and developer-hosted "admin abuse" sessions — is the **Grow a Garden** (Jandel / Splitting Point, launched March 2025) playbook, which SAB adopted wholesale. (Analyst inference from the two games' shared cadence; GaG and SAB later staged a joint "admin war.")

### 1.3 Growth timeline (all dates 2025 unless noted)

| Date | Milestone |
|---|---|
| Apr 21 | *Steal a Character* created (OMG / Killioz). |
| May 16 | **Steal a Brainrot released.** |
| Late June | ~415K average active players (Wikitubia). |
| Jul 3 | >1.5M CCU. |
| Jul 13 | **5.2M CCU.** |
| Late July | ~7B visits after seven weeks; 10M+ favorites; 6.9B visits (X post); ~1M CCU at normal peak hours. Visit pace: 1B → 2B in 8 days; 5B three weeks after 1B. |
| Jul 28 | Massively OP / Polygon critical pieces ("designed to make kids miserable"). |
| Aug 1 | YouTuber Parlo and others accuse SAB of copying *Steal a Character*. |
| Aug 2 | 9B visits. |
| Aug (early) | Creator Exchange estimates **$11M monthly revenue (+117% MoM), 720M hours played** — "biggest overall mover." |
| Aug 23 | **"Admin War" crossover with Grow a Garden** (Sammy vs. Jandel). GaG hits 22.3M CCU; SAB passes **20M** (second Roblox game ever to do so); Roblox platform record **47.4M CCU** (prior record 32.69M, July 2025). |
| ~Sep 6 | Wins **Best Creative Direction** at the Roblox Innovation Awards 2025 (RDC 2025). Grow a Garden took Best New Experience. |
| Sep 13 | **"Extinct Event": 24,136,040 CCU** — new all-game record, beating GaG's 22,346,725 (RTC). |
| Sep 27 | Update 18: Yin Yang event; Yin Yang mutation (7.5x). A TikTok from this window cites a new peak of **24.9M**. |
| Oct 11 | Witch Fuse (Halloween) event launches 3:00 PM EST. Wikipedia-derived extracts give the all-time record as **25,836,222 on Oct 11, 2025** (some pages attribute it to the "Yin Yang" event; PocketGamer and others report **25.4M** for October). Both figures: first game ever past 25M. |
| Oct 25 | Update 22: Big Halloween Update. |
| Nov 30 | Update 27: Christmas (Santa's Fuse, Santa's Shop). |
| Nov 2025 → | First of "at least four" lawsuits against alleged imposters filed by Spyder Games / Speedy Simulator Gaming. |
| Dec | Update 29: Christmas Event Board. Visits ~52B (approx.). |
| Jan 2026 | **Deadline (exclusive): Story Kitchen developing a *Steal a Brainrot* movie** with Do Big Studios and Spyder Games; game cited at 55B+ visits. Beebom also claims a "Bruno Mars virtual concert" in-game pulled **12.8M CCU** in January 2026 **(unverified — could not confirm this event occurred inside SAB)**. |
| Feb 21, 2026 | Update 39: Trade Machine (global cross-server trading) + Divine mutation. |
| Mar 14, 2026 | Leprechaun Lucky Block (St Patrick's). |
| Mar 24, 2026 | Bloomberg: "Steal A Brainrot battles its many imitators"; est. **$64M** real-money IAP revenue since launch. |
| ~Apr 8, 2026 | 65.8B visits in first 327 days. |
| Apr 18, 2026 | Cyber mutation (11x) added. |
| Apr 2026 | Update 44: Easter Hour event. |
| May 2, 2026 | Viral hoax claims Sammy died in a traffic collision; debunked (Primetimer, FFBooyah). |
| May 2026 | 68B visits. |
| Jun 30, 2026 | Unilad Tech covers the "first-ever brainrot lawsuit" filings (Spyder Games LLC v. Mementum Lab). |
| Summer 2026 | "Well over 1,000,000 CCU daily." Update 53: Trading Plaza. |
| Aug 19–21, 2026 | NPR: "A battle over 'Italian brainrot' could shape who owns AI art." |
| Sep 5, 2026 | **365.8K CCU, #7 on Roblox.** |
| Sep 12–15, 2026 | Update 66: OG Craft Machine returns (bee theme). |
| Mid-Sep 2026 | ~73B visits, ~29M favorites; one codes site cites ~99K in-game "at any given moment" (likely an off-peak snapshot). |

**Status as of Sept 19, 2026:** Live, weekly updates, still top-10 on Roblox, but daily CCU has fallen from >1M (summer 2026) to the ~100K–400K range. Record CCU remains unbroken on any platform.

---

## 2. Core Loop, In Detail

### 2.1 Session structure
- **Server size: 8 players**, one base each (private-server cap is 8; public servers use the same 8-base map).
- On spawn you get a **base** (a small house with numbered brainrot pads), a starting cash balance, and the base is **auto-locked for 30 seconds**.
- Bases ring a central **conveyor / "red carpet"** down which brainrot characters walk. Each shows its name, rarity, price and income/sec. Walk into one and press to buy; it teleports to a free slot in your base.
- Every owned brainrot generates **cash per second**; you periodically **collect** it at the base. Cash buys more brainrots, gear, and rebirths.
- The whole game is **stealing**: any base whose lock timer is down can be entered; grab a brainrot and carry it back to your own pad.

### 2.2 The conveyor and rarity tiers
Eight rarity tiers (spawn odds fall off steeply):

| Tier | Purchase price | Income/sec | Notes |
|---|---|---|---|
| Common | $25 – $1.7K | $1 – $14/s | ~55% of conveyor spawns |
| Rare | $2K – $9.7K | $15 – $75/s | |
| Epic | $10K – $47.5K | $75 – $325/s | |
| Legendary | (mid-game) | ~$200 – $1,800/s | **Pity:** a Legendary is guaranteed roughly every 5 min |
| Mythic | $350K – $6M | $2K – $18.5K/s | **Pity:** Mythic roughly every 15 min |
| Brainrot God | $5M – $77M | $19K – $320K/s | |
| Secret | e.g., La Vacca Saturno Saturnita $80M; La Grande Combinacion ~$10M/s (fusion of Tralalero Tralala + Tung Tung Sahur + Graipuss Medussi) | up to tens of millions/s | Player-tested conveyor spawn rate **0.01–0.05%**; on max-luck servers roughly one Secret per 45–60 min, on normal servers hours or never. RBLXGUIDE lists **199 methods** of obtaining Secrets (events, machines, lucky blocks, codes). |
| OG | Strawberry Elephant **$750B, $750M/s**; Meowl **$600B, $600M/s** | | Astronomically rare on conveyor (quoted odds like 1e-17). Mostly from OG Craft Machine events. |

Other conveyor facts: a "Lucky Spawn" upgrade line (I–III) raises rare-spawn chance (one guide: 0.02% base → 0.5% at Lucky Spawn III for the relevant tier). **Server Luck** boosts (bought with Robux or granted in Admin Abuse: 15x, 35x seen) multiply rare spawn odds for the whole server.

### 2.3 Mutations (one per brainrot, multiplies income)
RBLXGUIDE counts **14 tiers** as of 2026. Multipliers per 2026 guides:

| Mutation | Multiplier | How |
|---|---|---|
| Gold | 1.25x | ~10% of spawns |
| Diamond | 1.5x | natural |
| Bloodrot | 2x (some sources 2.5x) | Halloween/event |
| Candy | 4x | event |
| Lava | 6x | natural/event |
| Galaxy | 7x | event |
| Yin Yang | 7.5x | Update 18, Sep 27, 2025 |
| Radioactive | 8.5x | event |
| Cursed | 9x | event |
| Rainbow | 10x | "best permanent mutation" |
| Divine | 10x | Feb 21, 2026 (comes with Halo trait) |
| Cyber | 11x | Apr 18, 2026 |
| Phantom | 12x | Admin Abuse / event-only |
| Crystal | ~13x | Admin Abuse / event-only (strongest as of mid-2026) |

### 2.4 Traits (stack on top of mutation; a brainrot can hold several)
**105 traits** as of July 2026 (RBLXGUIDE). Examples: Taco 3x (Taco Tuesday), Bombardiro 3x (Bombardiro Crocodilo ritual), Galactic 4x (hit by event projectiles), Crab 5x, Nyan Cat 6x, Bunny Ears (Easter Hour), Halo (Divine). The best traits reach 7–9x. Because traits stack multiplicatively with mutations, an end-game Secret with Crystal + several traits is where the income curve explodes.

### 2.5 Stealing, locks and defense
- **Lock timer:** 30 s auto-lock on join; after that you can press the base button to lock for **60 s**; each rebirth adds **+10 s** (80 s at rebirth 2, 110 s at 5, 240 s at 18, 250 s at 19). Third-party "base timer" sites exist just to track it.
- **Shield:** the base button generates a temporary shield; Robux and dev products sell longer/extra shields **(exact Robux shield SKUs unverified)**.
- **Thief penalties:** on grabbing a brainrot the thief is **slowed, stripped of all held gear, and the owner is alerted**; if anyone hits the thief, the brainrot **teleports back** to its base.
- **Floors:** Floor 1 = 10 slots. **Rebirth 2** unlocks Floor 2 (+8 or +10 slots; sources differ) via an outside staircase. **Rebirth 10** adds a third floor via an inside ladder. Higher floors are harder to steal from, so players keep their best units up top. Total slots rose to **28** with Update 66 (Sept 2026).
- **Gear shop (in-game cash; some items gated by rebirth):** Slap $500 · Speed Coil $750 · Trap $1,000 · Coil Combo $20,000 · Grapple Hook $75,000 · Body Swap Potion $50,000,000. Robux gear: Blackhole Slap, Flying Carpet, Laser Gun, Ban Hammer (see §3). Bloomberg describes "swords and invisibility cloaks" as typical IAP. **Grief Shield** (Rebirth 19 reward / Update 66 gear) absorbs one hit from a third-party griefer.
- **Classic exploit-y strategies** guides recommend: drop a Trap behind a target base, use a Body Swap Potion as their timer expires, grapple in and out.

### 2.6 Rebirths
19 rebirth levels (as of mid-2026). Each wipes cash/brainrots, and grants a permanent cash multiplier, +10 s lock time, an extra base slot, and gear/floor unlocks.

| Rebirth | Requirement | Notable reward |
|---|---|---|
| 1 | $500K + Trippi Troppi + Gangster Footera | |
| 2 | — | Floor 2 |
| 10 | $125B + Giraffa Celestre | Floor 3 |
| 19 | 30 Qa (quadrillion) cash + La Grande Combinacion (Secret, ~$10M/s) | 250T cash back, 19x cash multiplier, +10 s lock, extra slot, Grief Shield |

(Full 19-row table exists on the Fandom "Rebirth" page and Sportskeeda's per-level guides; not fetchable here.)

### 2.7 Machines and event fixtures
- **Craft Machine** — fuse specific brainrots into higher ones (e.g., La Grande Combinacion). Periodically replaced by themed variants: **Witch Fuse** cauldron (Oct 11, 2025), **Santa's Fuse + Santa's Shop** (Nov 30, 2025), **OG Craft Machine** (returned Sept 12–15, 2026).
- **Trade Machine** (Feb 21, 2026, Update 39) — player-to-player trades, including **cross-server**; **Trading Plaza** added in Update 53 (mid-2026).
- **RNG Machine**, **Admin Machine** (e.g., "Bee Admin Machine," Update 66) — gacha-style spawners.
- **Event Boards** (Christmas Event Board Update 29; Easter Event Board with Egg Hunt / Egg City) cycle mini-events on a timer.
- **Lucky Blocks** — single-pull loot boxes bought with cash *or* Robux (see §3).

### 2.8 Admin Abuse (the retention engine)
- **Twice weekly:** **Saturday Update at 3:00 PM ET** and **"Taco Tuesday" at 6:00 PM ET.** Hosted by Sammy, Steak, or guests like Caylus. Sessions run **30–45 minutes**.
- The host uses admin commands server-wide: **server luck to 15x–35x**, force-spawn event-only Secrets/OGs, spawn special "Sammy/Steak bases," give mutations/traits (Phantom, Crystal, Taco, etc.).
- **Taco Tuesday mechanic:** a giant taco cannon fires tacos across the map; any brainrot hit gains the Taco trait; feed **10 Taco-trait brainrots to "Fat Sammy"** for a shot at exclusive Taco brainrots.
- Servers have crashed under load during these sessions (Aug 2025 TikToks). Complaints of "35x luck scam" (no Secret spawned) circulate.

---

## 3. Monetization

### 3.1 Gamepasses (Robux; from the Fandom "Gamepasses and Dev Products" page and Rolimon's)
| Pass | Price (R$) | Effect |
|---|---|---|
| VIP | 499 (Rolimon's: 375) | VIP tag/perks |
| 2x Money | 299 | doubles income |
| Admin Panel / Admin Commands | 9,999 (Rolimon's: 7,999) | limited in-server admin commands |
| Flying Carpet | 375 | mobility gear |
| Laser Gun | 749 | offensive gear |
| Blackhole Slap | 199 | knockback gear |
| Ban Hammer | 1,499 | gear |
| Blackhole Starter Pack | 499 | Blackhole Slap + Coil Combo + $1,000 + Brr Brr Patapim |

### 3.2 Dev products (consumables)
| Product | Price |
|---|---|
| Server Luck 2x / 15 min | 249 R$ |
| Server Luck 4x / 30 min | 999 R$ |
| Server Luck 8x / 45 min | 2,999 R$ |
| Mythic Lucky Block | $2.5M cash or 175 R$ |
| Brainrot God Lucky Block | $15M cash or 599 R$ |
| Secret Lucky Block | $750M cash or 2,399 R$ (another source: 1,499 R$; price appears to have changed) |
| Admin Lucky Block | $100M cash (event) |
| Leprechaun Lucky Block (Mar 14, 2026) | 50 Gold Coins / $400M cash / 649 R$ |
| Bee Lucky Block, Spooky Lucky Block, etc. | seasonal |
| Cash bundles, extra shields, rebirth skips | exist per third-party shop listings **(exact Robux prices unverified)** |

Lucky Block odds are **not displayed in-game**; Robux purchase of Lucky Blocks is disabled in **Belgium and Austria** due to loot-box law.

### 3.3 Revenue and earnings estimates (all third-party; Roblox does not publish per-game revenue)
| Source (date) | Figure |
|---|---|
| Creator Exchange (early Aug 2025) | **~$11M est. monthly revenue** (+117% MoM), 720M hours played that month |
| Bloomberg (Mar 24, 2026) | **~$64M** real-money IAP earned since May 2025 release |
| profitable.app (Aug 2026) | $577.5M "lifetime" estimate from 72.4B visits **(unverified; almost certainly overstated — extrapolation)** |
| Another analytics site (2026) | ~$1.43M/month (82% "confidence") **(unverified; likely understated)** |
| YouTuber Obsesal | Sammy net worth ~**$30M** **(unverified)**; other outlets guess $2–5M/year for Sammy **(unverified)** |
| KreekCraft (bo3.gg) | SAB content earned KreekCraft personally **>$1M** |

Reconciliation: Bloomberg's $64M lifetime (~10 months) implies ~$6–7M/month average, broadly consistent with Creator Exchange's $11M in the peak month. Treat the $577.5M figure as unreliable.

**Roblox-level impact:** Roblox guided 2025 bookings growth of ≤21% before SAB and Grow a Garden launched; it finished 2025 up **55% at $6.8B bookings** and credited both games on earnings calls. 2026 guidance was 22–26%. A widely shared mid-2026 X thread (Aakash Gupta) argues Roblox shed ~$70B in market value as the post-brainrot cohort of games monetized worse **(analyst opinion, unverified)**.

### 3.4 Off-platform monetization
- **PhatMojo** officially licensed plush line (2026): 4-inch collectible blind-box plush with DLC code, 6.5-inch mystery bags (9 characters), a 12-inch "67" holiday edition; sold at Five Below, Amazon, TikTok Shop, and the official site **playsab.com**.
- **Film:** Story Kitchen (Dmitri M. Johnson et al.; first-look deals at Amazon MGM for TV and DreamWorks for animation) developing with Do Big Studios and Spyder Games (Deadline, Jan 2026).
- **Codes:** the game does run promo codes (e.g., Sept 2026 code spawns a one-time La Vacca Saturno Saturnita on the carpet).

---

## 4. Update Cadence & Live-Ops

- **Cadence:** effectively **weekly**. Update 18 landed Sept 27, 2025 and Update 66 on Sept 12, 2026 — 48 numbered updates in 50 weeks. Updates drop **Saturdays at 3:00 PM ET** (12:00 PM PT), paired with a Sammy-hosted Admin Abuse.
- **Second weekly beat:** Taco Tuesday Admin Abuse, 6:00 PM ET.
- **Countdown loop:** an in-game countdown to the next update/event, mirrored by dozens of third-party countdown/schedule sites and YouTuber "leak" videos; each update's event typically runs **Saturday → the following Wednesday** (e.g., Trade Machine event Feb 21 12:00 PM PT – Feb 25 9:00 AM PT, 2026), creating a FOMO window before the next Saturday.
- **Typical update contents:** 3–6 new brainrots (some via RNG machine, some on the carpet), a themed base/machine, a themed Lucky Block, 1–2 new mutations or traits, a new gear item, base-slot or rebirth cap increase, plus balance/anti-cheat fixes. Example — **Update 66 (Sept 12, 2026):** OG Craft Machine returns; 5 new brainrots (2 RNG machine, 3 carpet); Honey Bee Base; Bee Admin Machine; Bee Emperor Base; Bee Lucky Block; Bee Flying Gear; slot cap to 28; Grief Shield gear.
- **Seasonal events:** Yin Yang (Sept 27, 2025, U18) · Witch Fuse (Oct 11, 2025) · Big Halloween (Oct 25, 2025, U22) · Christmas (Nov 30, 2025, U27) · Christmas Event Board (U29) · Trade Machine + Divine (Feb 21, 2026, U39) · St Patrick's Leprechaun LB (Mar 14, 2026) · Easter (Egg Hunt / Egg City boards; Easter Hour, U44, April 2026) · Cyber (Apr 18, 2026) · Trading Plaza (U53, ~June 2026) · Bee/OG Craft (U66, Sept 2026).
- **Crossovers:** the **Aug 23, 2025 "Admin War" with Grow a Garden** (Jandel) is the marquee one and set the Roblox platform CCU record. Guest hosts (Caylus, KreekCraft) function as creator collabs. Beebom's claimed Bruno Mars concert (Jan 2026) **(unverified)**.

---

## 5. Controversies & Criticism

1. **"Copied Steal a Character" (Aug 1, 2025).** YouTuber Parlo and others posted videos alleging SAB stole the concept because Steal a Character shipped first. Sammy's position: he bought the rights and Killioz was well compensated. The wider point stands — SAB's own origin is a licensed clone, which colors its later anti-clone litigation.
2. **AI-art copyright — Spyder Games LLC v. Mementum Lab.** French firm **Mementum Lab** sent a letter demanding licensing negotiations for **Tung Tung Tung Sahur**; instead of paying, Spyder Games/Do Big sued for a declaration (Unilad, Jun 30, 2026; NPR, Aug 19, 2026). Core issue: the character originates from an AI-generated image, which the US and Indonesia treat as uncopyrightable, yet Mementum has asserted rights against Epic (Fortnite) and Roblox too. A **seven-day jury trial is scheduled for Nov 8, 2027.** NPR framed it as a test case for who owns AI art.
3. **SAB as plaintiff — at least four lawsuits against imitators since Nov 2025** (Bloomberg, Mar 24, 2026): e.g., **Bella Thomas / stealbrainrotio.io** (hosted 12 near-identical browser clones; served in person), and **Thomas van der Voort**, maker of a Fortnite Island Creator copy ("Stealing Brainrots"), covered by PC Gamer and TheGamer. IP-law newsletters (MBHB) flagged it as a notable UGC-vs-UGC case.
4. **Gambling-style mechanics.** Lucky Blocks are loot boxes with undisclosed odds, purchasable with Robux; Belgium/Austria purchases are disabled. Parent-oriented guides (Noobsi, "Casino mechanics") and Andy Hall's Substack ("The Algorithm Behind Steal a Brainrot") criticize variable-reward loops, server-luck timers and pay-to-defend pressure aimed at children.
5. **Design that distresses kids.** Polygon: SAB "has become the biggest game on Roblox by making kids miserable"; Massively OP (Jul 28, 2025): "designed to make kids absolutely miserable"; PC Gamer called it "sensory overload." Critique centers on loss-aversion (being robbed of hours of progress) and the shop nudging real-money spending on guns/gear to defend.
6. **Cheating, dupes and scams.** Widely distributed exploit scripts (auto-steal, insta-steal, teleport, fly, auto-lock), duplication-glitch videos, fake "trade scam scripts," and value-inflation trade scams after the Feb 2026 Trade Machine. Third-party RMT shops (Eldorado, U7Buy, RPGStash, itemku, eBay) sell brainrots and gamepasses, breaching Roblox ToS.
7. **Server instability during Admin Abuse** (Aug 2025) and "luck scam" complaints.
8. **Creator death hoax (May 2026)** — viral posts claimed Sammy died in a car crash; debunked.
9. **Roblox-level narrative:** SAB and Grow a Garden are cited on Roblox earnings calls as the drivers of the 2025 bookings beat; critics argue their success skewed Roblox's recommendation system toward low-monetizing "brainrot" games in 2026 **(opinion, unverified)**.

---

## 6. The Clone Wave

### 6.1 Direct "Steal a ___" clones (Roblox unless noted)

| Game | Creator | Created | Scale | Outcome |
|---|---|---|---|---|
| **Steal a Character** | Open Minded Games / Killioz | Apr 21, 2025 | Small; "[UPD4]" | The original; rights sold to Sammy; effectively superseded. |
| **Steal a Car** | Turbo Heist | May 29, 2025 | 101.9M visits; **peak 18.54K CCU** | Died. |
| **Steal a Meme** | InterLocked Productions | Jun 4, 2025 | 10.2M visits | Died. (Another "Steal a Meme🤑" exists.) |
| **Steal a Fish** | MY FISH FRIEND | Jun 13, 2025 | 434.6M visits; Sept 14, 2026: 193 players (#2,121), 48-h peak 575 | Died. Peak CCU **(unverified)**. |
| **Steal a Pet** | **BIG Games Pets** (the Pet Simulator studio) | June 2025 | 32.4M visits; **peak 13,110 CCU** | Died — even a top studio couldn't make the reskin stick. Other "Steal a Pet"s: God Bless Zak; a Bloxd.io mode (Aura_c, Sept 26, 2025) that "dropped drastically" after Tsunami Steal Brainrots. |
| **Steal a Labubu / 2 Player Steal a Labubu / Steal a Bubu** | Leaf Games Studios and others | mid-2025 | Codes articles ran Jul 2025 → Apr 2026, so it lived ~9+ months | Modest; peak CCU **(unverified)**. |
| **Steal a Bloxypet** | The bloxyMon Team | 2025 | small | Died. |
| **Steal An Egg** (also "Steal a Egg", "Steal A Lucky Egg", "Steal A Brainrot Egg") | **(unverified creator)** | **Jul 25, 2026** | **4.13B visits by mid-Sept 2026**; YouTube titles claim ~1M CCU | The 2026 breakout of the format — the only "Steal a" clone to reach GaG/SAB-class numbers. |

### 6.2 "___ for Brainrots" and genre-mashup clones
| Game | Creator | Launched | Peak | Outcome |
|---|---|---|---|---|
| **Plants vs Brainrots** | Yo Gurt Studio | Aug 2025 | ~500K weekdays, 1M+ on update days, ~856K sustained average; 1B+ visits. One outlet claims **8.65M peak** **(unverified/implausible; conflicts with other sources)** | Winner — married brainrot IP to tower defense. |
| **Escape Tsunami for Brainrots** | — | late 2025 | **1.25M CCU on Jan 14, 2026** (claimed 5th-highest Roblox peak ever — also inconsistent with the PvB claim above) | Winner. |
| Tsunami Steal Brainrots, Cut Grass for Brainrots, Survive LAVA for Brainrots, Grow a Beanstalk for Brainrots | various | 2025–26 | Named by Bloomberg as part of "hundreds" of clones | Mostly short-lived. |

### 6.3 Off-Roblox clones
- **Fortnite Creative "Steal the Brainrot"** — first UEFN map to pass **1,000,000 CCU (1,019,725)**, per PCGamesN (late 2025). Beebom credits SAB with giving UEFN "a second wind."
- **"Stealing Brainrots"** (Fortnite, Thomas van der Voort) — sued by Spyder Games.
- **Browser clones:** stealbrainrotio.io (12 variants; sued), Poki "Steal a Brainrot", CrazyGames "Steal Brainrot Online", Playgama, stealabrainrot2.io.
- **Bloxd.io** "Steal a Pet" mode.

### 6.4 Why the winners won
1. **First-mover with the meme at its peak.** SAB shipped in May 2025 when Italian brainrot was cresting; GaG had primed Roblox's audience for conveyor-tycoon loops. Pure noun-swaps (Fish, Car, Meme, Pet, Labubu) offered nothing new and died within weeks.
2. **Live-ops muscle.** Do Big's weekly Saturday update + twice-weekly Admin Abuse cadence, Sammy as an on-camera personality, and creator relationships (KreekCraft, Caylus, Jandel) are expensive to copy. Steal a Character got four updates; SAB got 66.
3. **Genre mutation beats reskin.** Plants vs Brainrots (tower defense), Escape Tsunami (obby/survival) and Steal An Egg (pet-hatch layer on the steal loop) changed the verb, not just the noun.
4. **Legal deterrence.** From Nov 2025 SAB sued the most visible copies, and Roblox/Epic moderation removed others, thinning the field.
5. **Economy depth.** Stacking mutations (up to ~13x) × 105 traits × 19 rebirths × trading gives SAB a long tail that shallow clones never built.

---

## 7. Open questions / could not verify
- Exact all-time peak (25.4M vs 25,836,222) and whether the record day was Oct 11, 2025 or a late-September Yin Yang session.
- Do Big Studios headcount on SAB; identity of "Speedy Simulator Gaming."
- Robux prices for shield extensions, rebirth skips and cash bundles.
- Full 19-row rebirth table; full trait table.
- Peak CCU for Steal a Fish, Steal a Labubu, Steal An Egg (and its creator).
- The January 2026 Bruno Mars 12.8M claim.
- Plants vs Brainrots' 8.65M peak claim.

---

## Sources

### Origin, creator, company
- https://stealabrainrot.fandom.com/wiki/SpyderSammy
- https://roblox.fandom.com/wiki/Player:SpyderSammy
- https://youtube.fandom.com/wiki/SpyderSammy
- https://youtube.fandom.com/wiki/Steal_a_Brainrot
- https://en.wikipedia.org/wiki/Steal_a_Brainrot
- https://stealabrainrot.fandom.com/wiki/Steal_a_Brainrot_(Game)
- https://roblox.fandom.com/wiki/BRAZILIAN_SPYDER/Steal_a_Brainrot
- https://roblox.fandom.com/wiki/Do_Big_Studios%E2%84%A2
- https://roblox.fandom.com/wiki/Player:Do_small
- https://www.eldorado.gg/blog/sammy-steal-a-brainrot-guide/
- https://www.u7buy.com/blog/sammy-steal-a-brainrot/
- https://x.com/killiozz
- https://gamefaqs.gamespot.com/roblox/540910-steal-a-character
- https://www.roblox.com/games/101354156600579/Steal-a-Character
- https://www.rolimons.com/game/101354156600579
- https://steal-a-character.fandom.com/wiki/Steal_a_character_Wiki
- https://www.thenexthint.com/who-is-spydersammy-age-career-and-controversies/
- https://newslayer.net/blog/sammy-steal-a-brainrot/
- https://www.primetimer.com/features/is-spyder-sammy-dead-viral-traffic-collision-death-claim-surrounding-creator-of-robloxs-steal-a-brainrot-debunked
- https://ffbooyah.com/2026/05/02/is-spyder-sammy-dead-the-steal-a-brainrot-creator-car-accident-hoax-fully-debunked/

### Records, growth, current stats
- https://x.com/Roblox_RTC/status/1966948186653863995
- https://www.pocketgamer.biz/robloxs-steal-a-brainrot-becomes-first-game-to-surpass-25m-concurrent-players/
- https://www.pocketgamer.biz/robloxs-peak-concurrent-user-count-hits-record-474m-as-steal-a-brainrot-and-grow-a-garden-compete/
- https://www.tubefilter.com/2025/08/25/roblox-grow-garden-steal-brainrot-admin-war-record/
- https://respawn.outlookindia.com/gaming/gaming-news/robloxs-steal-a-brainrot-breaks-all-time-player-record
- https://insider-gaming.com/roblox-mindblowing-player-count-record-steal-a-brainrot/
- https://www.rpgstash.com/blog/steal-a-brainrot-ccu-record-25-million-players
- https://www.lootbar.com/blog/en/steal-a-brainrot-roblox-top-charts.html
- https://x.com/jo5htheboss/status/1958604254245278105
- https://www.tiktok.com/@thebartblox/video/7554938511426719031
- https://beebom.com/robloxs-steal-a-brainrot-delivered-a-2025-masterclass-in-player-engagement-and-gave-uefn-a-second-wind/
- https://rowatcher.com/games/7709344486/steal-a-brainrot
- https://rowatcher.com/news/is-the-brainrot-trend-dying-what-ccu-data-from-three-top-games-reveals
- https://profitable.app/roblox/games/steal-a-brainrot
- https://www.rolimons.com/game/109983668079237
- https://romonitorstats.com/experience/109983668079237/monetization/
- https://rocodes.gg/codes/steal-a-brainrot
- https://www.gamesradar.com/games/simulation/roblox-steal-a-brainrot-codes/
- https://www.dexerto.com/roblox/steal-a-brainrot-codes-3388813/
- https://roblox.fandom.com/wiki/Timeline_of_Roblox_history/2025
- https://rolearn.dev/trend-reports/2025-annual-review/
- https://www.sportskeeda.com/roblox-news/when-steal-brainrot-come-out
- https://x.com/RoGameNews/status/1964513270129422481
- https://x.com/pgbiz/status/1965374345829847051
- https://variety.com/2025/awards/news/grow-a-garden-roblox-innovation-awards-2025-winners-1236510387/
- https://www.pocketgamer.biz/roblox-reveals-2025-innovation-awards-winners/

### Gameplay, economy, events
- https://stealabrainrot.fandom.com/wiki/Rarities
- https://stealabrainrot.fandom.com/wiki/Mutations
- https://stealabrainrot.fandom.com/wiki/Traits
- https://stealabrainrot.fandom.com/wiki/Rebirth
- https://stealabrainrot.fandom.com/wiki/Gears
- https://stealabrainrot.fandom.com/wiki/Lucky_Blocks
- https://stealabrainrot.fandom.com/wiki/Secret_Lucky_Block
- https://stealabrainrot.fandom.com/wiki/Admin_Abuse
- https://stealabrainrot.fandom.com/wiki/Strategies
- https://stealabrainrot.fandom.com/wiki/Yin-Yang_Event
- https://stealabrainrot.fandom.com/wiki/Halloween
- https://stealabrainrot.fandom.com/wiki/Christmas
- https://stealabrainrot.fandom.com/wiki/Trade_Machine
- https://stealabrainrot.fandom.com/wiki/Brainrot_Trader
- https://rblxguide.com/games/steal-a-brainrot/mutations
- https://rblxguide.com/games/steal-a-brainrot/updates/steal-a-brainrot-mutations-multipliers-2026
- https://rblxguide.com/games/steal-a-brainrot/updates/steal-a-brainrot-mutations-guide-may-2026
- https://rblxguide.com/games/steal-a-brainrot/traits
- https://rblxguide.com/games/steal-a-brainrot/gears
- https://rblxguide.com/games/steal-a-brainrot/updates/steal-a-brainrot-secret-brainrots-guide-2026
- https://rblxguide.com/games/steal-a-brainrot/update-tracker
- https://rblxguide.com/games/steal-a-brainrot/updates
- https://beebom.com/steal-a-brainrot-mutations-and-traits-list/
- https://beebom.com/steal-a-brainrot-rebirth-guide-levels-and-rewards/
- https://beebom.com/steal-a-brainrot-lucky-blocks-guide/
- https://gamerant.com/roblox-steal-a-brainrot-all-brainrots-list/
- https://gamerant.com/roblox-steal-a-brainrot-all-traits-multipliers/
- https://allthings.how/steal-a-brainrot-brainrots-rarities-and-prices-full-list/
- https://allthings.how/steal-a-brainrot-lucky-blocks-explained-costs-odds-and-best-drops/
- https://allthings.how/steal-a-brainrot-trading-plaza-and-update-53-trading-changes-explained/
- https://allthings.how/steal-a-brainrot-events-schedule/
- https://www.sportskeeda.com/roblox-news/steal-brainrot-rebirth-guide
- https://www.sportskeeda.com/roblox-news/steal-brainrot-rebirth-10-guide
- https://www.sportskeeda.com/roblox-news/steal-brainrot-rebirth-19-guide
- https://www.sportskeeda.com/roblox-news/how-get-second-floor-steal-brainrot
- https://www.sportskeeda.com/roblox-news/all-steal-brainrot-items-get
- https://www.sportskeeda.com/roblox-news/steal-brainrot-yin-yang-update-guide
- https://www.sportskeeda.com/roblox-news/all-lucky-blocks-steal-brainrot-cost-contents
- https://www.sportskeeda.com/roblox-news/news-steal-brainrot-trade-machine-update-patch-notes
- https://www.sportskeeda.com/roblox-news/when-is-the-next-steal-a-brainrot-update
- https://www.eldorado.gg/blog/all-brainrots-in-steal-a-brainrot/
- https://www.eldorado.gg/blog/steal-a-brainrot-admin-abuse-schedule-explained/
- https://www.eldorado.gg/blog/steal-a-brainrot-rebirth-guide/
- https://www.eldorado.gg/blog/steal-a-brainrot-en/steal-a-brainrot-lucky-blocks/
- https://www.eldorado.gg/blog/steal-a-brainrot-en/steal-a-brainrot-update-log/
- https://www.eldorado.gg/blog/steal-a-brainrot-traits-guide/
- https://www.eldorado.gg/blog/steal-a-brainrot-rarest-brainrots-guide/
- https://www.u7buy.com/blog/steal-a-brainrot-next-admin-abuse/
- https://www.u7buy.com/blog/steal-a-brainrot-rebirth-19/
- https://www.u7buy.com/blog/steal-a-brainrot-update-log/
- https://www.u7buy.com/blog/steal-a-brainrot-new-trade-machine-and-divine-mutation-update/
- https://www.u7buy.com/blog/steal-a-brainrot-server-guide/
- https://www.u4gm.com/steal-a-brainrot/blog-steal-a-brainrot-full-rebirths-list-in-order
- https://www.u4gm.com/steal-a-brainrot/blog-what-are-the-chances-of-a-secret-spawning-in-steal-a-brainrot
- https://mitchcactus.co/blog/steal-a-brainrot/steal-a-brainrot-secret-spawn-chance/
- https://techwiser.com/steal-a-brainrot-lucky-blocks-guide/
- https://techwiser.com/steal-a-brainrot-trade-machine-update-release-countdown/
- https://fandomwire.com/roblox-steal-a-brainrot-yin-yang-update-countdown-new-brainrots-mutations-rituals/
- https://games.gg/steal-a-brainrot/guides/steal-a-brainrot-easter-event-guide/
- https://bloxguidesgg.com/blog/steal-a-brainrot-update-66-craft-machine-return-preview-september-12-2026
- https://bloxultra.com/updates/steal-a-brainrot
- https://steal-a-brainrot.wiki/Updates
- https://www.brainrot.expert/timer
- https://progameguides.com/roblox/steal-a-brainrot-private-server-links/
- https://en.namu.wiki/w/Steal%20a%20Brainrot/%EB%8F%84%EA%B5%AC
- https://playxarena.com/steal-a-brainrot-roblox/

### Monetization & business
- https://stealabrainrot.fandom.com/wiki/Gamepasses_and_Dev_Products
- https://stealabrainrot.fandom.com/wiki/Robux_Shop
- https://x.com/CreatorExc/status/1952868682096574520
- https://www.bloomberg.com/news/articles/2026-03-24/roblox-s-hit-game-steal-a-brainrot-battles-its-many-imitators
- https://www.thestar.com.my/tech/tech-news/2026/03/25/robloxs-hit-game-steal-a-brainrot-battles-its-many-imitators
- https://nz.finance.yahoo.com/news/roblox-hit-game-steal-brainrot-133000309.html
- https://bo3.gg/games/news/kreekcraft-says-steal-a-brainrot-has-earned-him-over-1-million
- https://www.pocketgamer.biz/roblox-revenue-up-36-yy-as-grow-a-garden-and-steal-a-brainrot-drive-multiple-milestones/
- https://www.tradingview.com/news/reuters.com,2025:newsml_L4N3WB1BG:0-roblox-lifts-annual-bookings-forecast-as-viral-games-draw-strong-spending/
- https://s27.q4cdn.com/984876518/files/doc_financials/2025/q4/Roblox-Q4-and-Full-Year-2025-Financial-Results_Transcript.pdf
- https://x.com/aakashgupta/status/2085215538930966607
- https://www.runcheyresearch.com/blog/rblx-deferred-revenue-creator-moat-deep-dive
- https://deadline.com/2026/01/steal-a-brainrot-movie-story-kitchen-in-works-1236702374/
- https://www.gamespot.com/articles/steal-a-brainrot-the-incredibly-popular-roblox-game-gets-a-movie-deal/1100-6537778/
- https://www.dexerto.com/roblox/robloxs-steal-a-brainrot-is-being-adapted-into-a-movie-3311810/
- https://playsab.com/
- https://stealabrainrot.fandom.com/wiki/Brainrot_Plushies
- https://www.fivebelow.com/products/steal-a-brainrot-collectible-plush--styles-may-vary--9248235
- https://www.ebay.com/itm/287406427330

### Controversy & criticism
- https://www.npr.org/2026/08/19/nx-s1-5867638/artificial-intelligence-brainrot-memes-copyright-spyder-tung-tung-sahur
- https://www.uniladtech.com/news/ai/steal-a-brainrot-lawsuit-ai-generated-roblox-242885-20260630
- https://www.thegamer.com/roblox-steal-a-brainrot-fortnite-stealing-brainrots-lawsuit/
- https://www.pcgamer.com/games/a-brainrot-themed-roblox-game-is-taking-a-brainrot-themed-fortnite-game-to-court-for-being-a-copy/
- https://www.law.com/radar/card/pm-60749659-spyder-games-llc-v-van-der-voort
- https://www.mbhb.com/intelligence/snippets/gaming-industry-ip-news-james-bond-parody-faces-trademark-challenges-steal-a-brainrot-developers-battle-ip-theft-uspto-makes-a-move-in-the-nintendo-reexamination-and-more/
- https://www.yardbarker.com/video_games/articles/steal_a_brainrot_team_seeks_justice_as_digital_doppelganger_drama_unfolds/s1_17458_42956673
- https://www.pcgamer.com/games/sim/one-of-robloxs-biggest-experiences-right-now-is-a-bizarre-italian-brainrot-character-stealing-simulator-and-lord-help-me-i-now-understand-why-its-so-popular/
- https://massivelyop.com/2025/07/28/robloxs-latest-fad-minigame-is-designed-to-make-kids-absolutely-miserable/
- https://gamerant.com/roblox-what-is-steal-a-brainrot-explained-gameplay-player-count-scripts/
- https://www.noobsi.com/blog/steal-a-brainrot-casino-mecaniques/
- https://freesystems.substack.com/p/the-algorithm-behind-steal-a-brainrot
- https://bo3.gg/games/articles/roblox-steal-a-brainrot-scripts
- https://theu7buy.com/steal-a-brainrot-trading-values/
- https://www.youtube.com/watch?v=sRXiZOxd3fs
- https://www.youtube.com/watch?v=C3JOQtTzRlw
- https://newqualitipedia.telepedia.net/wiki/Steal_a_Brainrot

### Clones
- https://www.pcgamesn.com/fortnite/creative-steal-the-brainrot-roblox-clone-1-million-players
- https://www.rolimons.com/game/72212564918217 (Steal A Fish)
- https://www.roblox.com/games/72212564918217/Steal-A-Fish
- https://www.rolimons.com/game/95702387256198 (Steal a Car)
- https://romonitorstats.com/experience/95702387256198/
- https://www.rolimons.com/game/80206182059529 (Steal a Meme)
- https://www.rolimons.com/game/113909146512320
- https://www.rolimons.com/game/107778070777162 (Steal An Egg)
- https://www.roblox.com/games/107778070777162/Steal-An-Egg
- https://www.roblox.com/games/108053424714724/Steal-a-Egg
- https://www.rolimons.com/game/123698673940079 (Steal A Lucky Egg)
- https://www.rolimons.com/game/126016859830524 (Steal A Brainrot Egg)
- https://www.youtube.com/watch?v=zHySJpHe8Fs
- https://roblox.fandom.com/wiki/BIG_Games_Pets/Steal_a_Pet
- https://www.rolimons.com/game/106848621211283 (Steal a Pet)
- https://www.rolimons.com/game/74866348003583
- https://bloxd-io.fandom.com/wiki/Steal_a_Pet
- https://www.roblox.com/games/101900018730822/2-Player-Steal-a-Labubu
- https://creatorexchange.io/roblox-game/8320993676/2-player-steal-a-labubu
- https://romonitorstats.com/experience/132841984831376/
- https://romonitorstats.com/experience/119823419558973/
- https://www.rolimons.com/game/119823419558973 (Steal a Bubu)
- https://beebom.com/steal-a-labubu-codes/
- https://progameguides.com/roblox/steal-a-labubu-codes/
- https://creatorexchange.io/roblox-game/8615803520/steal-a-bloxypet
- https://roblox.fandom.com/wiki/Yo_Gurt_Studio/Plants_Vs_Brainrots
- https://www.roblox.com/games/127742093697776/Plants-Vs-Brainrots
- https://www.sportskeeda.com/roblox-news/who-made-plants-vs-brainrots
- https://gam3s.gg/news/plants-vs-brainrots-roblox-viral-hit/
- https://www.maxpowergaming.co/post/roblox-s-latest-breakout-game-is-plants-vs-brainrots
- https://www.maxpowergaming.co/post/escape-tsunami-for-brainrots-roblox-s-next-brainrot-juggernaut
- https://earnaldo.com/blog/plants-vs-brainrots-vs-escape-tsunami-for-brainrots
- https://www.u7buy.com/blog/top-roblox-brainrot-games-to-try/
- https://poki.com/en/g/steal-a-brainrot
- https://www.crazygames.com/game/steal-brainrot-online
- https://playgama.com/game/steal-a-brainrot-the-original-version
- https://stealabrainrot2.io/
- https://en.wikipedia.org/wiki/Grow_a_Garden
- https://en.wikipedia.org/wiki/List_of_Roblox_games
