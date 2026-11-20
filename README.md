# Battle Royale

A local-first map game designed for use alongside external AI text and image generators.

## Play

Once GitHub Pages is enabled, open:

[https://sebbalaj.github.io/battle-royale/](https://sebbalaj.github.io/battle-royale/)

## Current model

- Built-in fantasy map and four placeholder characters.
- Local PNG, JPEG, and WebP uploads for maps and portraits.
- Plain-text file upload or pasted semicolon-separated story entries.
- Circular map cells placed manually over the image.
- Connected nearby cells that define allowed movement.
- 50% chance to stay and 50% chance to move to a connected cell.
- Power starts at 7 and changes by `-2`, `-1`, `0`, `+1`, or `+2` every movement round.
- Power-weighted fight odds, winner damage, loser death or escape, and invulnerable characters.
- Four weapon types (suppressed pistol, sniper, knife, shotgun) across two slots: a combat slot and a separate ranged slot, so a character can hold both a combat weapon and a sniper at once. Combat weapons add a secret power bonus that shifts fight odds but never shows on the displayed number; the ranged slot only enables sniper fire. A character always keeps the stronger weapon per slot and ignores weaker finds.
- Weapons can be assigned to characters or placed on the map. A killed character drops **both** weapon slots on the cell; the killer claims each only if it is better for that slot, otherwise it stays on the ground. Characters auto-pick a better ground weapon into its matching slot when they arrive on a cell.
- Supply crates placed on the map with a find chance to open and reveal a weapon when a character arrives.
- Sniper shots: a sniper holder has a small chance each round to target a random character in a connected cell. The target is locked at Advance and resolved at Reveal, as either an instant kill or flat damage. Invulnerable targets survive at 1 power.
- Named healing points with a heal amount, a success chance, and a cooldown. Named danger points with a per-point avoid chance (default 25%): occupants that avoid take no damage, otherwise they take random damage in a set range, which can kill the vulnerable. Danger points act as unkillable terrain.
- A **Settings** menu to tweak every tunable value (movement, power, combat, weapons, sniper, crates, healing, danger).
- Named layout save slots that store the whole setup (map, cells, characters, weapons, crates, healing and danger points) without touching settings or an in-progress battle.
- Larger map portraits with the power number moved off the face, dual weapon glyphs (one for the combat slot and one for the ranged slot), a sniper targeting indicator, and crate / healing / danger markers. A dead character with a custom dead-body image renders that image on the minimap as a small rectangle in its natural aspect ratio instead of the greyed circle.
- Conflict results hidden on the map until Reveal.
- A sticky action bar with the Advance / Reveal control, a **Round text** button that opens basic and conflict text without page scrolling, a compact **Copy both** button that copies the basic and conflict text together in one tap without opening the drawer, and a compact **Conflict** button that teleports two random living characters onto one shared cell and runs the normal hidden-then-reveal flow so the outcome stays hidden on the map.
- A fullscreen cell viewer: press and hold a map cell to open one image at a time for the characters on that cell, fallen first then living. A fallen character shows its greyed portrait by default; you can paste a custom dead-body image from the clipboard (with a file-picker fallback on Safari / iOS) or remove it to revert. Navigate with swipe, arrow keys, or on-screen chevrons.
- Numeric fields across Setup and Settings can be cleared while editing and commit the parsed value (or a fallback) on blur, so there is no forced leading zero.
- Three copyable texts: a setup prompt describing the map and cast for an AI, the basic round text, and the conflict text with results and 8 to 12 randomized story entries.
- IndexedDB auto-save for the campaign, uploaded images, pending results, custom dead-body images, and saved layout slots.
- Installable PWA configuration for mobile and desktop browsers.

## Image uploads

Open **Setup** and use **Replace map** or **Upload portrait**. Images remain in IndexedDB on that device and are not uploaded to GitHub or another server. Each image can be up to 15 MB.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

See [`docs/product-draft.md`](docs/product-draft.md) for the current game rules.
