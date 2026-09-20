# The Investor's Memo: SKYTREE

*Council seat 3 of 4. I do not evaluate whether Skytree is a good game. I evaluate whether it is a rational use of eight weeks and a thousand dollars.*

**Source-quality warning, stated once and applying throughout.** Nearly every input came from search-result snippets, not primary sources; Roblox's domains and all CCU trackers were blocked during research. Tracker figures carry a stated ±30% error, and third-party revenue estimates (GaG's "$12M in May 2025", SAB's "$11M/month") are models with unverified bases. The only hard figures are those read from Roblox's creator-docs mirror: the 70% share, the $0.0038 and $0.0054 DevEx rates, the 30,000-Robux minimum. Every probability here is my judgement, not a measurement.

---

## 1. The verdict in one paragraph

**Fund it, with conditions, as a cheap option — not as an income plan.** The expected value is positive (~$47,000 against ~$33,000 of fully-loaded cost) but roughly 91% of that EV lives in outcomes with a combined 3% probability, and the *median* outcome is zero. What makes me willing to write the check is not the EV; it is that this specific design can be falsified for about $300 and three weeks. The entire thesis reduces to one testable claim — *will a child come back on day fourteen?* — and that claim can be tested before the expensive eight weeks are spent. Cash break-even is absurdly low (~22–91 average CCU, because Roblox bears all hosting), and time break-even is ~650–950 sustained CCU, which is a reachable rather than a heroic number. Against that, the design's deliberate refusal to sell time-skips costs roughly two-thirds of its revenue per player, and its target of seven-year-old comprehension forfeits the 42% higher adult DevEx rate that Roblox is actively steering capital toward. I fund the option; I do not fund the current targeting.

---

## 2. The base rate

This is the most important number in the memo and it is the one every pitch omits.

In 2025, about 23,500 creators cashed out *anything at all* — they cleared 30,000 Earned Robux ($114) in a year. The median of those 23,500 earned about $1,550; the top 1,000 averaged $1.3M. The power law is so steep that "the median successful creator" earns less than one week of contractor wages. **Assumption (shaky):** I estimate 100,000–200,000 serious monetized attempts per year against those cash-outs; the denominator is disclosed nowhere in the corpus.

### Outcome tiers

| Tier | Sustained avg CCU | Monthly net to devs | What it means |
|---|---|---|---|
| Total failure | <50 | <$100 | Never clears the $114 DevEx minimum meaningfully |
| Marginal | 50–300 | $300–3,000 | Cashes out; roughly the $1,550 median |
| Modest success | 300–2,000 | $3,000–20,000 | Real part-time income, decaying |
| Real business | 2,000–20,000 | $20,000–250,000 | Fundable studio |
| Breakout | >20,000 | >$250,000 | Top-1,000 creator ($1.3M/yr avg) |

### Prior probability by tier

| Tier | Random attempt | Informed 2-person team, proven lane | **Skytree specifically** | 12-mo value assumed |
|---|---|---|---|---|
| Total failure | 93% | 65% | **72%** | $50 |
| Marginal | 5% | 22% | **19%** | $2,500 |
| Modest | 1.5% | 9% | **6%** | $60,000 |
| Real business | 0.45% | 3.5% | **2.5%** | $500,000 |
| Breakout | 0.05% | 0.5% | **0.5%** | $6,000,000 |

Skytree's column is adjusted *down* in the middle tiers (novel shape with no comparable, weakened monetization, no YouTube relationships for the cold start) and held flat in the tail (the 28-day-retention algorithm genuinely favours this shape).

**EV = 0.72(50) + 0.19(2,500) + 0.06(60,000) + 0.025(500,000) + 0.005(6,000,000) = $46,611.**

| EV contribution | $ | Share |
|---|---|---|
| Breakout (0.5% chance) | $30,000 | 64% |
| Real business (2.5%) | $12,500 | 27% |
| Everything else (97%) | $4,111 | 9% |

