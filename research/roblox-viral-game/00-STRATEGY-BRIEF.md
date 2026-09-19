# The Strategy Brief
### Making a formula-genre Roblox hit, written for the market as it exists on 19 September 2026

---

## How to read this document

Six research agents spent a combined ~8 hours on this. Their full findings are in `appendices/A` through `appendices/F` — roughly 2,800 lines and ~900 source URLs. This brief is the synthesis and the recommendation.

**A hard caveat on sourcing, stated up front.** The research ran inside a sandbox whose network policy blocked `roblox.com`, `create.roblox.com`, `devforum.roblox.com`, the Roblox fan wikis, and every concurrent-player tracker (RoMonitor, Rolimons, RoVitals). Two of the six agents also exhausted the web-search quota mid-task. So most figures below come from search-engine result snippets rather than the primary page, and a handful come from the one class of primary source that *was* reachable: Roblox's own creator documentation mirrored on GitHub. Every claim in the appendices is tagged for provenance, and anything single-sourced is marked unverified. **Before any of this drives a spending decision, re-verify the numbers from an unblocked network.** A verification checklist is at the end of this document.

---

## 1. The finding that should change your plan

You asked for a game like *Steal a Brainrot* — and that instinct was right about the mechanics and is now wrong about the market. The single most important fact the research turned up is this:

> **Roblox spent 2026 deliberately dismantling the conditions that made *Steal a Brainrot* possible, and said so out loud, and took a revenue hit to do it.**

The evidence, in sequence:

| Date | What happened | Why it matters to you |
|---|---|---|
| Apr 2026 | Creators notice Home-page impressions shifting; argue about whether it's a bug | It was not a bug |
| **15 Jun 2026** | Chief Growth Officer John Ciancutti publishes "Optimizing Discovery". Recommended For You moves from a **7-day** to a **28-day** retention window, scored in three buckets: Day 1, Day 2–7, **Day 8–28**. Stated goal: surface games players "enjoy long term" over ones "that win a quick click but don't offer deeper substance" | The spike-and-churn launch is now structurally throttled. A game that peaks in week one and empties in week three loses reach *because* it emptied |
| **29/30 May 2026** | Cross-experience Pass and Dev Product sales disabled | Killed an entire monetization pattern overnight |
| **8 Jun 2026** | US 18+ DevEx rate raised 42% to $0.54 per 100 Robux for age-checked adult spend in R15-compliant games | Roblox is paying you more to build for adults than for children |
| **30 Jul 2026** | Q2 earnings: DAU **123M**, down from 132M in Q1. Bookings growth collapses from **+43% to +8%**. Q3 guided to **−14% to −18% YoY** — the first decline ever. Full-year guidance **withdrawn**. Management blames, in its own words, "a greater-than-expected shift in engagement away from high-monetizing viral games and the impact of discovery algorithm changes" | The platform is shrinking, and the shrinkage is concentrated in exactly your target genre |
| **Late Aug 2026** | New policy bars experiences from the "Roblox Kids and Select" tiers if they combine a media feed, autoplay/infinite scroll, and watch-to-earn rewards. *Steal An Egg* was pulled and re-uploaded without its clip-feed feature | First explicit mechanic ban aimed at this sub-genre. Written within about nine days of the mechanic going viral |
| **19 Aug 2026** | NPR reports Do Big Studios is trying to invalidate copyright in Tung Tung Tung Sahur; rights-holder Mementum countersues for trademark infringement. Jury trial set for Nov 2027 | The free-meme era is ending. Borrowed brainrot IP is now a live legal liability |
| **10–12 Sep 2026** | RDC 2026. Innovation Awards swept by *Animal Hospital*, a co-op veterinary-anomaly-horror game. **No "Steal a", "Grow a", or brainrot title among the reported winners** | Where the platform's own prestige signal is pointing |

Naavik's H1 2026 analysis puts it bluntly: Roblox "is deliberately sending fewer players toward the experiences that monetized hardest."

**What this does not mean.** It does not mean the genre is dead or that you should build something else. The loop — instant comprehension, a base you own, income that accrues, a rival who can take it — is not what's being punished. *Shallowness past day seven* is what's being punished. The mechanics are fine. The 2025 **launch strategy** is what's broken.

