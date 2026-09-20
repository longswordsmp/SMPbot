# The Case Against SKYTREE
### The Skeptic's brief to the council

---

## 1. The kill shot

**Skytree makes every player's payoff conditional on nineteen other people not churning, in a genre where roughly three quarters never return for a second day.** The incumbents are anonymous-server games, and that is load-bearing, not incidental: your experience in Grow a Garden does not degrade when the strangers who joined the same day quit, because matchmaking silently refills the world and churn stays invisible. Skytree deliberately removes that shock absorber. It binds you to a named persistent roster of 20, makes growth rate a function of how many are active, and gates the entire fourteen-day reward behind collective activity that will not exist. Take the corpus's own 25% D1 benchmark and any plausible decay: a Grove seeded with 20 has perhaps five actives by day 4 and one or two by day 14. The modal Grove does not occasionally miss a rare species — it fails structurally, every cycle, for almost every player, and the failure is rendered on screen as a stunted tree beside a roster of nineteen names that stopped logging in. Skytree does not merely suffer the platform's churn; it converts churn into a visible, personal, fortnight-long disappointment and shows it to the survivors.

---

## 2. Why players will not return

**Steelman.** The instinct is right. The ranker scores Day 8–28, most trend games have no answer, and a mechanic that *is* the retention system rather than a bolted-on league is elegant. I am attacking the implementation, not the instinct.

**The timer gives no reason to log in today.** The brief states the tree "grows in real time whether or not anyone is logged in." That is the design's own confession. Absence costs nothing perceptible; the tree will be there on day 8 regardless. A retention mechanic must create a consequence for not returning *now* — Grow a Garden's crops ripen in minutes, and GaG2 added a night-time theft window precisely so skipping a night has a countable cost. Skytree's only lever is rate, and rate at the margin of one player in twenty is invisible. This is not a timer that rewards return; it is a timer that runs without you, which is the definition of a mechanic you can safely ignore.

**Day 3 is the problem, not day 14.** The brief promises the tree is "enormous, visible from anywhere on the map" *and* that it gets "visibly, dramatically bigger." Both cannot be true early. If it is enormous on day 1, the day-2-to-3 delta is a few percent of an already-huge mesh — below what a seven-year-old notices at a glance. If it is small enough for growth to read, it is not the landmark the pitch sells. The day-3 player checks on the thing they were promised and correctly sees that nothing happened. That is the session you lose them, and the one session the design structurally cannot fix, because making day 3 dramatic means compressing the arc.

**The absence penalty is social, which makes it a quit trigger.** Growth is "faster when more Grove members are actively tending," so a missed day is not a cost you pay — it is a cost your friends pay. The mechanic converts lapse into social debt, and the cheapest way for a child to discharge social debt is to leave the group permanently. Obligation mechanics do not pull lapsed players back; they make lapse feel like a confrontation.

**Day 9 in a dead Grove is worse than a dead server.** An unfilled server is anonymous — you leave and rejoin. A Grove displays its churn as a roster: unambiguous social proof that the game is dying, delivered by the game itself to your most loyal player.

**Everything downstream is too slow.** Time-to-first-payoff is fourteen days, so every channel drops players at a random phase of a clock you do not control and onboarding cannot be tuned. Rebirth, which fires hourly in this genre, fires twice a month. The collection — "dozens of species," the long-term hook — ticks 26 times a year.

---

## 3. Why players will not pay

Take the genre's documented ladder and cross off what the design forbids.

- **Multipliers, 99–299 R$, "the core monetiser."** Here a 2x accelerates growth — a time-skip in a hat. Sell it and the design dies; refuse it and you delete the highest-volume rung.
- **VIP, 199–499 R$.** In Steal a Brainrot VIP "lengthens the base lock timer": monetisation welded to theft. No theft, no defensive product, nothing to protect.
- **Admin/god passes, 1,999–7,999 R$.** The whale rung, and it sells because power over other players is fun. You cannot sell a ban hammer into a world with no enemies.
- **Paid random items, 175–2,399 R$.** A mystery seed pack is buyable, but if seeds influence species and species is the payoff, paying for randomness *is* paying to determine the outcome — a time-skip laundered through a slot machine, sitting on the mechanic the research flags as the likeliest next ban.
- **Season pass, 749 R$.** Roblox's ~1-month season guidance fits the cycle. This rung works, and it is the only one that does.

What remains is cosmetics and convenience. **Cosmetics decorate an object the buyer does not own** — the tree belongs to the Grove, creating a public-good problem inside the monetisation layer (why buy when a Grove-mate might, and why buy when nineteen people can overrule your taste) plus a griefing surface. Convenience is 99–199 R$ with nothing above it.

