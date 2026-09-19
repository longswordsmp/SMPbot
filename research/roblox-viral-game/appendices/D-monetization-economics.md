# The Economics of Making Money on Roblox (2025–2026)
## Focus: simple viral games in the "Steal a Brainrot" / "Grow a Garden" genre

*Research compiled 19 September 2026. Every fact carries a date and a source. Items I could not confirm from a primary or reliable secondary source are marked **unverified**. Note on method: during this session the network proxy blocked most news, wiki, DevForum and analytics sites; official Roblox creator documentation was read from Roblox's own open-source `creator-docs` GitHub mirror, and Roblox financial figures come from verbatim 10-K / earnings-call quotes hosted on GitHub. Third-party estimates come from web-search summaries and are labelled as such.*

---

## 0. Executive summary (ten points)

1. **Cash conversion is fixed and public.** Since 5 Sept 2025 the DevEx rate is **$0.0038 per Earned Robux** (up 8.5% from $0.0035). A new **US 18+ rate of $0.0054** (42% higher) applies from **8 June 2026** to in-experience spend by age-verified US adults in eligible games. Minimum cash-out: **30,000 Earned Robux ($114)**, once per calendar month.
2. **Developers keep ~70% of Robux spent in-experience, but only ~21–27 cents of the consumer's dollar** after app-store/Roblox take and the DevEx rate (≈27¢ via web at $9.99/1,000 R$; ≈21¢ via mobile; ≈38¢ for US-18+-rated spend).
3. **Creator Rewards (live 24 July 2025)** replaced Premium/Engagement-Based Payouts: **5 Robux/day per "Active Spender"** (spent ≥$9.99 in past 60 days) who plays 10+ min and for whom your game is one of their first three that day, plus **35% of the first $100** spent platform-wide by new/reactivated users you bring in (60 days; needs 100+ DAU). Terms unchanged as of July 2026. Realistically worth cents per DAU-day, not the thousands per month some blogs claim.
4. **Roblox paid creators >$1.5B in 2025** (+63% DevEx fees vs $923M in 2024); Q4-2025 DevEx $477M, Q1-2026 ≈$423M (+50%), Q2-2026 $363M (+15%). Top-1,000 creators averaged **$1.3M** in 2025; top 10 averaged **$33.9M**; the **median DevEx participant received ~$1,550**; 23,500 creators cashed out in 2025.
5. **The two genre-defining hits are enormous but concentrated:** Grow a Garden (launched 25 Mar 2025, built in 3 days by a 16-year-old) did **~$12M in May 2025** alone and peaked ~21–22M CCU; Steal a Brainrot peaked **25.4M CCU** (Q4 2025) with a July-2025 third-party estimate of **$11M/month**. Both are now (part-)owned by Do Big Studios. Crude visit-based lifetime estimates: GaG ~$286M, SAB ~$578M (models, not disclosures).
6. **Benchmarks:** platform-wide payer conversion ≈1.4% of DAU per day (1.9M daily payers / 132M DAU, Q1-2026); bookings per DAU $0.15/day; **$10.36 bookings per daily paying user per day**; **$18.78 per monthly payer** (Q1 2026). Community rules of thumb: simulators earn 2–6 gross Robux per visit; typical games 0.6–1.2; 1,000 average CCU ≈ 10–30k DAU.
7. **Monetization pattern in the genre is standardised:** 2x cash (119–299 R$), VIP (199–499 R$), admin panel (1,999–7,999 R$), lucky blocks/eggs (175–2,399 R$), gear dev-products (199–1,499 R$), season pass (749 R$, skips 49 R$/level, 1,699 R$ full), currency packs, luck boosts, base locks/shields, extra slots, rebirths, limited-time event currencies. Managed pricing (regional 30–100% of list price, automatic A/B price optimisation at ≥60k transactions/30 days) is on by default.
8. **Costs are low but rising:** Luau scripters $15–40/hr mid-level, $50–120+/hr senior; Roblox Ads Manager sponsored tiles bid on cost-per-play, ~$0.10–0.50/click, $1–5 CPM immersive; Roblox YouTubers $200–1,000 (50–200k subs) to $5,000–25,000+ (1M+) per video; influencer cost-per-player ~$0.05–0.20.
9. **Risk has escalated sharply in 2026:** ≥182 cases consolidated in a federal MDL (Dec 2025), state AG suits (TX, FL, IA, TN, NE, OK and others), ~$54M in state settlements requiring age verification; a gambling-facilitation angle is named in Roblox's 10-Q; Roblox's own age-check rollout plus "de-biasing" of discovery cut new-user growth and led to a guidance cut (FY-2026 bookings +8–12%, from +22–26%).
10. **Genre-specific risks:** paid random items must display exact odds and respect `PolicyService` restrictions; R6-avatar games are excluded from the 18+ rate; viral-hit revenue "generally moderates" (10-K); DevEx can be declined for ToU violations with Robux frozen; clones and meme-IP ambiguity are endemic to "Steal a…" games.

---

## 1. THE ROBUX PIPELINE

### 1.1 What players pay for Robux (consumer side)

| Channel | Price | Robux | $ per Robux | Source / date |
|---|---|---|---|---|
| Web / desktop | $4.99 | 500 | $0.0100 | NY Mag (Sept 2025); price guides 2026 |
| Console / mobile app | $4.99 | 400 | $0.0125 | NY Mag (Sept 2025) |
| Web | $9.99 | 1,000 | $0.0100 | CoinGate / ProGameGuides 2026 |
| Mobile app | $9.99 | ~800 | $0.0125 | CoinGate 2026 |
| Web | $199.99 | 24,000 | $0.0083 | ProGameGuides 2026 |

- Web/desktop/gift-card purchases yield **up to 25% more Robux** than in-app purchases because Roblox passes Apple/Google's ~30% fee through ("differential Robux pricing", launched **November 2024** per the FY2025 10-K).
- Roblox "reworked its packages and its subscription during 2026, so older price tables are unreliable" (CoinGate, 2026). Exact 2026 package tiers beyond the points above: **unverified**.
- FY2025 10-K: **29% of revenue came via the Apple App Store and 15% via Google Play**; Roblox is "obligated to pay up to 30%" of those sales to Apple/Google and ~30% to Xbox/PlayStation.
- **Roblox Premium** ($4.99 / $9.99 / $19.99 tiers with monthly Robux stipends) **closed to new purchases on 30 April 2026**, replaced by **Roblox Plus** ($4.99/month; 10% discount on eligible Robux purchases in months 1–2, 20% from month 3; no monthly Robux stipend; free access to paid private servers; Robux transfers). (Tubefilter 13 Apr 2026; PCGamesN; Roblox Plus creator doc, updated through 14 Jul 2026.)

### 1.2 The developer's cut of Robux

Official creator-doc facts (Roblox/creator-docs mirror, read 19 Sep 2026):

| Item | Creator share |
|---|---|
| Passes / developer products bought in-experience | **70%** (Roblox Plus doc example: "Non-subscriber at 100 Robux: creator earns 70 Robux") |
| Robux-priced in-experience subscriptions | **70%** every month |
| Local-currency subscriptions ($2.99–$14.99 tiers) | 70% first month, **100% from month 2** |
| Private servers (monthly Robux fee) | Share not stated in doc (industry understanding: 70%, **unverified**) |
| Paid access (25–1,000 Robux) | Doc says price "affects the amount you earn per sale"; a 2025 third-party note claims 50–70% tiered for desktop local-currency paid access — **unverified** |
| Avatar marketplace item sold in the Marketplace | Creator 30% / Roblox 70% (progressive up to 70% creator at ≥6x price floor) |
| Avatar item sold *inside a game* | Creator 30% / **game owner (affiliate) 40%** / Roblox 30% |
| Creator Store (plugins/models) | Only taxes & payment-processing deducted |
| Robux transfers (Plus feature) | Creator of the hosting game gets **10%**, recipient 90%, Roblox takes 0% |
| Roblox Plus-discounted purchases | Creator still gets 70 R$ on a 100 R$ item — Roblox subsidises the discount, so the **effective share is 78% (10% off) or 88% (20% off)** |

