# Battle Royale

A local-first map game designed for use alongside external AI text and image generators.

## First playable model

The current model includes:

- A built-in fantasy map and four placeholder characters.
- PNG, JPEG, and WebP uploads for the map and character portraits.
- Plain-text file upload or pasted semicolon-separated story entries.
- Circular map cells placed manually over the image.
- Manually connected nearby cells that define allowed movement.
- A 50% chance to stay and a 50% chance to move to a connected cell.
- Simultaneous movement and automatic conflict detection.
- Hidden map results until the next Reveal action.
- Basic-round and conflict copy text.
- Conflict text containing the winner and 8–12 randomized semicolon-separated entries.
- Greyed-out defeated characters.
- IndexedDB auto-save for the campaign, images, and pending results.
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

See [`docs/product-draft.md`](docs/product-draft.md) for the current rules and interaction model.
