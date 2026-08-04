# turnflockoff.com MCP servers

Three standalone [Model Context Protocol](https://modelcontextprotocol.io) servers, each in its
own directory with its own `package.json`. They don't share code or a workspace — build and run
them independently.

| Server | Purpose | Storage |
|---|---|---|
| [`alpr-camera-finder`](./alpr-camera-finder) | Find publicly mapped ALPR/surveillance cameras via OpenStreetMap | none (live API calls) |
| [`shop-catalog`](./shop-catalog) | Manage the turnflockoff.com merch catalog and render the storefront page | local JSON file |
| [`flappy-leaderboard`](./flappy-leaderboard) | High scores, player stats, and achievements for FLOCKOFF FLAPPY | local JSON file |

## Setup

Each server needs its own install + build:

```bash
cd mcp-servers/alpr-camera-finder && npm install && npm run build
cd ../shop-catalog && npm install && npm run build
cd ../flappy-leaderboard && npm install && npm run build
```

This produces `dist/index.js` in each directory, which is what you point an MCP client at.

## Registering with an MCP client

For a client that reads a JSON config (e.g. Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "alpr-camera-finder": {
      "command": "node",
      "args": ["/absolute/path/to/FlockOff-Flappy/mcp-servers/alpr-camera-finder/dist/index.js"]
    },
    "shop-catalog": {
      "command": "node",
      "args": ["/absolute/path/to/FlockOff-Flappy/mcp-servers/shop-catalog/dist/index.js"]
    },
    "flappy-leaderboard": {
      "command": "node",
      "args": ["/absolute/path/to/FlockOff-Flappy/mcp-servers/flappy-leaderboard/dist/index.js"]
    }
  }
}
```

All three talk over stdio — no ports, no auth, nothing to deploy for local use.

## alpr-camera-finder

Read-only. Wraps the public OpenStreetMap Overpass API (camera locations) and Nominatim
(geocoding place names). No API key needed.

Tools: `find_cameras_near_point`, `find_cameras_in_bbox`, `search_cameras_by_place`, `get_camera_details`.

**Known limitation:** the free public Overpass instance (`overpass-api.de`) is a shared resource
and can be slow or return `504` under load, especially from cloud/datacenter IPs — this is an
availability characteristic of the free service, not a bug in the server. The server times out
client-side after 20s with an actionable error rather than hanging. If you see repeated timeouts,
point it at a mirror:

```bash
OVERPASS_URL=https://overpass.kumi.systems/api/interpreter node dist/index.js
```

**Coverage caveat:** camera data is community-mapped on OpenStreetMap. It is not exhaustive or
authoritative — an empty result does not mean no camera is present, and a listed camera's
`surveillance:type` tag reflects whatever the mapper recorded, not a verified fact.

## shop-catalog

Manages `data/products.json` (committed, seeded with the current 4 products: gag glasses, IR
glasses, the legal FLOCK OFF plate frame, and stickers) and can regenerate the static storefront
HTML from it.

Tools: `list_products`, `get_product`, `add_product`, `update_product`, `remove_product`, `render_storefront_html`.

**This does not touch real payments or inventory.** It's a catalog/content layer — `render_storefront_html`
produces a static page with placeholder "ADD TO CART" buttons. Wire those to your actual checkout
provider (Stripe, Shopify, etc.) separately.

**Built-in content guard:** `add_product` and `update_product` refuse any listing shaped like a
license-plate obstruction device (text matching "plate" + a covering/obscuring/obstructing verb),
because covering a plate character to defeat ALPR/toll/red-light cameras is illegal in most US
states regardless of "novelty" or "art" framing (see e.g. California Vehicle Code §5201(f)). This
is a narrow, literal pattern match on the listing text — it won't catch every phrasing and isn't a
substitute for actually reviewing new listings, but it stops the obvious case by default. Legitimate
plate-adjacent items (like the frame already in the catalog, which leaves every character visible)
aren't affected.

## flappy-leaderboard

Backs the actual FLOCKOFF FLAPPY game's save-system requirements (high score, statistics,
achievements, coins) with a local JSON store at `data/game-state.json` (gitignored — it's runtime
state, recreated automatically on first run). The achievement catalog itself
(`data/achievements.json`) is committed static reference data.

Tools: `submit_score`, `get_leaderboard`, `get_player_stats`, `list_achievements`,
`unlock_achievement`, `get_global_stats`.

Achievements auto-unlock on `submit_score` based on the run's score, level reached, coins, and
whether the player won (survived Level 3 / reached the ending portal). See
`data/achievements.json` for the full catalog.

## Testing a server manually

Use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node mcp-servers/shop-catalog/dist/index.js
```

Or send raw JSON-RPC over stdio if you don't have a browser available in your environment —
`initialize`, then `tools/list`, then `tools/call`.