### 1.3 DevEx (Developer Exchange) — verified from the official doc

- **Standard rate: $0.0038 per Earned Robux** ("$114 USD for 30,000 Earned Robux"). Effective **5 Sept 2025, 10 am PT**. Before that: **$0.0035** ($105 per 30,000). Robux earned before the cut-over are cashed at the legacy rate and "must cash out completely before accessing current rates."
- **US 18+ rate: $0.0054** (42% higher) effective **8 June 2026**, for Earned Robux from **developer products, passes, subscriptions and private servers** bought by **US players who verified age ≥18 via facial age estimation or government ID**, in eligible games. Eligibility is about avatars: the game must use R15/advanced rigs or compliant custom human/non-human characters for 100% of active playtime; **"If a player can spawn into or swap to a R6 avatar at any point during active playtime, your game is not eligible."** Roblox runs ongoing compliance checks. Higher-rate Robux are cashed out (and converted to ad credits) first. Creator Rewards Robux do **not** get the 18+ rate. (Doc first published 29 May 2026; last updated 25 Aug 2026.)
- **Minimum cash-out: 30,000 Earned Robux.** Requirements: age 13+, verified email, DevEx-portal (Tipalti) account, W-9 (US) or W-8 (non-US) on file, full compliance with Terms of Use and Community Standards.
- **Frequency:** "You can have a completed DevEx request once per calendar month."
- **Timing:** ~10 business days for first-timers, ~5 for returning participants, plus bank time (ACH/eCheck 3–5 days, PayPal 2–3, wire 1–5, cheque 7–14). Tipalti deducts transaction fees; FX adds **1.9–3%**. New portal registration must be completed within one week of invitation or the request is auto-declined.
- **What counts as Earned Robux:** sales of dev products, passes, subscriptions, private servers, paid access, avatar items, Creator Store items, in-game ad earnings, Roblox Plus incentives, Creator Rewards. **Not eligible:** purchased Robux, subscription stipends, trading/resale, Robux transfers received, gift-card redemptions, "passes from template games lacking legitimate visits", and revenue from moderated/violative content.
- Q4-2025 call (5 Feb 2026, CEO Baszucki): "In Q4, DevEx was at $477 million, which was up 70% year-on-year. This increase in DevEx reflects our 8.5% increase rate in September."

### 1.4 Tax and legal considerations (official tax doc + DevEx portal doc)

- US persons: W-9; Roblox reports on **Form 1099-NEC** for payments before 1 Nov 2026 (portal doc: threshold >$2,000/yr, issued by 31 Jan). **From 1 Nov 2026 the tax flow moves into Creator Hub and payments are reported on 1099-MISC as royalties (Box 2) for $10+** — a reclassification worth discussing with an accountant. Roblox states it "does not provide tax advice."
- Non-US: W-8BEN / W-8BEN-E; **24% backup withholding** if valid tax info is not on file by 31 Oct 2026; otherwise 0–30% treaty-dependent withholding on the US-source portion; Form 1042-S issued regardless of amount.
- Minors (13–17) can DevEx but need the tax forms/portal; group-owned games pay out via group funds (standard practice, **unverified** here).
- Terms of Use grant Roblox a perpetual, sublicensable licence to published UGC (ToU dated 19 May 2026).

### 1.5 Creator Rewards (the engagement-based payout program) — verified from the official doc, launch version vs current

- **Announced 24 June 2025; live 24 July 2025** for all creators (no enrolment). Replaced **Engagement-Based Payouts** (formerly "Premium Payouts") and the **Creator Affiliate** program, both deprecated 24 July 2025.
- **Daily Engagement Rewards:** "Creators earn **5 Robux each day** if their experience is one of the **first three** an **Active Spender** plays for **10+ minutes**." *Active Spender* = a user who "has made Qualifying Purchases totaling at least **$9.99 USD** anywhere on Roblox within the past 60 days" and was not a New/Reactivated User in the past 60 days.
- **Audience Expansion Rewards:** "35% revenue share on their first $100 of Qualifying Purchases anywhere on the platform" during a **New User's or Reactivated User's** (inactive 60+ days) first 60 days, if they arrived via your share link/direct link and played 10+ minutes; your experience must average **100+ DAU for the 60 days** after they join. Requires ID-verified account in good standing and a valid DevEx account.
- **60-day hold** before rewards become spendable/cashable Earned Robux. Artificial activity, alts and fraudulent transactions are excluded.
- **No change in the numeric terms** between the 24 Jul 2025 launch text and the 10 Jul 2026 revision (I compared both versions).
- Secondary claims (Spaceport blog; a GitHub design doc): "73% of developers earn more" under the new system and "171% more developers cross the minimum payout" — presumably from Roblox's announcement; **unverified**.
- **Reality check on value:** 5 R$ × $0.0038 = **$0.019 per qualifying spender-day**. A 1,000-DAU game where 20% of users are Active Spenders and half of those qualify earns 100 × 5 = 500 R$/day ≈ **$57/month**. The theoretical ceiling at 1,000 DAU (every user qualifying every day) is 150,000 R$/month ≈ $570. Blog tables claiming "$5,000–15,000/month at 1,000 DAU" from Creator Rewards are arithmetically impossible under the published rate.
- **Old Premium Payouts / EBP:** pool split by each game's share of *Premium members'* playtime, reported over 28 days; deprecated 24 Jul 2025. Creators on DevForum complained the new 60-day hold is longer than before (thread "Shorten the hold period…", 2025).

### 1.6 Roblox Plus creator payouts (replacing Premium-related income) — official doc, April–July 2026

- Creators earn **250 Robux/month for up to 3 months (max 750 R$)** per new Plus subscriber acquired through `PromptRobloxSubscriptionPurchase` inside their game.
- **Up to 100 Robux/month per subscriber** who spends ≥60 cumulative minutes in the creator's paid private servers.
- **10% of every Robux transfer** initiated by a Plus subscriber inside your game (transfers 10–500 R$).
- Item discounts are subsidised by Roblox, so per-transaction creator income is unchanged.

### 1.7 Chronology of 2024–2026 revenue-share changes affecting creators

| Date | Change |
|---|---|
| Nov 2024 | Differential Robux pricing (more Robux via low-fee channels) — cited in 10-K as a driver of higher DevEx |
| 24 Jul 2025 | Creator Rewards launched; EBP/Premium Payouts & Creator Affiliate ended |
| 5 Sep 2025 (announced at RDC, Sept 2025) | DevEx rate +8.5% to $0.0038 |
| 2025 | Managed pricing (regional pricing 30–100% of list; price optimisation) default-on for new games/items |
| 30 Apr 2026 | Roblox Plus replaces Premium; new creator bonuses (above) |
| 8 Jun 2026 | US 18+ DevEx rate $0.0054 |
| 1 Nov 2026 (scheduled) | Tax documentation moves to Creator Hub; 1099-MISC royalty reporting |

### 1.8 Roblox-level creator payout statistics