That is the damage. The corpus anchors ARPPU at $10.36 per paying day and warns that "high ARPPU and low ARPDAU suggest revenue comes from a limited user subset." The money here is a thin whale tier buying 2,000–7,500 R$ items. Skytree's ladder tops out near 749 R$ — under $2 net at the standard DevEx rate. Removing the top rung does not shave a proportional slice; it removes most of the revenue. And Grow a Garden itself made only ~$0.015–0.02 gross per DAU-day, below the platform's $0.15 ABPDAU: these hits win on volume, not spend. Skytree surrenders the ARPPU *and* has no path to the volume.

---

## 4. The missing drama problem

**Steelman: Animal Hospital is a strong counter-example** — co-op, no PvP, >700K concurrent, swept RDC 2026 while no "Steal a" or "Grow a" title won anything. Co-operation can win.

But look at *why*. Animal Hospital is anomaly horror: it manufactures **incident**. Something is wrong with the patient, right now, and you must notice. Its co-op is a delivery mechanism for threat. Skytree's analogue is "blight, beetles and parasites," and the fork is unresolved: if blight cannot damage the tree there are no stakes and the pest is a chore; if blight *can* destroy fourteen days of collective work you have reintroduced loss in its most rage-inducing form — catastrophic, collective, caused by somebody else's absence. There is no comfortable middle. Custodianship without jeopardy is gardening, and gardening does not trend.

**The clip problem is worse than the drama problem.** The cold start for every recent mega-hit was YouTube, and "the meme theme makes the screenshots travel." Steal a Brainrot generates a fresh clip every thirty seconds, per player, forever — infinite supply for the creators who are your only viable distribution. Skytree generates one clippable moment per Grove per fortnight, and it is a mesh swap. No creator can build a series on it. Worse: **the payoff is spoilable by the exact channel that must market it.** Once a video shows you the Glass Tree, you have had the fourteen-day reward in nine seconds without playing. The marketing asset and the retention payoff are the same object, and consuming one destroys the other.

---

## 5. Weaknesses not in the brief's list

**5.1 The social bootstrap is gated behind age verification.** Skytree needs 20 coordinating players. Roblox rolled out age checks for chat globally in January 2026 and named it an engagement headwind itself — much of the under-13 core demographic **cannot chat**. A design premised entirely on group coordination has had its coordination layer removed for the players it targets. Either you auto-assign strangers, so "you and your friends" is false and the co-play may not register as intentional, or you require a nineteen-friend recruitment step at the top of the funnel.

**5.2 Free-riding at n=20 is the default, not the edge case.** Your marginal contribution is 1/20 and invisible; optimal play is to let others water the tree. The only fixes — contribution leaderboards, per-member stats — re-import exactly the competition the design disavows. There is no third option.

**5.3 Griefing does not require theft, and this surface is the worst I have seen.** If species is set by "what the Grove collectively fed it," one player feeding the wrong nutrient for fourteen days destroys nineteen people's fortnight. Low effort, high damage, no counterplay, and **invisible until day 14**, when it is unfixable. Add a prune tool and you have shipped a grief button. Every mitigation — roles, permissions, voting — adds UI and social conflict to a two-person team.

**5.4 Grove persistence and server persistence are technically contradictory.** Roblox's unit of shared space is the server. Either co-locate the Grove in one reserved server — mostly-empty 20-slot instances fighting fill logic, the empty-Grove problem made literal — or render the tree as a DataStore-synced abstraction, in which case **the co-play is cosmetic**: you are alone in a world with a large plant. The second option also voids the headline justification, because "intentional co-play" almost certainly measures simultaneous same-server play, not asynchronous Community membership. The marquee discovery argument and the marquee social fantasy may be mutually exclusive. Note too that `03-FIFTY-IDEAS.md` specified *eight players, one server, per-server tree*, rated **Cheap**. The brief silently escalated to 20 players, cross-server, persistent, with MessagingService sync, contended DataStore writes and orphan-state management — a large unbudgeted scope increase inside two people and eight weeks.

**5.5 The discovery catch-22 hits Skytree hardest.** Creators' April 2026 complaint was "can a brand-new game ever prove it has 28-day retention?" Skytree deliberately sacrifices D1 and D2–7 — nothing has happened, the tree is a sapling, the payoff is twelve days out — for a D8–28 bucket it cannot be scored on until after the launch window closes. It optimises for the metric it cannot yet report while failing the metric it is judged on immediately. Ordering failures are fatal at cold start regardless of eventual quality.

**5.6 Cross-pollination builds a permanent caste system.** Rare species need pollen from two Groves that "each grew something unusual." At launch nobody has anything unusual, so the rare tier is unreachable until someone breaks through — then compounds. A Grove founded in month three needs a partner with a rare tree; established Groves have every incentive to pollinate each other and none to carry beginners. Rich-get-richer with a hard ceiling on new entrants is exactly backwards when new-player inflow is your only growth, and it creates an obvious paid-pollen RMT surface.

