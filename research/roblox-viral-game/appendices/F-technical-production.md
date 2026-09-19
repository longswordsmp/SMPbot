# Building and Operating a "Steal a Brainrot" / "Grow a Garden"-style Roblox Game in Late 2026
## Technology & Production Research Brief

**Prepared:** September 19, 2026
**Scope:** toolchain, architecture, performance, content pipeline, live-ops, production benchmarks.
**Method notes:** Roblox's own sites (devforum.roblox.com, create.roblox.com, about.roblox.com, ir.roblox.com), Wikipedia, Fandom wikis and most trade press were blocked by the research proxy. Primary sources were therefore (a) the official Creator Docs mirror on GitHub (`Roblox/creator-docs`, read on 2026-09-19), (b) tool repositories on GitHub (release pages read 2026-09-19), (c) a decompiled Steal-a-Brainrot-lineage place found on GitHub (`say30/brain`), and (d) search-engine result summaries for pages that could not be opened. Anything that rests only on a search summary or on prior knowledge is marked **[unverified]** or **[search summary only]**.

---

## 0. Executive summary (the ten things that matter)

1. **The reference architecture for this genre is now public.** `github.com/say30/brain` is a decompiled place (extracted with UniversalSynSaveInstance, decompilation timestamp "Sat Jun 28 18:35:14 2025", source `rickdev.rbxlx`) whose data tables, folder names (`workspace.Plots[n].AnimalPodiums[slot].Base.Spawn`, `DeliveryHitbox`) and character list (Noobini Pizzanini, Trippi Troppi, Cappuccino Assassino, Sigma Girl, Los Bros, Matteo) match Steal a Brainrot as seen from dozens of exploit scripts. Whether it is the live game's own code or a near-verbatim copy is **[unverified]**; treat it as an architecture reference, not as code to reuse (copyright).
2. **Data layer:** ProfileStore (session-locked DataStore wrapper; `AUTO_SAVE_PERIOD = 300 s`, `SESSION_STEAL = 40 s`, `ASSUME_DEAD = 630 s`) + `Reconcile()` + kick-on-failure + a soft-shutdown service that teleports players to a reserved server on `BindToClose`. That exact stack is what the leaked tree uses.
3. **Income is lazy, not ticked:** `coins = floor((GetServerTimeNow() - LastCollect) * Generation(index, mutation, traits, owner))`; the client runs the same formula for display; offline gain is computed once on profile load (elapsed since `LastOnline`, capped per rebirth tier) and stored per animal as `OfflineGain` seconds.
4. **The steal loop is a server-validated carry:** remote `StealAnimal(timestamp, actionId, plot, slot)` → timestamp within ±5 s (after a 185 s offset), must be inside the target base hitbox, slot non-empty, base not locked (60 s default lock, +10 s per rebirth up to 140 s), then a non-collidable clone welded to the thief's `HumanoidRootPart` until `DeliveryHitbox` at the thief's own base (2 s debounce).
5. **Roblox platform in 2026:** Luau's new type solver is GA (rolled out Nov–Dec 2025); Server Authority (client prediction + rollback) shipped in 2026 with `Workspace.AuthorityMode = Server`; physics replication got "eventual consistency" from June 15, 2026; Configs + Experiments (A/B, 14–60 days, ≥1,000 DAU) and an expanded analytics/segmentation platform (Aug 2026); Moments (30-s clips, new homepage July 2026); rewarded video ads via `AdService`; RDC 2026 (Sept 2026) added Roblox Everywhere (standalone apps, Chrome web player by end of 2026), offline mode and the mobile "Build" prompt-to-game tab.
6. **AI tooling that actually works:** Assistant (GA) with Planning Mode, a playtesting agent, Procedural Models (50 per rolling 24 h, ≤8 parts), Cube mesh generation, Material/Texture generators, a built-in Studio MCP server (the open-source `Roblox/studio-rust-mcp-server` was archived April 3, 2026 in favour of it), and BYO API keys (Anthropic/OpenAI/Google). In-experience 4D generation (`GenerationService:GenerateModelAsync`, schemas `Car5`/`Body1`) is in beta since Feb 2026.
7. **Mobile dominates:** ~72–80% of activity/sessions are mobile (2026 figures); ~60% of Android players have 2–4 GB RAM; >50% of players are on Passmark 10k–20k devices. Budget: <1,000 draw calls, <1M triangles, 16.67 ms frame, textures ≤512².
8. **Small servers are a design choice with technical dividends:** 8 bases → 8 players (Steal a Brainrot), which bounds instance count and memory (server cap historically 6.25 GB; newer formula reported as 6.4 GB + 50 MB × peak players **[search summary only]**), keeps steal density high and makes every server feel fresh.
9. **Anti-exploit reality:** Hyperion/Byfron has hollowed out free executors, but paid and mobile executors persist and re-break weekly; GitHub holds dozens of Steal a Brainrot cheats (teleport-to-base, `firetouchinterest` on `DeliveryHitbox`, base-lock ESP, noclip, Discord "Chilli Notify" auto-joiners). Everything that moves value must be server-validated with travel-time and position sanity checks; the leaked tree's reliance on a 2022 third-party "MadAntiCheat" loader is a weak point to avoid.
10. **Production reality:** Grow a Garden's first version was built in 3–4 days by a 16-year-old (released March 26, 2025; 21.3M CCU on June 21, 2025); Steal a Brainrot launched May 16, 2025 on a licensed concept and hit 25.8M CCU on Oct 11, 2025. Both ship weekly (the leaked tree has update gates for 08/23, 08/30 and 09/06/2025). A competent 2–3 person team can ship an MVP in 3–6 weeks; what kills these games is data loss/dupes, rollback-driven trust collapse, and memory leaks—not lack of features.

---

## 1. TOOLCHAIN 2026

### 1.1 Roblox Studio: state of the art (2025 → 2026)

| Change | Status / date | Source |
|---|---|---|
| Studio UI overhaul ("Next Gen Studio UI") fully rolled out; unified Creator Hub replaces legacy dashboards | "the new normal in 2026" | MSN summary of "Roblox Studio Updates Are Reshaping Creator Workflows in 2026" **[search summary only]** |
| Redesigned Place Version History in Studio: version notes, search, filters (date range, save type, collaborator), who-was-in-session tracking, dockable widget (`Window > Version History`); version notes are mandatory on publish and Studio can auto-draft the publish summary from team notes | March 2026 | Creator Docs `projects/version-history.md`; DevForum thread "Redesigned Place Version History in Studio" (title only) |
| Revamped Asset Manager (folders, avatar assets, import/export) | 2026 | Creator Roadmap 2026 Spring Update **[search summary only]** |
| New 2D tooling: orthographic camera, animated image containers, sprite-sheet import | 2026 | same |
| Instance Streaming: adaptive radius + path pre-fetching from per-experience movement heatmaps; minimum draw distance on low-end devices raised to 500 studs | announced for late 2026 | Creator Roadmap 2026 Fall Update **[search summary only]** |
| Fall 2026 roadmap scorecard: 130 features launched since RDC 2025, 79% on time | Sept 2026 | same |
| Age-based collaboration requirements for Team Create (government ID or facial age estimation; e.g. 13–15 may collaborate with 9–17, 18+ with 16+) | effective June 25, 2026 | Creator Docs `projects/collaboration.md` |
| Team Create autosaves to the cloud every 4 minutes; Drafts mode lets scripters edit privately and commit; four permission levels (Owner/Edit/Play/No Access) | current | same |
| Stricter publishing requirements for experiences targeting under-16 audiences | 2026 **[unverified detail]** | MSN summary |

**No native Git in Studio.** Source control is still Rojo + Git (Section 1.3); Studio's contribution is Version History (rollback checkpoints) and Team Create. Restoring a version does **not** auto-publish: you must publish and restart servers to replace the live place (Creator Docs `version-history.md`).

### 1.2 Luau in 2026

- **New Type Solver — General Release.** Rolled out to all users of `--!nocheck` and `--!nonstrict` in late November 2025; "officially live across Roblox as of December 2025". Not fully backward-compatible in `--!strict` on large legacy codebases (expect a wave of new diagnostics). Headline features: user-defined type functions, read-only / write-only properties, far better inference and fewer false positives. **[search summary of DevForum "[General Release] Luau's New Type Solver" (topic 4084991)]**
- **User-defined type functions** (RFC status: Implemented): `type function rawget(tbl, key) ... end` executes ordinary Luau in a sandboxed "type runtime" during analysis; the `types` library builds/inspects unions, intersections, tables, functions. (luau-lang/rfcs `user-defined-type-functions.md`, read 2026-09-19.)
- **Property access modifiers** (`read`/`write` on table properties) have RFCs `property-readonly.md`, `property-writeonly.md`, `syntax-property-access-modifiers.md` (luau-lang/rfcs).
- **Language cadence is weekly.** From the luau-lang/luau releases page (2026-09-19): 0.739 (Sept 18, 2026) adds experimental `if local` expressions and a metamethod lookup cache; 0.737 (Sept 4) contains a *classes* RFC prototype; 0.735 (Aug 22) adds `LOP_FASTPCALL` (~50% lower `pcall` overhead); 0.734 permits `pcall`/`xpcall` inside type functions. The `const` keyword is now supported by StyLua 2.5.0 (May 16, 2026) and Selene 0.31.0 (May 20, 2026), confirming `const` shipped to Luau in the first half of 2026.
- **Native code generation** (Creator Docs `luau/native-code-gen.md`): `--!native` at the top of a **server** Script, or `@native` on individual functions. Limits: 64K instructions per code block, 32K internal blocks per function, 1M instructions per script, plus a global native-memory budget; exceeding them errors ("exceeded single code block instruction limit"). Use only for numeric-heavy loops (2–3× reported gains on intersection tests); avoid for remote/API-heavy code; inspect with the Script Profiler (`<native>` tags), `debug.dumpcodesize()` and the heap profiler (`[native]`). Not available for client scripts.
- **Type checking modes** (Creator Docs `luau/type-checking.md`): `--!nocheck`, `--!nonstrict` (default), `--!strict`. Recommendation for a new project in 2026: `--!strict` everywhere from day one with the new solver; it is far cheaper than retrofitting.

