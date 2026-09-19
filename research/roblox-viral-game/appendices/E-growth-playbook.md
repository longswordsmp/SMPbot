# How Simple Viral Roblox Games Get Discovered and Grow to Millions of Players
## The complete growth / virality playbook (research snapshot: September 19, 2026)

---

## 0. Method, scope and confidence

- **Research window:** compiled September 19, 2026. Facts are dated inline. "Today" in this document means Sept 19, 2026.
- **How this was gathered:** 20 successful web searches (each returned a summarized excerpt of the linked pages). The sandbox's egress proxy blocked *every* direct page fetch attempted (Roblox Creator Hub, DevForum, Roblox newsroom, Wikipedia, GameDeveloper, VentureBeat, Fandom, GameAnalytics, Yahoo Finance, X, Hypertube, SponsorRadar, etc.), and the session's search quota was exhausted after 20 queries. Consequently:
  - Facts labelled **[S]** come from a search excerpt and carry the URL in the Sources section.
  - Facts labelled **[BK - unverified]** come from the analyst's background knowledge (training data through mid-2026) and were **not** re-verified in this session. Treat them as leads to confirm, not as citations.
  - Where the two disagree, trust [S].
- **What this document does NOT contain:** verbatim quotes from the DevForum announcement threads, the exact per-signal weights Roblox published in June 2026, verified Discord member counts for Grow a Garden / Steal a Brainrot, verified per-creator sponsorship price lists, and Reddit postmortem quotes. Each is listed in Section 9 (Gaps) with the exact URL to open.

---

## 1. Executive summary - the playbook in one page

1. **Discovery on Roblox is algorithmic, not editorial, and Home "Recommended For You" (RFY) is the main faucet.** Roblox has now told creators exactly what it optimizes: a *qualified play-through rate* (qPTR - the share of people who see your tile and go on to play a "qualified" session) at the top of the funnel, and **28-day retention split into Day 1 / Day 2-7 / Day 8-28 buckets** underneath it (June 15, 2026). Since August 20, 2026 it is testing an extra reward for games that are strong on **both retention and monetization**. [S]
2. **The tile is the ad.** qPTR is heavily driven by the icon + name; Roblox's own thumbnail-personalization tool produced an average **+8.5% qPTR (some +50%)** at launch (Feb 13, 2025) and **+12% average across 8,000+ experiences** shortly after. Icons still cannot be A/B tested natively as of May 2026; top studios rotate icons and read qPTR windows in Creator Hub. [S]
3. **The "cold start" for the 2025-26 mega-hits was almost never ads - it was YouTube.** Dead Rails went from hundreds of CCU to 100k+ after Flamingo (2M+ views), KreekCraft, Thinknoodles and Sketch covered it; Steal a Brainrot's first wave came from Infinite and Foltyn videos. Sponsored ads (Ads Manager) are used to buy the first few hundred players and validate retention, at reported costs anywhere from ~$0.02 to ~$1.00 per play depending on icon quality. [S]
4. **Meme-timing beats budget.** Steal a Brainrot (released May 16, 2025) bolted the TikTok "Italian brainrot" AI-character meme onto a licensed "Steal a ___" loop and went 1.5M CCU (Jul 3) -> 5.2M (Jul 13) -> 10M (Aug 1) -> 24M (Sept 13) -> ~25.4M (Oct 2025). [S]
5. **Live-ops is a fixed weekly ritual.** The Do Big / Splitting Point family (Grow a Garden, Steal a Brainrot, Plants vs Brainrots, Steal an Egg) ships **every Saturday**, pairs the patch with a developer-hosted **"admin abuse"** livestream event, and uses countdowns and teasers to concentrate the whole playerbase into one spike that the charts and RFY then amplify. A whole third-party ecosystem of countdown/"abuse time" sites exists purely to track these. [S]
6. **Manufactured rivalry is the biggest lever anyone has pulled.** The Aug 23, 2025 "Admin Abuse War" between Jandel (Grow a Garden) and Sammy (Steal a Brainrot), with KreekCraft, MrBeast and PokeDaily taking sides, pushed Grow a Garden to 22.3M CCU, Steal a Brainrot past 20M, and Roblox to a platform record **47.4M CCU** (vs 32.69M in July 2025). [S]
7. **Names are the mechanic in three words.** "Steal a ___", "Grow a ___", "___ vs Brainrots", "99 Nights in the Forest" each state the loop, are searchable, and clone-able; the pattern Roblox trend analysts describe is *fast onboarding + a social trigger + a loop understood in 30 seconds*. [S]
8. **Studios funnel players between their own games.** Shared ownership (Do Big Studios holds stakes in Grow a Garden, Steal a Brainrot, formerly Fisch; Jandel runs Splitting Point and Yo Gurt Studio) lets them cross-promote via crossover events and guest appearances (e.g., "SAMMY IS COMING" event inside Steal an Egg on Sept 19, 2026). [S]
9. **The 2026 algorithm punishes the exact tactic that built 2025's hits** - flashy thumbnails without long-term value. Roblox's CGO John Ciancutti said such games were "displacing games that players value for the long term." Growth teams now have to design for Day 8-28 return visits, not just the launch spike. [S]
10. **Short-form video is becoming a first-party discovery surface.** Roblox "Moments" (beta Sept 2025, 13+, clips up to 30 s, tap-to-play) is fully live in the US as of RDC 2026 (Sept 10-12, 2026), and videos from a game's Experience Details Page will start appearing in the Moments feed later in September 2026. [S]

---

## 2. Roblox's discovery algorithm (2025-2026)

### 2.1 Timeline of what Roblox has announced