- **2024:** creators earned **$923M** (Roblox economic-impact report, Sept 2025).
- **2025:** "creators earned over **$1.5 billion** for the first time" (Baszucki, 5 Feb 2026). 10-K: DevEx fees **+$580.3M (+63%)** → ≈$1.50B. "Creator earnings surpassed $1 billion in the first 9 months of 2025" (Q3 call, 30 Oct 2025). Q3-2025 DevEx **$427.9M (+85%)**; Q4-2025 **$477M (+70%)**.
- **2026 to date:** Q1-2026 DevEx **+$141M (+50%)** (≈$423M); Q2-2026 DevEx **$363M (+15%)** (earnings 30 Jul 2026). Analyst estimates put 2026 payouts at **$1.8–2.0B** (Yahoo Finance) — estimate, not guidance. Payout/revenue ratio ≈31% in 2025.
- **Distribution:** "top 1,000 creators … earned an average of **$1.3 million**, up over 50%" (Q4-2025 call). Sept-2025 report: **top 10 averaged $33.9M, top 100 averaged $6M**; **29,000+** in DevEx; **median DevEx creator $1,440** (12 months to 30 Jun 2025). Creator Hub (16 Jul 2026): "over 35,000 are part of our DevEx program, with the median creator receiving **$1,550** during the twelve months ended December 31, 2025." 10-K: "over **23,500** creators participated in our Developer Exchange Program" in 2025. Secondary: "<0.1% earn $100k+/month; ~85% earn <$100/month" (SQ Magazine summarising Roblox data) — **unverified**.
- **Counts of creators above $1M / $100k / $10k for 2025:** not disclosed in any source I could reach; **unverified**.
- **Sept 2026 report ("The Global Impact of Creation on Roblox", 3 Sep 2026):** US creators added **$752M** to US GDP in 2025 (+69%); ~**12,000** full-time-equivalent jobs supported globally.

### 1.9 Platform economics (context for per-user benchmarks)

- **FY2025 (10-K, 11 Feb 2026):** bookings **$6.788B (+55%)**, revenue **$4.891B (+36%)**, avg DAU **127M**, **123.9B hours** (2.7 h/DAU/day), **bookings per DAU $0.15/day**, **daily bookings per daily unique paying user $10.36**, 82% of DAU / 39% of revenue outside US+Canada.
- **Q3-2025:** DAU 151.5M; 45M peak concurrency (Aug 2025 weekend); **7 experiences with >10M DAU** at some point in Q3 — "Grow a Garden, Steal a Brainrot, Brookhaven, 99 Nights in the Forest, Plants Vs Brainrots, Ink Game and Blox Fruits" — five of them under 12 months old; monthly unique payers 35.8M; Roblox ≈3.2% of global gaming spend.
- **Q4-2025:** revenue $1.4B (+43%), bookings $2.2B (+63%), DAU +69%, hours 35B, monthly payers ~37M; **"Steal a Brainrot peaked at 25.4 million concurrent players."** 18+ cohort growing >50% and "monetizes 40% higher than younger cohorts"; 45% of global DAU age-checked by Jan 2026. FY-2026 guidance then: bookings +22–26%.
- **Q1-2026 (30 Apr 2026):** DAU 132M; **1.9M daily unique payers (≈1.4% of DAU)**; monthly unique payers 30.7M (+52%); **$18.78 bookings per monthly payer** (down from $19.92); daily bookings per daily payer $10.17. Guidance cut to bookings **+8–12%**, revenue +20–25%; management blamed top-of-funnel weakness from age checks and "the monetization bias of our recommendation engine" hurting app-store ratings.
- **Q2-2026 (30 Jul 2026):** revenue ~$1.5–1.6B (+36%), **bookings ~$1.6B (+8%)**, DAU **123M (+10%)**, hours 29B (+5%), net loss $185M, infrastructure & trust-and-safety expense +54% to $236M; Q3 bookings guide implied a decline; shares −14% after hours.

---

## 2. REVENUE BENCHMARKS

### 2.1 Named games

| Game | Owner / dev | Key dated facts | Revenue data (with quality flag) |
|---|---|---|---|
| **Grow a Garden** | Created by "BMWLux" (16) in ~3 days; released **25 Mar 2025**; Splitting Point Studios (Janzen "Jandel" Madsen) bought a stake **Apr 2025**; **Do Big Studios** bought a minority stake **end of May 2025** (GamePressure; Wikipedia summary) | 1B visits in 33 days; peak **21.3M CCU (21 Jun 2025)**, "nearly 22M" in July 2025, 22.3M Aug 2025; **35.3B visits by May 2026**; still >10M DAU in Q3 2025 | **$12M in May 2025** from Robux item sales (Calcalist/CTech, Aug 2025 — likely gross Robux value, basis **unverified**). Model estimate: **$286M lifetime** from 35.9B visits (profitable.app, Sep 2026; formula below) |
| **Steal a Brainrot** | SpyderSammy ("Sammy", CPO of Do Big Studios); owned by Do Big Studios; built in ~4 months; released 2025 | Only Roblox game past **25M CCU** (25.4M, Q4 2025); 42B visits (early 2026), ~57B (mid-2026, secondary); "average CCUs hit nearly a million" | **$11M/month est. July 2025 (+117%), 720M hours** (Creator Exchange on X, Aug 2025). Model: **$577.5M lifetime** from 72.4B visits (profitable.app, Aug 2026). YouTuber net-worth guesses for Sammy (~$30M) — **unverified** |
| **Blox Fruits** | Gamer Robot Inc. | Perennial top-3 earner | **$8–12M/month (2023–24), $8–14M/month (2026)**; lifetime est. **$510M** (RoWatcher / profitable.app models) |
| **Adopt Me!** | Uplift Games | Perennial | **$5–10M/month (2026 est.)**; lifetime est. **$356M** (profitable.app model) |
| **Dress to Impress** | — | 2024 hit, still updating | **$2–5M/month (est.)** |
| **99 Nights in the Forest** | — | >10M DAU in Q3 2025; **26B visits by Apr 2026**; iOS listing 2026 | No credible $ estimate found; secondary "~442K CCU peak" contradicts >10M-DAU status — **unverified** |
| **Plants vs Brainrots** | Yo Gurt Studio | >10M DAU Q3 2025; **3.5B+ visits; ~400K avg CCU** | No credible $ estimate found |
| **Fisch** | — | Dropped out of top-100 earners then "climbed back into the Top 15 earners" (2026) | No $ figure |
| **Ink Game** | — | Q3-2025 >10M DAU | **$3.2M/month est. Jul 2025 (+800%), 1.13B hours** (Creator Exchange, Aug 2025) |
| **Dead Rails** | — | 2025 hit | No data found |

**profitable.app estimation formula (as published):** lifetime visits × 2% "engagement" (payer) rate × 150 Robux average spend per paying visit × 70% developer share × $0.0038 → ≈ **$0.008 of developer cash per visit** (≈3 gross Robux/visit). Treat as an order-of-magnitude model, not a disclosure.

### 2.2 Rules of thumb for the genre

