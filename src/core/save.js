// Persistent save system backed by localStorage.

const KEY = 'flockoff-flappy-save-v1';

const DEFAULTS = {
  coins: 0,
  highScore: 0,
  victory: false,
  stats: {
    games: 0,
    flaps: 0,
    totalScore: 0,
    coinsCollected: 0,
    camerasPassed: 0,
    dronesDodged: 0,
    distance: 0,       // in meters (world px / 8)
    deaths: 0,
    playtime: 0,       // seconds
    revives: 0,
  },
  achievements: {},    // id -> true
  owned: { groucho: true },  // shop item id -> true
  equipped: { disguise: 'groucho', trail: 'white' },
  upgrades: { magnet: 0, revive: 0 },
  settings: { music: true, sfx: true, shake: true, voice: true },
};

function deepMerge(base, over) {
  const out = { ...base };
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
        base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], over[k]);
    } else if (over[k] !== undefined) {
      out[k] = over[k];
    }
  }
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    return deepMerge(structuredClone(DEFAULTS), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode); play session continues unsaved
  }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return structuredClone(DEFAULTS);
}