**What it does mean.** A straight clone — pick an untaken noun, ship in a week, buy a YouTuber, ride the spike — was a good bet in mid-2025 and is a bad bet now. You would be entering a shrinking market, against studios with 40-person live-ops teams, with a mechanic the ranker demotes, on borrowed IP that is being litigated, at a moment when fourteen clones of any viral idea appear within forty-eight hours.

---

## 2. What actually made the two reference games work

Strip the memes away and the machine underneath is consistent.

**Steal a Brainrot** (SpyderSammy / Sam Brakta, 24, Chief Product Officer of Do Big Studios; launched 16 May 2025). Not an original concept: it is a licensed rebuild of *Steal a Character* by Killioz, whose "Steal a" rights Sammy **bought** rather than copied. Growth: 1.5M concurrent on 3 Jul 2025 → 5.2M on 13 Jul → over 20M on 23 Aug → **25,836,222 on 11 Oct 2025**, the first game on any platform past 25 million concurrent players. Roughly 73 billion lifetime visits. By 5 Sep 2026 it was down to ~366K concurrent and #7 on the platform, still shipping weekly (Update 66 landed 12 Sep 2026).

**Grow a Garden** (built in three or four days by an anonymous 16-year-old, "BMWLux"; launched 26 Mar 2025). Splitting Point Studios bought 50% in April 2025 when it sat at about 1,000 concurrent players; Do Big took a minority stake in May. Peak **22.3M concurrent on 23 Aug 2025**. Fastest Roblox game to a billion visits: 33 days. By September 2026: ~63K concurrent, rank #11.

Seven things they share:

1. **Comprehension in under thirty seconds.** The title states the mechanic. You understand the game before you finish reading the tile.
2. **A base you own and passive income you watch accumulate.** The number goes up while you stand there. This is the entire hook.
3. **A social trigger that creates stakes.** Theft in one, trading and weather envy in the other. Something another human does that you feel.
4. **Collection depth disguised as simplicity.** 142 characters across 8 rarity tiers, 14 mutation types, 105 stackable traits in *Steal a Brainrot*. The surface is a conveyor belt; the spreadsheet underneath is enormous.
5. **Content that costs almost nothing per unit.** A mutation is a texture swap. One model, fourteen looks. Roblox's own documentation recommends exactly this: "simple variants on existing assets, like slight colour changes, are ideal."
6. **A fixed weekly ritual.** Saturday update plus a developer-hosted "admin abuse" livestream where staff spawn rare items across every server at once. Third-party websites exist purely to track the schedule.
7. **Manufactured narrative.** The 23 Aug 2025 "Admin Abuse War" between the two games' owners — with KreekCraft, MrBeast and PokeDaily taking sides — drove Roblox to a platform record of **47.4M concurrent**. Both games are Do Big-connected. The rivalry was, in the commercial sense, a joint marketing campaign.

Point 7 deserves emphasis because it is the one most people miss. These are not games that got lucky. They are operated.

---

## 3. What the money actually looks like

Do not plan against the headline numbers. Plan against the pipeline.

**The pipeline.** A player pays about $9.99 for 1,000 Robux on the web, less per Robux on mobile. You keep 70% of Robux spent in your experience. You convert Earned Robux to cash through DevEx at **$0.0038 per Robux** (raised 8.5% on 5 Sep 2025), or **$0.0054** for spend by age-verified US adults in R15-compliant games (since 8 Jun 2026). Net: you receive roughly **21 to 27 cents of every consumer dollar** — about 38 cents on qualifying US adult spend. Minimum cash-out is 30,000 Robux (~$114), once per calendar month.

**Benchmarks worth internalising.** Platform-wide, about **1.4% of daily users pay on a given day**. Bookings per daily active user run about **$0.15**. Community rule of thumb for simulators is **1–3% payer conversion** (2–3% at the better end for this genre) and **2–6 gross Robux per visit**. Daily actives run roughly **16–32× average concurrent** in this genre. A well-monetized simulator nets on the order of **$10,000–70,000 per month per 1,000 average concurrent players** — the single most useful number in this document for sizing an outcome.

