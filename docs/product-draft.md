# Battle Royale: Initial Product Draft

## 1. Purpose

Battle Royale is a single-user, local-first map game that works alongside external AI text and image generators. The game manages maps, characters, random movement, collisions, hidden conflict results, and randomized text ingredients. It does not need to call an AI service in the first version.

The initial release should be an installable Progressive Web App (PWA). It should run in mobile and desktop browsers, remain usable offline after installation, and save campaigns on the current device.

## 2. Terms

- **Campaign:** One saved collection of a map, areas, characters, phrase entries, settings, and game progress.
- **Area:** A manually drawn overlay region on the map. An area acts as one playable cell.
- **Active character:** A character still participating in random movement and conflicts.
- **Defeated character:** A character that lost a conflict. It remains visible but is greyed out and no longer moves.
- **Hidden outcome:** A conflict result already selected by the game but not shown until the next Advance action.
- **Text entry:** One word or phrase parsed from the semicolon-separated source text.

## 3. Setup flow

### 3.1 Create a campaign

The user creates a locally saved campaign and gives it a name.

### 3.2 Upload a map

The user uploads a PNG, JPEG, or WebP image. The editor displays the image with a scalable overlay.

The map image is stored locally. It is not automatically uploaded to GitHub or another server.

### 3.3 Draw map areas manually

The user enters area-editing mode and draws each playable cell directly over the map.

Proposed polygon workflow:

1. Select **Add area**.
2. Tap or click several points around the desired region.
3. Close the polygon by selecting its first point or pressing **Finish**.
4. Give the area a name.
5. Drag vertices to correct the shape.
6. Save, rename, redraw, or delete the area.

Each polygon stores normalized coordinates from `0` to `1` rather than screen pixels. This keeps the overlay aligned when the map is displayed at different sizes.

The application highlights the area under the pointer or finger. Overlapping polygons should be rejected or clearly warned about because a character must occupy exactly one cell.

### 3.4 Add characters

For each character, the user:

- Uploads a portrait.
- Assigns a name.
- Selects a starting area.

Each character receives an internal ID independent of its name. The first version does not require statistics, teams, or factions.

### 3.5 Import text entries

The user can paste text or upload a plain-text file. A semicolon separates entries.

Example:

```text
fog; broken sword; betrayal; silent footsteps; red moon
```

Parsing rules:

- Split on `;`.
- Trim spaces and line breaks around each entry.
- Ignore empty entries.
- Preserve capitalization and punctuation inside entries.
- Show the parsed list before starting the game.

Whether duplicate entries should be preserved as additional weighting remains an open decision.

### 3.6 Save setup

The game validates that:

- A map exists.
- At least one area exists.
- Every active character has a name, portrait, and starting area.
- At least one valid text entry exists.

The user can return to setup later. Editing areas during an active game may require restarting the game because existing positions could become invalid.

## 4. Game rules

### 4.1 Random movement

When a movement phase begins, the game independently chooses an outcome for every active character:

- Stay in the current area.
- Move to another eligible area.

All selected movements are applied simultaneously. Defeated characters never move.

Proposed first-version default:

- Staying has a 20% probability.
- Moving has an 80% probability.
- When moving, every other map area has an equal chance of being selected.

These values are assumptions, not confirmed requirements. A later settings screen can control the stay chance and movement rules. Restricting movement to connected neighboring areas is also a possible later feature.

### 4.2 Conflict detection

After simultaneous movement, every area containing at least two active characters creates a conflict. Conflict always occurs in a shared area; there are no friendly teams or exceptions in the first version.

Characters crossing in opposite directions do not conflict unless they finish in the same area.

### 4.3 Conflict selection

Proposed first-version rule:

- The game randomly selects one character in each contested area as the winner.
- Every occupant has an equal chance.
- All other characters in that area become defeated.
- The result is stored immediately as a hidden outcome.

The map must not reveal the winner during the hidden phase. All characters in a contested area remain displayed in their normal active style until the next Advance action.

A manual override can be considered later, but it is outside the initial scope.

## 5. Advance state machine

The interface uses one main button whose label explains what the next action will do.

### State A: Ready to move

Button label:

```text
Advance: Move characters
```

Pressing it performs these actions in order:

1. Randomly choose movement or staying for every active character.
2. Apply all movement simultaneously.
3. Detect conflicts.
4. Select and store conflict results without displaying them.
5. Randomly select and order text entries.
6. Display a copyable string that does not reveal conflict winners.
7. Change the game to the hidden-outcome state.

The map may show that several characters occupy the same area, but it must not visually identify a winner or loser.

### State B: Outcome hidden

Button label:

```text
Advance: Reveal conflicts
```

The user can copy the generated string and use it with an external text generator before revealing results.

Pressing Advance now:

1. Reveals every stored winner.
2. Greys out every defeated character on the map and roster.
3. Prevents defeated characters from participating in future movement.
4. Adds the revealed results to game history.
5. Changes the game to the revealed state.

If no conflict occurred, this step simply confirms the round without defeating anyone.

### State C: Results revealed

Button label:

```text
Advance: Start next round
```

Pressing it begins the next movement phase and returns to State B with a newly generated string. This separate state gives the user time to inspect the revealed result before pieces move again.

This creates the sequence:

```text
Move and generate text -> Reveal conflict -> Move and generate text -> Reveal conflict
```

