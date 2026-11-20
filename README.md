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
- Larger map portraits with the power number moved off the face, plus weapon icons, a sniper targeting indicator, and crate / healing / danger markers.
- Conflict results hidden on the map until Reveal.
- A sticky **Round text** control that opens basic and conflict text without page scrolling.
- Three copyable texts: a setup prompt describing the map and cast for an AI, the basic round text, and the conflict text with results and 8 to 12 randomized story entries.
- IndexedDB auto-save for the campaign, uploaded images, pending results, and saved layout slots.
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
