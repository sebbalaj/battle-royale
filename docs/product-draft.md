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
- Power, starting at 7.
- An optional **Invulnerable** setting.
- A record of their most recent opponent.
- Active or dead status.

Invulnerable means the character cannot die. They can still lose a fight and escape. A negative movement change cannot reduce an invulnerable character below 1 power.

### Story entries

The user can paste text or upload a `.txt` file. Semicolons separate individual words and phrases. At least eight entries are required.

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

## Hidden map result and Reveal

The movement advance calculates and saves complete fight results. The conflict copy immediately names winners, damage, deaths, and escapes. The map still displays all conflict participants without showing those changes.

Pressing **Reveal conflicts** then:

- Applies winner damage.
- Moves escaped losers.
- Greys out dead characters.
- Updates every visible power value.
- Saves the revealed history record.

Reloading during the hidden phase does not reroll the result.

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

### Conflict

Includes:

- Each winner and loser.
- The winning probability.
- Winner power damage.
- Whether the loser died or escaped.
- Escape destination and remaining power.
- Between 8 and 12 randomized story entries.

## Visible power

Power appears:

- As a small number on each map portrait.
- As a larger value beside each roster entry.
- In basic movement text.
- In conflict results.

Invulnerable characters receive a distinct marker and portrait border.

## Local persistence and migration

IndexedDB stores the current campaign, uploaded images, game phase, hidden outcomes, power values, death causes, and round history.

Campaigns created by the earlier model are migrated automatically. Their map, cells, routes, portraits, names, and story entries are kept. The old battle is reset because its saved conflict records do not contain power information.

## Future options

- Adjustable movement and power-change probabilities.
- Adjustable combat formulas.
- Campaign export/import and multiple campaigns.
- Automatic nearby-route suggestions.
- Direct AI text and image APIs.
