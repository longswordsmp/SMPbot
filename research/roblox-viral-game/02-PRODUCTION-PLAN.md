# The Production Plan
### How to build and launch it, with the platform as it stands in September 2026

---

## Team and budget

The reference cases are the benchmark. *Grow a Garden* was built in three or four days by one 16-year-old. *Steal a Brainrot* took one person about four months. Both then scaled to a studio. Roblox's own guidance and both cases point at a **two-to-six person core**: a scripter, a modeller/builder, and someone on UI, art and live-ops.

**Minimum viable team: two people.** One Luau scripter who owns the server, one artist who owns the Stompers and the tile. Live-ops can be one of those two for the first three months, but it has to be somebody's named job, because the Saturday slot is the product.

| Line | Cost |
|---|---|
| Two people, 8 weeks | Time, or $15–40/hr mid-level and $50–120/hr senior if contracted |
| Assets, plugins, AI credits | $200–1,000 |
| Launch ad test (Ads Manager) | $10–50/day, two weeks: **$150–700** |
| Two to five mid-tier YouTubers (200K–1M subs) | **$1,000–5,000 each** |
| Hosting, moderation, payments | **$0** — Roblox bears all of it |

Contractors in this market are usually retained on revenue share rather than hourly, because well-paid commissions are scarce and good people prefer the upside.

---

## Toolchain

**Use Rojo and Git from day one, not pure Studio.** Studio-only is faster for the prototype week, but this is a game you intend to operate weekly for months with at least two people, and you need pull-request review on economy maths, `git revert` on a bad balance table, and headless tests for the RNG and reset curves.

| Tool | Version as of 19 Sep 2026 | Role |
|---|---|---|
| **Rojo** | v7.7.0 | Filesystem ↔ Studio sync |
| **Wally** | v0.3.2 | Packages |
| **Rokit** | rolling | Toolchain manager (successor to Aftman/Foreman) |
| **StyLua** | v2.5.2 (16 May 2026) | Formatter |
| **Selene** | v0.31.0 (20 May 2026) | Linter |
| **luau-lsp** | v1.69.0 (18 Jul 2026) | Language server; respects the client/server boundary |
| **Zap** | 0.6.x | Buffer-serialised networking, if bandwidth becomes an issue |
| **ProfileStore** | current | Session-locked persistence |

`takoyakisoft/roblox-rojo-wally-template` wires Rokit, Rojo, Wally, Selene, StyLua, GitHub Actions and headless tests in one go.

**Do not start on Knit** — archived 31 July 2024.

**Write `--!strict` everywhere from the first file.** Luau's new type solver reached general release in December 2025; retrofitting strict typing onto a live economy later is far more expensive than paying for it now.

The hybrid most top teams use: code in Rojo, maps and UI and VFX built in Studio and committed as `.rbxm`, and a `Datas/` tree of pure ModuleScript tables for Stompers, rarities, mutations, resets and shop items — so a balance change is a reviewable one-line diff.

---

## Architecture

Appendix F contains a full reference architecture for this exact genre, extracted from a decompiled place in the *Steal a Brainrot* lineage. **Read it as architecture, not as code to copy** — it is someone else's copyrighted work, and parts of it are actively insecure.

The essentials:

**Persistence.** ProfileStore, keyed on user ID, with `Reconcile()` against the template, three load attempts, and a kick with an error code on total failure. Autosave every five minutes with jitter. Save on leave and on shutdown. A soft-shutdown service that reserves a server and teleports everyone rather than hard-kicking them. Session locking is what prevents the dupe-and-rollback spiral that eroded trust in *Grow a Garden*.

**Income.** Lazy accrual, never a tick loop. `cash = floor((now - lastCollect) * rate)` computed server-side on claim, with the client running the identical formula purely for display. Offline gain computed once on load from the persisted timestamp and capped by tier.

**The raid.** Server-validated carry. Validate in order: data ready, timestamp plausible, target is not your own crew, **distance check on** (the reference build has this commented out, which is why dozens of teleport cheats work against it), inside the warehouse bounds, slot occupied, crew not locked, carrier has capacity. Record grab time and position server-side and reject any delivery whose implied speed exceeds sprint speed by more than half. Test the delivery on the server with `WorldRoot:GetPartBoundsInBox`, never by trusting `.Touched`. Single-use action IDs. Token-bucket rate limiting, roughly ten calls per five seconds.

**Randomness.** Every roll server-side. Weighted spawn tables with per-rarity pity timers. Publish your odds — players will read `ReplicatedStorage` anyway, and paid random items are legally required to disclose exact percentages.

**Global events.** One `MessagingService:PublishAsync` per event, under 1 KB, carrying an event ID and an end timestamp, applied idempotently, with servers ignoring their own `JobId`. Late-starting servers catch up from MemoryStore rather than missing the broadcast. Quotas scale with server count: 40 + 80 × servers per topic per minute.