- **Gross Robux per visit (DevForum community benchmarks, via RoWatcher 2026):** simulators/tycoons **2–6 R$/visit**; typical games 0.6–1.2; obbies 0.1–0.4. At $0.0038 × 70%, 3 R$/visit ≈ $0.008 net per visit.
- **Payer conversion:** typical **1–3% of visitors/DAU spend Robux**; simulators/tycoons 2–3%; social/RP 1–2%. Individual DevForum reports: 0.66%, 1.2%. Platform-wide daily payer rate ≈ **1.4%** (Q1 2026). ARPPU anchors: **$10.36 bookings per daily paying user per paying day** (FY2025), **$18.78 per monthly payer** (Q1 2026) — these are consumer-dollar figures; the developer nets ≈ 22–27% of them (or ≈38% on US-18+ spend).
- **CCU → DAU:** avg CCU = DAU × (avg minutes per DAU per day / 1,440). Platform average 2.7 h/day ⇒ DAU ≈ 9× average CCU; for a game whose typical DAU plays 45–90 min/day, **DAU ≈ 16–32× average CCU**. Blog claims that "1,000 CCU ≈ 4,000 DAU" imply 6 h/user/day and are too optimistic on spend-per-CCU.
- **Revenue per 1,000 average CCU (developer net, my derivation):** 1,000 CCU ≈ 15–30k DAU; at 1.5–3% daily payers spending ~$5–10 gross on a paying day, gross bookings ≈ $1,100–9,000/day; developer net (25%) ≈ **$300–2,300/day**, i.e. **~$10k–70k/month per 1,000 CCU** for a well-monetised simulator. Community figures bracket this: "50,000–100,000+ Robux/day at ~1,000 CCU" for a well-designed simulator ($190–380/day, $70k–139k/year) vs. "$12–24/day" for a poorly monetised one (RoWatcher, 2026). **Grow a Garden at ~$12M in May 2025 with roughly 20–30M DAU works out to only ~$0.015–0.02 gross per DAU-day** — below the platform's $0.15 ABPDAU — showing these hits win on volume, not on per-user spend.
- **Unverified blog benchmark (GitHub design doc, 2026):** share of DAU buying anything — <1% poor, 2–4% average, 5–8% strong, 10%+ excellent; repeat-purchase rate ~50% average, 70%+ strong.

---

## 3. MONETIZATION DESIGN PATTERNS IN THE GENRE

### 3.1 Real price points

**Steal a Brainrot** (prices observed 2025–2026; note that regional/managed pricing means different players see different prices, which explains the spread across sources):

| Item | Type | Robux |
|---|---|---|
| 2x Money | Gamepass | **299** (reseller list 2025/26); 119 reported by guides in mid-2025 |
| VIP (longer base lock + earnings boost) | Gamepass | **499** (reseller); 199 / 375 in other guides |
| Admin Panel / Admin Commands | Gamepass | **7,499** (reseller); 1,999 / 7,999 in other guides |
| Blackhole Slap | Gear (dev product) | 199 |
| Flying Carpet | Gear | 375 |
| Laser Gun | Gear | 749 |
| Ban Hammer | Gear | 1,499 |
| Lucky Block – Mythic | Paid random item | 175 |
| Lucky Block – Brainrot God | Paid random item | 599 |
| Lucky Block – Secret | Paid random item | 2,399 |

Sources: Steal a Brainrot Fandom wiki "Gamepasses and Dev Products"; Sportskeeda VIP explainer; Deltia's Gaming; an Indonesian reseller Discord-bot price list on GitHub (Rupiah resale prices alongside Robux list prices). Secondary-market listings (PlayerAuctions scrapes, Apr 2026) show accounts sold with "Rebirth 15–16, 2x Money, Flying Carpet, Ban Hammer, 903T cash", illustrating the RMT market around the game.

**Grow a Garden**

| Item | Robux | Source |
|---|---|---|
| Season Pass – Premium track (50 levels; mutated pets, exotic seed packs) | **749** (Seasons 3 and 4) | Sportskeeda / Beebom 2025–26 |
| Skip one pass level | **49** | Beebom |
| Skip entire pass | **1,699** | Beebom |
| Infinite watering-can pass, pet/animal slot expansions, multipliers, premium eggs (random hatch), Sheckle packs "at ever-changing Robux amounts", Robux-enabled theft/PvP mechanics | prices **unverified** | NY Mag (Sep 2025); GitHub compliance memo (Jun 2026) citing Max Power Gaming's GaG monetization analysis |

**Generic ladder used across the genre** (GitHub design doc 2026, consistent with observed prices; treat ranges as **indicative**): starter pack 49–75 R$ (impulse), 2x multiplier 99–199, VIP 199–399, quality-of-life/auto-collect 199–399, premium bundle 499–999, ultra-premium/admin 999–7,999; currency packs 49/199/499 with 10–20% bonus; 30-min boosts 25–49 ("highest-converting type"); skip/refresh 49; crate/egg 99–199 ("regulatory risk").

### 3.2 The standard gamepass/dev-product set (catalogued)

- **Multipliers:** 2x cash/money, 2x speed, 2x luck, 2x XP — the core monetiser (99–299 R$).
- **VIP:** status tag + small boost; in SAB it also lengthens the base **lock** timer (defence), tying monetisation to the steal loop.
- **Base defence / shields / locks; extra base slots; extra pet/animal slots; auto-collect; rebirth skips.**
- **Admin/"god" passes** at 1,999–7,999 R$ — pure whale products (7,499 R$ ≈ $75–94 consumer, ≈ $20 net to the developer at $0.0038 after 70% share… precisely 7,499 × 0.7 × 0.0038 ≈ **$19.95**, or **$28.35** if the buyer is a verified US adult).
- **Dev products:** cash/Sheckle packs, lucky blocks/eggs/crates, "secret" units, gear (weapons/traps/mobility), event currency, level skips.
- **Season/battle pass:** free + premium tracks; Roblox's own design guidance: ~1-month seasons, ~10 tiers to start, ≥1-week rest between seasons; premium pass should be priced "to the value of the rewards"; award all previously completed premium tiers on mid-season upgrade.
- **Roblox first-purchase levers:** analytics doc recommends "welcome discounts for first-time buyers" and purchase-funnel analysis; Roblox Plus gives subscribers 10–20% off at no cost to the creator (effective 78–88% share), and contextual-purchase docs cite Doors (pre-run shop), Dress to Impress (intermission offers), Adopt Me (loading-screen modals), Bee Swarm (complementary-pass prompts).
- **Trading economies:** Adopt Me is the canonical trade-driven economy (Naavik deep-dive; page blocked, details **unverified**). Roblox policy: paid-random-item outcomes can be traded only where `PolicyService.IsPaidItemTradingAllowed` is true; some regions block it.
- **FOMO / limited-time:** weekly events and limited seeds/units; Roblox's economy-balancing doc explicitly recommends "a unique event currency that is only used to purchase items from a special event shop" to isolate the main economy.
- **Whales:** ARPPU anchors above; Roblox's analytics doc warns "a high ARPPU and low ARPDAU suggest revenue comes from a limited user subset."
- **Paid random items:** must display every outcome and exact percentage odds summing to 100% before purchase (a "Details" button is allowed for long lists); pity/luck modifiers count as paid random items; odds must update as one-off outcomes are exhausted; `ArePaidRandomItemsRestricted` users must get a non-random path or no access. A 2025 DevForum clarification thread exists (id 4654622; page blocked).
- **Managed pricing:** regional prices never <30% or >100% of list; price optimisation runs ~3-week A/B tests, needs **≥60,000 transactions in 30 days**, re-runs every ≤90 days, applies only if incremental revenue is positive.
- **Rewarded video ads** (opt-in ads for in-game currency): live for 140+ onboarded creators as of Q3 2025; publisher needs ≥2,000 unique visitors/month, ID verification, 2FA, approved maturity questionnaire; paid on EPM (Robux per 1,000 impressions, no rate published). A GitHub note claims GaG runs rewarded video — **unverified**.

### 3.3 Conversion / ARPDAU / ARPPU evidence from developers

- DevForum threads (2024–2026): "Best way to increase ARPPU in my game with a 0.66% conversion rate?"; a developer with **1.2% payer conversion** called it "fairly good"; "Payer conversion rate and ARPDAU decreasing as game gains more popularity" (a well-known effect: viral traffic dilutes the payer mix).
- Roblox Creator Hub definitions: payer conversion = % of DAU who are paying users; ARPDAU = conversion × ARPPU.
- Generic ranges (search summary of creator-hub-adjacent guides): **1–3% overall, 2–3% simulators/tycoons, 1–2% social/RP.**