The product can omit a separate third visual state if the result remains visible until the next movement press. The important rule is that a result is never revealed on the same press that generated its text string.

## 6. Copyable randomized string

The source is the parsed semicolon-separated entry list. During each movement phase, the game chooses entries and randomizes their order.

Example output:

```text
silent footsteps; red moon; broken sword
```

The copy panel should provide:

- The generated string.
- A **Copy** button.
- Confirmation that copying succeeded.
- The ability to view strings from prior rounds in history.

The string must not contain the hidden winner or any wording that reveals the outcome.

The number of selected entries and whether movement details should accompany them remain open decisions.

## 7. Map presentation

### Active characters

Display portraits as markers associated with their current polygon. If several characters share an area, show them as a small stack or row rather than placing them directly on top of one another.

### Hidden conflicts

A contested area may receive a neutral border or conflict icon, provided that it does not imply who won.

### Defeated characters

After reveal:

- Grey out the portrait.
- Lower its opacity.
- Mark it as defeated in the roster.
- Leave it visible in its defeat location unless the user later chooses to hide defeated characters.

### Mobile interaction

The map needs pinch zoom and pan. Setup controls need large touch targets, explicit edit modes, and an undo action for polygon points.

## 8. Local persistence

Campaigns and game progress should be stored in IndexedDB because maps and portraits are too large for reliable use of `localStorage`.

Auto-save after:

- Setup changes.
- Character movement.
- Hidden conflict selection.
- Conflict reveal.
- Settings changes.

The pending hidden outcome must be saved so closing and reopening the app cannot reroll a conflict accidentally.

A later version can export and import a campaign package for backups or movement between devices. Device synchronization and user accounts are outside the initial scope.

## 9. Suggested data model

```ts
type Campaign = {
  version: 1;
  id: string;
  name: string;
  map: {
    imageBlobId: string;
    width: number;
    height: number;
  };
  areas: Area[];
  characters: Character[];
  textEntries: string[];
  settings: {
    stayChance: number;
    selectedTextEntryCount: number;
  };
  game: GameState;
};

type Area = {
  id: string;
  name: string;
  points: Array<{ x: number; y: number }>;
};

type Character = {
  id: string;
  name: string;
  portraitBlobId: string;
  areaId: string;
  status: "active" | "defeated";
  defeatedInRound?: number;
};

type GameState = {
  round: number;
  phase: "ready" | "outcome-hidden" | "revealed";
  pendingOutcomes: ConflictOutcome[];
  currentText: string;
  history: RoundRecord[];
};

type ConflictOutcome = {
  areaId: string;
  participantIds: string[];
  winnerId: string;
  loserIds: string[];
};
```

Blob records for map and portrait images should be stored separately from campaign metadata.

## 10. Recommended implementation shape

Provisional stack:

- TypeScript.
- React for setup and game screens.
- Vite for the browser build.
- SVG layered over the map for editable polygons and character markers.
- IndexedDB for local campaign and image storage.
- A PWA service worker and manifest for installation and offline use.
- GitHub Pages for the hosted application.

A native wrapper is unnecessary for the first version unless app-store distribution is required immediately.

## 11. Initial screens

1. **Home:** Create, continue, rename, or delete a local campaign.
2. **Campaign setup:** Upload map, draw areas, add characters, import text, and review validation.
3. **Game map:** View positions, advance phases, copy generated text, and reveal conflicts.
4. **Roster:** View active and defeated characters.
5. **History:** Review generated strings, movements, and revealed outcomes by round.
6. **Settings:** Initially read-only or minimal; later controls movement and text selection probabilities.

On mobile, the map remains the primary view and the roster/history open as sheets or tabs.

## 12. First implementation boundary

The first playable version should include:

- One or more locally saved campaigns.
- One map per campaign.
- Manual polygon area drawing and editing.
- Character portrait upload, naming, and starting placement.
- Semicolon-separated text parsing.
- Random movement with a stay chance.
- Simultaneous movement.
- Conflict in every area containing multiple active characters.
- Hidden random outcomes.
- Copyable randomized text before reveal.
- Reveal on a later Advance action.
- Greyed-out defeated characters.
- Local auto-save.
- Installable mobile and desktop PWA behavior.

Not included initially:

- Direct text-generation or image-generation APIs.
- Online accounts or synchronization.
- Multiplayer.
- Teams or diplomacy.
- Character statistics.
- Native app-store packages.
- Complicated movement tuning.

## 13. Open decisions before implementation

1. **Area shape:** Does “select areas manually” mean drawing polygon boundaries, or placing simpler circular cells?
2. **Movement range:** In the first version, can a moving character land in any map area, or only a neighboring area?
3. **Stay chance:** Is 20% an acceptable initial default?
4. **Winner selection:** Should every participant have an equal random chance, with one winner defeating everyone else?
5. **Text count:** How many semicolon-separated entries should each generated string contain?
6. **Text content:** Should the copyable output contain only randomized entries, or also character movements and conflict participants while withholding the winner?
7. **Duplicates:** Should repeated text entries increase their chance of selection, or should duplicates be removed?
8. **Starting positions:** Does the user select every starting area, or should the game randomize them?
9. **Defeated marker:** Should a defeated character remain greyed out on the map, or disappear from the map and remain only in the roster/history?