**This is a lottery ticket, and the memo should say so plainly.** A 91%-tail-driven EV is a categorically different proposition from a reliable small return. If the founders need money in six months, this is the wrong instrument regardless of its EV.

---

## 3. Unit economics, with arithmetic

### The consumer-dollar waterfall

| Channel | Consumer pays | Robux | Creator 70% | × DevEx rate | Net to dev | **Cents per consumer $** |
|---|---|---|---|---|---|---|
| Web | $9.99 | 1,000 | 700 | ×$0.0038 | $2.66 | **26.6¢** |
| Mobile app | $9.99 | 800 | 560 | ×$0.0038 | $2.13 | **21.3¢** |
| Blended @75% mobile | $9.99 | — | — | — | $2.26 | **22.6¢** |
| Web, verified US 18+, R15 | $9.99 | 1,000 | 700 | ×$0.0054 | $3.78 | **37.8¢** |

I use **22.6¢** throughout. Skytree, designed for seven-year-old comprehension, captures essentially none of the 37.8¢ rate — a forfeited ~15 points of margin on every consumer dollar.

### Deriving revenue per 1,000 average CCU

Assumption: **DAU = 25 × avg CCU** (mid of the 16–32x band). Flagged shaky: a feed-and-leave loop produces short sessions, which pushes this ratio *higher* — good for headcount, bad for the algorithm's "total session playtime" signal.

| Scenario | Daily payer rate | Gross $/paying day | Gross bookings/day | × 22.6% | **Net $/mo per 1,000 CCU** |
|---|---|---|---|---|---|
| Low | 0.5% (125 payers) | $5 | $625 | $141 | **$4,300** |
| Base | 1.25% (312 payers) | $6 | $1,875 | $424 | **$12,900** |
| High | 2.5% (625 payers) | $8 | $5,000 | $1,130 | **$34,400** |

This reproduces the brief's $10,000–70,000 rule of thumb — note that the rule's band implicitly assumes a *well-monetised* simulator, i.e. my Base-to-High columns.

### Skytree at four scales

| Avg CCU | DAU | Low /mo | Base /mo | High /mo | Base annualised at run-rate | Base, decay-adjusted 12mo |
|---|---|---|---|---|---|---|
| 500 | 12,500 | $2,150 | $6,450 | $17,200 | $77,400 | $54,200 (×0.70) |
| 2,000 | 50,000 | $8,600 | $25,800 | $68,800 | $309,600 | $154,800 (×0.50) |
| 10,000 | 250,000 | $43,000 | $129,000 | $344,000 | $1,548,000 | $541,800 (×0.35) |
| 50,000 | 1,250,000 | $215,000 | $645,000 | $1,720,000 | $7,740,000 | $2,322,000 (×0.30) |

**Never annualise a peak in this genre.** Grow a Garden went from 22.3M CCU to 63,000 in thirteen months; Roblox's 10-K says viral engagement "has generally not been sustainable." Decay factors are my judgement, steeper for spikier outcomes.

---

## 4. The monetization problem, priced

The design refuses to sell time-skips. That is not a minor SKU omission; it removes the genre's highest-converting category by name.

| Genre product | Source evidence | Available to Skytree? |
|---|---|---|
| 30-min boosts (25–49 R$) | "highest-converting type" | **No** — a growth boost is a time-skip |
| 2x multipliers (99–299 R$) | "the core monetiser" | **No** |
| Level/wait skips (49 R$) | standard | **No** |
| Lucky blocks / eggs (175–2,399 R$) | 3 SKUs in Steal a Brainrot alone | **Compromised** — species is "the collection"; selling luck breaks the promise, and triggers odds-disclosure rules |
| VIP, cosmetics, slots, season pass, admin | standard | Yes |

Both terms of ARPDAU fall. **Conversion** falls because the design deliberately removes the friction moment where purchase intent spikes; **ARPPU** falls because cosmetics repeat far worse than consumables. Against a genre range of 1–3% (2–3% at the good end), Skytree should be modelled at **0.5–1.25%** — at or below the platform-wide 1.4% daily payer rate, and consistent with the DevForum reports of 0.66% and 1.2%.