### 1.3 External toolchain (Rojo / Wally / Selene / StyLua / luau-lsp / Rokit) vs. pure Studio

Latest versions observed on GitHub release pages on 2026-09-19:

| Tool | Latest | Notes |
|---|---|---|
| **Rojo** (rojo-rbx/rojo) | v7.7.0 shown as latest tag (page rendered its date as July 2, 2024 — **[date unverified]**) | Websocket sync, `syncback` (place → project), `.jsonc` project files. Still the de-facto file-system ↔ Studio bridge. |
| **Wally** (UpliftGames/wally) | v0.3.2 (June 5, 2024) | Package manager; parallel installs (~10 s for 1,200 packages). Slow-moving but stable; the whole `Packages/` ecosystem (Signal, Trove, Promise, Net, Observers, Cmdr, Replion, Freeze…) is what the leaked Steal-a-Brainrot tree is built from. |
| **StyLua** (JohnnyMorganz/StyLua) | v2.5.2 (May 16, 2026) | Formatter; `const` support since 2.5.0. |
| **Selene** (Kampfkarren/selene) | 0.31.0 (May 20, 2026) | Linter; `restricted_module_paths` lint since 0.29.0 (July 2025). |
| **luau-lsp** (JohnnyMorganz/luau-lsp) | 1.69.0 (July 18, 2026), synced to Luau 0.729 | VS Code language server; Roblox-mode auto-imports respect the server/client boundary (1.67.0, May 2026). Also ships a Studio plugin. |
| **Rokit** (rojo-rbx/rokit) | rolling | Toolchain manager, successor to Aftman/Foreman (reads both `aftman.toml` and `foreman.toml`). |
| **Zap** (red-blox/zap) | 0.6.x stable; "rewrite" branch in progress | Networking IDL that serialises remotes into `buffer`s — much lower bandwidth than raw RemoteEvents, plus schema validation. |
| **Knit** (Sleitnick/Knit) | **archived July 31, 2024** | Do not start a new project on Knit. |

A ready-made template (`takoyakisoft/roblox-rojo-wally-template`) wires Rokit + Rojo + Wally + Selene + StyLua + GitHub Actions + headless tests (Lune + TestEZ).

**Pure Studio vs external editor — the practical 2026 rule:**
- Solo dev, prototype week: pure Studio + Assistant/Code Assist is fastest; enable `--!strict`, use Version History notes as your commit log.
- Anything you intend to operate for months with 2+ people: Rojo + Git + Wally + luau-lsp + Selene/StyLua in CI. Reasons: PR review of economy math, rollback of a bad balance table by `git revert`, headless unit tests for RNG/rebirth math, and the ability to let an external MCP client (Claude/Cursor/Codex) edit files.
- Hybrid that most top teams use: code in Rojo; maps/UI/VFX built in Studio and stored as `.rbxm` model files (Rojo syncs them); a small `Datas/` tree of pure ModuleScript tables (animals, rarities, mutations, rebirths, shop) — exactly the structure visible in the leaked tree (`ReplicatedStorage.Datas.Animals`, `.Rarities`, `.Mutations`, `.Rebirth`, `.ShopItems`, `.LuckyBlocks`, `.ServerLuck`, …).

### 1.4 Collaboration, version control and deployment primitives Roblox provides

- Team Create + Drafts + Version History (above).
- Place versions are immutable snapshots; Creator Hub `Creations > Configure > Places > Version History > Restore`.
- Studio test modes: **Server & Clients** launches up to 8 clients; **Network Simulator** injects latency/jitter/packet loss (essential for Server Authority); **Party Simulator** fakes parties for `Player.PartyId` / `SocialService:GetPartyAsync()` testing. (Creator Docs `studio/testing-modes.md`.)

### 1.5 Roblox AI tools: what exists and what actually works (Sept 2026)

From Creator Docs `ai/accelerated-workflows.md`, `assistant/guide.md`, `parts/model-generation.md`, `generative-AI.md` (read 2026-09-19) and press summaries:

| Tool | Status | What it does / limits |
|---|---|---|
| **Assistant** (Studio) | GA (toggle under File → Beta Features for newest modes) | Conversational agent that reads the live data model, writes/runs code, inserts Creator Store assets, generates materials/meshes/procedural models, captures the 3D viewport, simulates inputs and playtests. **Planning Mode** (April 2026 "agentic" update) produces an editable Markdown plan stored in the cloud that persists across chats; a **playtesting agent** reads output logs, takes screenshots and drives keyboard/mouse to find bugs. |
| **Code Assist** | GA | Inline completions in the Script Editor; Luau-specific. |
| **Studio MCP Server (built-in)** | GA (Assistant → Manage MCP Servers) | Lets Claude, Cursor, Codex etc. read the data model, create/run scripts, edit instances, playtest remotely. The earlier open-source `Roblox/studio-rust-mcp-server` (tools: `run_code`, `insert_model`, `get_console_output`, `start_stop_play`, `run_script_in_play_mode`, `get_studio_mode`) was **archived April 3, 2026**. |
| **Bring your own model** | GA | Assistant → Manage API Keys for Anthropic, OpenAI or Google keys. |
| **Mesh Generation (Cube 3D)** | GA in Studio via Assistant/MCP | Text → textured MeshPart. Cube 3D open-sourced March 2025 (v0.1); v0.5 (July 2025) trained on +2.8M synthetic assets, latent 512→1024 tokens (github.com/Roblox/cube). |
| **Procedural Models** | GA with quota | Editable, attribute-driven models (e.g. shelf count); **50 per rolling 24 h**, up to 8 parts per model (5 when segmenting an imported mesh). |
| **4D / in-experience generation** | Public beta since Feb 2026 | `GenerationService:GenerateModelAsync(inputs, schema)`; `inputs.TextPrompt`; `schema.PredefinedSchema` = `"Car5"` (body + 4 wheels) or `"Body1"` (single mesh). All inputs/outputs are moderated. Pricing/quotas not in docs. **CubePart** (open-vocabulary, part-controllable generation) announced May 2026. |
| **Material Generator / Texture Generator** | GA | Tiling PBR materials → `MaterialVariant`; context-aware textures on existing meshes. |
| **Avatar Auto-Setup** | GA | Rigs/cages/segments a mesh into an R15 avatar — useful for brainrot characters you want to animate with standard rigs. |
| **Text-to-speech / speech-to-text / text generation** | GA (`AudioTextToSpeech`, `TextGenerator`) | Runtime NPC voice/dialogue; outputs must pass `TextService` filtering. |

**Honest assessment for this genre** (opinion, informed by the above): Code Assist and Assistant are reliable for boilerplate (remotes, UI wiring, data templates, ProximityPrompt handlers) and for refactors when driven through MCP from a real editor. Material/Texture generation is production-usable for props and floors. Mesh generation produces acceptable props but not yet the crisp, stylised, meme-recognisable characters this genre needs; for characters, plan on Blender + Creator Store + commissioned/AI-assisted texturing (Section 4). In-experience 4D generation is a UGC feature (players generating cars), not a content pipeline.

### 1.6 Engine/platform features from RDC 2025 (Sept 5–6, 2025) and RDC 2026 (Sept 2026) that matter here

