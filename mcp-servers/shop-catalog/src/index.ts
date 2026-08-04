import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(MODULE_DIR, "..", "data");
const PRODUCTS_PATH = path.join(DATA_DIR, "products.json");

interface Product {
  id: string;
  name: string;
  price_usd: number;
  category: string;
  tag?: string;
  emoji?: string;
  description: string;
  fine_print?: string;
  active: boolean;
}

// Refuses to catalog anything shaped like a license-plate obstruction device (e.g. the
// magnetic "leaf" concept this store's owner keeps floating). CA Veh. Code 5201(f) and
// equivalents elsewhere ban covering/obscuring plate characters to defeat ALPR/toll/red-light
// cameras — a "novelty" or "art" disclaimer doesn't change that the *product* is illegal to use.
// This is a content-shape guard, not a brand filter: legitimate items like the plate FRAME
// (which leaves every character visible) don't match it.
const PLATE_PATTERN = /plate/i;
const OBSTRUCTION_VERB_PATTERN = /(cover|obscure|obstruct|conceal|hide|block|defeat|evade|jam|spray|blur)/i;

function isBlockedListing(name: string, description: string, finePrint: string): { blocked: boolean; reason?: string } {
  const text = `${name} ${description} ${finePrint}`;
  if (PLATE_PATTERN.test(text) && OBSTRUCTION_VERB_PATTERN.test(text)) {
    return {
      blocked: true,
      reason:
        "Refused: this listing reads as a device to cover/obscure/obstruct a license plate character. " +
        "That's illegal to use in most US states regardless of marketing language (e.g. CA Veh. Code §5201(f) " +
        "bans any product that obstructs or impairs electronic reading of a plate). A disclaimer like " +
        "'art frames only' does not make the product legal — the obstruction itself is the violation. " +
        "If you want a plate-adjacent product, list a frame/decal that leaves all characters fully visible instead.",
    };
  }
  return { blocked: false };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function loadProducts(): Promise<Product[]> {
  try {
    const raw = await readFile(PRODUCTS_PATH, "utf-8");
    return JSON.parse(raw) as Product[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function saveProducts(products: Product[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PRODUCTS_PATH, JSON.stringify(products, null, 2) + "\n", "utf-8");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStorefront(products: Product[]): string {
  const cards = products
    .filter((p) => p.active)
    .map(
      (p) => `
      <div class="card">
        <div class="thumb">${p.tag ? `<div class="tag">${escapeHtml(p.tag)}</div>` : ""}<div class="emoji">${p.emoji ?? "🛍️"}</div></div>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="price">$${p.price_usd.toFixed(2)}</p>
        <p class="desc">${escapeHtml(p.description)}</p>
        ${p.fine_print ? `<p class="fine">${escapeHtml(p.fine_print)}</p>` : ""}
        <div class="cta">ADD TO CART</div>
      </div>`
    )
    .join("\n");

  // The donate bar and the legal note are fixed template chrome — intentionally NOT data-driven,
  // so no product-catalog edit can ever cause the donate link to disappear from the top of the page.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Shop &amp; Support — TURNFLOCKOFF.COM</title>
<style>
  :root{
    --bg:#0e1116; --panel:#161b22; --panel2:#1c232d; --ink:#e8edf2; --muted:#9aa7b4;
    --accent:#ff3b3b; --accent2:#26d07c; --line:#2a333f; --gold:#ffd166;
    --shadow:0 10px 30px rgba(0,0,0,.45);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;line-height:1.5}
  a{color:inherit}
  .donatebar{position:sticky;top:0;z-index:50;display:flex;align-items:center;
    justify-content:space-between;gap:12px;padding:10px 16px;
    background:linear-gradient(90deg,#12161c,#171d25);border-bottom:1px solid var(--line);
    backdrop-filter:blur(6px)}
  .brand{font-weight:800;letter-spacing:1px;font-size:14px}
  .brand span{color:var(--accent)}
  .donate{display:inline-flex;align-items:center;gap:8px;background:var(--accent2);
    color:#04130b;text-decoration:none;font-weight:800;padding:9px 16px;border-radius:8px;
    border:1px solid #1aa863;box-shadow:0 4px 0 #109154;white-space:nowrap}
  .donate:active{transform:translateY(2px);box-shadow:0 2px 0 #109154}
  .hero{max-width:1000px;margin:0 auto;padding:38px 20px 8px;text-align:center}
  .hero h1{font-size:clamp(24px,5vw,40px);margin:0 0 8px;letter-spacing:1px}
  .hero h1 b{color:var(--accent)}
  .hero p{color:var(--muted);max-width:620px;margin:6px auto 0}
  .pill{display:inline-block;margin-top:14px;padding:6px 12px;border:1px dashed var(--line);
    border-radius:999px;color:var(--gold);font-size:12px}
  .wrap{max-width:1000px;margin:0 auto;padding:24px 20px 60px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;
    overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow)}
  .thumb{aspect-ratio:1/1;display:grid;place-items:center;background:
    radial-gradient(120% 120% at 30% 20%,#232c37,#12161c);border-bottom:1px solid var(--line);
    position:relative}
  .thumb .emoji{font-size:64px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))}
  .thumb .tag{position:absolute;top:10px;left:10px;font-size:10px;letter-spacing:1px;
    background:#0c0f14cc;border:1px solid var(--line);padding:4px 8px;border-radius:6px;color:var(--muted)}
  .card h3{margin:14px 14px 4px;font-size:16px}
  .card .price{margin:0 14px;color:var(--accent2);font-weight:800;font-size:18px}
  .card .desc{margin:8px 14px 0;color:var(--muted);font-size:12.5px;flex:1}
  .card .fine{margin:10px 14px 0;color:#7f8b98;font-size:10.5px;font-style:italic}
  .card .cta{margin:14px;padding:11px;border:1px solid #333f4d;border-radius:9px;
    background:#212a34;color:var(--ink);font-weight:800;text-align:center;cursor:pointer;
    letter-spacing:.5px}
  .card .cta:hover{background:#28323d}
  footer{max-width:1000px;margin:0 auto;padding:24px 20px 50px;color:#7f8b98;font-size:12px;
    border-top:1px solid var(--line)}
  footer b{color:var(--muted)}
  .note{background:var(--panel2);border:1px solid var(--line);border-radius:12px;
    padding:14px 16px;margin:0 0 22px;color:var(--muted);font-size:12.5px}
  .note b{color:var(--gold)}
</style>
</head>
<body>

  <div class="donatebar">
    <div class="brand">TURN<span>FLOCK</span>OFF<span>.COM</span></div>
    <a class="donate" href="#donate" aria-label="Donate to the cause">❤ DONATE</a>
  </div>

  <header class="hero">
    <h1>Gear up. <b>Flock off.</b></h1>
    <p>Every order funds the fight against warrantless mass surveillance in your town.
       Wear it loud — none of it touches your license plate.</p>
    <div class="pill">100% street-legal merch · proceeds fund ALPR advocacy</div>
  </header>

  <main class="wrap">

    <div class="note">
      <b>Why no “plate leaf”?</b> Covering any character on your plate — even to dodge a camera —
      violates <b>CA Vehicle Code §5201(f)</b> and equivalents nationwide, disclaimer or not.
      We don’t sell it. The plate frame below makes the point and stays 100% legal:
      every character, the state name, and the sticker stay fully visible.
    </div>

    <div class="grid">
${cards}
    </div>

    <div id="donate" class="note" style="margin-top:26px;text-align:center">
      Prefer to give directly? <a href="#" style="color:var(--accent2);font-weight:800">
      Make a one-time or monthly donation →</a> Your support keeps the cameras
      accountable and the merch flying.
    </div>

  </main>

  <footer>
    <p><b>TURNFLOCKOFF.COM</b> — fighting warrantless mass surveillance, one town at a time.</p>
    <p>Nothing here obstructs, covers, alters, or defeats a license plate or any legally
       required marking. Products are sold for lawful use only; comply with your local laws.
       “Add to cart” buttons are placeholders — wire them to your checkout provider.</p>
  </footer>

</body>
</html>
`;
}

const server = new McpServer({
  name: "shop-catalog",
  version: "1.0.0",
});

server.registerTool(
  "list_products",
  {
    title: "List products",
    description: "List every product in the turnflockoff.com catalog.",
    inputSchema: {
      include_inactive: z.boolean().default(false).describe("Include products marked inactive/delisted"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ include_inactive }) => {
    const products = await loadProducts();
    const filtered = include_inactive ? products : products.filter((p) => p.active);
    return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
  }
);

server.registerTool(
  "get_product",
  {
    title: "Get a product",
    description: "Fetch a single product by id.",
    inputSchema: { id: z.string().describe("Product id (slug)") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    const products = await loadProducts();
    const product = products.find((p) => p.id === id);
    if (!product) {
      return { isError: true, content: [{ type: "text", text: `No product with id "${id}".` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(product, null, 2) }] };
  }
);

server.registerTool(
  "add_product",
  {
    title: "Add a product",
    description:
      "Add a new product to the catalog. Rejects listings shaped like a license-plate obstruction device " +
      "(illegal under CA Veh. Code §5201(f) and equivalents) regardless of disclaimers.",
    inputSchema: {
      id: z.string().optional().describe("Slug id; auto-generated from name if omitted"),
      name: z.string().min(1),
      price_usd: z.number().positive(),
      category: z.string().min(1),
      description: z.string().min(1),
      fine_print: z.string().optional(),
      tag: z.string().optional().describe("Small badge shown on the card, e.g. 'NEW'"),
      emoji: z.string().optional().describe("Single emoji used as the placeholder product image"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ id, name, price_usd, category, description, fine_print, tag, emoji }) => {
    const guard = isBlockedListing(name, description, fine_print ?? "");
    if (guard.blocked) {
      return { isError: true, content: [{ type: "text", text: guard.reason! }] };
    }
    const products = await loadProducts();
    const finalId = id ?? slugify(name);
    if (products.some((p) => p.id === finalId)) {
      return {
        isError: true,
        content: [{ type: "text", text: `A product with id "${finalId}" already exists. Use update_product instead.` }],
      };
    }
    const product: Product = {
      id: finalId,
      name,
      price_usd,
      category,
      description,
      fine_print,
      tag,
      emoji,
      active: true,
    };
    products.push(product);
    await saveProducts(products);
    return { content: [{ type: "text", text: JSON.stringify(product, null, 2) }] };
  }
);

server.registerTool(
  "update_product",
  {
    title: "Update a product",
    description:
      "Update fields on an existing product. Same content guard as add_product applies to the merged result.",
    inputSchema: {
      id: z.string(),
      name: z.string().min(1).optional(),
      price_usd: z.number().positive().optional(),
      category: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      fine_print: z.string().optional(),
      tag: z.string().optional(),
      emoji: z.string().optional(),
      active: z.boolean().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...updates }) => {
    const products = await loadProducts();
    const idx = products.findIndex((p) => p.id === id);
    if (idx === -1) {
      return { isError: true, content: [{ type: "text", text: `No product with id "${id}".` }] };
    }
    const current = products[idx];
    const merged: Product = {
      id: current.id,
      name: updates.name ?? current.name,
      price_usd: updates.price_usd ?? current.price_usd,
      category: updates.category ?? current.category,
      description: updates.description ?? current.description,
      fine_print: updates.fine_print ?? current.fine_print,
      tag: updates.tag ?? current.tag,
      emoji: updates.emoji ?? current.emoji,
      active: updates.active ?? current.active,
    };
    const guard = isBlockedListing(merged.name, merged.description, merged.fine_print ?? "");
    if (guard.blocked) {
      return { isError: true, content: [{ type: "text", text: guard.reason! }] };
    }
    products[idx] = merged;
    await saveProducts(products);
    return { content: [{ type: "text", text: JSON.stringify(merged, null, 2) }] };
  }
);

server.registerTool(
  "remove_product",
  {
    title: "Remove a product",
    description: "Permanently remove a product from the catalog.",
    inputSchema: { id: z.string() },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    const products = await loadProducts();
    const next = products.filter((p) => p.id !== id);
    if (next.length === products.length) {
      return { isError: true, content: [{ type: "text", text: `No product with id "${id}".` }] };
    }
    await saveProducts(next);
    return { content: [{ type: "text", text: `Removed "${id}". ${next.length} product(s) remain.` }] };
  }
);

server.registerTool(
  "render_storefront_html",
  {
    title: "Render the storefront page",
    description:
      "Generate the complete products.html storefront from the current catalog. The donate link is always " +
      "pinned at the top of the page — this is fixed template chrome, not something catalog edits can remove. " +
      "Optionally writes the result to a file path.",
    inputSchema: {
      write_to_path: z.string().optional().describe("Absolute path to write the HTML file to, e.g. '/home/user/FlockOff-Flappy/products.html'"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ write_to_path }) => {
    const products = await loadProducts();
    const html = renderStorefront(products);
    if (write_to_path) {
      await mkdir(path.dirname(write_to_path), { recursive: true });
      await writeFile(write_to_path, html, "utf-8");
      return { content: [{ type: "text", text: `Wrote ${html.length} bytes to ${write_to_path}` }] };
    }
    return { content: [{ type: "text", text: html }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Shop catalog MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