---

## 4. COST SIDE

### 4.1 Talent (contractors) — 2025–2026

| Role | Rate | Source / date |
|---|---|---|
| Luau scripter, mid-level, short scope | **$15–40/hr** | Game-Ace hiring guide (2026) summarising Talent Hub |
| Senior systems engineer with shipped titles | **$50–120+/hr** | same |
| Blended multi-role studio | **$30–70/hr** | same |
| Long-term scripter retainer (older DevForum listing) | $350–450/month + revenue % | DevForum, 2020 (dated) |
| Low end of market | Fiverr gigs offering a "full Steal a Brainrot / Grow a Garden clone" for **$20** | Fiverr listing, 2026 |
| Builders, 3D modelers, UI, thumbnail/icon artists via Hidden Developers / Talent Hub | **No reliable 2026 rate card reachable — unverified.** Anecdotally thumbnails trade at tens of dollars to low hundreds each. | — |

DevForum sentiment (2024–2026): well-paid commissions are scarce and many postings offer derisory pay ("$5 for an entire game"), so quality talent is typically retained on revenue share (%) rather than hourly.

### 4.2 Team sizes for the hits

- **Grow a Garden:** one 16-year-old built it in ~3 days (Mar 2025); Splitting Point Studios (Jandel) joined in Apr 2025 to run live-ops; Do Big Studios took a minority stake in late May 2025. Exact headcount **unverified**.
- **Steal a Brainrot:** SpyderSammy built it in ~4 months; operated under Do Big Studios (Sammy is its Chief Product Officer). Headcount **unverified**.
- Roblox's guidance and both cases point to a **2–6 person core** (scripter, builder/modeler, UI, artist, community/live-ops) for this genre.

### 4.3 Roblox Ads Manager (paid UA on-platform) — official docs + 2026 benchmarks

- **Formats:** Sponsored experience tiles on Home (bid on **max cost-per-play, CPP**, or auto-bid), search ads (second-price auction; winner pays the next bid adjusted for relevance + $0.01), immersive ads (image/video/portal; publishers paid per impression/teleport), sponsored items.
- **Billing:** cards (initial **$5** charge, **$100** threshold billing, **$300/day** card spend limit) or **ad credits** bought with Robux (irreversible; US-18+-rate Robux converted first; minimum 1 credit). Fraud review 14 days after campaign end, refunds by day 16. Targeting: location, age, gender, genre, device, and audience segments (all/new/recent/lapsed).
- **Benchmarks (BLOXG, data from 850+ promoted games, updated Mar 2026):** sponsored experiences **$0.10–0.50 per click**; immersive ads **$1–5 CPM**; minimum budget $1/day, **$10–50/day recommended for testing**. Roblox notes "the highly engaged player audience is smaller … typically results in a higher CPP."
- **Creator-marketplace (Roblox-native video/promo networks) CPMs:** ~$0.50–1.50 per 1,000 views; funnel example: $1,000 at $0.75 CPM → ~1.3M views → 0.5% → ~6,500 visits → 25% D1 → ~1,600 retained (GitHub design doc 2026; **indicative**).
- **Launch budgets used by top studios:** no verifiable disclosure; DevForum thread "Sponsorship Costs and Long-Term CCU Stability" was unreachable. **Unverified.**

### 4.4 Influencer / YouTube / TikTok sponsorships

- Roblox-specific YouTubers (BLOXG / Hypertube 2026): **50–200k subs $200–1,000/video; 200k–1M $1,000–5,000; 1M+ $5,000–25,000+**. Influencer campaigns average **$0.05–0.20 per new player** (850+ campaigns, BLOXG).
- General YouTube rate cards 2026 (Influencer Marketing Hub): nano $50–500; micro $200–5,000; mid $1,500–25,000; macro $5,000–80,000; mega $15,000–250,000+. Gaming CPMs are among the lowest ($15–25).
- Roblox YouTubers monetise poorly on AdSense (young audience) — a 100k-sub channel nets ~$100–400/month from ads — so sponsorships and Robux/gamepass deals are their real income (Hypertube 2026), which keeps sponsorship prices comparatively low.

### 4.5 Platform costs

- Hosting, storage, matchmaking, moderation and payment processing are borne by Roblox (10-K); creators pay nothing to publish. Avatar-item uploads cost 80 R$ (500 R$ for emissive) — irrelevant to most sim games.

---

## 5. RISK

### 5.1 Chargebacks, refunds and DevEx holds

- Roblox's docs do not publish a chargeback policy for creators. Known mechanics: DevEx **excludes** Robux from moderated/violative content and from "passes from template games lacking legitimate visits"; Robux submitted for DevEx are **removed and held during review** and returned only if rejected; Roblox "reserves the right to decline" any request over ToU/spirit-of-program violations (Roblox Support DevEx FAQ).
- DevForum cases 2025–2026: "Devex Declined, Roblox withholding 40k+ USD" (thread 4067404); a developer declined as "not eligible" repeatedly for 300+ days; new-account denials. Pattern: appeals go through support with limited transparency.
- Fraudulent Robux purchases are reversed by Roblox; developers can lose the Robux (and Roblox can drive accounts negative) — widely reported practice, **unverified** from primary docs this session.
- Ad-credit spend is non-refundable to Robux.

### 5.2 Moderation exposure specific to this genre

- **Gambling:** Roblox's experience guidelines define gambling as "exchanging real world money, Robux, or in-experience items of value for a game of chance" — **playable gambling is prohibited**; only depictions (13+ rating) are allowed. Lucky blocks/eggs/crates survive as **"paid random items"** only with full odds disclosure and `PolicyService` compliance; luck boosts and pity systems are explicitly in scope.
- **Trading of paid random outcomes** must be blocked for users where `IsPaidItemTradingAllowed` is false.
- **Ratings/questionnaire:** unrated experiences default to 13+ treatment and lose Home-page eligibility; misrepresentation triggers moderation. A 2026 "new publishing requirements / evaluation process" (DevForum 4573166) gates reach to under-16 audiences behind creator ID verification, 2FA, a "Minimal" maturity questionnaire and an evaluation trial — this directly affects kid-heavy genres like GaG/SAB.
- **IP:** "brainrot" characters are AI-generated meme content of ambiguous ownership; the genre is flooded with clones ("Steal a …" variants). Roblox launched an **IP licensing platform** (2025; Mattel, Kodansha on board) which raises the bar for unlicensed IP use. Specific takedowns of SAB clones: **unverified**.
- **18+ rate eligibility** can be lost via compliance checks (e.g., any R6 avatar spawn).
- Roblox's own 10-K risk language: viral-hit engagement "has generally not been sustainable" and "our results have generally moderated as peak engagement of viral experiences naturally declines."

### 5.3 Lawsuits and regulatory attention (2025–2026)

