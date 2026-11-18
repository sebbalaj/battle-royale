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
- Conflict results hidden on the map until Reveal.
- A sticky **Round text** control that opens basic and conflict text without page scrolling.
- Conflict text with results and 8–12 randomized story entries.
- IndexedDB auto-save for the campaign, uploaded images, and pending results.
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
