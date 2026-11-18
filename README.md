# Battle Royale

A local-first map game designed to be used alongside external AI text and image generators.

## Status

The repository currently contains the initial product draft. Implementation has not started.

## Core idea

1. Upload a map and draw playable areas over it.
2. Upload and name character portraits.
3. Import words or phrases separated by semicolons.
4. Let the game move every active character randomly, including a chance to stay.
5. Generate a copyable randomized text string before revealing any conflict result.
6. On the next advance, reveal each conflict winner and grey out defeated characters.
7. Save the campaign and current game locally on the device.

See [`docs/product-draft.md`](docs/product-draft.md) for the proposed behavior, state model, assumptions, and open decisions.