**Remote config.** Three layers. `ConfigService` for tunables and feature flags, propagating in about five minutes. A MemoryStore hash map polled every 30–60 seconds for instant event state. Time-gated content flags for next week's update, shipped inside this week's build and unlocked on server time. The trade-off is real: leakers read the roadmap out of the reference game's build. Accept it, or load reveal-week assets server-side.

**Anti-exploit.** Server validation everywhere, honeypot remotes where any traffic at all is a cheat signal, a suspicion score combining signals, and a consequence ladder that starts with silent logging and clamping rather than banning. Client-side anti-cheat reporting is routinely neutralised — public scripts specifically block outbound remotes named things like `CheatDetected`. Do not rely on it.

**Server size: 8 players, two crews of four.** This bounds instance count and memory, keeps raid density high, matches the genre's proven shape, and means a party of four fills exactly one side.

---

## Performance budget

About 72–80% of Roblox activity is mobile, roughly 60% of Android players have 2–4 GB of RAM, and over half of all players use devices scoring 10,000–20,000 on Passmark. Design to the low end from the start.

- Under **1,000 draw calls** and **1,000,000 triangles** on screen
- 16.67 ms per frame; split long work into ~5 ms chunks
- Textures at **512×512** or smaller, 256 for minor assets
- Transparency at 0 or 1 only, never partial
- Every Stomper is a **single low-poly MeshPart** with an `AnimationController`, **never a Humanoid** — humanoids are expensive and you may have dozens on screen
- Instance identical meshes by reusing asset IDs; use Packages to avoid duplicates
- Pool VFX; cap simultaneous street spawns
- One server heartbeat loop for all lock timers; no per-Stomper `while task.wait()` loops
- `StreamingEnabled` on, with each warehouse's essential parts marked `Persistent` and the owner's marked `PersistentPerPlayer`
- Watch `LuaHeap` and `InstanceCount` in the Developer Console; growing heap means a leak
- Landscape default, safe-area-aware UI, 44-pixel minimum touch targets, the Input Action System so every control works on touch, keyboard and gamepad

Test on a real cheap Android phone. Studio's emulator, in Roblox's own words, "can't fully replicate real hardware."

---

## The six-week build

**Week 1 — Foundations.** Rojo/Wally/Rokit repo with `--!strict` and CI. ProfileStore data layer with template, reconcile, kick-on-failure and soft shutdown. The map: two warehouses, one street. Street spawner with weights and pity. Economy tables in `Datas/`.

**Week 2 — The core loop.** Lazy income with client-side display prediction. Buy, place, collect. Raid: grab, carry, drop, deliver, all server-validated. The crew lock. Leaderstats. First 20 Stompers — 20 top meshes on one shared leg rig.

**Week 3 — Progression and money.** Clock Out table, 10 tiers. Four mutations. Gamepasses: Double Pay, Auto-Collect, Crew VIP. Lucky Shift dev products with disclosed odds. Codes. Offline accrual with tier caps. **Simulate the whole progression curve in a headless test before any of it ships.**

**Week 4 — Crews and mobile.** Crew persistence, crew levels, the Weekly League with its MemoryStore leaderboard. Party integration. Input Action System bindings, safe-area UI, StyleSheet theming, VFX pooling, streaming tuning, real-phone testing. Automatic translation on, Stomper names pinned identically across all 18 languages. Icon and thumbnails.

**Week 5 — Operations.** Analytics wired end to end: onboarding funnel (spawn → first buy → first raid → first defend → first Clock Out), economy sources and sinks, custom events for raids and locks and exploit flags. Config flags. Admin command framework and the global broadcast. Exploit heuristics and honeypots. Staging place with prefixed datastore names. **Rehearse a rollback before you need one.**

**Week 6 — Launch.** Closed test with 50 players. Fix whatever data or performance problems that surfaces. Publish. Ads Manager test over the weekend. First weekly update already time-gated in the build.

Trading lands in week 7 or 8, after launch stability is proven, and never before the escrow design in the game design document is fully implemented.

---

## Launch

**The cold start is YouTube, not ads.** This is the clearest finding in the growth research. *Dead Rails* went from hundreds of concurrent players to over 100,000 after Flamingo, KreekCraft, Thinknoodles and Sketch covered it. *Steal a Brainrot*'s first wave came from Infinite and Foltyn. Ads are for validating retention cheaply, not for buying a hit.

**The sequence:**

1. **Ship two or more thumbnails and turn on thumbnail personalization.** Roblox's own numbers: +8.5% average qualified play-through rate at launch, +12% across 8,000+ experiences, some as high as +50%. Icons still cannot be A/B tested natively, so rotate them manually and read the qualified play-through rate windows in Creator Hub. Be aware that prettier is not better — there is a documented DevForum case of click-through collapsing after a visual upgrade. **Clearer beats prettier.**
2. **Buy a small ad test, $10–50 a day.** The only purpose is to read Day 1 and qualified play-through rate. Costs run $0.10–0.50 per click, and cost-per-play varies by a factor of five to fifty depending purely on icon quality.
3. **Hold the gate.** Do not scale spend until Day 1 and Day 2–7 hold up. Under the current ranker, scaling a game that churns actively hurts you.
4. **Then approach two to five mid-tier YouTubers**, 200K to 1M subscribers, $1,000–5,000 each. Campaigns average $0.05–0.20 per new player. Give them a moment to title a video after: the cathedral-with-legs reveal, or a four-person crew defending a door.
5. **Lock the Saturday slot and never miss it.**
6. **Feed Moments** from the Experience page, which enters the feed as of late September 2026.