**So my "Low" column *is* the no-time-skip case.** The price of the design:

| Avg CCU | Base (1.25%) /mo | Downside (0.5%) /mo | Cost of the refusal |
|---|---|---|---|
| 500 | $6,450 | $2,150 | −$4,300/mo |
| 2,000 | $25,800 | $8,600 | −$17,200/mo |
| 10,000 | $129,000 | $43,000 | −$86,000/mo |
| 50,000 | $645,000 | $215,000 | −$430,000/mo |

**Skytree must reach roughly 3× the CCU of a conventional clone to earn the same money.** That is the honest price of the principle.

One further cost, unpriced by the pitch: Roblox began testing in August 2026 an additional reward for games strong on retention **and** monetization *together*. Skytree optimises for one half of that pair and opts out of the other. Given Roblox's own bookings are guided to their first-ever decline, the monetization half will likely gain weight, not lose it.

Durability does not rescue this at these magnitudes: 1,000 CCU held 12 months at the Low rate earns $51,600, while a spike to 10,000 CCU that dies in a quarter still earns ~$300,000. Durability wins only if the algorithm grants *materially more reach* — the bull case, and unproven.

---

## 5. Cost and break-even

| Cost line | Low | High |
|---|---|---|
| Assets | $500 | $1,000 |
| Roblox Ads Manager | $150 | $700 |
| YouTuber (mid-tier, optional) | $0 | $5,000 |
| **Cash subtotal** | **$650** | **$6,700** |
| Founder time: 2 × 8wk × 40hr = 640 hr @ $50/hr blended | $32,000 | $32,000 |
| Live-ops, 5 months @ 50% of one person (~240 hr) | $12,000 | $12,000 |
| **Fully loaded** | **$44,650** | **$50,700** |

Contractor rates from the research: mid-level Luau $15–40/hr, senior $50–120/hr, blended studio $30–70/hr. I use $50/hr; the 640 hours cost $9,600 at the low end and $76,800 at senior rates. I include live-ops because launch-and-abandon produces zero day-8–28 retention, which under the June 2026 algorithm means zero reach. Eight weeks is the *build* cost, not the *commitment*.

### Break-even, at sustained average CCU held for 12 months

| Cost basis | Amount | @ Low ($4.30/CCU-mo) | @ Base ($12.90/CCU-mo) |
|---|---|---|---|
| Cash only, no YouTuber | $1,150 | **22 CCU** | 7 CCU |
| Cash + one YouTuber | $4,700 | **91 CCU** | 30 CCU |
| + 8 weeks of time | $33,150 | **642 CCU** | 214 CCU |
| + build + 5 months live-ops | $48,700 | **944 CCU** | 315 CCU |

**The headline finding of this memo.** Because Roblox bears all hosting, moderation and payment costs, cash break-even is trivial — under 100 average CCU. The real threshold is time: **~650–950 sustained average CCU** to justify the founders' hours. That is roughly a perpetual top-3,000 game. It is not a mega-hit. It is a genuinely reachable number, and it is why this deserves a conditional yes rather than a flat no.

The comparison that matters: those 640 hours contracted out at $50/hr bank **$32,000, certain**. The bet's EV of $46,611 beats it — but with a 72% chance of near-zero.

---

## 6. The market timing question

Entering a contracting market is rational under exactly three conditions: (a) the contraction is in incumbents' share, not the addressable audience; (b) entry costs fall with it; (c) your product is counter-positioned to the *specific cause*.

### Decomposing the contraction

| Cause | Cyclical or structural | Does Skytree benefit? |
|---|---|---|
| Discovery rewired to 28-day retention + co-play (Jun 2026) | **Structural, permanent** | **Yes — directly and strongly** |
| Doomscroll / media-feed ban (Aug 2026) | Structural | Yes — removes rivals' engagement hacks |
| Under-13 spend shifting off high-monetizing viral games | Structural; Roblox *chose* it | Mixed — more reach, less spend |
| Age checks for chat (Jan 2026) | Structural, largely absorbed | Slightly negative (Grove chat matters) |
| Cross-experience pass sales disabled (May 2026) | Structural | Neutral |
| Russia ban (Dec 2025) | One-time | Neutral |

