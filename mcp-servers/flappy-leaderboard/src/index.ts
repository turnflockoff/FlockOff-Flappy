import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(MODULE_DIR, "..", "data");
const ACHIEVEMENTS_PATH = path.join(DATA_DIR, "achievements.json");
const STATE_PATH = path.join(DATA_DIR, "game-state.json");

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface ScoreEntry {
  player_name: string;
  score: number;
  level_reached: number;
  coins_collected: number;
  won: boolean;
  achieved_at: string;
}

interface PlayerRecord {
  games_played: number;
  best_score: number;
  total_score: number;
  total_coins: number;
  highest_level_reached: number;
  achievements: string[];
  last_played_at: string;
}

interface GameState {
  scores: ScoreEntry[];
  players: Record<string, PlayerRecord>;
}

async function loadAchievements(): Promise<Achievement[]> {
  try {
    const raw = await readFile(ACHIEVEMENTS_PATH, "utf-8");
    return JSON.parse(raw) as Achievement[];
  } catch {
    return [];
  }
}

async function loadState(): Promise<GameState> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    return JSON.parse(raw) as GameState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { scores: [], players: {} };
    throw err;
  }
}

async function saveState(state: GameState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function computeLeaderboard(state: GameState, limit: number): Array<{ rank: number; player_name: string; best_score: number }> {
  return Object.entries(state.players)
    .map(([player_name, rec]) => ({ player_name, best_score: rec.best_score }))
    .sort((a, b) => b.best_score - a.best_score)
    .slice(0, limit)
    .map((row, i) => ({ rank: i + 1, ...row }));
}

function rankOf(state: GameState, playerName: string): number | null {
  const sorted = Object.entries(state.players)
    .map(([player_name, rec]) => ({ player_name, best_score: rec.best_score }))
    .sort((a, b) => b.best_score - a.best_score);
  const idx = sorted.findIndex((r) => r.player_name === playerName);
  return idx === -1 ? null : idx + 1;
}

const server = new McpServer({
  name: "flappy-leaderboard",
  version: "1.0.0",
});

server.registerTool(
  "submit_score",
  {
    title: "Submit a game run",
    description:
      "Record the result of a completed FLOCKOFF FLAPPY run: updates the player's stats, high score, and " +
      "coin total, and auto-unlocks any achievements newly earned by this run.",
    inputSchema: {
      player_name: z.string().min(1).max(40),
      score: z.number().int().min(0),
      level_reached: z.number().int().min(1).max(3),
      coins_collected: z.number().int().min(0).default(0),
      won: z.boolean().default(false).describe("True if the player survived Level 3 and reached the ending portal"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ player_name, score, level_reached, coins_collected, won }) => {
    const state = await loadState();
    const achievements = await loadAchievements();
    const now = new Date().toISOString();

    const entry: ScoreEntry = { player_name, score, level_reached, coins_collected, won, achieved_at: now };
    state.scores.push(entry);

    const existing = state.players[player_name];
    const rec: PlayerRecord = existing ?? {
      games_played: 0,
      best_score: 0,
      total_score: 0,
      total_coins: 0,
      highest_level_reached: 0,
      achievements: [],
      last_played_at: now,
    };
    rec.games_played += 1;
    rec.total_score += score;
    rec.total_coins += coins_collected;
    rec.best_score = Math.max(rec.best_score, score);
    rec.highest_level_reached = Math.max(rec.highest_level_reached, level_reached);
    rec.last_played_at = now;

    const isNewHighScore = existing ? score > (existing.best_score ?? 0) : true;

    const earned = new Set(rec.achievements);
    const checks: Record<string, boolean> = {
      first_flight: rec.games_played === 1,
      century_club: score >= 100,
      flock_dodger: score >= 500,
      welcome_to_california: rec.highest_level_reached >= 3,
      mission_complete: won,
      pocket_change: rec.total_coins >= 100,
      big_spender: rec.total_coins >= 1000,
      disguise_master: rec.games_played >= 25,
    };
    const newlyUnlocked: Achievement[] = [];
    for (const [id, met] of Object.entries(checks)) {
      if (met && !earned.has(id)) {
        earned.add(id);
        const def = achievements.find((a) => a.id === id);
        if (def) newlyUnlocked.push(def);
      }
    }
    rec.achievements = Array.from(earned);
    state.players[player_name] = rec;

    await saveState(state);
    const rank = rankOf(state, player_name);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              recorded: entry,
              is_new_high_score: isNewHighScore,
              player_stats: rec,
              leaderboard_rank: rank,
              achievements_unlocked_this_run: newlyUnlocked,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "get_leaderboard",
  {
    title: "Get the leaderboard",
    description: "Get the top players ranked by their best score. Optionally include a specific player's rank even if outside the top N.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(10),
      player_name: z.string().optional().describe("Also report this player's rank/best score even if not in the top `limit`"),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ limit, player_name }) => {
    const state = await loadState();
    const top = computeLeaderboard(state, limit);
    const result: Record<string, unknown> = { leaderboard: top };
    if (player_name) {
      const rec = state.players[player_name];
      result.requested_player = rec
        ? { player_name, best_score: rec.best_score, rank: rankOf(state, player_name) }
        : null;
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  "get_player_stats",
  {
    title: "Get a player's stats",
    description: "Get full statistics for a single player: games played, best/average score, coins, level reached, achievements, and leaderboard rank.",
    inputSchema: { player_name: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ player_name }) => {
    const state = await loadState();
    const rec = state.players[player_name];
    if (!rec) {
      return { isError: true, content: [{ type: "text", text: `No stats found for player "${player_name}".` }] };
    }
    const achievements = await loadAchievements();
    const earned = achievements.filter((a) => rec.achievements.includes(a.id));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              player_name,
              games_played: rec.games_played,
              best_score: rec.best_score,
              average_score: rec.games_played > 0 ? Math.round((rec.total_score / rec.games_played) * 10) / 10 : 0,
              total_coins: rec.total_coins,
              highest_level_reached: rec.highest_level_reached,
              achievements: earned,
              leaderboard_rank: rankOf(state, player_name),
              last_played_at: rec.last_played_at,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "list_achievements",
  {
    title: "List achievements",
    description: "List the full achievement catalog. If player_name is given, mark which ones that player has unlocked.",
    inputSchema: { player_name: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ player_name }) => {
    const achievements = await loadAchievements();
    if (!player_name) {
      return { content: [{ type: "text", text: JSON.stringify(achievements, null, 2) }] };
    }
    const state = await loadState();
    const rec = state.players[player_name];
    const withStatus = achievements.map((a) => ({ ...a, unlocked: rec ? rec.achievements.includes(a.id) : false }));
    return { content: [{ type: "text", text: JSON.stringify(withStatus, null, 2) }] };
  }
);

server.registerTool(
  "unlock_achievement",
  {
    title: "Manually unlock an achievement",
    description: "Admin override to grant a player a specific achievement directly (idempotent — safe to call repeatedly). Creates the player record if it doesn't exist yet.",
    inputSchema: {
      player_name: z.string().min(1),
      achievement_id: z.string().min(1),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ player_name, achievement_id }) => {
    const achievements = await loadAchievements();
    if (!achievements.some((a) => a.id === achievement_id)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown achievement_id "${achievement_id}". Call list_achievements for valid ids.` }],
      };
    }
    const state = await loadState();
    const now = new Date().toISOString();
    const rec =
      state.players[player_name] ??
      ({
        games_played: 0,
        best_score: 0,
        total_score: 0,
        total_coins: 0,
        highest_level_reached: 0,
        achievements: [],
        last_played_at: now,
      } as PlayerRecord);
    if (!rec.achievements.includes(achievement_id)) rec.achievements.push(achievement_id);
    state.players[player_name] = rec;
    await saveState(state);
    return { content: [{ type: "text", text: `"${achievement_id}" unlocked for ${player_name}.` }] };
  }
);

server.registerTool(
  "get_global_stats",
  {
    title: "Get global game statistics",
    description: "Get aggregate statistics across every player: total games played, total players, total coins collected, average score, and the top score.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    const state = await loadState();
    const players = Object.entries(state.players);
    const totalGames = players.reduce((sum, [, r]) => sum + r.games_played, 0);
    const totalCoins = players.reduce((sum, [, r]) => sum + r.total_coins, 0);
    const totalScoreSum = players.reduce((sum, [, r]) => sum + r.total_score, 0);
    const top = players.reduce<{ player_name: string; best_score: number } | null>((best, [name, r]) => {
      if (!best || r.best_score > best.best_score) return { player_name: name, best_score: r.best_score };
      return best;
    }, null);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total_players: players.length,
              total_games_played: totalGames,
              total_coins_collected: totalCoins,
              global_average_score: totalGames > 0 ? Math.round((totalScoreSum / totalGames) * 10) / 10 : 0,
              top_score: top,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Flappy leaderboard MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