- **Federal MDL:** the Judicial Panel on Multidistrict Litigation consolidated Roblox child-safety cases in the **Northern District of California in December 2025**; **≥182 cases** by mid-2026 (law-firm trackers, Sep 2026). Individual suits include *Doe v. Roblox* (E.D. Pa., filed 29 Jul 2025, with Snap) and *Doe v. Roblox & Discord* (N.D. Cal., Apr 2025).
- **State attorneys general:** suits by **Texas** (Paxton), **Florida, Iowa, Tennessee**, **Nebraska (Mar 2026)** and **Oklahoma (May 2026)**, among others; a Roblox–Attorney General Alliance child-safety coalition was announced Oct 2025.
- **Settlements:** ~**$54M** across five states by July 2026 — **Nevada $12M**, **Mississippi $9M**, **Alabama $12.2M**, **Virginia $11M**, **South Dakota ~$10M over four years (13 Jul 2026)**; an April 2026 report cited $35.8M at that point. Settlements require age verification and youth protections.
- **Gambling:** Roblox's 10-Q states it "has become subject to regulatory investigations and/or legal proceedings relating to claims … that the Company has facilitated gambling by users of the Platform, including by minors"; a federal judge approved a settlement with third-party Robux-gambling sites in the Roblox litigation (MLex, 2026; details **unverified**).
- **Business impact already visible:** age-check rollout (facial age estimation; 45% of DAU by Jan 2026; un-checked users lose chat) plus removal of "monetization bias" from recommendations → Q1–Q2 2026 DAU contraction, bookings growth collapsing from +63% (Q4 2025) to +8% (Q2 2026), FY-2026 bookings guidance cut to +8–12%, T&S spend +54%. For creators this means slower organic discovery, a smaller under-13 funnel, and more compliance work — but also a 42% richer cash-out rate on verified-adult spend.

### 5.4 Practical implications for a new "Steal a…/Grow a…" style game (analyst view)

1. Budget for **~25% of consumer spend** reaching your bank (≈$0.0027 per Robux of list price at 70% share), rising to ~38% only for age-verified US adults in R15-compliant games.
2. Cash flow lag: 60-day hold on Creator Rewards, 30-day cadence on DevEx, 1–3 weeks processing, and any hold on review.
3. Design paid-random items to Roblox's odds-disclosure spec from day one; keep a non-random purchase path for restricted regions.
4. Plan UA in the $10–50/day test range on Ads Manager, and $200–5,000 per mid-tier YouTube integration; expect $0.05–0.50 per acquired player.
5. Expect per-DAU monetisation in this kid-heavy genre to sit **below** the platform's $0.15 ABPDAU; the business case rests on retention-driven volume and event cadence, not ARPPU.

---

## Sources