**5.7 Moderation exposure is categorically higher than the incumbents'.** 182+ cases in a federal MDL since December 2025, six state AGs, ~$54M in settlements, and 2026 publishing rules gating under-16 reach behind ID verification, 2FA, a maturity questionnaire and an evaluation trial. Skytree's social unit is a persistent, private, named group of children cooperating over weeks — that structure, not the thirty-second anonymous server, is what child-safety litigation is actually about. The incumbents largely do not carry this risk. Skytree adopts it voluntarily with no moderation capacity.

**5.8 Nobody has said what happens when a Grove dies.** Tree keeps growing untended → the timer is decorative. Tree stops or dies → nineteen people's churn punishes the one loyal member. Merge dead Groves → the persistent-identity fantasy is a lie. Every branch is bad, and you accumulate hundreds of thousands of orphaned trees in storage.

**5.9 "No proven comparable" does not cut both ways.** Roblox is twenty years old with millions of experiences and, as of RDC 2026, an AI that generates a whole game from a prompt in ten to fifteen minutes. A multi-day shared-timer co-op is not exotic — it is the Farmville and clan-timer shape every developer has known for fifteen years. The prior for a well-known shape nobody ships is *tried and failed*, not *undiscovered*. And the corpus holds the natural experiment: Grow a Garden 2 took idle-grow and **added** stealing, night PvP and guilds, and the verdict on the original is one line — "the pure idle-grow version faded." The market already ran this A/B test. Skytree proposes re-running the losing arm with the remaining hostility removed.

**5.10 The economy has no throughput.** Fruit is "the currency and the collectible," faucet rate one harvest per Grove per fortnight. Trading economies are the genre's documented long tail — the thing keeping Steal a Brainrot alive in 2026. You cannot build one on a faucet that opens 26 times a year.

---

## 6. Competitive reality

The brief lists "content is nearly free" and "cheap to build" as strengths. They are liabilities. Fourteen clones of a *tweeted idea* shipped within 48 hours; dozens of *Find the Needle* clones took "tens of thousands of players and significant revenue"; AI-slop clones out-earn Steam originals, and the research notes they do it by "introducing monetization mechanics that the original games avoid." That sentence is Skytree's obituary. **The clone does not have to honour your design purity.** The first copy ships with a Robux time-skip, converts several times better, and out-earns you inside a week. You have chosen a design whose only differentiator is a self-imposed monetisation handicap a competitor removes in one line of code — the worst possible moat: expensive to hold, free to abandon.

Owned IP does not rescue it. Original IP is a legal shield, not a distribution asset, and distribution was the point. Italian brainrot was valuable because it was *pre-viral and free*; a Glass Tree is a mesh nobody has heard of. You traded the marketing engine for insurance against a risk you were not running.

And if it works, Splitting Point or Do Big ship it better in three weeks — admin-abuse schedules, seasonal events, trading, updates every one to two weeks. Your fourteen-day clock actively *prevents* that cadence: you cannot run an event that shortcuts the tree without breaking the core. They can bolt a Grove tree onto Grow a Garden 2 as a guild feature, keep the stealing, keep the time-skips, and ship it to 454,000 existing concurrent players.

---

## 7. What would change my mind

I am attacking the fourteen-day clock and the twenty-person cross-server Grove. I am **not** attacking co-op custodianship as a lane — Animal Hospital validates it and I would back that instinct. The specific evidence that retires each objection:

1. **A five-day instrumented prototype with auto-assigned Groves.** If median Grove active members at day 5 is ≥6 of 20 and D3 return is ≥30%, the compound-churn kill shot fails and I withdraw section 1. This costs days, not weeks, and should be built before anything else.
2. **The actual text of Roblox's June 15, 2026 discovery post**, which published the signal list with relative importance. If "intentional co-play" credits persistent Community-backed membership, 5.4's contradiction dissolves and the discovery case strengthens considerably. If it credits same-server co-presence, the design must go server-local and the Grove must shrink.
3. **One named shipped comparable**: any Roblox experience with a multi-day shared-timer co-op core that held >50K concurrent for >60 days. If it exists, my "absence is evidence" prior collapses. If the search turns up a graveyard instead, the matter is closed.
4. **A product above 1,500 R$ that sells neither time, nor power over others, nor randomness.** Name it and my revenue objection weakens badly. I have tried and cannot.
5. **Make the thirty-second maturation trailer before writing any code.** If a nine-year-old would not rewatch it, the game is undiscoverable and nothing else matters.
6. **Test the identical design at a seventy-two-hour cycle.** If the "watch it grow together" fantasy survives compression — and I suspect it does, because the fantasy is about *visible change*, which a short cycle serves better — roughly 80% of my objections shrink to manageable size: D1 and D2–7 become winnable, time-to-first-payoff drops from fourteen days to three, the collection ticks 120 times a year instead of 26, and a Grove of six survives the churn that kills a Grove of twenty. That is the redesign I would endorse. My objection is not to the idea. It is to the number fourteen and the number twenty.