| Date | Announcement | What it changed / said | Source |
|---|---|---|---|
| Jan 31, 2025 (updated Feb 14, Mar 28, Dec 12, 2025) | "Building the Future of Roblox Home and Search: Introducing Personalized Discovery" (DevForum) | Home "now adapts to how people play, explore, and connect with friends"; "Recently Visited" content added to Search. Stated mission: "a balanced and healthy ecosystem where every user connects with the best creations... and every creation reaches its most relevant audience." | [S] devforum 3432124; Roblox on X |
| Feb 13, 2025 | "[Live now] Personalize your thumbnails to attract more users" | Thumbnail personalization live for experiences with >=2 thumbnails; Roblox picks the thumbnail most likely to convert each user. Avg **+8.5% qPTR, some +50%**. Bloxy News (Feb 2025): **8,000+ experiences adopted, avg +12% qPTR**; Roblox staff shared "5 tips". | [S] devforum 3257233; Bloxy News X post |
| Sept 2025 (RDC 2025) | Roblox Moments beta; discovery ranking changes | Ranking "now optimizes for both younger players, who tend to engage best with shorter-form games, and older players, who are drawn to deeper games they return to over time, looking beyond the first week to the first 28 days and beyond." Roblox "also testing optimizing for direct growth, measured by how many new players a game brings to the platform." Moments: short-form gameplay clips, jump straight into a game. | [S] Roblox newsroom RDC 2025; Creator Roadmap RDC update |
| Dec 11, 2025 | "Boost Your Discovery with the Improved Recommended For You Algorithm and Analytics for Creators" | Global release of improved RFY that "optimizes for long-term user retention by prioritizing organic recommendations"; new **Home Recommendations** tab in Creator Analytics showing how home recs convert ("percent of users who played your game after viewing it in recommendations"). Roblox framed it as "full transparency into the algorithm's functionality." | [S] devforum 3587441; VentureBeat |
| Early-mid 2026 | "Testing More Recommended For You Algorithm Signals" (DevForum) | Precursor test thread to the June update. (Content not retrieved.) | [S] devforum 4568033 |
| June 15, 2026 | Newsroom: "Optimizing Discovery: How Great Games Reach Millions of Players on Roblox" + DevForum "Recommended For You Algorithm Improvements That Better Value Long-Term Retention" | RFY evaluation window expanded **from 7 days to 28 days**, scored in **three buckets: Day 1, Day 2-7, Day 8-28**. Roblox "shared the full list of signals and their relative importance with creators." CGO John Ciancutti: games that "win attention with flashy thumbnails but lack long-term value" were "displacing games that players value for the long term, actually harming long-term retention and engagement." In testing, "surfacing of retaining games improved and platform-wide DAU and engagement rose." Platform context: **132M DAU**, "millions of games." Signals and weights visible in Creator Analytics; a creator webinar accompanied it. | [S] about.roblox.com June 2026; devforum 4684575 |
| Aug 20, 2026 | "Boost Your Discovery by Building Games People Want to Play" (John Ciancutti, DevForum) | New test "that will better recognize long-term player value: games players choose to return to over time, and where players find value in making purchases." Analysis: games strong in only retention *or* monetization keep receiving Home impressions; games strong in **both** may get "broader distribution." Rollout expected late Aug / early Sept 2026. Thread ran to 10+ pages of creator debate; a widely shared X post (EvanZir) framed it as "Roblox just publicly admitted what the algorithm actually [rewards]". | [S] devforum 4779042; X/EvanZir; Yahoo Finance |
| Sept 10-12, 2026 (RDC 2026, "The World Needs More Play") | Discovery, Moments, Wallet | Moments "fully available in the US"; "later this month, videos from a game's Experience Details Page will start appearing in Moments"; in October, tap any avatar in the Moments tab to buy items; "in the coming months, Build games will be playable right in the tab." Ranking "becoming more age-aware, recommending shorter-form games to younger players and deeper, return-visit games to older players." Roadmap items: **Search Landing Page, improving predictability of Continue Playing, continued RFY improvements, UI changes to Home** (all slated "mid 2026"). Roblox Wallet (real-currency earnings management) late 2026 US, global 2027. | [S] BusinessWire Sept 11, 2026; Inven Global; allthings.how; Roblox newsroom Sept 2026 |

Context from investors' side [S]: Yahoo Finance (2026) reported Roblox "is tuning discovery for 28-day retention after age-check changes hit sign-ups," and that in Q1 2026 results "games outside the top 10 account[ed] for 65% of spending growth" - i.e., Roblox wants a broader mid-tier, not just mega-hits.

### 2.2 The surfaces, and what feeds each