**The contraction is overwhelmingly self-inflicted and structural, not cyclical.** This cuts both ways, and both matter.

Against: the 2025 kid-whale regime is not coming back. Anyone modelling on Grow a Garden's May 2025 economics is modelling a dead regime.

For: the *new* regime is durable, and Skytree is built natively for it. Management's own words are that engagement shifted away from "high-monetizing viral games" — Roblox is redistributing reach toward retention and co-play, and Skytree's two-week arc and mandatory Grove are exactly the signals being rewarded. This is the only genuinely differentiated asset in the pitch, and it is real.

Two caveats. 123M DAU falling 7% in a quarter is a slowdown, not a collapse — the market is still enormous, which weakens the drama on both sides. And Skytree's short feed-and-leave sessions work *against* the algorithm's "total session playtime" signal, partially offsetting the retention advantage.

---

## 7. Opportunity cost

Same tier values, adjusted per option for durability and revenue-per-player.

| # | Option | Failure | Marginal | Modest | Real | Breakout | **EV** | Character |
|---|---|---|---|---|---|---|---|---|
| A | **Skytree as designed** | 72% | 19% | 6% | 2.5% | 0.5% | **$46,611** | Tail-driven lottery |
| B | Clone in a proven lane (co-op job-sim horror / "Steal a") | 62% | 24% | 9% | 4% | 1% | **$60,411** | Fatter tail, worse durability (×0.7 values), clone + IP + policy risk |
| C | **Adult-audience lane (R15, 18+ DevEx)** | 60% | 25% | 11% | 3.7% | 0.3% | **$104,095** | 2.4× revenue/player, thin tail, fat middle |
| D | Portfolio of three cheap games | 88%/ea | 9% | 2% | 0.9% | 0.1% | **$35,907** | Was right in 2025; wrong in 2026 |
| E | Don't build — contract 640 hr @ $50/hr | — | — | — | — | — | **$32,000 certain** | Zero variance, zero optionality |

**Option C is the finding that should change the plan.** Its mechanism is documented, not invented: 37.8¢ vs 22.6¢ per consumer dollar (+68%), and an 18+ cohort that "monetizes 40% higher" and grows >50% YoY — combined, ~2.4× revenue per player. Its EV is also *healthier*: only 41% comes from the breakout tail versus Skytree's 64%, and its Modest tier at ~$144k/yr is an actual income.

**Option D is a trap.** Portfolio theory needs each draw to have a real shot. Splitting 640 hours three ways eliminates the live-ops budget, and under the 28-day algorithm no live-ops means no reach. Three abandoned games in 2026 is three zeros.

**Honesty on the ranking:** the gaps between A, B and D sit inside my estimation noise — I invented those probabilities. C is the robust call, because it rests on a documented revenue multiplier rather than guessed odds.

### The adjacent observation the pitch missed

Skytree's own stated weakness is that "two weeks is a very long time horizon for the core demographic." A persistent, slow, collection-driven, guild-based world fits adults *better* than seven-year-olds. Aging the target simultaneously fixes the design's biggest admitted weakness and unlocks a 1.68× DevEx rate. At the design stage this is nearly free; after the first line of code it is expensive, and after launch impossible — Roblox's rule is absolute: *"If a player can spawn into or swap to an R6 avatar at any point during active playtime, your game is not eligible."*

---

## 8. What would make me write the check

Staged, with kill criteria. Capital is committed only as risk is retired.