### Official Roblox documentation (read via the Roblox/creator-docs GitHub mirror, 19 Sep 2026)
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/developer-exchange.md (and raw: https://raw.githubusercontent.com/Roblox/creator-docs/main/content/en-us/production/monetization/developer-exchange.md)
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/18-plus-devex-rate.md
- https://github.com/Roblox/creator-docs/commits/main/content/en-us/production/monetization/18-plus-devex-rate.md
- https://github.com/Roblox/creator-docs/commits/main/content/en-us/production/monetization/developer-exchange.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/creator-rewards.md (raw current and launch versions: https://raw.githubusercontent.com/Roblox/creator-docs/main/content/en-us/creator-rewards.md ; https://raw.githubusercontent.com/Roblox/creator-docs/9ca2287/content/en-us/creator-rewards.md)
- https://github.com/Roblox/creator-docs/commits/main/content/en-us/creator-rewards.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/engagement-based-payouts.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/roblox-plus.md (+ commit history)
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/robux-transfers.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/paid-random-items.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/tax-information.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/devex-portal.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/subscriptions.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/private-servers.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/paid-access-robux.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/passes.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/developer-products.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/managed-pricing.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/price-optimization.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/regional-pricing.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/immersive-ads.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/marketplace/marketplace-fees-and-commissions.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/analytics/monetization.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/ads-manager.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/reporting-and-billing.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/advertise-on-roblox.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/search-ads.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/rewarded-video-ads.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/experience-guidelines.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/share-links.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/referral-system.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/monetization-foundations.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/balance-virtual-economies.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/season-pass-design.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/contextual-purchases.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/roblox-user-base.md
- Canonical (blocked this session, referenced): https://create.roblox.com/docs/production/monetization/developer-exchange ; https://create.roblox.com/docs/creator-rewards ; https://create.roblox.com/docs/production/monetization/18-plus-devex-rate ; https://create.roblox.com/docs/production/promotion/ads-manager ; https://create.roblox.com/docs/production/analytics/monetization ; https://create.roblox.com/docs/monetize

### Roblox financial filings and earnings calls (verbatim quotes hosted on GitHub)
- RBLX Q4-2025 earnings-call transcript (5 Feb 2026): https://raw.githubusercontent.com/Ngafney/garda-spring26/c207d258165d9626cf027b34e41d6ebb62761430/amir/transcripts/roblox/2025/Q4/RBLX_2026-02-05_Q4.txt
- RBLX Q3-2025 earnings-call transcript (30 Oct 2025): https://raw.githubusercontent.com/vanillefatale/earnings-transcripts/62e284866e182d04e5a56e5168eafa7f6e19aeb3/docs/translated/3Q25/RBLX_3Q25_translated_output.html
- Evidence dossier quoting the FY2025 10-K (11 Feb 2026), Q1-2026 10-Q (30 Apr 2026), Q1-2026 call and supplementals: https://github.com/marginofdanger/marginofdanger.github.io/blob/a741c81d67818734a5b2a457841eafa4ce4d5288/deep-dives/dossiers/RBLX_codex/evidence.html
- SEC filings (blocked this session, referenced): https://www.sec.gov/Archives/edgar/data/0001315098/000162828026051082/rblx-20260630.htm (Q2-2026 10-Q) ; https://www.sec.gov/Archives/edgar/data/0001315098/000162828026051059/ex991-robloxq22026earnin.htm (Q2-2026 shareholder letter) ; https://www.sec.gov/Archives/edgar/data/0001315098/000162828026028904/rblx-20260331.htm (Q1-2026 10-Q)
- Q2-2026 coverage: https://www.gurufocus.com/news/8993610/roblox-corp-rblx-q2-2026-earnings-call-highlights-revenue-surges-36-to-15b-but-q3-bookings-forecast-signals-sharp-decline ; https://www.investing.com/news/transcripts/earnings-call-transcript-roblox-q2-2026-beats-eps-but-shares-sink-on-bookings-93CH-4826338 ; https://www.investing.com/news/company-news/roblox-q2-2026-slides-revenue-rises-36-as-bookings-growth-stalls-93CH-4826381 ; https://respawn.outlookindia.com/gaming/gaming-news/roblox-q2-2026-revenue-soars-36-to-15b-despite-bookings-miss ; https://www.gamingamigos.com/post/roblox-q2-2026-results ; https://www.insiderfinance.io/news/roblox-q2-earnings-weigh-on-guidance-after-safety-changes
- Q2-2025 coverage: https://www.pocketgamer.biz/roblox-revenue-up-36-yy-as-grow-a-garden-and-steal-a-brainrot-drive-multiple-milestones/ ; https://www.gamedeveloper.com/business/roblox-s-grow-a-garden-had-nearly-22-million-concurrent-users-in-july
- Creator payouts / margins: https://finance.yahoo.com/markets/stocks/articles/roblox-raises-creator-payouts-margins-155100105.html ; https://www.tipranks.com/news/the-fly/roblox-says-on-track-to-pay-out-1b-to-creators-in-2025-thefly ; https://games.gg/news/roblox-revenue-hits-4-billion-in-2025-boosted-by-grow-a-garden/

### Roblox economic-impact reports and newsroom
- https://about.roblox.com/newsroom/2025/09/roblox-annual-economic-impact-report (Sept 2025)
- https://about.roblox.com/newsroom/2026/09/global-impact-of-creation-on-roblox (Sept 2026)
- https://ir.roblox.com/news/news-details/2026/Roblox-Creators-Added-752-Million-to-the-U-S--Economy-in-2025-a-69-Increase-From-2024/default.aspx ; https://www.businesswire.com/news/home/20260903230812/en/Roblox-Creators-Added-%24752-Million-to-the-U.S.-Economy-in-2025-a-69-Increase-From-2024 ; https://finance.yahoo.com/economy/articles/roblox-creators-added-752-million-160000116.html ; https://www.stocktitan.net/news/RBLX/roblox-creators-added-752-million-to-the-u-s-economy-in-2025-a-69-x1y6oe4y6zbb.html
- https://sqmagazine.co.uk/roblox-game-creation-and-monetization-statistics/ ; https://rolearn.dev/trend-reports/creator-economy-2025-report/ ; https://rolearn.dev/insights/roblox-developer-revenue-share-2026/ ; https://gamedevreports.substack.com/p/roblox-top-100-roblox-developers ; https://www.shanethegamer.com/research/roblox-creator-economy-analysis/ ; https://profitable.app/roblox/stats

### DevEx, Creator Rewards, Roblox Plus (secondary)
- https://en.help.roblox.com/hc/en-us/articles/13061189551124-Developer-Exchange-Help-and-Information-Page ; https://en.help.roblox.com/hc/en-us/articles/27954482561300-DevEx-Eligibility-General-Questions
- https://devforum.roblox.com/t/introducing-the-us-18-devex-rate-earn-42-more-on-spend-from-18-us-players/4607091
- https://rohire.dev/blog/2026-devex-cheat-sheet ; https://devex.gg/ ; https://devex.gg/18-plus-devex-rate ; https://mathgyro.com/robux-devex-rates/ ; https://bloxsniper.cc/blog/devex-rates-2026 ; https://rblxtax.com/devex
- https://roblox.fandom.com/wiki/Creator_Rewards ; https://roblox.fandom.com/wiki/Engagement-Based_Payouts ; https://rolearn.dev/insights/roblox-creator-rewards-payout-guide/ ; https://www.spaceport.xyz/blog/roblox-developer-rewards-changes ; https://generalistprogrammer.com/tutorials/roblox-premium-payouts-explained ; https://loottally.com/premium-payouts-calculator ; https://x.com/Bloxy_News/status/1937566184305774609
- https://devforum.roblox.com/t/shorten-the-hold-period-of-engagement-payouts-or-restore-the-old-premium-payouts-system/3956591
- https://www.tubefilter.com/2026/04/13/roblox-plus-creator-payouts/ ; https://www.pcgamesn.com/roblox/plus-subscription ; https://games.gg/news/roblox-plus-subscription-replaces-premium/ ; https://www.shanethegamer.com/esports-news/roblox-plus-subscription-price-features-premium-comparison/ ; https://axeetech.com/is-roblox-plus-replacing-premium/ ; https://blx.gg/blog/roblox-plus-a-complete-breakdown-of-the-premium-transition-2026 ; https://roblox.fandom.com/wiki/Roblox_Premium

### Robux prices
- https://coingate.com/gift-cards/articles/article/how-to-buy-robux ; https://progameguides.com/roblox/roblox-price-guide-how-much-do-robux-cost/ ; https://gamtova.com/news/how-much-robux-do-you-get-for-1-5-and-10-robux-prices-in-2026 ; https://www.gamsgo.com/blog/robux-prices ; https://gameseal.com/blog/roblox-price-guide-how-much-robux-can-you-get-for-a-dollar ; https://www.g2a.com/news/features/roblox-price-robux-cost-per-dollar-guide/ ; https://gamecratex.com/robux-mobile-vs-pc/ ; https://calcbrew.com/robux-to-usd
- NY Magazine (Sept 2025) mirrored: https://github.com/AramZS/aramzs.xyz/blob/2c1122205e6bf21d5afd9e34d20939d371b819df/src/content/amplify/2025/09/09/2025-09-09-httpsnymagcomintelligencerarticlewhat-is-roblox-video-game-app-metaverse-safe-children-banhtml.md

### Game revenue and stats
- https://www.calcalistech.com/ctechnews/article/dj4lxef8r (Grow a Garden, $12M May 2025) ; https://en.wikipedia.org/wiki/Grow_a_Garden ; https://en.wikipedia.org/wiki/Steal_a_Brainrot ; https://profitable.app/roblox/games/grow-a-garden ; https://profitable.app/roblox/games/steal-a-brainrot ; https://profitable.app/tools/roblox-revenue-calculator ; https://profitable.app/roblox/developers
- https://x.com/CreatorExc/status/1952868682096574520 (Creator Exchange July-2025 estimates)
- https://gamesbeat.com/janzen-madsen-interview/ ; https://www.gamepressure.com/newsroom/did-jandel-sell-grow-a-garden-heres-the-story-so-far/z186ab ; https://gamertweak.com/did-jandel-sell-grow-a-garden/ ; https://legalclarity.org/who-owns-grow-a-garden-roblox-studios-explained/ ; https://bloxultra.com/blog/spydersammy-steal-a-brainrot-creator-guide ; https://fandomwire.com/who-is-steal-a-brainrot-creator-sammy-face-reveal-net-worth/
- https://fourweekmba.com/roblox-revenue/ ; https://rowatcher.com/news/the-10-highest-earning-roblox-games-in-2026-and-what-they-mean-for-the-platform ; https://naavik.co/deep-dives/roblox-blox-fruits-brookhaven-adopt-me/ ; https://games.gg/news/roblox-top-earning-games-in-june-2025/ ; https://games.gg/news/roblox-top-games-of-september/ ; https://en.wikipedia.org/wiki/Dress_to_Impress_(video_game) ; https://fandomwire.com/top-10-roblox-games-made-their-creators-rich/ ; https://www.roblox.com/charts ; https://apps.apple.com/us/app/id6755978698
- GitHub design doc with SAB/GaG stats: https://raw.githubusercontent.com/BlissDirective/Roblox-Game-Design/d1b82b7401dcde98cd214230c84bc7d97fc8bce0/docs/04_VIRAL_MECHANICS.md ; https://raw.githubusercontent.com/BlissDirective/Roblox-Game-Design/d1b82b7401dcde98cd214230c84bc7d97fc8bce0/docs/05_MONETIZATION.md ; https://raw.githubusercontent.com/BlissDirective/Roblox-Game-Design/d1b82b7401dcde98cd214230c84bc7d97fc8bce0/docs/01_05_monetization_addition.md
- https://github.com/LouisRosche/RB.Game/blob/822b54446f770ff41581080d4a1ac18283e5fa6c/research/01-strategic-foundation.md (unsourced stats, flagged)

### Rules of thumb, conversion, ARPDAU
- https://rowatcher.com/news/devex-math-in-2026-what-you-actually-take-home-per-1-000-players ; https://rowatcher.com/news/the-roblox-income-ladder-what-developers-really-earn ; https://calcbrew.com/roblox-earnings-calculator
- https://devforum.roblox.com/t/how-to-make-my-game-profitable/2223387 ; https://devforum.roblox.com/t/how-much-robux-would-one-have-to-put-into-a-game-to-make-it-have-a-good-amount-of-concurrent-players/717848
- https://devforum.roblox.com/t/best-way-to-increase-arppu-in-my-game-with-a-066-conversion-rate/2875348 ; https://devforum.roblox.com/t/payer-conversion-rate-and-arpdau-decreasing-as-game-gains-more-popularity/3898921 ; https://devforum.roblox.com/t/incredibly-low-arpdau-average-revenue-per-paying-users/3454473 ; https://devforum.roblox.com/t/very-low-arppu-in-floor-race/3566999 ; https://devforum.roblox.com/t/payer-conversion-rate-0-and-paying-users-0-but-daily-revenue-and-arpdau-is-not-nothing/3755808
- https://www.businessofapps.com/data/roblox-statistics/ ; https://www.gameanalytics.com/blog/how-to-calculate-arpu-arppu-arpdau-and-more

### Monetization design / prices
- https://stealabrainrot.fandom.com/wiki/Gamepasses_and_Dev_Products ; https://stealabrainrot.fandom.com/wiki/Gamepasses ; https://www.sportskeeda.com/roblox-news/steal-brainrot-vip-gamepass-explained ; https://deltiasgaming.com/roblox-steal-a-brainrot-all-gear-and-game-passes/ ; https://www.u4gm.com/steal-a-brainrot/blog-steal-a-brainrot-vip-gamepass-benefits ; https://www.rolimons.com/game/109983668079237 ; https://www.itemku.com/en/g/steal-a-brainrot/gamepass ; https://www.rpgstash.com/roblox-store/steal-a-brainrot/
- Reseller price list (GitHub): https://github.com/PsychoNautss/raura-store-bot/blob/38e802874dbd792721e62dd03006dea3be37a61f/bot.js ; RMT account listings scrape: https://github.com/shreyasnan/Roblox-Accounts-Monitoring
- https://www.sportskeeda.com/roblox-news/grow-garden-season-3-pass-guide-premium-price-rewards ; https://www.sportskeeda.com/roblox-news/grow-a-garden-season-pass-4-guide-all-rewards-premium-price ; https://beebom.com/grow-a-garden-season-pass-guide/ ; https://www.rolimons.com/game/126884695634066 ; https://www.itemku.com/en/product/grow-a-garden-premium-pass---grow-a-garden-robux-all-day/3838667
- https://medium.com/@alvarlaigna/robloxs-grow-a-garden-a-predatory-scam-targeting-kids-2b05e34e4d43 ; https://www.maxpowergaming.co/post/inside-the-monetization-playbook-of-roblox-s-biggest-hit ; https://freesystems.substack.com/p/the-algorithm-behind-steal-a-brainrot
- GaG monetization memo (GitHub, Jun 2026): https://github.com/timothyallyndrake/roblox/blob/c521bea5a3f74979da348eb7af9b4a74ece66a10/studio/loops/runs/2026-06-28-compliance-feasibility-starlit-conservatory/research/003-monetization-model-recommendation.md ; policy screen: https://raw.githubusercontent.com/timothyallyndrake/roblox/c521bea5a3f74979da348eb7af9b4a74ece66a10/studio/loops/runs/2026-06-28-compliance-feasibility-starlit-conservatory/research/001-roblox-policy-screen-starlit-conservatory.md
- Roblox policy threads referenced there: https://devforum.roblox.com/t/clarifying-requirements-for-paid-random-items/4654622 ; https://devforum.roblox.com/t/guidelines-around-users-paying-for-random-virtual-items/307189 ; https://devforum.roblox.com/t/new-publishing-requirements-evaluation-process-for-games/4573166 ; https://about.roblox.com/newsroom/2025/08/extending-roblox-policy-on-romantic-and-sexual-content ; https://en.help.roblox.com/hc/en-us/articles/15869919570708-Restricted-Content-Policy

### Costs: talent, ads, influencers
- https://game-ace.com/blog/how-to-hire-the-best-roblox-game-developer/ ; https://ropage.gg/blog/how-to-price-roblox-scripting-commissions ; https://devforum.roblox.com/t/350450-usd-per-month-and-hiring-a-long-term-scripter/789157 ; https://devforum.roblox.com/t/how-much-should-i-pay-scripters-long-term/1334075 ; https://devforum.roblox.com/t/what-is-a-fair-price-to-pay-game-builders-and-scripters-in-robux-or-usd/3027798 ; https://devforum.roblox.com/t/its-way-too-hard-finding-quality-projects-on-the-talent-hub/1747965 ; https://www.fiverr.com/barnabasjenny/do-roblox-full-game-creation-steal-a-brainrot-grow-a-garden-or-simulator-game
- https://bloxg.com/statistics/roblox-advertising-benchmarks ; https://bloxg.com/guides/roblox-ads-guide ; https://bloxg.com/guides/roblox-influencer-guide ; https://bloxg.com/roblox-youtube-promotion ; https://www.guptamedia.com/insights/roblox-advertising ; https://devforum.roblox.com/t/sponsored-experiences-moving-to-ads-manager/2661756 ; https://devforum.roblox.com/t/what-is-cost-per-play/2908034 ; https://devforum.roblox.com/t/sponsorship-costs-and-long-term-ccu-stability/3121727
- https://hypertube.io/blog/how-much-do-roblox-youtubers-really-make-2026-data ; https://influencermarketinghub.com/influencer-rates/youtube-influencer-rates/ ; https://outlierkit.com/resources/youtube-sponsorship-rates/ ; https://www.vivianagency.com/how-much-do-sponsors-pay-youtubers/ ; https://influencerfee.com/blog/youtube-influencer-pricing/ ; https://www.rolimons.com/promotionrates ; https://milx.app/en/cases/youtube-sponsorship-rates-how-much-do-sponsors-really-pay

### Risk: DevEx holds, moderation, lawsuits
- https://devforum.roblox.com/t/devex-declined-roblox-witholding-40k-usd-i-dont-know-what-to-do-anymore/4067404 ; https://devforum.roblox.com/t/denied-for-the-3rd-time-in-devex-for-absolutely-no-reason/2709928 ; https://devforum.roblox.com/t/roblox-keeps-rejecting-my-devex/2703612 ; https://devforum.roblox.com/t/does-roblox-deny-devex-requests-from-new-accounts/2522111 ; https://devforum.roblox.com/t/any-insight-as-to-why-my-devex-request-was-denied/2051345 ; https://devforum.roblox.com/t/devex-declined-and-requirements-questions/2785958
- https://ago.nebraska.gov/nebraska-attorney-general-hilgers-files-lawsuit-against-roblox-enabling-child-exploitation-and ; https://oklahoma.gov/oag/news/newsroom/2026/may/drummond-files-lawsuit-against-roblox-for-endangering-children-and-deceiving-parents.html ; https://hoodline.com/2026/05/oklahoma-ag-rips-roblox-as-predator-playground-in-explosive-child-safety-suit/ ; https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-sues-roblox-putting-pixel-pedophiles-and-profits-over-safety-texas
- https://www.claimsjournal.com/news/national/2026/04/22/337051.htm ; https://southdakotasearchlight.com/2026/07/13/10-million-settlement-over-online-gaming-child-exploitation-will-fund-safety-after-school-efforts/ ; https://www.rutlandherald.com/news/business/roblox-gaming-platform-reaches-12-million-settlement-with-nevada-enhancing-youth-protections/article_62e5e9c9-4af8-5612-b1a4-93539f2c99d5.html ; https://tech-insider.org/roblox-lawsuit-2026/ ; https://openclassactions.com/news/roblox-lawsuits-settlement-child-exploitation-2026.php
- https://www.lawsuit-information-center.com/roblox-sex-abuse-lawsuit.html ; https://www.consumernotice.org/legal/roblox-lawsuit/ ; https://www.simmonsfirm.com/complex-litigation/sexual-abuse/roblox/ ; https://vanlawfirm.com/blog/roblox-lawsuits-explained-what-to-know-in-2026/ ; https://www.robertkinglawfirm.com/mass-torts/video-game-addiction-lawsuit/roblox-lawsuit/
- https://www.mlex.com/mlex/articles/2486070/us-federal-judge-approves-settlement-with-gambling-sites-in-roblox-litigation
- Court dockets (via GitHub litigation dataset): https://www.courtlistener.com/docket/70951549/doe-v-roblox-corporation/ ; https://www.courtlistener.com/docket/69926441/doe-v-roblox-corporation/
