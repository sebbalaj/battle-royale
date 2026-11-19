# Battle Royale: Current Game Rules

## Purpose

Battle Royale is a local-first map game used alongside external AI text and image generators. It manages map cells, random movement, changing character power, conflicts, delayed map reveals, and copyable story text.

## Setup

### Images

The user can upload one map and one portrait per character from the device's normal file picker.

Accepted formats are PNG, JPEG, and WebP, with a 15 MB limit per image. Images remain in IndexedDB on the current device. They are not sent to GitHub or an AI provider.

### Map cells and routes

The user manually places circular cells over the map. Connections between circles define which cells count as nearby. A moving character can only use one of these connections.

### Characters

Every character has:

- A name and portrait.
- A manually selected starting cell.
- Power, starting at the configured starting power (default 7).
- An optional **Invulnerable** setting.
- An optional carried weapon.
- A record of their most recent opponent.
- Active or dead status.

Invulnerable means the character cannot die. They can still lose a fight and escape. A negative movement change cannot reduce an invulnerable character below 1 power. Invulnerable characters also survive sniper shots and danger points, flooring at 1 power.

### Story entries

The user can paste text or upload a `.txt` file. Semicolons separate individual words and phrases. At least eight entries are required.

### Weapons, crates, healing and danger points

The Setup screen can assign a weapon to a character, place weapons and crates on cells, and place named healing and danger points on cells. A **Randomize** button scatters these across the map for quick play. See the dedicated sections below for how each behaves in a round.

### Settings

A **Settings** menu exposes every tunable value so the user can tweak the whole system. Settings are part of the campaign but are not part of a saved layout slot. Defaults are listed in the Settings section below.

### Layout save slots

Named layout slots save the whole setup so a map can be reused. A slot stores the campaign name, map image, cells and routes, characters, carried and placed weapons, crates, healing points, and danger points. A slot does **not** store settings or any in-progress battle. Slots live in a separate IndexedDB object store and can be saved, loaded, and deleted independently of the live autosave.

## Movement round

For every active character:

1. Randomly choose `-2`, `-1`, `0`, `+1`, or `+2`, with a 20% chance for each.
2. Apply that change to the character's power.
3. If a non-invulnerable character reaches 0 power, the character dies before moving.
4. Otherwise, give the character a 50% chance to stay.
5. If moving, randomly select one connected neighboring cell.
6. Apply all surviving characters' movement simultaneously.

Power has no upper limit.

### Death outside a fight

If movement reduces power to zero:

- A character who has never fought **died in an accident / to the elements**.
- A character who previously fought **died from injuries from fight with [most recent opponent]**.

The exact cause appears in basic round text, history, and the roster.

## Conflict

Two or more active characters finishing in the same cell always create a conflict. For more than two characters, the application randomizes a one-on-one fight order and continues until one character controls the cell. Winner damage affects the odds of later fights in that same conflict.

### Win probability

A one-on-one fight starts at 50/50. Each point of power difference shifts both sides by five percentage points.

Examples:

- Power 7 against 7: 50% / 50%.
- Power 9 against 7: 60% / 40%.
- Power 14 against 7: capped at 95% / 5%.

Probabilities are capped at 95% and 5%, so an upset remains possible.

### Winner damage

The winner loses a random whole amount from 0 through 50% of the winner's current power, rounded down. Winner damage is applied before another fight in the same multi-character conflict.

### Loser death or escape

The loser either dies or escapes. The death chance is:

```text
50%
+ 5 percentage points for each power point the winner had over the loser
+ 10 percentage points if the loser entered the fight with only 1–2 power
```

The result is capped between 10% and 90%.

If the loser survives:

- Their power becomes randomly 1 or 2.
- They move to a random connected neighboring cell.
- They remain active next round.

If an invulnerable character loses, their death chance is 0%, so they always escape with 1 or 2 power.

### Weapons in combat

Combat uses an **effective power** equal to base power plus the weapon's secret bonus. The bonus affects the win chance and the death chance only. The stored and displayed power number never includes it.

Default secret bonuses, strongest to weakest:

- Shotgun: +4
- Suppressed pistol: +2
- Knife: +1
- Sniper: 0 (no close-combat edge)