- **UI:** blur, text shadows and improved gradients (RDC 2025). Docs now list a `UIShadow` appearance modifier (drop shadow with blur radius, colour/transparency, offset, spread) alongside `UIGradient` (linear/radial/conical), `UIStroke`, `UICorner`, `UIPadding` (`ui/appearance-modifiers.md`). **Universal styling** (`StyleSheet`/`StyleRule`, tokens, themes, queries — "CSS for Roblox") is GA (`ui/styling/index.md`). A new **notification system for turn-based/async multiplayer** was announced at RDC 2025 **[search summary only]**.
- **Server Authority** (about.roblox.com, July 2026 — blocked; Creator Docs `projects/server-authority/`): the server is the single source of truth; clients send inputs and predict. Enable by setting `Workspace.AuthorityMode = Server`, which also sets `NextGenerationReplication = true`, `PlayerScriptsUseInputActionSystem = true`, `SignalBehavior = Deferred`, `UseFixedSimulation = true`, `StreamingEnabled = true`. Simulation code goes in ModuleScripts bound with `RunService:BindToSimulation()` on both client and server; only "Simulation Access" properties are usable inside it; attributes limited to the first 64 per instance (names/strings ≤50 chars). Debug with the Server Authority Visualizer (Ctrl+Shift+F6). Templates exist for racing, soccer, laser tag. The `network-ownership.md` doc still calls it "currently in beta". A DevForum thread reports "major issues" in some games after enabling it **[search summary only]**. Community precedent: `easy-games/chickynoid` (server-authoritative character controller with rollback, used in Anarchy Arena).
- **Physics replication "eventual consistency"** rolled out from **June 15, 2026** — updates are no longer lost to packet drops (DevForum "Upcoming Improvements to Physics Replication" **[search summary only]**).
- **Party** (social feature): `Player.PartyId`, `SocialService:GetPartyAsync(partyId)` (returns UserId/PlaceId/JobId/PrivateServerId/ReservedServerAccessCode per member), `SocialService:GetPlayersByPartyId(partyId)`; testable only with the Party Simulator or in production. Useful for "join my server with friends" in an 8-player-server game (reserve a server for a party of 4 → half the bases).
- **Moments** (clips): launched in beta (13+) at/after RDC 2025 as a short-form video feed; July 2026 homepage redesign made the Moments tab central; 30-second clips, trim, DistroKid music, react and jump into the featured game with one tap; UI and usernames are stripped automatically; the help centre says 10 uploads/day while `CaptureService` docs say 20 video uploads/day/user (discrepancy noted). From October 2026 players can tap an avatar in a clip to buy the items. Developer hooks: `CaptureService:StartVideoCaptureAsync()` (max 30 s, voice muted), `TakeScreenshotCaptureAsync()`, `PromptShareCapture()` (native share sheet **with an invite link and optional launch data** — the built-in virality hook), `PromptSaveCapturesToGallery()`, `UploadCaptureAsync()`; requires the Maturity & Compliance questionnaire. Events `CaptureBegan`/`CaptureEnded`/`UserCaptureSaved`.
- **Roblox Everywhere** (RDC 2026): creators can ship games as standalone apps on mobile, PC and consoles; a **Chrome web player** (no install) launches from the experience details page by end of 2026 **[search summary only]**. **Offline mode** merging with online play was announced **[search summary only]**. A **creator wallet** was announced at RDC 2026 **[search summary only; details unverified]**.
- **Build** (mobile, prompt-to-game): alpha in New Zealand produced ~9,000 games; 71% of its creators had never used Studio; expanding to Serbia and Singapore; Build games become playable inside the tab "in the months that follow" **[search summary only]**.
- **In-experience ads:** immersive ads (image, click-to-play video ≥15 s, autoplay video, portal) via `AdGui` on 8–32 × 4.5–18-stud blocks and the `BasePortal` package; **rewarded video** via `AdService:GetAdAvailabilityNowAsync(Enum.AdFormat.RewardedVideo)` → `AdService:ShowRewardedVideoAdAsync(player, reward)` where `reward = AdService:CreateAdRewardFromDevProductId(id)` and the grant flows through `MarketplaceService.ProcessReceipt` (rewards must be developer products, never randomised items; paid on impressions × EPM). Eligibility for both: publisher 13+, ID-verified, 2FA; experience public, Maturity & Compliance questionnaire approved, **≥2,000 unique visitors/month**. Use `PolicyService:GetPolicyInfoForPlayerAsync().AreAdsAllowed`. Payout on the 25th of the following month. Grow a Garden's documented placement: HUD button granting progressive consumables that accelerate growth (`production/ad-placements/growagarden.md`). Jan 2026: "Homepage Feature" premium ad unit (brands, CPM) reaching a stated 151M DAU **[search summary only]**.
- **Automatic translation** now covers 18 languages (Section 4.6) with real-time chat translation announced at RDC 2025.

---

## 2. ARCHITECTURE FOR THE GENRE

### 2.1 What the leaked/decompiled tree tells us (github.com/say30/brain)

Repository facts (read 2026-09-19): 1 commit, description "Import automatique depuis D:\Roblox\extr\out_flat"; ~650 extracted scripts named `NNNN_<Class>_<Path>.lua`; header comments "Extracted from: …, Source file: rickdev.rbxlx"; several modules carry "time of decompilation: Sat Jun 28 18:35:14 2025" and mention UniversalSynSaveInstance. Update gates inside the code: `Update-06/28/2025`, `Update-08/23/2025`, `Update-08/30/2025`, `Update-09/06/2025`. Identity as the live Steal a Brainrot is **[unverified]**; the content, names and structure match what exploit scripts target.

**Folder/service layout (as extracted):**

```
ReplicatedStorage/
  Packages/        Net, Signal, Trove, Promise, Observers, Input(Touch/Keyboard/Gamepad),
                   Synchronizer (custom replication), Replion, Freeze, Cmdr, Conch, FFlags, EasyVisuals, Gradients, Debounce
  Datas/           Animals (142 entries), Rarities, Mutations, Traits, Rebirth (14 tiers), ShopItems, Shop (gamepasses/products),
                   LuckyBlocks, ServerLuck, GalaxySpinWheel/MoltenSpinWheel/YinYangSpinWheel, FuseMachineData, Dialogues, AdminCommands, MutationsTextures
  Shared/          Game (cash multiplier), Animals (generation/sell-value helpers), Index, Updates (time-gated flags), Friends, VFX, ConchTypes
  Classes/         PlotClient, AnimalClient, AnimatedButton, Interface
  Controllers/     RebirthController, ShopController, CoinsShopController, FuseMachineController, HudController …
  Items/           Slap variants, Traps, Magnet, Lollipop, Ban Hammer … (each with a Controller Script)
ServerScriptService/
  Services/        Plots (PlotManager, Plot, PlotConstants, PlotSecurity, PlotSynchronizer, AnimalManager, AnimalStealing, AnimalGrab, LuckyBlockTimerManager),
                   Players, DataManagment, RoadAnimalService(RoadAnimalSpawner), MonetizationService (ServerLuckHandler, spin handlers),
                   FuseService, LikeService, AdminPanelService, CommandsService (Conch commands), CmdrService (Cmdr commands), SoftShutdownService, EventService, Tips
  Controllers/     ProfileStore (vendored)
  Main/            Data.Initialize, Data.Settings, Data.CmdrSetup, Data.MonetizationInit, Player.CoinShop, Player.ChatTags, Items.*, Server.ServicesManager
  Events/          MoltenEvent, GalaxyEvent, EventService
  MadAntiCheat/    third-party loader (Madonox, 2022) pulling modules 8472471824 / 8472470237
Workspace/
  Plots/<PlotName>/ Owner (ObjectValue), AnimalPodiums/<slot>/Base/Spawn, DeliveryHitbox, steal hitbox, multiplier display
```

Remotes are created through a `Net` package with `"Service/Action"` naming: `PlotService/ClaimCoins`, `PlotService/CashCollected`, `PlotService/Sell`, `PlotService/ToggleFriends`, `Rebirth/RequestRebirth` (RemoteFunction), `CoinsShopService/RequestBuy`, `SettingsService/ToggleSetting`, `NotificationService/Notify`, `GlobalEventRequest`, plus UUID-named steal/delivery/prompt remotes listed in `PlotConstants.REMOTES` (obfuscated names—a mild anti-remote-spy measure).

### 2.2 Data persistence (server-authoritative, session-locked)

**What the leaked tree does (and what you should do):**
- `ProfileStore.New("Data", template)`; key `tostring(player.UserId)`; `StartSessionAsync` with 3 attempts (delay 5 s × attempt, doubled on "session" conflicts); on total failure `player:Kick("Failed to load your data…")` with an error code; a 30-second `DATA_WAIT_TIMEOUT` guards every gameplay service (`waitForData`).
- After load: `Reconcile()` against the template, a corruption check (empty profile or missing `Coins` → deep-copy the template), `AddUserId(player.UserId)` (GDPR/right-to-be-forgotten), then `calculateOfflineGains()` and `updateLastOnline()`.
- On leave: `updateLastOnline`, `saveProfile` (= `EndSession()`), and `forceCleanupSession` if the save throws; `game:BindToClose` is handled by ProfileStore itself and by a **SoftShutdownService** that reserves a server (`TeleportService:ReserveServer`) and teleports everyone (halving wait times for VIP servers), redirecting late joiners too, and only returns when `#Players:GetPlayers() == 0`.
- Leaderstats (Cash/Rebirths/Steals) and per-player state are pushed to clients through a custom **Synchronizer** (one `RemoteEvent` `CommunicationRoute` + one `RemoteFunction` `RequestData`, channel API `Create/Get/Set/OnChanged/Destroy/Wait`). Keys synced: `Coins, Rebirth, Steals, Spins, PaidSpins, LastDailyDiscount, AnimalPodiums, Items, Gamepass, Settings, AutoBuy, RainbowEvent, TimesJoined, Index`.

**ProfileStore internals** (MadStudioRoblox/ProfileStore `ProfileStore.luau`, read 2026-09-19): `AUTO_SAVE_PERIOD = 300 s`, `LOAD_REPEAT_PERIOD = 10 s`, `FIRST_LOAD_REPEAT = 5 s`, `SESSION_STEAL = 40 s`, `ASSUME_DEAD = 630 s`, `START_SESSION_TIMEOUT = 120 s`, `CRITICAL_STATE_ERROR_COUNT = 5`, `MAX_MESSAGE_QUEUE = 1000`. Locks live in `MetaData.ActiveSession = {place_id, game_job_id, unique_session_id}` and are transferred with `UpdateAsync`; MessagingService is used to resolve conflicts faster than ProfileService did. API: `ProfileStore.New`, `:StartSessionAsync(key, {Steal = bool?})`, `:MessageAsync`, `:GetAsync(key, version?)`, `:VersionQuery`, `:RemoveAsync`; `Profile:IsActive/Reconcile/EndSession/AddUserId/RemoveUserId/MessageHandler/Save/SetAsync`. ProfileStore is explicitly *not* for leaderboards or global state.