| Surface | What it is | What drives placement (per Roblox statements + observed) |
|---|---|---|
| **Home > Continue Playing** | Your recent games | Recency of play; RDC 2026 roadmap explicitly targets "improving the predictability of Continue Playing." [S] Because of this row, *retention is also distribution*: every retained player keeps seeing your tile. |
| **Home > Recommended For You** | Personalized carousel; the largest organic driver for new games | qPTR of your tile for *that* user; 28-day retention buckets; engagement; (from Aug 2026 test) monetization value; age-aware matching (short-form for younger, deep for older); "direct growth" (new-to-Roblox players a game brings). [S] |
| **Home > Friends' activity / social rows** | Tiles showing what friends are playing | Friend co-play; the Jan 2025 update said Home adapts to how people "connect with friends." [S] |
| **Home > Sponsored / Today's Picks** | Paid tiles via Ads Manager; curated/algorithmic picks | Ads Manager auction (see 3.1). |
| **Charts ("Top" / Top Trending etc.)** | Public leaderboards | Observed: recent visit/engagement growth. [BK - unverified: Roblox's Charts page includes "Top Trending", "Up-and-Coming" (younger experiences), "Top Earning", "Most Engaging"; exact formulas not published.] |
| **Search** | Query -> results | Jan 2025: personalized results + "Recently Visited"; RDC 2026: new Search Landing Page. Name matching matters: this is why the genre's names are literal ("Steal a Brainrot", "Plants vs Brainrots"). [S] |
| **Moments** | Short-form video feed (13+), tap to play | Sept 2025 beta -> fully in US by Sept 2026; EDP videos flow into it from late Sept 2026. [S] |
| **Events page / notifications** | Scheduled in-experience events with RSVP | [BK - unverified] Roblox's "Experience Events" feature lets devs schedule events that appear with countdowns and RSVP; Do Big-family games use it alongside Discord announcements. |

### 2.3 The signals, in plain language

- **qPTR (qualified play-through rate)** - of the users who were shown your tile (impression), the share who clicked *and* played long enough to count as a "qualified" play. It is reported per acquisition source in Creator Hub > Analytics > Acquisition; Roblox says Home Recommendations is "the most representative source for analyzing icon performance." Temporary qPTR dips right after a homepage surge are normal (your tile is being shown to less-targeted users). [S] [BK - unverified: the exact minimum session length that makes a play "qualified" is stated in Roblox's Acquisition analytics docs; it is a short threshold, not minutes.]
- **Retention: D1, D2-7, D8-28** - the three June-2026 buckets. The old 7-day window rewarded launch spikes; the 28-day window rewards games people are still playing a month later. [S]
- **Engagement / session time** - referenced throughout Roblox's discovery docs and the 2025 RDC talk ("shorter-form games" for young players vs "deeper games they return to" for older). [S]
- **Monetization value** - added as an explicit test signal Aug 20, 2026: "where players find value in making purchases." [S]
- **Direct growth** - "how many new players a game brings to the platform" (tested since RDC 2025). This directly rewards games that pull players in from TikTok/YouTube - i.e., the meme pipeline. [S]
- **Age-awareness** - the ranker matches game "depth" to the user's age cohort (RDC 2025, restated RDC 2026). [S]

### 2.4 Icon, thumbnail and name - Roblox's tools and what devs report

- **Thumbnail personalization** (Feb 13, 2025): upload >=2 thumbnails; Roblox serves the best one per user; you can see which thumbnail wins on qPTR. Results: +8.5% avg qPTR at launch, some +50%; +12% avg across 8,000+ adopters within weeks. [S]
- **Icon A/B testing does not exist natively** (confirmed in DevForum threads Jan 2025 "Are you able to A/B test game icons", and feature requests "Icon A/B Testing" and, in 2026, "Add A/B Testing and Stats for Titles & Icons"). Practice: rotate icons manually and compare qPTR/impression windows. A 2026 request also asks Roblox to expose CTR inside the thumbnail-personalization page. [S]
- **Cautionary thread:** "CTR and play rate took a nosedive after improving Icons and thumbnails" (DevForum, Creations Feedback) - prettier is not the same as clearer; the algorithm punishes a tile that lowers qPTR immediately. [S]
- **CreatorXP "icon mistakes that kill clicks and qPTR"** (2026 guide) exists but its content could not be retrieved. [S - title only]
- Observed conventions in the genre [BK - unverified, but consistently visible on the charts]: one oversized character face or object, saturated primary colors, a 1-3 word overlay ("NEW", "UPDATE", the featured item), and the same character reused in icon, thumbnail and YouTube thumbnails so the tile matches the video the player just watched.
- **Localization experiment:** Roblox ran an "Icon & Thumbnail Translation Experiment" (DevForum announcement, 2024/2025) auto-translating text on tiles for non-English users. [S - title only]

### 2.5 The name formula (what Roblox's ecosystem says)

- Titles that *are* the loop: "Steal a Brainrot" = you steal brainrots; "Grow a Garden" = you grow a garden; "Plants vs Brainrots" = tower defense with the meme; "99 Nights in the Forest" = survive 99 nights. Trend analysts (Game-Ace, Cubix, 2026) describe the breakout pattern as "fast onboarding plus a strong social trigger," a "steal-and-defend loop that anyone understands in 30 seconds," and a checklist of four traits: **core loop under five minutes per session, a visible progression hook, a social trigger that pulls in a second player, and monetization that doesn't block the fun.** [S]
- Emoji + bracket prefixes ("[UPDATE!] 🥚 ...", "🔦 99 Nights in the Forest") [S - the 🔦 is in the game's Rolimon's listing title]; the bracket text is swapped weekly to advertise the update in the tile itself. [BK - unverified: Roblox moderation permits emojis in titles; heavy use is a genre convention rather than an algorithmic factor.]

---

## 3. The cold start: first 100 / 1,000 / 10,000 CCU

### 3.1 Paid: Roblox Ads Manager ("Sponsored")

- Sponsored Experiences moved into Ads Manager (announcement thread ran to 11+ pages of creator feedback). Ads Manager is "a one-stop shop to create, manage, and view reporting for all ads on Roblox." [S]
- **Bidding:** auto-bidding sets a budget and duration and Roblox "automatically calculates the bid that will get you the most plays at the lowest cost." Third-party guides (BLOXG 2026, Gupta Media 2025) cite a **$1/day minimum** and recommend **$10-50/day for testing**. [S]
- **Reported costs (all self-reported, small samples):**
  - "$0.10-0.50 per click," effective **$0.20-1.00 per engaged player** with a good icon and reasonable retention (BLOXG guide, 2026). [S]
  - One dev: **120 credits (~37k Robux) for 400k impressions**. [S]
  - Another dev: **$0.02 per play (~5.7 Robux)**. [S]
  - DevForum thread "Sponsors in Ad manager cost more if you make them cheaper" (2024/25) documents auction quirks where lowering bids reduced delivery efficiency. [S - title]
  - DevForum "Optimizing my game's Cost Per Play from Ads" and "What is Cost Per Play?" threads exist for benchmarks. [S - titles]
- **Role in the playbook:** ads are for *validation*, not scale. Studios buy a few hundred to a few thousand plays to read D1 retention and qPTR before spending on creators. None of the 2025 mega-hits is credited with ad-led growth in any source found; all are credited to creators + algorithm. [S, synthesis]

### 3.2 Organic/social: friends, parties, groups, Discord

- Roblox Home explicitly weights social context ("how people... connect with friends," Jan 2025). Each retained player who plays with a friend creates a Home tile for that friend. [S]
- [BK - unverified] Roblox launched a "Party" feature in 2025 letting friends queue into games together; Groups were renamed "Communities" in 2025 with feed/announcement features; both are used by the Do Big family for update announcements.
- Discord: every top game runs one. Verified numbers found: **Forsaken** - one official server "over 300k members, with over 60k active as of April 2025"; a second community server "1.5 million members." [S] Grow a Garden / Steal a Brainrot Discord sizes: not retrieved [BK - unverified: both were reported among the largest Discord servers in 2025, in the low-millions of members].

### 3.3 Creators: YouTube first, then TikTok

**Dead Rails (RCM Games / RiccoMiller; created Jan 1, 2025)** - the cleanest documented cold start [S]:
- "Flamingo (11M+ subs) posted a Dead Rails video that hit 2M+ views. Other creators like KreekCraft, Thinknoodles, and Sketch followed."
- "Dead Rails' live player count jumped from hundreds to tens of thousands, then to over 100K concurrent users."
- "232M visits to date (61% have come in the last 7 days alone)" at time of GameRant coverage; the GearCo Easter update set a **1.2M CCU** record; "a million fans just three months after its initial release."
- GameAnalytics published "How Dead Rails became a Roblox hit: the data behind a breakout success" ("hit-makers formula") - content not retrievable. [S - title]

**Steal a Brainrot (SpyderSammy / Sam Brakta, 24; developing since 2013; released May 16, 2025)** [S]:
- "Launched as a hit from the start, starting off slow but growing with YouTubers like **Infinite and Foltyn** making videos on it."
- Licensed the core loop: "Sammy purchased the rights to adapt the core 'Steal a' concept from **Killioz**, the original creator of Steal a Character."
- Growth curve: June 2025 traction -> Jul 3: 1.5M CCU -> Jul 13: 5.2M -> Aug 1: 10M -> Sept 13: 24M (broke Grow a Garden's record) -> Oct 2025: ~25M (25.4M reported).
- Aug 15, 2025: Jandel "declared war"; KreekCraft, MrBeast and PokeDaily "sided with Jandel"; both sides had until Aug 23 to plan admin abuses -> the "Admin Abuse War."

**Grow a Garden (BMWLux, a teenager; released Mar 26, 2025; co-owned with Splitting Point Studios / Jandel; Do Big Studios minority)** [S]:
- "Its early momentum was organic. By late May, the game was drawing nearly 9 million concurrent players, largely thanks to simple gameplay and its ability to reward users passively."
- Splitting Point CEO Janzen Madsen (Jandel): the original creator "literally made the game in, like, three days."
- "Once development was scaled up... weekly events and time-gated content turned it into a cultural force."
- Milestones: 21.3M CCU (June 21, 2025, most-played in Roblox history, above Fortnite's 15.3M); 22.3M (Aug 23, 2025). A film adaptation was announced (Games.gg).

**Plants vs Brainrots (Yo Gurt Studio, led by Jandel; released Aug 2025)** [S]:
- "Entered Roblox quietly before gaining massive traction by late September" 2025 - i.e., a sibling studio's game got its lift ~6 weeks after launch, once the brand and creator network turned toward it.
- CCU record **8,654,525**; ~9M over one weekend (top-4 behind Steal a Brainrot, Grow a Garden, 99 Nights); over the next two weeks averaged **856,000 CCU** and passed **1B visits**; surpassed Grow a Garden in average CCU by autumn 2025 with "strong weekday consistency similar to Steal a Brainrot."

**99 Nights in the Forest (Grandma's Favourite Games, New Zealand; Alec Kieft "Cracky4"; launched June 2025)** [S]:
- Built "in a sprint of three months"; peak **14.2M CCU**; **26B visits by April 2026**, 7th most-played Roblox game ever; won Best Adventure and Best Horror Experience at the 2025 Roblox Innovation Awards.
- Kieft's explanation for the blow-up: "build on Roblox, where the audience already lives" (Roblox pulled 10B+ player-hours/month in 2025 per analysts). Roblox published a DevForum "Creator Spotlight: The Story Behind 99 Nights in the Forest" (thread 4036940).

**Fisch (WoozyNate; created Mar 13, 2024, released Oct 5, 2024)** [S]:
- Hit 100k+ CCU quickly ("as many concurrent players as Dress To Impress and Doors combined"); Nov 30, 2024 top CCU on the platform, beating Blox Fruits by 100k+.
- Transferred to the "Fisching" group Nov 4, 2024 after Do Big Studios acquired a stake "due to the unexpected success... a much larger player base than WoozyNate had initially prepared for." Do Big stepped down from development July 7, 2025 (kept equity); a team led by animepunk took over; **1M CCU on Oct 4, 2025** (13th experience ever).
- Lesson: Do Big's model is *acquire-and-scale* - find an organically rising game, bring live-ops and creator relationships.

**Dress to Impress (Gigi's Dress To Impress Group; released Nov 11, 2023)** [S]:
- Inspired by Fashion Famous and the 2023 Barbie film; became a viral phenomenon by July 2024; Charli XCX "Brat" collab; the "Pose 28" emote became a TikTok trend (Sept 2024) with users hitting the pose in real-life outfits; passed 1B visits after an update. Case study for *TikTok-native* virality: the game shipped a copyable gesture.

**Forsaken** [S]: Dead by Daylight-style asymmetrical horror; grew through 2025 while still "in Alpha," won Best Survival Experience (RIA 2025); community-driven via Discord + Trello + lore events ("Chrisaken").

### 3.4 What creators cost (2025-2026)

- Hypertube (2026 data): developers pay **$500-$25,000 per dedicated video**; micro creators (50k-200k subs) **$200-1,000**; mid-tier (200k-1M) **$1,000-5,000**. [S]
- SponsorRadar tracks **70 Roblox creators and 1,594+ deals** (2026). [S]
- Rolimon's "Promotion Rates" page is historical only (Roblox's sponsored-games system changed Nov 2020; the API was disabled Sept 2021). [S]
- KreekCraft (17M+ subs) [S] publicly attacked a 2026 Roblox move as "the equivalent of YouTube taking a cut of creators' sponsorship money... so insanely anti-creator and anti-developer" - indicating Roblox moved in 2026 to take a share of creator sponsorship deals. [S - tweet excerpt; policy details unverified]
- Organic vs paid: the mega-hits above are credited to *organic* creator coverage (creators chase the trending game because it earns views), with developers then formalizing relationships (admin roles, custom brainrots/pets named after creators, event co-hosting) rather than flat fees. [S, synthesis]

### 3.5 Cross-promotion inside a studio family

- Ownership map [S]: Grow a Garden = BMWLux + Splitting Point (Jandel) + Do Big (minority). Steal a Brainrot = SpyderSammy + Do Big. Plants vs Brainrots = Yo Gurt Studio (Jandel). Fisch = WoozyNate + Do Big stake. Do Big was reported "involved in more Roblox games" (May 30, 2025).
- Mechanisms observed [S]: (a) the Aug 23, 2025 Admin Abuse War (two games, one event, shared creators); (b) guest-character/guest-dev events - e.g., **Steal an Egg's "SAMMY IS COMING - A friend visits" 24-hour event starting 15:00 UTC, Sat Sept 19, 2026**; (c) shared trading communities ("Grow a Garden X Steal a Brainrot trading/cross-trading" Facebook groups).
- [BK - unverified] In-game portals/teleports between sibling games and shared codes were used in 2025 crossovers; not confirmed by any retrieved source.

---

## 4. Social / short-form: the meme pipeline

### 4.1 Italian brainrot -> Steal a Brainrot

- "Italian Brainrot" = a non-verbal genre of AI-generated absurd characters (a shark in sneakers, an orange with muscular arms, "Ballerina Cappuccina" with a mug head, "Tralalero Tralala," "Bombardiro Crocodilo") with shouty fake-Italian voiceovers; spread on TikTok in early 2025 among Gen Z/Alpha. **Tung Tung Tung Sahur** was created by TikTok creator **@noxaasht** in 2025, riffing on the Ramadan pre-dawn drum call. [S]
- Steal a Brainrot's loop is literally "collect, hoard, and steal brainrots" - the characters *are* the content. Tung Tung Tung Sahur "has been featured in Steal a Brainrot... often described as a high-value, rare character removed temporarily for copyright/moderation reasons" - the IP-risk side of riding memes. [S]
- Plants vs Brainrots took the same characters into a tower-defense frame (Aug 2025). [S]
- [BK - unverified] The same pipeline was repeated with 2025's Labubu plush craze and the "6-7" meme (Skrilla's "Doot Doot (6 7)" / LaMelo Ball clips; Dictionary.com's 2025 Word of the Year): brainrot-style characters and "67" gags were added to Steal a Brainrot-genre games and clones within weeks of each meme peaking.

### 4.2 Content-first design (design the clip, not just the game)

Observed features that exist to be clipped [S + synthesis]:
- **Steals** (Steal a Brainrot): a 10-second, zero-sum, betrayal moment - perfect for Shorts.
- **Rare mutations / weather** (Grow a Garden): visually distinct rarities that make "I GOT THE ___" thumbnails.
- **Admin abuse**: the developer appears in-game with god powers, triggers rare weather, restocks shops, hands out exclusives, talks via global messages - a live, unrepeatable spectacle that creators stream. [S]
- **Rivalry narratives** (Jandel vs Sammy) that recruit creators as combatants.
- **A copyable pose/emote** (Dress to Impress "Pose 28") that migrates to real-life TikTok.
- **Secrets/hidden characters** (99 Nights, Forsaken lore drops on Discord) that sustain "SECRET ___ FOUND" videos.

### 4.3 Which creators matter (2025-26)

- Named in sources as movers of these specific games: **Flamingo** (11M+; Dead Rails 2M+-view video), **KreekCraft** (17M+; Dead Rails, Admin Abuse War), **Thinknoodles, Sketch** (Dead Rails), **Infinite, Foltyn** (early Steal a Brainrot), **MrBeast, PokeDaily** (Admin Abuse War). [S]
- **DeeterPlays, Tanqr, and others** [BK - unverified sizes]; use SponsorRadar / Hypertube for current lists. [S]

### 4.4 First-party short-form: Moments

- Beta Sept 2025: 13+, trim to 30 s, add music/description, emoji reactions, tap to jump into the experience; Roblox is open-sourcing Moments so creators can build in-experience capture/discovery. Fully available in the US by RDC 2026; EDP videos begin appearing in the feed late Sept 2026; tap-to-buy avatar items Oct 2026. [S]
- Implication: the 16:9 YouTube pipeline is being joined by a vertical, in-app one where the developer's own EDP video is a ranked object.

---

## 5. Retention and the live-ops loop

### 5.1 The weekly ritual (verified examples)

- **Steal a Brainrot** "usually updates every Saturday with Admin Event." Example current patch: **Rebirth 19** (extra base slot; "Grief Shield" blocks one griefer hit; two new RNG-machine brainrots, Candini Fluffini and La Fuse Machine). [S]
- **Steal an Egg** "updates every Saturday, with Admin Abuse at 8:00 AM PT and the patch that morning or afternoon"; recent patch times: 18:33 UTC Aug 29, 21:19 UTC Sept 4, 20:42 UTC Sept 5, 17:02 UTC Sept 12, 2026. [S]
- **Grow a Garden**: "weekly events and time-gated content." [S] [BK - unverified: the 2025 cadence was Saturdays ~10:00 AM PT / 1 PM ET, with admin abuse before or after, announced on Discord/X with countdowns.]
- Demand signal: dedicated tracker sites (abusetime.dev "Roblox Event Schedule & Admin Abuse Times", techboltx "All Roblox Game Update Times & Live Event Tracker (2026)", bloxswaps "Grow a Garden Admin Abuse Schedule (September 2026)", xstealabrainrot "All Admin Event Times") exist because players plan their week around these. [S]

### 5.2 Why a fixed slot works (mechanism)

1. Concentrates returning players into one hour -> CCU spike -> Charts/Top Trending -> more impressions.
2. The spike is content: creators schedule streams for it.
3. Predictability trains D7/D28 return behavior - exactly what the June 2026 ranker measures.
4. Time-gated/limited items create FOMO and trading demand between updates.

### 5.3 Admin abuse as a system [S]

- Hosted by the dev team; uses "special powers and commands to create unique server-wide events"; rare weather, limited seeds/gear restocks, exclusive pets/cosmetics; global chat to players; exclusive characters obtainable only then.
- Peak use: Aug 23, 2025 -> Grow a Garden >=22.3M, Steal a Brainrot >20M, Roblox platform **47.4M CCU** (prior record 32.69M, July 2025).

### 5.4 Codes, trading, community

- Codes are a low-cost content beat (every game has a codes page on Games.gg / Gamer-Guides etc., which doubles as SEO). [S]
- Trading communities spill outside Roblox (Facebook groups for GaG x SaB cross-trading) - a retention and re-acquisition channel. [S]
- Discord as the live-ops control room (Forsaken: 300k+ / 1.5M-member servers; lore events like "Chrisaken"). [S]

### 5.5 After the spike

- No retrieved source documents the post-hype decline curves. [BK - unverified: Grow a Garden's CCU fell substantially from its Aug 2025 peak through 2026 while remaining top-10; Steal a Brainrot held up better on weekdays; Plants vs Brainrots' "strong weekday consistency" was cited as the healthiest shape.] The June/Aug 2026 algorithm changes are explicitly designed to stop rewarding the spike-and-fade profile.

---

## 6. Naming and packaging - conventions and evidence

- **Formula:** [Verb] + a + [Trend noun] ("Steal a Brainrot", "Grow a Garden", "Steal an Egg") or [Noun] vs [Trend noun] ("Plants vs Brainrots") or [Number] + [Stakes] ("99 Nights in the Forest"). Communicates the loop in <=4 words, is search-friendly, and is cheap to clone (which is why Sammy licensed "Steal a" from Killioz rather than merely copying it). [S]
- **Emoji/bracket prefix** carries the weekly update into the tile ("🔦 99 Nights", "[UPDATE!] 🥚"). [S, observed]
- **Icon:** big face/object, high saturation, 1-3 words; must be *clearer* not prettier (see the "nosedive" thread). Personalize thumbnails (>=2) and read qPTR per thumbnail. [S]
- **Evidence on A/B results:** the only Roblox-published numbers are the thumbnail-personalization lifts (+8.5%/+12% avg, up to +50%); icon A/B numbers from devs were not retrieved. [S]

---

## 7. Community-sourced lessons (DevForum / Reddit / YouTube)

Retrieved (titles and gist; full text not fetched):
- **Creator Spotlight: The Story Behind 99 Nights in the Forest** (DevForum 4036940) - Kieft: build where the audience already is; 3-month build to 14.2M CCU. [S]
- **"CTR and play rate took a nosedive after improving Icons and thumbnails"** (DevForum 3099908) - redesigns can hurt; test with personalization first. [S]
- **"Optimizing my game's Cost Per Play from Ads"** (3047197), **"Sponsors in Ad manager cost more if you make them cheaper"** (3086156), **"What is Cost Per Play?"** (2908034) - CPP varies 5-50x across icons; lowering bids can reduce delivery. [S]
- **"Are you able to A/B test game icons"** (3339468), **"Icon A/B Testing"** (3274267), **"Add A/B Testing and Stats for Titles & Icons"** (4778726, 2026), **"Allow us to see CTR in the thumbnail personalization page"** (3953108) - persistent tooling gap; devs improvise. [S]
- **"Boost Your Discovery by Building Games People Want to Play"** (4779042, Aug 20, 2026; 10+ pages) and **"Boost Your Discovery with the Improved RFY Algorithm"** (3587441, Dec 2025; 9+ pages) - creator debate over monetization weighting, "temporary dips after homepage surges," and transparency. [S]
- **Yahoo Finance / Ctech / Digiday** framing: teenager-built GaG (Ctech), "the marketing power of Roblox" (Digiday, June 2025). [S]

Not retrieved this session (see Gaps): r/robloxgamedev postmortems, YouTube devlogs ("I spent $X on Roblox ads"), verbatim DevForum quotes.

---

## 8. The synthesized playbook (step-by-step)

1. **Pick a meme that is 2-6 weeks old on TikTok and still climbing; name the game as the loop + the meme.**
2. **Build the minimum loop in days, not months** (GaG: 3 days; 99 Nights: 3 months for a deeper game). Core session <5 min, visible progression, a social trigger (steal/trade/co-op), non-blocking monetization.
3. **Ship 2+ thumbnails and turn on personalization; iterate the icon on qPTR** (Creator Hub > Analytics > Acquisition > Home Recommendations).
4. **Buy a small ad test ($10-50/day) to read D1 and qPTR**; only scale if D1 and D2-7 hold, because the June-2026 ranker will otherwise throttle you after the spike.
5. **Get 2-5 mid-tier YouTubers (200k-1M subs, $1-5k) or organic coverage; design a clip-able moment they can title a video after** (a steal, a mutation, a secret).
6. **Lock a weekly Saturday update + admin-abuse slot, announce with countdowns in Discord/X/in-game, and never miss it.**
7. **Manufacture narrative:** rivalries, guest appearances from sibling games/devs, creator-named items.
8. **Use sibling games as a funnel** (crossover events, guest events like "Sammy is coming").
9. **Design for D8-28 now:** rebirth systems, base-building, collections, trading - everything that gives a player a reason to return on day 20 - and for monetization that players value, because from Sept 2026 the ranker rewards both together.
10. **Feed Moments:** upload EDP videos (they enter the Moments feed from late Sept 2026) and encourage clip-sharing in-game.

---

## 9. Gaps and what to open next (could not be fetched from this sandbox)

| Need | Where to get it |
|---|---|
| Exact list of RFY signals + relative importance (June 2026) | https://devforum.roblox.com/t/recommended-for-you-algorithm-improvements-that-better-value-long-term-retention/4684575 and https://about.roblox.com/newsroom/2026/06/optimizing-discovery-great-games-reach-millions-players-roblox |
| Exact "qualified play" threshold and Acquisition metric definitions | https://create.roblox.com/docs/discovery and https://create.roblox.com/docs/production/analytics |
| Aug 20, 2026 post text + creator reactions | https://devforum.roblox.com/t/boost-your-discovery-by-building-games-people-want-to-play/4779042 |
| RDC 2026 full press release | https://www.businesswire.com/news/home/20260911312666/en/... and https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play |
| Grow a Garden / Steal a Brainrot Discord sizes, weekly update times, revenue | Wikipedia pages (blocked) and the games' Discord invites |
| Creator rate cards | https://hypertube.io/blog/how-much-do-roblox-youtubers-really-make-2026-data ; https://sponsorradar.com/brands/roblox |
| Dead Rails retention data | https://www.gameanalytics.com/blog/dead-rails-and-the-hit-makers-formula ; 2026 benchmark report https://www.gameanalytics.com/reports/2026-roblox-report |
| Icon best practices | https://creatorxp.gg/guides/roblox-game-icon-mistakes ; https://bloxg.com/guides/roblox-algorithm |
| Roblox's 2026 creator-sponsorship revenue-share policy | https://x.com/KreekCraft/status/2035082367983858136 and related DevForum announcement |

---

## 10. Sources (every URL surfaced by the searches used)

### Roblox official (Creator Hub / DevForum / Newsroom / X)
- https://create.roblox.com/docs/discovery
- https://create.roblox.com/docs/production/analytics
- https://create.roblox.com/docs/production/promotion/ads-manager
- https://devforum.roblox.com/t/building-the-future-of-roblox-home-and-search-introducing-personalized-discovery/3432124
- https://devforum.roblox.com/t/live-now-personalize-your-thumbnails-to-attract-more-users/3257233
- https://devforum.roblox.com/t/get-your-thumbnails-ready-for-thumbnail-personalization/3226599
- https://devforum.roblox.com/t/upcoming-icon-thumbnail-translation-experiment/3105942
- https://devforum.roblox.com/t/boost-your-discovery-with-the-improved-recommended-for-you-algorithm-and-analytics-for-creators/3587441
- https://devforum.roblox.com/t/testing-more-recommended-for-you-algorithm-signals/4568033
- https://devforum.roblox.com/t/recommended-for-you-algorithm-improvements-that-better-value-long-term-retention/4684575
- https://devforum.roblox.com/t/boost-your-discovery-by-building-games-people-want-to-play/4779042
- https://devforum.roblox.com/t/creator-roadmap-2025-rdc-update/3961527
- https://devforum.roblox.com/t/roblox-moments-a-new-era-of-user-generated-discovery-for-experiences-and-gameplay-is-here/3919813
- https://devforum.roblox.com/t/creator-spotlight-the-story-behind-99-nights-in-the-forest/4036940
- https://devforum.roblox.com/t/sponsored-experiences-moving-to-ads-manager/2661756
- https://devforum.roblox.com/t/optimizing-my-games-cost-per-play-from-ads/3047197
- https://devforum.roblox.com/t/sponsors-in-ad-manager-cost-more-if-you-make-them-cheaper/3086156
- https://devforum.roblox.com/t/what-is-cost-per-play/2908034
- https://devforum.roblox.com/t/are-you-able-to-ab-test-game-icons/3339468
- https://devforum.roblox.com/t/ctr-and-play-rate-took-a-nosedive-after-improving-icons-and-thumbnails/3099908
- https://devforum.roblox.com/t/give-developers-the-ability-to-run-ab-tests-for-their-games-appearances/1522294
- https://devforum.roblox.com/t/icon-ab-testing/3274267
- https://devforum.roblox.com/t/allow-us-to-see-the-click-though-rate-in-the-thumbnail-personalization-page/3953108
- https://devforum.roblox.com/t/add-ab-testing-and-stats-for-titles-icons/4778726
- https://devforum.roblox.com/t/save-the-date-rdc26/4556064
- https://about.roblox.com/newsroom/2025/09/roblox-rdc-2025
- https://about.roblox.com/newsroom/2025/09/roblox-moments-user-generated-discovery
- https://about.roblox.com/newsroom/2026/06/optimizing-discovery-great-games-reach-millions-players-roblox
- https://about.roblox.com/newsroom/2026/07/moments-new-homepage-unlocks-gaming-for-all
- https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play
- https://x.com/Roblox/status/1885373461524341064
- https://x.com/Roblox/status/1856760513038110792
- https://x.com/Bloxy_News/status/1890113378766704674
- https://s27.q4cdn.com/984876518/files/doc_financials/2025/q4/Q4-2025-Shareholder-Letter.pdf
- https://www.roblox.com/charts/top-trending
- https://www.roblox.com/games/79546208627805/99-Nights-in-the-Forest

### Press / analysis
- https://www.businesswire.com/news/home/20260911312666/en/Roblox-Unveils-New-Ways-to-Play-Build-and-Grow-at-the-Roblox-Developers-Conference-RDC
- https://www.invenglobal.com/articles/25918/roblox-unveils-expansions-to-play-creation-and-monetization-at-rdc
- https://allthings.how/roblox-rdc-every-major-announcement-for-players-and-creators/
- https://allthings.how/roblox-rdc-2025-10-creator-tools-and-updates-that-matter/
- https://allthings.how/robloxs-new-recommended-for-you-algorithm-rewards-games-that-keep-you-hooked/
- https://fossbytes.com/roblox-announces-new-updates-for-players-and-developers-at-rdc/
- https://www.lionheartv.net/2026/09/roblox-unveils-new-ways-to-play-build-and-grow-at-the-roblox-developers-conference-rdc/
- https://venturebeat.com/business/roblox-wants-to-improve-discovery-for-its-game-creators
- https://gamesbeat.com/roblox-will-let-game-devs-personalize-thumbnails-to-attract-more-players/
- https://finance.yahoo.com/markets/stocks/articles/rblxs-discovery-shift-targets-retention-142600721.html
- https://finance.yahoo.com/news/roblox-announces-short-form-video-173000565.html
- https://www.contentgrip.com/roblox-launches-moments/
- https://marketech-apac.com/roblox-launches-moments-to-let-users-capture-edit-and-share-gameplay-highlights/
- https://endsights.com/roblox-optimizing-discovery-how-great-games-reach-millions-of-players-on-roblox
- https://zehn-studio26.com/news/recommended-for-you-retention-update/
- https://zehn-studio26.com/news/recommended-for-you-discovery-rollout/
- https://zehn-studio26.com/news/rdc-2026-preview/
- https://rowatcher.com/news/what-the-roblox-algorithm-actually-rewards-in-2026-not-ccu
- https://rolearn.dev/insights/roblox-game-discovery-algorithm-2026/
- https://gmmarket.me/community/post/how-the-roblox-discovery-algorithm-actually-works-in-2026-myths-debunked
- https://bloxg.com/guides/roblox-algorithm
- https://bloxg.com/guides/roblox-ads-guide
- https://bloxg.com/roblox-youtube-promotion
- https://creatorxp.gg/guides/roblox-game-icon-mistakes
- https://www.guptamedia.com/insights/roblox-advertising
- https://www.gameanalytics.com/reports/2026-roblox-report
- https://www.gameanalytics.com/blog/dead-rails-and-the-hit-makers-formula
- https://www.gamedeveloper.com/business/roblox-s-grow-a-garden-had-nearly-22-million-concurrent-users-in-july
- https://www.calcalistech.com/ctechnews/article/dj4lxef8r
- https://digiday.com/media/in-graphic-detail-as-grow-a-garden-booms-a-new-report-shows-the-marketing-power-of-roblox/
- https://www.france24.com/en/live-news/20250626-roblox-s-grow-a-garden-explodes-online-video-game-numbers
- https://www.eneba.com/hub/news/grow-a-garden-hits-21-9-million-concurrent-players-making-roblox-the-center-of-gaming/
- https://tech.yahoo.com/gaming/articles/millions-flocking-grow-virtual-gardens-160456564.html
- https://medium.com/@daud56ach/grow-a-garden-the-cozy-roblox-game-that-shattered-records-57ca48ec8357
- https://gam3s.gg/news/plants-vs-brainrots-roblox-viral-hit/
- https://games.gg/news/plants-vs-brainrots-roblox-codes/
- https://games.gg/news/99-nights-forest-14-million-roblox/
- https://games.gg/news/roblox-grow-a-garden-is-becoming-a-movie/
- https://games.gg/news/fish-it-unexpected-rise-to-the-top-of-roblox/
- https://www.pcgamer.com/games/roblox/99-nights-in-the-forest-tips/
- https://gamerant.com/roblox-zombie-game-dead-rails-popularity/
- https://gamerant.com/roblox-fisch-game-mode-player-count/
- https://gamerant.com/roblox-fisch-game-fishing-gameplay-rods-explained/
- https://www.maxpowergaming.co/post/how-dead-rails-became-hottest-roblox-game
- https://www.slythergames.com/2025/05/30/do-big-studios-involved-in-more-roblox-games/
- https://www.newscoolchronicle.org/news/the-rise-and-fall-and-rise-of-roblox-fisch
- https://screenrant.com/roblox-dress-to-impress-viral/
- https://www.trendhunter.com/trends/roblox-dress-to-impress
- https://www.destructoid.com/roblox-forsaken-trello-and-discord/
- https://www.cubix.co/blog/top-10-most-popular-roblox-games/
- https://game-ace.com/blog/roblox-trends-in-gaming/
- https://game-ace.com/blog/roblox-game-ideas-that-actually-work/
- https://www.taylorwessing.com/en/insights-and-events/insights/2026/03/games-industry-in-2026-and-beyond
- https://gamertagmythras.com/blog/roblox/best-roblox-games-2026
- https://studiokrew.com/blog/top-roblox-games-may-2026/
- https://www.eldorado.gg/blog/sammy-steal-a-brainrot-guide/
- https://www.u7buy.com/blog/sammy-steal-a-brainrot/
- https://scorpiolikeyou.com/news/steal-a-brainrot-creator-sammy-unmasked-face-reveal-net-worth-and-the-story-behind-the-hype_a133
- https://x.com/EvanZir/status/2085815919788306693
- https://x.com/KreekCraft/status/2035082367983858136?lang=en

### Creator economics
- https://hypertube.io/blog/how-much-do-roblox-youtubers-really-make-2026-data
- https://sponsorradar.com/brands/roblox
- https://sponsorradar.com/brands/roblox/get-sponsored
- https://www.rolimons.com/promotionrates
- https://viralyft.com/blog/roblox-youtubers
- https://en.wikipedia.org/wiki/KreekCraft_(YouTuber)

### Memes
- https://en.wikipedia.org/wiki/Italian_brainrot
- https://www.perfectcorp.com/consumer/blog/video-editing/tiktok-memes-2025-tung-tung-tung-sahur
- https://www.philstar.com/lifestyle/health-and-family/2025/08/10/2464502/italian-brainrot-tung-tung-tung-sahur-ai-memes-only-gen-z-gen-alpha-know
- https://www.insmind.com/blog/top-tiktok-memes-tung-tung-tung-sahur
- https://focalml.com/blog/italian-brainrot-and-the-absurd-rise-of-tung-tung-tung-sahur/
- https://windsorjournal.net/tech/tung-tung-tung-sahur-meaning/
- https://momtasticmommyblog.com/2025/09/13/italian-brainrot-and-tung-tung-tung-sahur/

### Live-ops trackers, wikis, communities
- https://abusetime.dev/events
- https://techboltx.com/roblox-game-update-times-event-countdown/
- https://techboltx.com/roblox-game-event-time/
- https://bloxswaps.com/blog/grow-a-garden-admin-abuse
- https://xstealabrainrot.com/admin-event/
- https://stealaneggtime.com/tools/update-timer
- https://stealabrainrot.fandom.com/wiki/Admin_Abuse
- https://stealabrainrot.fandom.com/wiki/Los_Spyderinis
- https://stealabrainrot.fandom.com/wiki/Sammyni_Spyderini
- https://youtube.fandom.com/wiki/Steal_a_Brainrot
- https://youtube.fandom.com/wiki/SpyderSammy
- https://en.wikipedia.org/wiki/Steal_a_Brainrot
- https://en.wikipedia.org/wiki/Grow_a_Garden
- https://en.wikipedia.org/wiki/Dress_to_Impress_(video_game)
- https://en.wikipedia.org/wiki/List_of_Roblox_games
- https://roblox.fandom.com/wiki/The_Garden_Game/Grow_a_Garden
- https://roblox.fandom.com/wiki/Yo_Gurt_Studio/Plants_Vs_Brainrots
- https://roblox.fandom.com/wiki/Grandma's_Favourite_Games/99_Nights_in_the_Forest
- https://roblox.fandom.com/wiki/RCM_Games/Dead_Rails
- https://roblox.fandom.com/wiki/Fisching/Fisch
- https://roblox.fandom.com/wiki/Do_Big_Studios%E2%84%A2
- https://roblox.fandom.com/wiki/Roblox_Developers_Conference_2025
- https://roblox.fandom.com/wiki/Roblox_Developers_Conference_2026
- https://99-nights-in-the-forest.fandom.com/wiki/99_Nights_in_the_Forest:_Game
- https://dti-dress-to-impress.fandom.com/wiki/Dress_To_Impress
- https://forsaken.wiki/Forsaken
- https://fischipedia.org/wiki/Fisch
- https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/NinetyNineNightsInTheForest
- https://www.rolimons.com/game/79546208627805
- https://www.rolimons.com/game/116495829188952
- https://discord.com/servers/forsaken-roblox-1438388533046935614
- https://discord.com/invite/forsaken-roblox-1377647096798248990
- https://www.facebook.com/groups/709611651774373/posts/773741312028073/
- https://www.facebook.com/groups/1469865444195393/
- https://www.youtube.com/watch?v=B1u4-txy3yg (ADMIN ABUSE WAR Grow A Garden VS Steal A Brainrot)
- https://www.youtube.com/watch?v=LT5bmYVX2jg (GROW A GARDEN ADMIN ABUSE)
- https://www.youtube.com/watch?v=ceU3PJPZMTg (The TRUTH About Roblox DEAD RAILS)