A character carries one weapon at a time and always keeps the stronger weapon by bonus. A weaker find is ignored. Because the sniper has a 0 bonus, it is only taken when the character carries no weapon or another 0-bonus weapon.

### Weapons on the map

Weapons and crates can be placed on cells during Setup.

- **Ground weapons** are picked up automatically when a character arrives on the cell, but only if the weapon is better than what they already carry. A replaced weapon drops back onto the cell. Characters standing in a conflict cell do not scavenge that round.
- **Crates** have a find chance (default 50%) to open when a character arrives. If the crate weapon is better, the character takes it and the crate is marked opened.
- **Drops on death**: when a fight kills the loser, the loser's weapon drops on the conflict cell. The killer claims it only if it is better than their current weapon, in which case the killer's replaced weapon also drops. Anything not claimed stays on the cell for a later ground pickup.

All weapon changes are rolled and locked at Advance but only applied at Reveal, like every other outcome. Ground and crate pickups, their replaced-weapon drops, and drops from a kill all resolve at Reveal. During the outcome-hidden phase, carried weapons and crates on the map stay exactly as they were at the start of the round.

## Sniper

A sniper holder has a small chance (default 10%) each round to fire at a random active character in a connected (adjacent) cell. The target is chosen from the shooter's post-movement neighbours; if there is no valid target, no shot happens.

The chance is treated as the chance a shot both happens and connects. When a shot connects:

- An instant-kill roll (default 50%) decides the result.
- On an instant kill, a vulnerable target dies. An invulnerable target survives at 1 power.
- Otherwise the target takes flat damage (default 3). A vulnerable target that reaches 0 power dies. An invulnerable target floors at 1 power.

The target and the full outcome are locked at Advance and only applied at Reveal. During the outcome-hidden phase the map shows the targeting indicator for each locked shot. Reloading between Advance and Reveal cannot reroll the target or the outcome.

## Healing points

A healing point is named and sits on a cell. Each round, if the point is off cooldown and has at least one active occupant, it rolls its success chance (default 50%). On success it adds its heal amount (default 3) to one occupant's power with no upper limit, then goes on cooldown for its cooldown length (default 3 rounds). Cooldowns tick down by one each round. The success roll happens at Advance and the power change applies at Reveal.

## Danger points

A danger point is named and sits on a cell. It is unkillable terrain. Every round, every active occupant always takes random damage in the point's range (default 1 to 4). A vulnerable occupant that reaches 0 power dies, with the death cause naming the point. An invulnerable occupant floors at 1 power and cannot die. The damage is rolled at Advance and applied at Reveal.

## Settings

The Settings menu tunes every value the engine reads. Defaults:

| Setting | Default |
| --- | --- |
| Stay chance | 0.5 |
| Power change minimum | -2 |
| Power change maximum | +2 |
| Starting power | 7 |
| Sniper hit chance | 0.10 |
| Sniper flat damage | 3 |
| Sniper instant-kill chance | 0.50 |
| Weapon bonus: shotgun | 4 |
| Weapon bonus: suppressed pistol | 2 |
| Weapon bonus: knife | 1 |
| Weapon bonus: sniper | 0 |
| Crate find chance | 0.50 |
| Heal amount | 3 |
| Heal success chance | 0.50 |
| Heal cooldown rounds | 3 |
| Danger minimum damage | 1 |
| Danger maximum damage | 4 |
| Death chance base | 0.50 |
| Death chance per power difference | 0.05 |
| Death chance low-power bonus | 0.10 |
| Winner damage cap (fraction of power) | 0.50 |
| Escape power minimum | 1 |
| Escape power maximum | 2 |

Settings belong to the campaign and are not stored in layout save slots.

## Hidden map result and Reveal

The movement advance calculates and saves complete results: fight outcomes, locked sniper targets, healing success, danger damage, and ground / crate weapon pickups. The conflict copy immediately names winners, damage, deaths, and escapes. The map still displays all conflict participants without showing those changes, and carried weapons stay at their start-of-round state until Reveal. It does show sniper aim lines from each shooter to their locked target, with the shooter and target portraits both marked, for the duration of the hidden phase.

Pressing **Reveal conflicts** applies the locked results in a fixed order:

