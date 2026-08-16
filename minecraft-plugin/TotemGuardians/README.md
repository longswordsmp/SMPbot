# ⚔️ TotemGuardians

A Paper plugin for Minecraft servers. Pop a **Totem of Undying that carries the Unbreaking
enchantment** and a squad of nameless, blacked-out guardians spawns around you in full
netherite, with shields and maxed swords, and fights for you until the timer runs out.

> This is a **Minecraft server plugin**, separate from the SMPbot Discord bot that lives in the
> rest of this repository. It ships here so the SMP's Discord bot and gameplay plugin stay in
> one place.

---

## What it does

| | |
|---|---|
| **Trigger** | Popping a Totem of Undying enchanted with Unbreaking. A plain totem behaves exactly like vanilla. |
| **Squad** | 5 guardians, spawned in a ring around you. |
| **Look** | Wither skeletons in full netherite — solid black, **no nameplate at all**. |
| **Gear** | Netherite helmet / chestplate / leggings / boots (Protection IV, Unbreaking III), netherite sword (Sharpness V, Knockback, Fire Aspect on tier 3), shield in the off-hand. All unbreakable, all drop-chance 0. |
| **Duration** | 5 minutes, then they fade. A countdown sits on your action bar. |
| **Unbreaking I** | *Defend.* Guardians attack anything that attacks you. |
| **Unbreaking III** | *Assist.* Guardians attack anything **you** attack **and** anything that attacks you. |

Unbreaking II is configured as a middle tier (tougher than I, still defensive). Any Unbreaking
level above the highest configured tier falls back to that tier, so Unbreaking V uses tier 3.

### Behaviour details

- Guardians **only ever attack marked enemies**. Vanilla hostile-mob AI is intercepted, so they
  will not wander off and hit a random bystander.
- An enemy stays marked for 20 seconds after the last hit is traded, refreshed on every hit.
- Guardians never damage their owner or each other, and the owner cannot damage them.
- They walk back to you when they drift more than 6 blocks away, and are teleported back if they
  end up more than 24 blocks away or in another world.
- Their kit never drops and they give no XP, so there is no netherite duplication exploit.
- They are immune to fall / fire / lava / drowning / suffocation damage so scenery does not kill
  them, but players and mobs can absolutely kill them.
- They despawn when the timer runs out, when the owner dies, or when the owner logs out. Leftovers
  from a crash or restart are swept on startup and on chunk load.

---

## Building

Requires JDK 21 and network access to `repo.papermc.io`:

```bash
cd minecraft-plugin/TotemGuardians
mvn clean package
```

The jar lands at `target/TotemGuardians-1.0.0.jar`. Drop it in your server's `plugins/` folder and
restart.

Built against the Paper 1.21.4 API with `api-version: '1.20'`. Every constant that Mojang renamed
between 1.20 and 1.21 (attributes, enchantments, potion effects, sounds) is resolved by name at
runtime, so one jar covers **Paper 1.20.1 → 1.21.x**. Plain Spigot works too, minus the
follow-the-owner pathfinding, which falls back to leash teleports.

---

## Getting an enchanted totem

Unbreaking cannot be applied to a totem at an anvil, so hand them out with the command:

```
/tg give <player> [level] [amount]
```

Or with a vanilla command on 1.20.5+:

```
/give @p totem_of_undying[enchantments={unbreaking:3}]
```

On 1.20.4 and older:

```
/give @p totem_of_undying{Enchantments:[{id:"minecraft:unbreaking",lvl:3}]}
```

---

## Commands

| Command | Permission | Description |
|---|---|---|
| `/tg give <player> [level] [amount]` | `totemguardians.give` | Give a named, lore-tagged guardian totem. |
| `/tg summon <player> [level]` | `totemguardians.summon` | Summon a squad directly, ignoring cooldown and world rules. |
| `/tg despawn <player\|all>` | `totemguardians.despawn` | Dismiss guardians and sweep strays. |
| `/tg info` | `totemguardians.command` | List configured tiers and active squads. |
| `/tg reload` | `totemguardians.reload` | Reload `config.yml`. |

Aliases: `/totemguardians`, `/tg`, `/guardians`.

| Permission | Default | Meaning |
|---|---|---|
| `totemguardians.use` | everyone | Allowed to trigger guardians by popping a totem. |
| `totemguardians.command` | op | Access to `/tg`. |
| `totemguardians.bypass.cooldown` | op | Ignores the summon cooldown. |

---

## Configuration

Everything lives in `plugins/TotemGuardians/config.yml`, which is heavily commented. The parts
worth knowing:

- **`tiers.<unbreaking level>`** — one block per level: `count`, `duration-seconds`, `targeting`
  (`DEFEND` or `ASSIST`), `entity-type`, `equipment`, `attributes`, `effects`. Add a `'4'` block
  and Unbreaking IV becomes its own tier.
- **`entity-type`** — `WITHER_SKELETON` by default because in full netherite it reads as a solid
  black armoured humanoid. `ZOMBIE`, `SKELETON`, `PIGLIN_BRUTE`, `VINDICATOR` and `HUSK` also
  work if you want a different silhouette.
- **`attributes.attack-damage`** — this is the *base* attribute; the netherite sword and its
  Sharpness stack on top of it. The shipped values are deliberately brutal. If guardians are
  wiping your PvP, this is the number to lower first.
- **`settings.cooldown-seconds`** — 0 out of the box. Raise it if popping totems becomes a
  strategy in itself.
- **`settings.replace-existing-squad`** — whether a second totem refreshes the squad or is ignored
  while one is alive.
- **`settings.disabled-worlds`** — keep guardians out of spawn or event worlds.

Unknown materials, enchantments, effects, sounds and particles are logged and skipped rather than
crashing the plugin, so a typo costs you one item, not the whole squad.