**Platform limits you must design around** (Creator Docs `cloud-services/data-stores/error-codes-and-limits.md`, `versioning-listing-and-caching.md`, `best-practices.md`):
- Per key: 4,194,304 bytes; names/keys/scopes ≤50 chars; 25 MB/min reads and 4 MB/min writes per key.
- Per-experience request budgets per minute: reads `300 + 40×CCU`, writes `300 + 20×CCU`, lists `300 + 2×CCU`, removes `300 + 40×CCU` (server-level defaults `60 + 40×players` for read/write/remove). Request queues hold 30; overflow raises errors 301–306.
- `GetAsync` caches for 4 s (`DataStoreGetOptions.UseCache = false` to bypass). Prefer `UpdateAsync` whenever a write depends on the current value or several servers may write the same key.
- **Versioning:** a backup is taken on the first write to each key in each UTC hour and kept 30 days after being overwritten; `ListVersionsAsync`, `GetVersionAsync`, `RemoveVersionAsync`; daily **snapshot** via Open Cloud. This is your rollback tool for dupe incidents.
- **July 29, 2026 change** (reported by BloxBot/gmmarket guides **[search summary only]**): baseline per-experience storage rises to **500 MB + 1 MB per lifetime player**, and in-game and Open Cloud request budgets merge into one shared per-experience budget.
- Right-to-be-forgotten: automated RTBF processing for static key patterns, or webhooks for custom schemas.
- **OrderedDataStore** for persistent leaderboards (`GetSortedAsync`, `BatchGetAsync`; no versioning/metadata); write only on meaningful change, never per second.
- **MemoryStoreService** (`memory-stores/index.md`): SortedMap / Queue / HashMap; memory quota `64 KB + 1.2 KB × users`; **1,000 + 120 × CCU request units/min**; ≤1M items and 100 MB per structure; 32 KB per item; max TTL 45 days. Use for daily/weekly leaderboards, cross-server "what's spawned where", event state, code-use counters.
- **MessagingService** (`MessagingService.yaml`): 1 kB messages; per server `600 + 240 × players`/min; per topic `40 + 80 × servers`/min; whole game `400 + 200 × servers`/min; subscriptions per server `20 + 8 × players`; ~1–2 s best-effort delivery.
- **Configs** (feature flags): `ConfigService:GetConfigAsync()` / `GetConfigForPlayerAsync()` → snapshot `:GetValue(key)`; read-only in-game, edited in Creator Hub/Studio; changes propagate over ~5 minutes; keys are locked while an Experiment uses them (`production/experiments.md`, `cloud-services/data-stores-vs-memory-stores.md`).

### 2.3 Plot assignment and the plot state machine

