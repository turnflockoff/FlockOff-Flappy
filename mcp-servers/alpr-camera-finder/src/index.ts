import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const USER_AGENT = "turnflockoff-alpr-camera-finder-mcp/1.0 (+https://turnflockoff.com)";
// The main public instance (overpass-api.de) is a shared free resource and is frequently slow
// or 504s under load, especially from cloud/datacenter IPs. Override with a mirror (e.g.
// https://overpass.kumi.systems/api/interpreter) via OVERPASS_URL if you see repeated timeouts.
const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org/search";
const OVERPASS_TIMEOUT_MS = 20_000;

const MAX_RADIUS_M = 5000;
const MAX_BBOX_DEG = 0.5; // ~55km per side — keeps Overpass queries fast and polite

const SOURCE_NOTE =
  "Source: OpenStreetMap contributors, via the Overpass API. This is community-mapped data — " +
  "coverage depends on volunteer surveys and is neither exhaustive nor authoritative. " +
  "An empty result does not mean no camera is present.";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface CameraResult {
  osm_id: string;
  osm_type: string;
  lat: number;
  lon: number;
  is_alpr: boolean;
  operator: string | null;
  surveillance_type: string | null;
  tags: Record<string, string>;
  osm_url: string;
}

function toCameraResult(el: OverpassElement): CameraResult {
  const lat = el.lat ?? el.center?.lat ?? 0;
  const lon = el.lon ?? el.center?.lon ?? 0;
  const tags = el.tags ?? {};
  const surveillanceType = tags["surveillance:type"] ?? null;
  return {
    osm_id: `${el.type}/${el.id}`,
    osm_type: el.type,
    lat,
    lon,
    is_alpr: (surveillanceType ?? "").toUpperCase().includes("ALPR"),
    operator: tags.operator ?? null,
    surveillance_type: surveillanceType,
    tags,
    osm_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

async function runOverpassQuery(ql: string): Promise<CameraResult[]> {
  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  try {
    res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: `data=${encodeURIComponent(ql)}`,
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new Error(
      isAbort
        ? `Overpass API (${OVERPASS_URL}) did not respond within ${OVERPASS_TIMEOUT_MS / 1000}s. The public ` +
          `instance is a shared free resource and is often slow from cloud IPs — wait a minute and retry, or ` +
          `set the OVERPASS_URL environment variable to a mirror such as https://overpass.kumi.systems/api/interpreter.`
        : `Could not reach the Overpass API (network error): ${(err as Error).message}. It may be temporarily down — try again shortly.`
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (res.status === 429 || res.status === 504) {
      throw new Error(
        `Overpass API is rate-limiting or timing out (HTTP ${res.status}). ` +
          `Try a smaller radius/bounding box, or wait a minute before retrying.`
      );
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Overpass API returned HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as OverpassResponse;
  return data.elements.map(toCameraResult);
}

function buildSurveillanceQuery(filterClause: string, area: string): string {
  return `
    [out:json][timeout:25];
    (
      node["man_made"="surveillance"]${filterClause}(${area});
      way["man_made"="surveillance"]${filterClause}(${area});
      node["man_made"="surveillance_camera"]${filterClause}(${area});
    );
    out center tags;
  `;
}

const server = new McpServer({
  name: "alpr-camera-finder",
  version: "1.0.0",
});

server.registerTool(
  "find_cameras_near_point",
  {
    title: "Find cameras near a point",
    description:
      "Find publicly mapped surveillance cameras (including ALPR / license-plate readers) within a radius " +
      "of a latitude/longitude, using community-contributed OpenStreetMap data. Read-only, no auth required. " +
      SOURCE_NOTE,
    inputSchema: {
      lat: z.number().min(-90).max(90).describe("Latitude of the center point"),
      lon: z.number().min(-180).max(180).describe("Longitude of the center point"),
      radius_meters: z
        .number()
        .int()
        .min(50)
        .max(MAX_RADIUS_M)
        .default(1000)
        .describe(`Search radius in meters (max ${MAX_RADIUS_M})`),
      category: z
        .enum(["alpr", "all"])
        .default("all")
        .describe("'alpr' to filter to license-plate-reader cameras only, 'all' for every mapped surveillance camera"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ lat, lon, radius_meters, category }) => {
    try {
      const filterClause = category === "alpr" ? `["surveillance:type"~"ALPR",i]` : "";
      const ql = buildSurveillanceQuery(filterClause, `around:${radius_meters},${lat},${lon}`);
      const cameras = await runOverpassQuery(ql);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { query: { lat, lon, radius_meters, category }, count: cameras.length, cameras, source: SOURCE_NOTE },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
    }
  }
);

server.registerTool(
  "find_cameras_in_bbox",
  {
    title: "Find cameras in a bounding box",
    description:
      "Find publicly mapped surveillance cameras within a rectangular bounding box, using OpenStreetMap data. " +
      "Read-only. Use for scanning a neighborhood or route corridor; the box is capped in size to keep queries fast. " +
      SOURCE_NOTE,
    inputSchema: {
      min_lat: z.number().min(-90).max(90).describe("Southern edge latitude"),
      min_lon: z.number().min(-180).max(180).describe("Western edge longitude"),
      max_lat: z.number().min(-90).max(90).describe("Northern edge latitude"),
      max_lon: z.number().min(-180).max(180).describe("Eastern edge longitude"),
      category: z.enum(["alpr", "all"]).default("all"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ min_lat, min_lon, max_lat, max_lon, category }) => {
    if (max_lat <= min_lat || max_lon <= min_lon) {
      return {
        isError: true,
        content: [{ type: "text", text: "max_lat/max_lon must be greater than min_lat/min_lon." }],
      };
    }
    if (max_lat - min_lat > MAX_BBOX_DEG || max_lon - min_lon > MAX_BBOX_DEG) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Bounding box too large (max ${MAX_BBOX_DEG}° per side, ~55km). Split into smaller boxes and query each separately.`,
          },
        ],
      };
    }
    try {
      const filterClause = category === "alpr" ? `["surveillance:type"~"ALPR",i]` : "";
      const ql = buildSurveillanceQuery(filterClause, `${min_lat},${min_lon},${max_lat},${max_lon}`);
      const cameras = await runOverpassQuery(ql);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: { min_lat, min_lon, max_lat, max_lon, category },
                count: cameras.length,
                cameras,
                source: SOURCE_NOTE,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
    }
  }
);

server.registerTool(
  "search_cameras_by_place",
  {
    title: "Search cameras by place name",
    description:
      "Geocode a place name (city, address, landmark) via OpenStreetMap Nominatim, then search for publicly " +
      "mapped surveillance cameras within a radius of it. Read-only. " +
      SOURCE_NOTE,
    inputSchema: {
      place: z.string().min(2).describe("Place name, e.g. 'Austin, TX' or '350 5th Ave, New York, NY'"),
      radius_meters: z.number().int().min(50).max(MAX_RADIUS_M).default(1500),
      category: z.enum(["alpr", "all"]).default("all"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ place, radius_meters, category }) => {
    try {
      const geoRes = await fetch(`${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(place)}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!geoRes.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: `Geocoding failed (HTTP ${geoRes.status}). Try a more specific place name.` }],
        };
      }
      const geoData = (await geoRes.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (geoData.length === 0) {
        return {
          isError: true,
          content: [
            { type: "text", text: `No location found for "${place}". Try a more specific or differently formatted place name.` },
          ],
        };
      }
      const { lat, lon, display_name } = geoData[0];
      const filterClause = category === "alpr" ? `["surveillance:type"~"ALPR",i]` : "";
      const ql = buildSurveillanceQuery(filterClause, `around:${radius_meters},${lat},${lon}`);
      const cameras = await runOverpassQuery(ql);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                resolved_place: display_name,
                center: { lat: Number(lat), lon: Number(lon) },
                radius_meters,
                category,
                count: cameras.length,
                cameras,
                source: SOURCE_NOTE,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
    }
  }
);

server.registerTool(
  "get_camera_details",
  {
    title: "Get camera details by OSM id",
    description:
      "Fetch full OpenStreetMap tag data for a single mapped camera node or way, given its OSM id " +
      "(e.g. 'node/123456789', as returned in the osm_id field by the other tools).",
    inputSchema: {
      osm_id: z
        .string()
        .regex(/^(node|way)\/\d+$/, "Expected format 'node/12345' or 'way/12345'")
        .describe("OSM id in 'node/12345' or 'way/12345' format"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ osm_id }) => {
    try {
      const [osmType, idStr] = osm_id.split("/");
      const ql = `[out:json][timeout:25];${osmType}(${idStr});out center tags;`;
      const cameras = await runOverpassQuery(ql);
      if (cameras.length === 0) {
        return {
          isError: true,
          content: [{ type: "text", text: `No element found for ${osm_id}, or it has no tags on OpenStreetMap.` }],
        };
      }
      return { content: [{ type: "text", text: JSON.stringify(cameras[0], null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ALPR camera finder MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