1. Conflicts: winner damage, loser death or escape, and weapon drops or killer pickups.
2. Sniper shots.
3. Danger points.
4. Healing points.

To avoid one subsystem silently overwriting another within the same round, sniper, danger, and healing never roll against a character who is standing in a contested cell (a cell with a conflict this round). The conflict already decides that character's power, death, or escape. This also means a character who escapes a conflict is never hit by a danger or healing point on the cell they left, and a sniper never pre-locks a shot on someone whose fate is still being decided by a fight.

Sniper, danger, and healing apply their locked random decision (hit, instant kill, damage amount, heal amount, chosen target) as a signed power change against the character's live power at Reveal, rather than overwriting it with an absolute value. Death is re-derived from the resulting power. When more than one of these events lands on the same character in a round, they compose instead of clobbering. Danger and healing also apply only if the character still occupies the point's cell at Reveal.

Each later step skips a character who is already dead, so no one is revived or hurt twice. A sniper shot locked against a target who is dead by the time it resolves (for example, hit earlier in the Reveal order) is simply skipped; the shot is wasted on a corpse. Reveal then greys out dead characters, updates every visible power value, and saves the revealed history record.

Because every outcome is pre-rolled at Advance and persisted, reloading during the hidden phase does not reroll any result.

## Copyable text layout

The game map has a sticky action bar containing:

- **Advance first/next round** or **Reveal conflicts**.
- **Round text**.

Selecting **Round text** opens a side drawer on desktop or a bottom drawer on mobile. The user does not need to scroll below the map.

The drawer has two tabs:

### Basic round

Includes:

- Movement or staying.
- Every power change.
- Accidents and deaths caused by old injuries.
- Conflict participants and locations.
- Weapon pickups: who picked up what, and whether it came from a crate, the ground, or a drop.
- Sniper shots: shooter and target, hit or miss, and damage or kill.
- Healing events: who healed how much at which named healing point.
- Danger events: who took how much damage at which named danger point, and any resulting death.

### Conflict

Includes:

- Each winner and loser.
- The winning probability.
- Winner power damage.
- Whether the loser died or escaped.
- Escape destination and remaining power.
- Each fighter's weapon by name.
- Weapon drops after a kill and who picked them up.
- Between 8 and 12 randomized story entries.

Weapon names appear in the round and conflict texts. The numeric secret bonus is never printed anywhere.

## Setup prompt

The Setup screen offers a third copyable text that describes the world for an external AI. It covers:

- The campaign name.
- Every cell and the cells it connects to, by name.
- Each named healing point with its heal amount, success chance, and cooldown.
- Each named danger point with its damage range.
- Each character with their starting cell, invulnerable status, and starting weapon name if any.
- Crate locations by cell name.
- A short plain-language summary of the rules, including that weapons give a hidden combat edge.

## Map visuals

Map portraits are enlarged for readability, and the power number is moved off the face so it no longer covers the portrait. Each portrait can also show a weapon icon for the carried weapon. During the hidden phase, a sniper aim line is drawn from each shooter's cell to their target's cell, the shooter portrait is marked as taking aim, and the target portrait is marked as being in a sniper's sights. The map renders markers for crates, healing points, and danger points on their cells.

## Visible power

Power appears:

- As a number beside each map portrait, off the face.
- As a larger value beside each roster entry.
- In basic movement text.
- In conflict results.

The displayed power never includes a secret weapon bonus.

Invulnerable characters receive a distinct marker and portrait border.

## Local persistence and migration

IndexedDB stores the current campaign, uploaded images, game phase, hidden outcomes, power values, death causes, round history, and named layout slots. Layout slots live in their own object store, separate from the single live campaign.

Campaigns are stored at version 3. Older saves are migrated automatically to version 3. Their map, cells, routes, portraits, names, and story entries are kept. Weapons, crates, healing points, and danger points are only carried over from existing version 3 saves; earlier saves start these empty. On migration from version 2, settings reset to defaults. The old battle is reset because its saved conflict records do not contain the newer power and event information.

## Future options

- Campaign export/import and multiple campaigns.
- Automatic nearby-route suggestions.
- Direct AI text and image APIs.
