# Battle Royale: Product Draft

## Purpose

Battle Royale is a single-user, local-first map game used alongside external AI text and image generators. It manages maps, characters, random movement, conflicts, delayed map reveals, and copyable round text. Direct AI API access is outside the first playable model.

The application is an installable Progressive Web App (PWA) for mobile and desktop browsers.

## Confirmed rules

- The user places circular cells manually over a map image.
- The user connects nearby cells to define legal movement routes.
- Every active character has a 50% chance to stay in its current cell.
- Otherwise, the character randomly chooses one connected cell.
- All characters move simultaneously.
- Two or more active characters ending in one cell always enter conflict.
- The application randomly chooses one winner. Everyone else in that cell loses.
- The conflict result appears in copyable conflict text immediately.
- The map does not reveal the result until the next Reveal action.
- Revealed losers remain visible but greyed out and stop moving.
- Words and phrases are separated by semicolons.
- Conflict copy contains at least 8 randomized entries from the uploaded text.
- Campaign state and uploaded images are saved locally on the device.

## Setup flow

### Campaign and map

The user names the campaign and selects **Replace map**. The browser opens the phone or computer's normal Photos/Files picker.

Accepted user image formats:

- PNG
- JPEG
- WebP

Each image may be up to 15 MB. The image is converted to a data URL and stored in IndexedDB as part of the local campaign. It is not sent to GitHub, a backend, or an AI provider.

The first playable model includes a built-in placeholder map, so setup works before the user uploads anything.

### Circular cells

The map editor has three tools:

- **Select:** Choose an existing cell to rename, resize, or delete.
- **Place circle:** Tap or click the desired position on the map.
- **Connect nearby:** Select two circles to add or remove a legal movement route.

Cell centers and sizes use normalized map coordinates. They stay aligned when the map scales to another screen size.

Connection lines are visible during setup and play. They define “nearby”; a character cannot move between unconnected cells.

### Characters

Each character has:

- A stable internal ID.
- A name.
- A portrait.
- A manually selected starting cell.
- A current cell.
- Active or defeated status.

The user selects **Upload portrait** to choose an image from Photos/Files. The first model includes four placeholder portraits and can add or remove characters.

### Story words and phrases

The user pastes words and phrases into a text field or uploads a plain `.txt` file up to 1 MB. A semicolon separates entries.

```text
fog; broken sword; betrayal; silent footsteps; red moon; hidden passage
```

Parsing rules:

- Split on `;`.
- Trim surrounding spaces and line breaks.
- Ignore empty entries.
- Preserve capitalization and internal punctuation.

At least eight valid entries are required before play can begin.

### Start validation

The first battle can start when:

- The map has at least two cells.
- Every cell has at least one connection.
- At least two named characters exist.
- Every character has a starting cell.
- At least eight story entries exist.

Starting a battle resets all characters to their selected starting cells and restores defeated characters.

## Round flow

### Movement advance

The initial button says **Advance first round**. Later movement buttons say **Advance next round**.

Pressing the movement advance:

1. Gives each active character a 50% chance to stay.
2. Otherwise chooses one connected neighboring cell at random.
3. Applies every movement simultaneously.
4. Detects every cell with multiple active occupants.
5. Randomly chooses and stores one winner per conflict.
6. Produces the two copyable text types.
7. Shows contested cells without identifying winners or losers on the map.
8. Changes the main button to **Reveal conflicts**.

Pending outcomes are immediately auto-saved, so reloading the application does not reroll a winner.

### Reveal advance

Pressing **Reveal conflicts**:

1. Applies every stored conflict result.
2. Greys out each loser on the map and roster.
3. Prevents losers from moving again.
4. Marks the history record as revealed.
5. Enables the next movement advance.

If no conflict occurred, Reveal finalizes the round without defeating anyone.

## Copyable text

### Basic round copy

The basic copy reports movement and major events. It names conflict participants but leaves detailed results to the conflict copy.

```text
ROUND 3

MOVEMENTS
- Mara moved from Ember Port to Oldwood.
- Orin stayed at Iron Keep.

MAJOR EVENTS
- A conflict began at Oldwood between Mara and Sable.
```

### Conflict copy

The conflict copy contains the actual winner even though the map still hides the result. It also contains randomized story words and phrases.

The first model selects up to 12 entries. Because setup requires at least 8 entries, every conflict copy contains between 8 and 12 entries.

```text
ROUND 3 — CONFLICT RESULTS

- At Oldwood, Mara won. Defeated: Sable.

STORY WORDS AND PHRASES
silent footsteps; red moon; broken sword; hidden passage; sudden storm; betrayal; final oath; distant bells
```

Both panels have a Copy button. Generated text remains available in round history.

## Conflict rules

- Every shared destination creates conflict, without team or friendship exceptions.
- One participant is selected with equal probability.
- One winner remains active.
- All other occupants are defeated.
- Separate cells can resolve separate conflicts during the same round.
- Characters swapping positions do not conflict unless they share a final cell.

Weighted characters, manual winner overrides, and AI judging can be added later.

## Map display

- Circular cell overlays show cell names.
- Dotted lines show legal movement routes.
- Character portraits appear in a small stack at the occupied cell.
- A contested cell pulses in a neutral conflict color before Reveal.
- The pulse does not indicate who won.
- After Reveal, defeated portraits become grey and translucent.

## Local persistence

IndexedDB stores one current campaign in the first playable model, including:

- Campaign name.
- Map image data.
- Cell positions, sizes, names, and connections.
- Character images, names, positions, and status.
- Story source text.
- Current phase and pending conflict outcomes.
- Round history and copyable text.

The app auto-saves after setup edits, movement, winner selection, and reveal. Cross-device synchronization is not included. Export/import packages can be added later.

## First playable implementation

The implementation uses:

- TypeScript and React.
- Vite for development and production builds.
- HTML overlays and SVG connection lines over the map.
- IndexedDB for local persistence.
- A service worker and web app manifest for PWA installation and offline caching.
- Bundled SVG placeholder art.

## Later settings and features

Potential additions include:

- Adjustable stay probability.
- Different movement weights for each route.
- Automatic suggestions for nearby cell connections.
- Character statistics and weighted conflicts.
- Campaign export and import.
- Multiple local campaigns.
- Pinch-to-zoom map editing.
- Direct text or image generation APIs.
- Native app-store wrappers.