**The tail is brutal.** Roblox paid creators over **$1.5 billion in 2025**. The top 1,000 creators averaged $1.3M; the top ten averaged $33.9M. The **median DevEx participant earned about $1,550**. Some 23,500 creators cashed out at all. This is a power law with a very long, very flat tail.

**Reference revenue.** *Grow a Garden* reportedly made about **$12M in May 2025** alone (Bloomberg). *Steal a Brainrot* was estimated at **$11M/month** in mid-2025; Bloomberg put lifetime real-money in-app purchases at about **$64M** as of March 2026. Third-party models claiming $286M and $577M lifetime are formula estimates, not disclosures, and should be ignored.

**Costs are small and mostly time.** Luau scripters run $15–40/hour mid-level, $50–120+ senior. Core teams for the hits were **two to six people**. Roblox bears all hosting, moderation and payment costs. Roblox YouTubers charge $200–1,000 (50–200K subscribers) up to $5,000–25,000+ (1M+), with campaigns averaging **$0.05–0.20 per new player**. Roblox Ads Manager runs $0.10–0.50 per click, $10–50/day for a meaningful test.

**Risk is now material and it is new.** A federal multi-district litigation consolidating **182+ child-safety cases** was created in December 2025. State attorneys general in Texas, Florida, Iowa, Tennessee, Nebraska and Oklahoma have sued. About **$54M in state settlements** has been paid, mandating age verification. Roblox's own 10-Q discloses gambling-facilitation investigations. DevEx applications can be declined with Robux frozen; DevForum documents cases of $40,000+ withheld. Robux from moderated content is ineligible for cash-out.

---

## 4. The recommendation

Build a formula game whose surface is 2025 and whose skeleton is 2026.

Concretely, five bets:

**Bet 1 — Co-play as the core mechanic, not a feature.** "Intentional co-play" is a *headline signal* in the June 2026 ranker. Every existing formula game treats other players as antagonists; the loop makes enemies and enemies churn. Nobody has built a formula game where the primary relationship is a teammate. This is the largest unexploited gap in the research and it aligns your design with the exact signal the algorithm now rewards.

**Bet 2 — Own the intellectual property.** Original mascots, not borrowed brainrot memes. The Mementum litigation makes borrowed meme characters a liability, and owned characters are the thing you can license, plush, and carry into a standalone app. *Steal a Brainrot* already has a PhatMojo plush line and a Story Kitchen film deal; it can only do that for the characters it controls.

**Bet 3 — Ship the day-8-to-28 layer at launch, not as an update.** Crews, seasons, collection, and trading go in version one. Under the old ranker you could bolt retention on later. Under the current one, a launch without it gets throttled precisely when the spike would have carried you.

**Bet 4 — Be R15-compliant and age-aware from the first commit.** It costs nothing (simply never spawn an R6 avatar) and it qualifies your adult spend for the 42% higher DevEx rate. Given that Roblox's 18–34 cohort grew over 50% year on year and monetizes about 50% higher, this is free margin.

**Bet 5 — Design for clips.** Moments, Roblox's short-form video feed, went fully live in the US at RDC 2026, and Experience Page videos started entering the feed in late September 2026. `CaptureService:PromptShareCapture()` produces a native share sheet **carrying an invite link with launch data** — a first-party virality hook that barely anyone is using deliberately. Build moments worth clipping and then prompt the clip.

The concept that comes out of those five bets is in `01-GAME-DESIGN.md`. The plan to build it is in `02-PRODUCTION-PLAN.md`.

---

## 5. What I recommend you not do

Stated plainly, because each of these is tempting and each is now a trap.

- **Do not build a media feed, autoplay clip reel, or watch-to-earn loop.** Banned from the Kids and Select tiers as of late August 2026. *Steal An Egg* was delisted over it.
- **Do not use Italian brainrot characters, Labubu, or any borrowed meme IP.** Actively litigated. You would be building your brand on an asset a French company may own.
- **Do not name the game "Steal a ___".** Sammy licensed that phrasing from its originator rather than copying it, which tells you what he thought it was worth. The noun space is also picked over: Fish, Car, Meme, Pet, Labubu and Egg are taken, and the pure noun-swaps mostly died — *Steal a Fish* is down to around 200 players, *Steal a Car* peaked at 18,500, *Steal a Pet* at 13,110.
- **Do not build an economy that depends on whale spending by under-13s.** It is the exact cohort Roblox is throttling, the exact subject of the multi-district litigation, and the exact revenue line that fell off a cliff in Q2.
- **Do not sell a 7,499-Robux admin-powers pass.** *Steal a Brainrot* does, and it is both the whale product and the thing that looks worst in a regulatory filing.
- **Do not launch without the weekly ritual staffed.** Missing week three is how these games die. If you cannot commit to a fixed weekly slot for six months, build a different kind of game.