**Rewarded video** unlocks at 2,000 monthly unique visitors, with a 13+, ID-verified, 2FA-enabled publisher. Rewards must be developer products, never randomised items. *Grow a Garden*'s documented pattern is a HUD button granting progressive consumables.

---

## Gates

Decide these now, in cold blood, and write the numbers down before you have feelings about the project.

| Stage | Gate | If it fails |
|---|---|---|
| Closed test | Playtesters spontaneously help teammates without being told to | The core thesis is wrong. Stop and rethink before spending on launch |
| Week 1 live | Day 1 retention around 20%+ after icon iteration | Iterate the tile and the first sixty seconds. Do not buy traffic yet |
| Week 2 | Day 2–7 holding | Fix the mid-game before scaling. Traffic on a churning game costs reach under the 28-day ranker |
| Week 4 | Payer conversion 1.5%+ | The ladder is wrong, or the first purchase is not compelling. Genre range is 1–3% |
| Week 8 | Day 8–28 bucket non-trivial; crews forming and returning | The retention layer is not working. This is the whole 2026 bet |
| Month 3 | Revenue covers the live-ops commitment | Decide honestly whether to keep operating or archive it |

**Sizing the outcome.** The useful rule of thumb from the research: a well-monetized simulator nets roughly **$10,000–70,000 per month per 1,000 average concurrent players**. Daily actives run about 16–32× average concurrent. Sanity-check every projection against the fact that the **median DevEx participant earned about $1,550** in 2025.

---

## The mistakes that kill these games

Every one of these is documented in the research as having actually happened to a game in this genre.

| Failure | Cause | Prevention |
|---|---|---|
| **Data loss and rollbacks** | `SetAsync` races, no session lock, saving only on `PlayerRemoving`, datastore throttling | ProfileStore, `UpdateAsync`, jittered autosave, save on leave and shutdown, versioned backups |
| **Dupes** | Trading plus leave/rejoin mid-save; client-declared item IDs; granting before persistence | UUID items, escrow, double confirm, grant inside the session lock, return `PurchaseGranted` only after the profile is written |
| **Server crashes at scale** | Leaked connections, tables keyed by player never cleared, VFX never destroyed, unbounded spawns | Trove cleanup per player, capped spawns, watch `LuaHeap` and `InstanceCount` |
| **Economy blow-up** | Uncapped offline gains, multipliers stacking with events | Cap offline hours per tier, simulate the curve headlessly, log every source and sink |
| **Exploits** | Client-trusted delivery, no travel-time check, remotes without rate limits | Server bounds checks, suspicion score, honeypots, rate limits |
| **Trust collapse** | Mass rollbacks after a dupe wave, silent progression resets | Communicate in-game, compensate with codes, roll back surgically using datastore versions |
| **Mobile churn** | Desktop-shaped UI, too many draw calls, no touch bindings | The performance budget above, tested on a real 2–4 GB Android phone |

The pattern across all of them: **what kills these games is broken trust and broken data, not a shortage of features.**

---

## Open technical questions

Blocked by the sandbox network policy. Resolve before week 1.

1. **Server Authority** (`Workspace.AuthorityMode = Server`) shipped in 2026 with client prediction and rollback, but the network-ownership documentation still calls it beta and there is a DevForum report of "major issues" after enabling it. Decide whether the raid mechanic uses it or a conventional server-validated model. **Default to conventional for launch.**
2. **Datastore limits changed on 29 July 2026** — baseline storage reportedly rose to 500 MB plus 1 MB per lifetime player, and in-game and Open Cloud budgets merged. Confirm the current numbers.
3. **Paid random item rules** — whether luck multipliers count as paid random items, and the exact disclosure format.
4. **Rewarded video EPM rates** — no published rate found.
5. **AI mesh generation licensing** — Meshy's free tier is CC BY 4.0 requiring attribution; Tripo's free tier is non-commercial. Verify current terms before shipping any generated asset commercially. Roblox's own Cube generation is fine but produces props rather than crisp stylised characters.

---

## The honest summary

You can build this. Two people, eight weeks, under a thousand dollars in assets, and a few thousand more if you want YouTube coverage at launch. The technical risk is low and thoroughly documented. The design is a real, defensible idea rather than a reskin.

The market risk is the real one, and it is not small. Roblox is contracting for the first time in its history, it is contracting hardest in exactly this genre, and the platform is doing it deliberately. The upside case depends on a bet that co-play-native design is what the new algorithm rewards — which follows from what Roblox has published, but has not yet been proven by a hit in this genre.

That is a bet worth making with eight weeks and a thousand dollars. It is not a bet to make with your savings on the assumption that 2025 repeats.