- One plot per player, assigned on join after data is ready; the plot is a Workspace folder with an `Owner` value, N `AnimalPodiums` (only `MaxAnimals` for the player's tier are visible—extra podiums get `Transparency = 1`, `CanCollide = false`), a `DeliveryHitbox` (return point for stolen items), a steal hitbox around the base, and up to three floors with independent lock timers (`BlockEndTimeFirstFloor/SecondFloor/ThirdFloor`).
- States per slot: `Empty`, `Owner`, `Steal`, `Stealing`.
- Base lock: `DEFAULT_LOCK_TIME = 60 s` plus `AdditionalLockTime` from the rebirth table (10 s per rebirth, so 70–200 s at high rebirth); a 1-second `DELAY_TIME` before the first lock; "friends can enter" toggle (`ToggleFriends`) handled by the plot's security manager.
- Server size: eight bases per map, eight players per server (private servers also cap at 8) **[search summary of guides; Steal a Brainrot wiki blocked]**. Grow a Garden is commonly cited at 6 **[unverified]**.

### 2.4 Income-per-second and offline progression

- **Lazy accrual, no tick loop:** on `ClaimCoins`, per animal: `regularCoins = floor((GetServerTimeNow() - animal.LastCollect) * Animals:GetGeneration(index, mutation, traits, owner))`, then `LastCollect = now` *before* syncing to the client. The client (`PlotClient`) runs the identical formula every frame for the on-screen counter — zero remote traffic for the display.
- **Multiplier** (`Shared.Game.GetPlayerCashMultiplayer`): additive — base 1 + rebirth multiplier (0.5 → 13 across 14 rebirths) + VIP gamepass 0.5 + "2x Money" gamepass 2 + friend boost + update-gated multipliers + 0.5 per completed mutation set (Candy/Rainbow/Diamond/Gold).
- **Offline progression:** computed once on profile load: `elapsed = now - LastOnline`, capped by a per-rebirth-tier maximum; each animal gets `OfflineGain = elapsed` (seconds); on the next claim `offlineCoins = floor(OfflineGain * Generation)` and the field is cleared. Steal flags are reset during this pass. Because it is computed server-side from the persisted timestamp, it cannot be spoofed by the client; keep the cap modest (hours, not days) to protect the economy and make rebirth multipliers the main long-term lever.

### 2.5 The steal mechanic

Flow (`Services.Plots.AnimalStealing` / `AnimalGrab` / `PlotSecurity`):
1. Client fires `StealAnimal(timestamp, actionId, targetPlotName, animalSlot)` from a ProximityPrompt on the podium.
2. Server checks, in order: player data ready → **timestamp**: `|serverTime - (timestamp - 185)| ≤ 5 s` (a cheap replay/latency sanity check; note the leaked build has the failure return commented out with only a `print`) → target plot owner ≠ player → (a 50-stud distance check, commented out in this build) → `PlotSecurity.CanPlayerSteal`: player's `HumanoidRootPart` must be inside the base's steal hitbox (position converted to the hitbox's object space and compared against half-size), plot not locked, owner's friends-toggle honoured → slot holds an animal → capacity: "You need more room in your base to steal a brainrot!" (2-s notification debounce) → steal notification to the victim rate-limited to every 3 s.
3. The carried item is a **server-created visual clone** (non-collidable bounding box, `CarryHandle` welded to the thief's `HumanoidRootPart`, red "STOLEN" billboard, carry animation, `Transparency 0.5`); the slot flips to `Stealing`, tools are stashed in ServerStorage.
4. Delivery: touching your own `DeliveryHitbox` (2-s `DELIVERY_DEBOUNCE`) moves the record into your `AnimalList` with `LastCollect = now`, `Steal = false`.
5. Death/leave: `_cleanupStealState` removes tracks/models, restores tools, and the synchronizer resets the victim's slot.

**Hardening beyond the leaked build** (given the exploit scripts that exist — see 2.9): keep the distance check *on*; record `grabTime` and `grabPosition` server-side and reject deliveries whose implied speed exceeds sprint speed × 1.5; do the delivery test on the server with `WorldRoot:GetPartBoundsInBox` rather than trusting `.Touched`; never let a `RemoteEvent` carry the plot/slot identity without re-deriving ownership server-side; make `actionId` single-use.

### 2.6 RNG, rarity, mutations and pity (all server-side)

- **Conveyor/road spawner** (`RoadAnimalSpawner`): loop on `SPAWN_COOLDOWN`; candidate animals are those with `RoadWeight > 0`; weighted random pick; **server luck** (2×/4×/6×/8× dev products, 15-minute durations, `ServerLuckEndTime`) *divides the roll* to bias toward rare tiers; **pity timers** per rarity guarantee a tier when its timer hits zero; `MAX_ANIMALS_ON_ROAD` bounds active spawns; purchase via ProximityPrompt "Purchase $price".
- **Rarity table** (`Datas.Rarities`): Common 1, Rare 2, Epic 3, Legendary 4, Mythic 5, Brainrot God 6, Secret 7, OG 8, Admin 9, Taco 10 (weights are ordering/tier values; spawn odds come from per-animal `RoadWeight`, e.g. Noobini Pizzanini 100 vs Matteo 23).
- **Animal records** (142 entries): `DisplayName, Rarity, Price, Generation, RoadWeight?, IgnoreIndexCounter?, IsEnabled?() (update-gated), SpawnVFX?, SpawnDelay?`. Range: Price 25 → 6,000,000,000; Generation 1/s → 37,500,000/s.
- **Mutations** (`Datas.Mutations`): base "no mutation" weight 80 in the spawner; Gold weight 7 (income modifier +0.25), Diamond 3 (+0.5), Rainbow 0.2 (+9), Bloodrot (+1), event-limited Candy (+3), Lava (+5), Galaxy (+6), Yin Yang (+6.5) gated by `LimitedMutation` Unix timestamps; events (Bloodmoon/Rainbow/Candy) force or reweight outcomes.
- **Fuse machine**: combines rarity weights + mutation `RarityBoost` tables into a new weighted roll (`FuseService`).
- Everything rolls with the server's RNG; the client only receives results. Lucky blocks (`LuckyBlockTimerManager`) are timers with array/weighted animal pools.

### 2.7 Rebirth

14 rebirths (`Datas.Rebirth`; `PlotConstants.TIERING.MAX_REBIRTHS = 13` with rebirth 14 update-gated). Cash cost escalates 1M → 100T; each tier also lists `RequiredCharacters` (own specific brainrots) — this is the collection pressure that feeds stealing. Rewards: multiplier 0.5 → 13 (linear), cash payout 5K → 2.5T, `AdditionalLockTime` +10 s per tier, +1 podium slot from rebirth 2, and 2–3 exclusive items per tier. `Rebirth/RequestRebirth` validates the synchronizer, tier existence, coin balance and collection, applies, and **reverts if the plot update fails**.

### 2.8 Trading

The leaked tree has **no trading system** — stealing *is* the item-transfer mechanic, which removes the largest dupe surface (trade + leave/rejoin during save). Grow a Garden, which does trade, is the title associated with dupes/rollbacks and trust erosion (Section 6). If you add trading: server-side escrow object; both parties must re-confirm after any change with a 3-second lock; item instances carry UUIDs and are moved atomically under session lock; log every completed trade (custom analytics event + a DataStore/MemoryStore audit record with both UserIds and item UUIDs); rate-limit trade prompts; add a "trade cooldown" for new accounts.

### 2.9 Anti-exploit and the 2026 exploit landscape

Platform side: Hyperion (built from Byfron, which Roblox acquired; deployed 2023) is described in 2026 as having "no known public methods to bypass"; working executors are paid, break after client patches, and suffer ban waves ("bypass on Monday, detected Wednesday, ban wave Friday"). Free-executor culture is "hollowed out"; mobile executors (Delta etc.) still advertise **[search summaries; specific claims unverified]**.

Reality for *your* game (from GitHub, 2026-09-19): dozens of Steal a Brainrot cheat repos and gists exist — teleport-to-own-base while holding an item, `firetouchinterest(HRP, DeliveryHitbox)` "insta steal", tweening across the map, base-lock ESP timers reading `workspace.Plots`, noclip, anti-ragdoll, "sky route steal", auto-rebirth, plus **Discord-driven server sniping** (Chilli Notify posts job IDs of servers where high-income brainrots appear; `notasnek/roblox-autojoiner` joins them via an executor). Some scripts even attempt to block outbound remotes named `NoclipDetected`, `CheatDetected`, `ViolationReport`, `ServerLog` — i.e. client-side anti-cheat reporting is routinely neutralised.

Roblox's official guidance (Creator Docs `scripting/security/*`): never trust the client; ask "what if this remote fires 1,000×/s?"; keep logic in ServerScriptService, never in ReplicatedStorage/Workspace; sanity-check physical plausibility (distance before shop purchase); **server-side detection heuristics**: fastest-possible completion time, rate of gain, inhuman action cadence, **honeypot remotes** (any traffic = cheat), a **suspicion score** combining signals, and a **consequence ladder** (silent log → quiet mitigation/clamp → temporary restriction → kick/ban). Physics: exploiters own their character's network ownership and can set `Inf`/`NaN` velocities to fling; use `SetNetworkOwner` on gameplay-critical assemblies, distance-over-time and leaky-bucket movement validation, plane projection to catch teleports; Server Authority ultimately moves character simulation server-side.

Concrete checklist for this genre: rate-limit every remote per player (token bucket, e.g. 10 calls / 5 s for steal/delivery); validate plot ownership and slot state on every call; travel-time check from grab to delivery; server-only `ProcessReceipt`; never grant items from the client's declared product; hide nothing sensitive in `ReplicatedStorage.Datas` that isn't already public (odds tables *will* be read — that's fine, the rolls are server-side); log detections with `AnalyticsService:LogCustomEvent`; prefer time-gated content flags over shipping hidden models that leakers can extract (the leaked tree ships future animals with `IsEnabled()` gates — the entire roadmap was readable).

### 2.10 Networking and replication choices

- Property/state replication: attributes or a small custom synchronizer (as above) rather than hundreds of `IntValue`s; with `NextGenerationReplication` on, do not depend on ordering between property replication and remotes.
- Bandwidth: 8 players × small plots is cheap; if you add many road spawns/VFX, move to buffer-based remotes (Zap) and keep `StreamingEnabled` on.
- Client-side prediction for cosmetics only (coin counter, carry animation); the server decides everything with value.

---

## 3. PERFORMANCE & SCALE

### 3.1 Who is playing on what

- Mobile ≈ **72% of Roblox activity** (2026); PC 25%, console 3% (Udonis) **[search summary only]**; mobile sessions rose from 74% to **80% of sessions in Q1 2026** (SQ Magazine) **[search summary only]**.
- Android RAM distribution among players: ~60% 2–4 GB, ~35% 4–8 GB, ~5% >8 GB; >50% of players use devices scoring 10,000–20,000 on Passmark (Creator Docs `performance-optimization/test-on-hardware.md`). Studio's emulator "can't fully replicate real hardware" — test on cheap Android phones.

### 3.2 Why 6–8 player servers (and the numbers behind it)

- Design: one base per player, eight bases per map; stealing needs everyone within a short run; 8 keeps grief and loss tolerable and makes private servers (8-player) attractive.
- Memory: each server historically capped at **6.25 GB**; Roblox later moved to a scaling formula reported as **6.4 GB + 50 MB × peak players** (DevForum "Even More Server Memory") and there are 2025–2026 reports of crashes below the nominal cap and at ~8 GB for large servers **[search summaries only]**. Small servers keep instance count, physics and replication linear and small; you can afford lavish per-plot VFX.
- Cost of small servers: MessagingService and MemoryStore quotas scale with *server count* (`40 + 80×servers` per topic per minute), so global "admin abuse" broadcasts must be one message per event, deduplicated by `game.JobId`.
- Discovery: Roblox's compute-efficiency metric favours higher max players per server (analytics `performance.md`), but that metric "is not indicative of a good or bad player experience"; the genre's CCU records (25.8M) were set with 8-player servers.

### 3.3 Budgets Roblox actually publishes (Creator Docs `performance-optimization/design.md`, `improve.md`, `workspace/streaming/index.md`)

- Baseline for low-end: **<1,000 draw calls and <1,000,000 triangles** on screen; 16.67 ms/frame at 60 FPS, split long work into ~5 ms chunks; `updateInvalidatedFastClusters` >4 ms in MicroProfiler = avatar churn.
- Textures ≤512×512 (256 for minor); prefer built-in materials; avoid partial transparency (0 or 1 only); instance identical meshes (resize/rotate the same asset ID) and use Packages to avoid duplicate asset IDs; `LevelOfDetail.SLIM` avatars for crowds.
- Watch `LuaHeap`, `InstanceCount`, `PhysicsParts` in the Developer Console; growing LuaHeap = leak.
- **StreamingEnabled** defaults: `StreamingMinRadius 64`, `StreamingTargetRadius 1024`; set `ModelStreamingBehavior = Improved`, `StreamOutBehavior = Opportunistic`, mark each plot's essential parts `ModelStreamingMode = Persistent` (or `PersistentPerPlayer` for the owner's plot), enable `PredictiveStreamingMode`; late-2026 adds adaptive radius + path prefetch and a 500-stud minimum draw distance on low-end devices.
- Physics: adaptive stepping (default); fixed mode forces 240 Hz.

### 3.4 Genre-specific tricks

- Hide podiums beyond the player's slot cap (transparency + no collision) instead of destroying/creating models (leaked tree).
- Compute the coin counter on the client from `LastCollect` (no remote spam).
- Keep every brainrot a single low-poly `MeshPart` (+ optional decal) with one `Animator`; avoid `Humanoid`s on brainrots (docs: humanoids are expensive; disable unused states) — animate via `AnimationController`.
- Pool VFX; cap simultaneous road spawns (`MAX_ANIMALS_ON_ROAD`).
- Server: one heartbeat loop for lock timers; no per-animal `while task.wait()` loops.

### 3.5 Mobile-first UI and touch

- Landscape default; `StarterGui.ScreenOrientation` (LandscapeSensor/Sensor/LandscapeLeft/LandscapeRight/Portrait).
- Use the **Input Action System** (actions + bindings) so steal/sell/lock buttons work on touch, keyboard and gamepad; add `HapticEffect` (`GameplayCollision`) for grabs. `ContextActionService` still works for quick on-screen buttons.
- Respect safe areas (`ScreenGui.ScreenInsets`), ≥44-px touch targets, `UISizeConstraint`/`UIAspectRatioConstraint`, scale-based sizing; test in Studio's device emulator for aspect ratios only, then on real phones **[practice guidance, not a doc citation]**.
- `Player.DevTouchMovementMode`, `DevTouchCameraMode`, `AutoJumpEnabled` are server-settable per player.

---

## 4. CONTENT PIPELINE

### 4.1 Characters at volume (dozens of "brainrots")

- **Blender low-poly workflow:** block out 300–1,500-tri characters, single 512² texture atlas (or vertex colours + built-in materials to save memory), export FBX/OBJ → Studio 3D Importer; run **Avatar Auto-Setup** when you want an R15 rig so standard animations play. Reuse one rig for a whole family (fish-with-legs, shark-with-shoes) and vary meshes/textures.
- **Mutation as a texture/material swap** (Gold/Diamond/Rainbow…): the leaked tree keeps a `MutationsTextures` table and `Gradients` presets — one model, N looks, huge perceived content for near-zero cost. Docs' content-cadence guidance says exactly this: "simple variants on existing assets, like slight colour changes, are ideal" for a 2-week–1-month cadence with <3 weeks of effort each.
- **Creator Store:** free models/meshes/audio; verify each asset's licence terms in the Creator Store listing and prefer Packages so updates propagate.
- **AI mesh generation:** Studio Mesh Generation (Cube) via Assistant/MCP; Procedural Models (50/24 h). Third-party: **Meshy** — paid plans give full commercial rights (free tier is CC BY 4.0, attribution required); **Tripo** — free tier non-commercial, paid tiers commercial and private **[search summaries of vendor pages; verify current ToS]**. Roblox moderates all generated content and expects generative-AI disclosure under content-maturity rules (`production/promotion/content-maturity.md`); there is no Creator Store ban on AI assets as of the docs read on 2026-09-19 **[absence of evidence, not a policy citation]**.
- Cheap character volume plan: 10 base rigs × 3–4 mesh variants × 8 mutation looks ≈ 240–320 distinct collectibles from ~40 unique meshes.

### 4.2 Animation

- Roblox **Animation Editor**: keyframes at 30 FPS default, easing styles (Linear/Constant/CubicV2/Elastic/Bounce, In/Out/InOut), auto-removal of redundant keyframes, curve editor, IK, facial animation, 7 priority levels (Creator Docs `animation/editor.md`). Sufficient for idle bobs, carry poses and rebirth flourishes.
- **Moon Animator 2** (paid third-party plugin) remains popular for cinematic/keyframe-dense work **[2026 status unverified]**.

### 4.3 Audio

- Uploads are private by default; ID-verified creators may upload **2,000 audio assets per 30 days** (100 if unverified); ≤20 MB, ≤7 minutes, ≤48 kHz, mp3/ogg/wav/flac (Creator Docs `audio/assets.md`).
- Licensed music: Creator Store carries **100,000+** professionally produced tracks/SFX from partners (APM Music and Monstercat are the commonly cited libraries; DistroKid partnership since Aug 2024 lets artists publish "public audio") **[partner names from search summaries]**. Do not upload commercial music you don't own — it will be muted/removed.
- Moments clips can add DistroKid music on the platform side; your in-game music does not need to be clip-safe.

### 4.4 Icons, thumbnails, video

- Icon: square, ≥**512×512**; preview at 150×150 (Creator Docs `production/publishing/experience-icons.md`).
- Thumbnails: **1920×1080, <3 MB**, 2–5 active thumbnails; video thumbnails must show authentic gameplay (`thumbnails.md`).
- Both pass moderation; iterate them as A/B levers (the platform reports recommendation conversion in Acquisition analytics).

### 4.5 Rewarded video and immersive ads as "content"

See Section 1.6. Rewarded video rewards must be developer products (e.g. "5-minute 2× luck", "instant lock refill"); Grow a Garden's documented pattern is a HUD button granting progressive consumables.

### 4.6 Localization (do this at MVP)

- **Automatic translation** covers 18 languages: Arabic, Chinese (Simplified/Traditional), English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese, Russian, Spanish, Thai, Turkish, Vietnamese (Creator Docs `production/localization/automatic-translations.md`). Enable "Capture text from experience UI while users play" (ATC) and "Use Translated Content"; strings must have `AutoLocalize` on; quotas are per character per language with a monthly top-up; manual entries always win.
- Every player account has **Automatic Translations on by default** (2026), so even untranslated games get machine-translated names/descriptions/UI **[DevForum "New Translation Setting for Players" — search summary only]**.
- Brainrot names are meme-proper nouns: add them to the translation table with identical values in every language to stop the MT from "translating" them.

---

## 5. LIVE-OPS TOOLING

### 5.1 "Admin abuse" events (what they are and how the leaked tree runs them)

- Player-facing: scheduled windows in which staff spawn rare brainrots, push server luck and trigger global events across *all* servers **[Eldorado "admin abuse schedule" — search summary only]**.
- Implementation seen in the leaked tree: two command frameworks (**Cmdr** by evaera and **Conch**) with role/permission gates; commands `announce` (MessagingService broadcast), `pushserverluck` (multiplier + duration), `startglobalevent`/`executeglobalevent` (publishes to a UUID-named topic; a `GlobalEventStopAll` topic; `_G.EventService` applies luck/mutation changes locally), `spawnroadbrainrot`/`spawnroadbrainrotglobal` (publishes `GlobalRoadAnimalSpawn` with `{AnimalName, Mutation, Traits, FromServer = game.JobId, Executor}` and every server ignores its own JobId), `createmerch` (writes one-time codes into a DataStore `MerchCodes` key with `UpdateAsync`), `setrebirth`. A mobile admin panel (`StarterGui.Mobile Admin Panel`) exists for phones. A separate **"Admin Commands" gamepass** sells *troll* powers to players (jail, morph, ragdoll, rocket, tiny, control, balloon) with per-player cooldowns — monetised "admin abuse lite".
- Design the broadcast within limits: one `PublishAsync` per event (≤1 kB), subscribers apply idempotently, include `EventId` + `EndsAt` so late-starting servers catch up from MemoryStore rather than missing the message.

### 5.2 Remote config without redeploy

Three layers, all used in this genre:
1. **Configs** (Creator Hub; `ConfigService`): feature flags and tunables; ~5-minute propagation; read-only; A/B-able via Experiments.
2. **MemoryStore hash map** for instant flags/event state (seconds), polled every 30–60 s by each server; **DataStore** for durable settings (the leaked `FFlags` package splits Server/Client readers).
3. **Time-gated content** (`Shared.Updates`: `Update-08/23/2025`, `-08/30/2025`, `-09/06/2025` as Unix timestamps; animals/mutations carry `IsEnabled()`/`LimitedMutation` gates): ship next week's content in this week's build and unlock it by server time — no Friday-night publish/restart needed. Trade-off: leakers read the roadmap (they did).

### 5.3 Analytics

Creator Docs `production/analytics/*` (read 2026-09-19):
- Dashboards: Retention (D1/D7/D30; daily cohorts over 10 days, weekly over 10 weeks; 7-day playtime/conversion/revenue per cohort), Engagement, Monetization (payer conversion, ARPPU), Acquisition (sources, recommendation conversion), Funnels, Economy, Custom events, Benchmark scorecards, Insights, and the Performance dashboard.
- APIs (server-only, published places only, ~24 h aggregation delay): `AnalyticsService:LogOnboardingFunnelStepEvent(player, step, name)` (steps 1–100; recommended for tutorial), `LogFunnelStepEvent(player, funnelName, funnelSessionId, step, name)` (≤10 unique funnels; 10 most recent session IDs per user), `LogEconomyEvent(player, Enum.AnalyticsEconomyFlowType.Source|Sink, currency, amount, endingBalance, transactionType, itemSku?)` (≤5 currencies, 100 SKUs; types IAP/TimedReward/Onboarding/Shop/Gameplay/ContextualPurchase or custom), `LogCustomEvent(player, name, value?)` (≤100 events; 8,000 unique custom-field combinations per experience), progression/journey events, and `GetPlayerSegmentsAsync(player)` for runtime segmentation (spend/tenure/engagement buckets).
- **Aug 2026 platform update** (about.roblox.com — blocked; PocketGamer/search summaries): new segment dimensions (in-game activity, engagement level, platform activity, tenure, platform spend), the Explore interface, and an **Analytics Query API** for pulling aggregated metrics.
- Wire from day one: onboarding funnel (spawn → first purchase → first steal → first lock → first rebirth), economy sources (generation, sells, codes, rewarded ads) vs sinks (purchases, rebirth), custom events for steals/locks/exploit flags.

### 5.4 A/B testing (Roblox Experiments)

`production/experiments.md`: in-game experiments = up to **2 variants + control** on Config keys; matchmaking experiments up to 3 variants; run **14–60 days**; metrics D1/D7 retention, playtime/session time, ARPU/ARPPU, payer conversion; players are enrolled on first `GetValue()` for that key; the key is locked during the experiment; **<1,000 DAU "might struggle to get useful data"**. Third-party: GameAnalytics offers a Roblox SDK and a 2026 Roblox benchmark report (500+ titles with 1M+ MAU) **[search summary only]**.

### 5.5 Codes

Not a platform feature. Server-side only: normalise (`upper`, trim), look up in a Config/DataStore table with expiry and max uses, store redeemed codes in the player's profile, count global uses in MemoryStore, rate-limit the remote (1 attempt / 2 s), never reveal validity timing differences. The leaked tree's merch-code generator (DataStore `MerchCodes`, `UpdateAsync`, `{code, redeemed, updated}`) is the minimal version.

### 5.6 Update deployment, staging and rollback

- Keep a **staging place** (same universe or a private copy) with production data-store *names* prefixed (`Data_staging`) so you never test against live keys; use Version History notes as changelog; publish to production, then **restart servers** from Creator Hub so new servers pick up the version (the platform name of that button was not verifiable on GitHub docs) and let the **SoftShutdownService** pattern move players without a hard kick.
- Rollback = Version History → restore → publish → restart; data rollback = DataStore versions (30-day hourly backups) or Open Cloud snapshots. Practice both before launch.
- Cadence: weekly (Steal a Brainrot) is the competitive norm in 2025–2026; Roblox's own guidance is "every two weeks to one month" with <3 weeks of effort per cadence drop.

---

## 6. PRODUCTION PLAN BENCHMARKS

### 6.1 The two reference cases

| | Grow a Garden | Steal a Brainrot |
|---|---|---|
| First version | built in "three or four days" by an anonymous 16-year-old (username BMWLux) | rebuilt from Killioz's *Steal a Character* (concept rights purchased) with the Italian-brainrot theme by SpyderSammy (Sam Brakta, 24) and @do_small |
| Launch | March 26, 2025 | May 16, 2025 (group BRAZILIAN SPYDER, owned by Do Big Studios) |
| Scale-up | partially acquired by Janzen Madsen (Splitting Point), who staffed a team; ~2M avg concurrent and >10B visits by June 2025 | weekly updates; "Update 20" on Oct 11, 2025 |
| Peak CCU | **21.3M on June 21, 2025** (then an all-time record) | **25,836,222** (Oct 11, 2025) — still the only Roblox game above 25M |
| 2026 status | reported decline to ~40–50K average players amid exploits, dupes/rollbacks, "confusing progression resets" and trust erosion **[ggwtb.com — search summary only]** | ~72.4B lifetime visits; an *estimated* $577.5M lifetime revenue (profitable.app model: 2% payer rate × 150 Robux × 70% share × $0.0038/Robux — an estimate, **[unverified]**) |
| Notable incidents | April 2025 data-loss bug "finally getting fixed" (TikTok) | copyright litigation reported by Aftermath ("Brainrot Goes To Court") **[blocked; unverified]**; a decompiled build circulating on GitHub |
| Platform impact | Roblox 2025 bookings ended +55% at $6.8B, credited to both titles **[PocketGamer — search summary only]** | same |

All figures except the platform-doc ones are from search-engine summaries of Wikipedia/press because the pages were blocked; dates are as reported.

### 6.2 Realistic timelines and budgets

- **Solo, experienced Roblox scripter, Studio-only:** playable prototype (8 plots, road spawner, steal/lock, ProfileStore, 15 characters, rebirth ×3) in **5–10 days**; store-ready MVP with codes, analytics, translations, mobile UI, anti-exploit basics, thumbnails in **3–4 weeks**.
- **2–3 person team (scripter + artist + designer/ops):** MVP in **3–6 weeks**, then weekly drops. This matches the genre's own origin stories (days to prototype, weeks to polish) and generic 2026 estimates ("simple Roblox game 2–4 weeks; live-service 3–6 months") **[Chicmic — search summary only]**.
- **Outsourced cost benchmark:** a simulator-style Roblox game "$8,000–$30,000+" depending on progression, pets, UI and monetisation **[Chicmic — search summary only]**. In-house: the dominant cost is 8–16 weeks of two people's time plus ~$200–$1,000 in assets/plugins/AI credits.
- Launch spend: Roblox Ads Manager (sponsored placements) for the first weekend; Roblox reports a 150% lift in impressions and +24% plays for games that run ads **[Roblox marketing claim]**. Immersive/rewarded ads only unlock at ≥2,000 monthly unique visitors.

### 6.3 A concrete 6-week plan (2–3 people)

1. **Week 1 — foundations:** Rojo/Wally/`--!strict` repo; ProfileStore data layer with template + reconcile + kick-on-fail + soft shutdown; 8-plot map; road spawner with weights/pity; economy tables in `Datas/`.
2. **Week 2 — core loop:** lazy income + client prediction; steal/carry/deliver with server validation; base lock timers; sell; leaderstats; first 20 characters (10 meshes × 2 variants).
3. **Week 3 — progression & money:** rebirth table (10 tiers), mutations (4), gamepasses (2× cash, VIP, auto-collect), server-luck dev products, lucky blocks; codes; offline gains with caps.
4. **Week 4 — mobile & polish:** Input Action System bindings, safe-area UI, StyleSheet theme, VFX pooling, StreamingEnabled tuning, low-end phone tests; auto-translation on; icons/thumbnails.
5. **Week 5 — ops:** analytics events (onboarding funnel, economy, custom), Configs flags, admin command framework + global-event broadcast, exploit heuristics + honeypots, staging place, rollback drill.
6. **Week 6 — launch:** private test with 50 players, fix data/perf, publish, Ads Manager weekend, first weekly update pre-gated by timestamp.

### 6.4 Technical mistakes that kill these games (and the mitigation)

| Failure | Cause seen in the wild | Mitigation |
|---|---|---|
| **Data loss / rollbacks** | `SetAsync` races between servers, no session lock, saving on `PlayerRemoving` only, DataStore throttling (write budget `300 + 20×CCU`/min shared by *all* servers), `BindToClose` missing | ProfileStore/session locking, `UpdateAsync`, autosave 3–5 min with jitter, save on leave + shutdown, versioned backups + snapshots, staging store names |
| **Dupes** | trading + leave/rejoin mid-save; client-declared item IDs; `ProcessReceipt` granting before persistence | no trading at MVP (steal instead); UUID items; escrow + double confirm; grant inside the session lock and only return `PurchaseGranted` after the profile is updated |
| **Server crashes at scale** | memory leaks (connections never disconnected, tables keyed by Player never cleared, VFX never destroyed), unbounded road spawns, 6.25 GB+ usage | Trove/Janitor cleanup per player, cap spawns, track `LuaHeap`/`InstanceCount`, keep 8-player servers, soft shutdown |
| **Economy blow-ups** | uncapped offline gains, additive multipliers stacking with events, admin commands sold as gamepass abused | cap offline hours per tier, simulate the rebirth curve in a headless test, log every source/sink |
| **Exploits** | client-trusted delivery (`Touched`), no travel-time checks, client anti-cheat reporting (trivially blocked), remotes without rate limits, secrets in ReplicatedStorage | server bounds checks, suspicion score + consequence ladder, honeypots, rate limits, Server Authority when stable for your movement model |
| **Trust collapse** | mass rollbacks after dupe waves; silent progression resets | communicate in-game (`NotificationService/Notify` + Configs banner), compensate via codes, roll back surgically with DataStore versions |
| **Mobile churn** | UI built for 16:9 desktop, >1,000 draw calls, big textures, no touch bindings | Section 3 budgets; test on 2–4 GB Android |
| **Roadmap leaks** | future content shipped inside the place with time gates | accept it, or stage assets behind server-only `InsertService` loads for the reveal week |

---

## 7. Quick reference: API names used in this brief

`DataStoreService` (`GetAsync/SetAsync/UpdateAsync/IncrementAsync/RemoveAsync/ListVersionsAsync/GetVersionAsync/RemoveVersionAsync`, `GetOrderedDataStore`, `GetSortedAsync`, `BatchGetAsync`, `DataStoreGetOptions.UseCache`), `MemoryStoreService` (SortedMap/Queue/HashMap), `MessagingService:PublishAsync/SubscribeAsync`, `ConfigService:GetConfigAsync/GetConfigForPlayerAsync → :GetValue`, `AnalyticsService:LogOnboardingFunnelStepEvent/LogFunnelStepEvent/LogEconomyEvent/LogCustomEvent/LogProgressionEvent/LogJourneyEvent/GetPlayerSegmentsAsync`, `AdService:GetAdAvailabilityNowAsync/ShowRewardedVideoAdAsync/CreateAdRewardFromDevProductId`, `Enum.AdFormat.RewardedVideo`, `MarketplaceService.ProcessReceipt`, `PolicyService:GetPolicyInfoForPlayerAsync().AreAdsAllowed`, `CaptureService:StartVideoCaptureAsync/StopVideoCapture/TakeScreenshotCaptureAsync/PromptShareCapture/PromptSaveCapturesToGallery/UploadCaptureAsync`, `SocialService:GetPartyAsync/GetPlayersByPartyId/PromptGameInvite/CanSendGameInviteAsync`, `Player.PartyId`, `Workspace.AuthorityMode/NextGenerationReplication/UseFixedSimulation/PlayerScriptsUseInputActionSystem/SignalBehavior/StreamingEnabled/StreamingMinRadius/StreamingTargetRadius/ModelStreamingBehavior/StreamOutBehavior/PredictiveStreamingMode`, `ModelStreamingMode` (Nonatomic/Atomic/Persistent/PersistentPerPlayer), `RunService:BindToSimulation`, `Animator:GetTrackByAnimationId/GetPlayingAnimationTracks`, `GenerationService:GenerateModelAsync`, `TeleportService:ReserveServer/TeleportToPrivateServer`, `game:BindToClose`, `workspace:GetServerTimeNow`, `UIShadow/UIGradient/UIStroke/UICorner/UIPadding`, `StyleSheet/StyleRule`, `StarterGui.ScreenOrientation`, `HapticEffect`, `LevelOfDetail.SLIM`, Luau `--!native`, `@native`, `--!strict`, `type function`, `const`, `if local`.

---

## Sources

### Fetched and read directly (2026-09-19)
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/projects/server-authority/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/projects/server-authority/techniques.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/Workspace.yaml
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/characters/character-controller-library/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/studio/testing-modes.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/luau/native-code-gen.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/luau/type-checking.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/luau/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/data-stores-vs-memory-stores.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/data-stores/error-codes-and-limits.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/data-stores/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/data-stores/best-practices.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/data-stores/versioning-listing-and-caching.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/memory-stores/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/memory-stores/per-partition-limits.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/cloud-services/cross-server-messaging.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/MessagingService.yaml
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/experiments.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/analytics/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/analytics/funnel-events.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/analytics/economy-events.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/analytics/custom-events.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/analytics/retention.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/AnalyticsService.yaml
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/onboarding.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/content-updates.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/liveops-essentials.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/game-design/liveops-planning.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/monetization/immersive-ads.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/rewarded-video-ads.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/rewarded-video-guides.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/ad-placements/growagarden.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/promotion/advertise.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/CaptureService.yaml
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/SocialService.yaml
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/Player.yaml
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/scripting/security/security-tactics.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/scripting/security/server-side-detection.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/scripting/security/network-ownership.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/ai/accelerated-workflows.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/assistant/guide.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/parts/model-generation.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/generative-AI.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/localization/automatic-translations.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/localization/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/projects/collaboration.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/projects/version-history.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/workspace/streaming/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/performance-optimization/design.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/performance-optimization/improve.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/performance-optimization/test-on-hardware.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/input/mobile.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/ui/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/ui/appearance-modifiers.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/ui/styling/index.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/audio/assets.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/animation/editor.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/publishing/experience-icons.md
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/publishing/thumbnails.md (via code search)
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/production/analytics/performance.md (via code search)
- https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/classes/AdService.yaml (via code search)
- https://github.com/luau-lang/luau/releases
- https://github.com/luau-lang/rfcs/tree/master/docs
- https://github.com/luau-lang/rfcs/blob/master/docs/user-defined-type-functions.md
- https://github.com/rojo-rbx/rojo/releases
- https://github.com/rojo-rbx/rokit
- https://github.com/UpliftGames/wally/releases
- https://github.com/JohnnyMorganz/StyLua/releases
- https://github.com/JohnnyMorganz/luau-lsp/releases
- https://github.com/Kampfkarren/selene/releases
- https://github.com/takoyakisoft/roblox-rojo-wally-template
- https://github.com/red-blox/zap
- https://github.com/Sleitnick/Knit
- https://github.com/Roblox/studio-rust-mcp-server
- https://github.com/Roblox/cube/
- https://github.com/MadStudioRoblox/ProfileStore
- https://github.com/MadStudioRoblox/ProfileStore/blob/main/ProfileStore.luau
- https://github.com/easy-games/chickynoid
- https://github.com/say30/brain (and files: `…Services.Plots.PlotConstants.lua`, `…Plots.AnimalStealing.lua`, `…Plots.AnimalGrab.lua`, `…Plots.AnimalManager.lua`, `…Plots.Plot.lua`, `…Plots.PlotSecurity.lua`, `…Plots.lua`, `…Services.Players.lua`, `…Services.DataManagment.lua`, `…Controllers.ProfileStore.lua`, `…Main.Data.Initialize.lua`, `…Services.SoftShutdownService.lua`, `…Services.AdminPanelService.lua`, `…Services.LikeService.lua`, `…RoadAnimalService.RoadAnimalSpawner.lua`, `…MadAntiCheat.Core.lua`, `…Events.EventService.lua`, `…GlobalEventServerHandler.lua`, `…CmdrService.Commands.CustomCommands.spawnroadbrainrotServer.lua`, `…CommandsService.Commands.executeglobalevent.lua`, `…Datas.Rarities.lua`, `…Datas.Mutations.lua`, `…Datas.Rebirth.lua`, `…Datas.Animals.lua`, `…Shared.Game.lua`, `…Shared.Updates.lua`, `…Packages.Synchronizer.lua`, `…Packages.FFlags.lua`)
- https://github.com/notasnek/roblox-autojoiner
- https://github.com/robloxcomphub/stealabrainrot
- https://gist.github.com/hell0109/87a939c44d027e6651dd535d4f4147b7
- GitHub code search results for Steal a Brainrot exploit scripts (repos `Kirsiasc/STREE-HUB`, `pebbleford/roblox-scripts`, `HOSTI1315/Opensurs`, `teogabrielofc/hub.facil.wtf`, `msami223/Scripts`, `bory0739-rgb/ChudyHub`, `contortz/RB`, `trejosau/api-finder`)

### Search-result summaries only (pages blocked by the proxy; facts marked accordingly)
- https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play
- https://about.roblox.com/newsroom/2025/09/roblox-rdc-2025
- https://about.roblox.com/newsroom/2026/07/creating-responsive-cheat-resistant-games-roblox-server-authority
- https://about.roblox.com/newsroom/2026/08/optimize-testing-live-updates-roblox-analytics-experimentation-platform
- https://about.roblox.com/newsroom/2026/07/moments-new-homepage-unlocks-gaming-for-all
- https://about.roblox.com/newsroom/2026/02/accelerating-creation-powered-roblox-cube-foundation-model
- https://about.roblox.com/newsroom/2026/05/cubepart-roblox-open-vocabulary-part-controllable-3d-generator
- https://ir.roblox.com/news/news-details/2026/Roblox-Unveils-New-Ways-to-Play-Build-and-Grow-at-the-Roblox-Developers-Conference-RDC/default.aspx
- https://www.businesswire.com/news/home/20260911312666/en/Roblox-Unveils-New-Ways-to-Play-Build-and-Grow-at-the-Roblox-Developers-Conference-RDC
- https://www.91mobiles.com/gaming/roblox-announces-standalone-game-apps-at-rdc-2026/
- https://allthings.how/roblox-rdc-every-major-announcement-for-players-and-creators/
- https://allthings.how/roblox-everywhere-offline-play-standalone-apps-and-browser-games-rdc/
- https://tbreak.com/roblox-offline-browser-ai-game-creation/
- https://devforum.roblox.com/t/rdc25-what-we-announced/3920245
- https://devforum.roblox.com/t/creator-roadmap-2025-rdc-update/3961527
- https://devforum.roblox.com/t/creator-roadmap-2026-spring-update/4625473
- https://devforum.roblox.com/t/creator-roadmap-2026-fall-update/4880208
- https://devforum.roblox.com/t/general-release-luau%E2%80%99s-new-type-solver/4084991
- https://devforum.roblox.com/t/redesigned-place-version-history-in-studio/4451086
- https://devforum.roblox.com/t/upcoming-improvements-to-physics-replication/4675512
- https://devforum.roblox.com/t/help-with-the-new-server-authoritative-physics-causing-major-issues-in-the-game/4698015
- https://devforum.roblox.com/t/early-access-introducing-in-experience-4d-functional-objects-and-enhanced-3d-generation/4050893
- https://devforum.roblox.com/t/beta-4d-generation-unlock-new-types-of-gameplay/4331818
- https://devforum.roblox.com/t/live-now-use-configs-and-experiments-to-grow-your-game-faster/4051385
- https://devforum.roblox.com/t/datastores-access-and-storage-updates/3597255
- https://devforum.roblox.com/t/even-more-server-memory/3293192
- https://devforum.roblox.com/t/server-memory-cap-for-700-player-servers-reduced-to-65gb-from-125gb/3109012
- https://devforum.roblox.com/t/servers-crashing-despite-being-below-the-server-memory-limit/3795797
- https://devforum.roblox.com/t/memory-allocation-issues/4584423
- https://devforum.roblox.com/t/profilestore-save-your-player-data-easy-datastore-module/3190543
- https://devforum.roblox.com/t/automatic-translation-now-available-between-16-languages/2912942
- https://devforum.roblox.com/t/new-translation-setting-for-players-automatic-translations/4684608
- https://devforum.roblox.com/t/update-changes-to-asset-privacy-for-audio/1715717
- https://devforum.roblox.com/t/how-to-make-roblox-%E2%80%9Csteal-a-brainrot%E2%80%9D-game-tutorial-series/4137672
- https://devforum.roblox.com/t/selene-stylua-and-roblox-lsp-what-they-do-why-you-should-use-them/1977666
- https://devforum.roblox.com/t/luau-native-code-generation-preview-studio-beta/2572587
- https://techcrunch.com/2026/04/16/robloxs-ai-assistant-gets-new-agentic-tools-to-plan-build-and-test-games/
- https://techcrunch.com/2025/09/05/roblox-announces-short-form-video-feed-for-gameplay-clips-new-ai-tools-for-creators-and-more
- https://en.help.roblox.com/hc/en-us/articles/40021970073236-Roblox-Moments-How-to-Capture-Share-and-Discover
- https://marketech-apac.com/roblox-launches-moments-to-let-users-capture-edit-and-share-gameplay-highlights/
- https://findingdulcinea.com/how-to-use-roblox-moments/
- https://www.tubefilter.com/2026/01/08/roblox-homepage-feature-ads-sams-club-ces/
- https://www.gamebizconsulting.com/blog/roblox-ad-monetization-guide-2026
- https://endsights.com/roblox-anti-cheat
- https://roblox.fandom.com/wiki/Hyperion
- https://luablox.com/blog/best-free-roblox-executors-2026
- https://en.wikipedia.org/wiki/Steal_a_Brainrot
- https://en.wikipedia.org/wiki/Grow_a_Garden
- https://en.wikipedia.org/wiki/Cube_3D
- https://stealabrainrot.fandom.com/wiki/Steal_a_Brainrot_(Game)
- https://roblox.fandom.com/wiki/BRAZILIAN_SPYDER/Steal_a_Brainrot
- https://www.eldorado.gg/blog/sammy-steal-a-brainrot-guide/
- https://www.eldorado.gg/blog/steal-a-brainrot-admin-abuse-schedule-explained/
- https://www.u7buy.com/blog/sammy-steal-a-brainrot/
- https://aftermath.site/brainrot-roblox-court/
- https://profitable.app/roblox/games/steal-a-brainrot
- https://www.pocketgamer.biz/roblox-revenue-up-36-yy-as-grow-a-garden-and-steal-a-brainrot-drive-multiple-milestones/
- https://www.pocketgamer.biz/roblox-launches-new-analytics-and-experimentation-tools/
- https://odt.co.nz/star-news/star-national/created-16yo-three-or-four-days-millions-going-mad-nz-made-garden-game
- https://sherwood.news/markets/roblox-hits-a-52-week-high-as-a-wildly-simple-gardening-game-created-by-a-16/
- https://www.calcalistech.com/ctechnews/article/dj4lxef8r
- https://tech.yahoo.com/gaming/articles/roblox-kids-yearning-farm-grow-124048667.html
- https://ggwtb.com/blog/grow-a-garden-can-it-come-back-in-2026
- https://www.tiktok.com/@audreyradio/video/7495509305777523999
- https://progameguides.com/roblox/steal-a-brainrot-private-server-links/
- https://www.ldplayer.net/blog/steal-a-brainrot-stacked-servers-guide.html
- https://simplegameguide.com/steal-a-brainrot-good-stacked-private-servers-guide/
- https://www.blog.udonis.co/mobile-marketing/mobile-games/roblox-player-count
- https://sqmagazine.co.uk/roblox-statistics/
- https://www.demandsage.com/how-many-people-play-roblox/
- https://www.bloxbot.ai/guide/roblox-datastore-limits-july-2026
- https://gmmarket.me/community/post/roblox-datastore-in-2026-the-new-per-experience-limit-explained-migration-plan
- https://mattqdev.github.io/blog/profileservice-datastore-in-roblox-studio-2026-developer-guide
- https://www.oflight.co.jp/en/columns/luau-developer-toolchain-rojo-selene-wally-2026
- https://lastlevel.co.uk/blog/new-luau-type-solver-studio-ui-and-more-news
- https://www.msn.com/en-us/news/other/roblox-studio-updates-are-reshaping-creator-workflows-in-2026/gm-GM11635EA0
- https://help.meshy.ai/en/articles/16102098-can-i-use-meshy-assets-commercially
- https://www.tripo3d.ai/blog/commercial-use-ai-3d-models
- https://www.exitlag.com/blog/roblox-song/
- https://www.gameanalytics.com/reports/2026-roblox-report
- https://www.chicmicstudios.in/blogs/how-much-does-it-cost-to-build-a-roblox-game-in-2026/
- https://picoo.io/blog/how-to-use-ai-in-roblox-studio
- https://www.obby.fun/blog/roblox-studio-ai