### Stage 0 — Retargeting decision (1 week, $0)
- **G0.1** R15-only / 18+-eligible avatar pipeline committed from line one of code. Non-negotiable; it is free now and impossible later.
- **G0.2** Monetization ladder of ≥6 priced SKUs, none of them time-skips, with a modelled ARPDAU.
- **G0.3** Cold-start plan naming three specific YouTubers, rates, and whether contact exists — the 2025–26 mega-hits cold-started on YouTube, not paid ads.
- **KILL:** the ladder cannot model ≥$8,000/mo net per 1,000 CCU. Below that, time break-even exceeds 1,000 sustained CCU.

### Stage 1 — Vertical slice (2 weeks, ≤$300)
Grove of 5, one tree, the feed loop, clock compressed 24:1.
- **G1.1** ≥6 of 10 unpaid testers voluntarily return at the simulated "day 8"
- **G1.2** Median session ≥12 minutes
- **G1.3** ≥8 of 10 describe the game correctly after 30 seconds of watching
- **KILL:** <4/10 return. This kills the thesis outright — the design rests entirely on the multi-day return.

### Stage 2 — Soft launch (weeks 3–6, ≤$1,300). Measured on ≥500 real players, real clock.
- **G2.1** D1 ≥ 30%
- **G2.2** D7 ≥ 12%
- **G2.3 D14 ≥ 6%** — the make-or-break metric, because it *is* the product promise
- **G2.4** Payer conversion ≥ 1.0% of DAU
- **G2.5** ≥40% of sessions have 2+ Grove members concurrently present (co-play must be real, not aspirational — the algorithm measures it)
- **KILL:** D14 < 3%, **or** conversion < 0.5%. Either alone. At 0.5% you need ~950 sustained CCU merely to pay for your own time.

### Stage 3 — Paid cold start (weeks 7–8 + 4 weeks live-ops, $3,000–8,000). **YouTuber money unlocks here and not before.**
- **G3.1** 30 days post-first-video: avg CCU ≥ 400 and rising
- **G3.2** CAC ≤ $0.20 per retained player (research band: $0.05–0.20)
- **G3.3** One completed DevEx of ≥30,000 Robux — proves the whole pipe works end to end
- **KILL:** avg CCU < 150 at day 30, or declining three consecutive weeks.

### Stage 4 — Scale (open-ended)
- **G4.1** 90-day average CCU ≥ 1,000, positive trend, ≥$12,000/mo net.

### Capital at risk by stage

| Through stage | Cash | Person-weeks | % of thesis risk retired |
|---|---|---|---|
| 0–1 | $300 | 3 | ~60% (does anyone return?) |
| 2 | $1,600 | 11 | ~85% (do they return *and* pay?) |
| 3 | $9,600 | 19 | ~95% (does it grow?) |

**Sixty percent of the uncertainty is resolved for $300 and three weeks.** That asymmetry is the whole investment case.

---

## 9. Recommendation

**FUND WITH CONDITIONS.**

1. **R15 / 18+-eligible from line one of code.** Non-negotiable and free today.
2. **Seriously evaluate aging the audience to 13+/adult before writing code.** The persistent, slow, collection-driven shape suits adults better than seven-year-olds, it fixes the design's own stated biggest weakness, and it pays 1.68× per consumer dollar in a lane Roblox is actively steering capital toward.
3. **Staged gates as in §8, with the D14 ≥ 6% kill criterion binding.** No exceptions, no "let's give it one more update."
4. **No YouTuber spend before Stage 3.** It is the single largest cash line and it is worthless before retention is proven.
5. **Before Stage 2, add one high-conversion SKU that is not a time-skip** — a cosmetic season pass on species collection is the obvious candidate. The design can refuse to sell speed without refusing to sell anything.

**I do not fund this as an income plan.** The median outcome is zero. If these two people need the $32,000 they would earn contracting those same 640 hours, they should take it — it is over twenty times the median DevEx participant's annual earnings. This check is rational only for founders who can absorb a total loss and who value the residual: a shipped live game, a working DevEx pipeline, a community, original IP with no litigation exposure, and the skills. Those residuals are real, they are absent from my EV calculation, and they are the main reason I am a yes rather than a no.