---

## 6. Honest odds

You asked for the future of Roblox games and tons of players. Here is the fair statement of the bet.

The base rate is unforgiving: the median DevEx participant makes $1,550 a year, and roughly 23,500 people cashed out at all in 2025 against millions who tried. The market is contracting for the first time in the platform's history, and it is contracting hardest in this genre. Fourteen clones of a good idea appear within two days of it surfacing.

Against that: the mechanical formula genuinely works, it is cheap to build, the two reference cases were made by a 16-year-old in three days and a 24-year-old in four months, and there is one real structural gap — co-play-native formula design — that the platform's own algorithm now pays for and that no incumbent has filled, because filling it means rebuilding a loop that currently prints money for them.

A realistic good outcome is a game that reaches five figures of concurrent players and nets a few thousand dollars a month, which on this platform would put you above the great majority of people who ship anything. A great outcome is six figures of concurrent players and a real business. The 25-million-concurrent outcome required a meme at the exact moment of its virality, a platform that rewarded spikes, and a studio with an existing audience to cross-promote from. Two of those three conditions no longer hold.

That is worth doing. It is not worth doing on the assumption that it repeats 2025.

---

## 7. Verification checklist before spending money

Every item below is load-bearing and was blocked or single-sourced. Check each from an unblocked network before committing budget.

1. **Current DevEx rates** and the exact US-18+ qualification rules — `create.roblox.com/docs/production/earn-on-roblox/developer-exchange`
2. **The June 2026 discovery post** in full, plus the August 2026 "Boost Your Discovery" DevForum thread (topic 4779042) — the published signal weights are the single most valuable document for this project
3. **The late-August 2026 media-feed policy text** — exact wording of what is barred and from which tiers
4. **Paid random item rules** — odds disclosure requirements, `PolicyService.ArePaidRandomItemsRestricted`, and whether luck multipliers count
5. **Current concurrent-player data** for the genre from RoMonitor and Rolimons — several figures in Appendix C conflict badly (one tracker claims 9.87M for *Steal An Egg* where Kotaku reports ~800K)
6. **Roblox Q3 2026 earnings** (due around late October 2026) — this tells you whether the contraction is a policy-induced dip or a trend
7. **Trademark search** on any name you settle on, in the relevant classes, plus a Roblox search for existing games
8. **The Mementum v. Do Big docket** — the outcome shapes whether meme characters are ownable property
9. **RDC 2026 sessions on discovery and Roblox Everywhere** — standalone apps and end-of-2026 Chrome play change distribution materially
10. **Rewarded video eligibility** — publisher must be 13+, ID-verified, 2FA-enabled, with 2,000+ monthly unique visitors

---

## Appendices

| File | Contents |
|---|---|
| `appendices/A-steal-a-brainrot.md` | Origin, growth timeline, full mechanical breakdown, monetization, controversies, the clone wave |
| `appendices/B-grow-a-garden.md` | Origin, the acquisition, the Splitting Point / Do Big studio playbook, criticism and regulation |
| `appendices/C-landscape-2026.md` | Current top games, 2026 trends, the clone graveyard, platform state, where the puck is going |
| `appendices/D-monetization-economics.md` | The Robux pipeline, revenue benchmarks, monetization design patterns, costs, legal risk |
| `appendices/E-growth-playbook.md` | The discovery algorithm, cold start, the meme pipeline, live-ops, naming and packaging |
| `appendices/F-technical-production.md` | Toolchain, reference architecture, performance budgets, content pipeline, live-ops tooling, production benchmarks |

Appendix F is the most immediately actionable: it contains a decompiled reference architecture for this exact genre, the persistence stack with real constants, the steal-mechanic validation flow, and the platform limits you must design around.
