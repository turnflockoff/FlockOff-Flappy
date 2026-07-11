// Static game data: level tuning, achievements, shop catalog, credits.

export const W = 320;
export const H = 180;
export const GROUND_Y = 164;

// Score thresholds where each level begins.
export const LEVEL2_AT = 10;
export const LEVEL3_AT = 25;
export const FINAL_AT = 50; // survive to here to reach the portal

export const LEVELS = [
  {
    name: 'SMALL TOWN',
    sky: ['#7ec8f0', '#b8e4f8'],
    hills: '#8fbf6a',
    buildings: ['#c8a878', '#b89468', '#d8b888'],
    night: 0,
    rain: 0,
    fog: 0,
    bgCamChance: 0.25,
    decoChance: 0.3,
    droneEvery: 0,       // no drones
    speed: 42,
    gap: 66,
    spacing: 150,
  },
  {
    name: 'THE CITY',
    sky: ['#5a7ab8', '#c88a6a'],
    hills: '#4a5a78',
    buildings: ['#6a7290', '#5a6280', '#7a82a0'],
    night: 0.35,
    rain: 0.5,
    fog: 0.1,
    bgCamChance: 0.7,
    decoChance: 0.5,
    droneEvery: 7,       // a hunter drone about every N obstacles
    speed: 50,
    gap: 58,
    spacing: 138,
  },
  {
    name: 'CALIFORNIA',
    sky: ['#101024', '#38204a'],
    hills: '#1a1e32',
    buildings: ['#2a2e44', '#232738', '#323852'],
    night: 0.85,
    rain: 0.75,
    fog: 0.35,
    bgCamChance: 1.6,    // >1 = multiple per slot
    decoChance: 0.7,
    droneEvery: 4,
    speed: 58,
    gap: 52,
    spacing: 126,
  },
];

export function levelForScore(score) {
  if (score >= LEVEL3_AT) return 2;
  if (score >= LEVEL2_AT) return 1;
  return 0;
}

export const ACHIEVEMENTS = [
  { id: 'first', name: 'FIRST FLIGHT', desc: 'Pass your first FLOUK camera', check: (s, g) => g.score >= 1 },
  { id: 'town10', name: 'SUBURBAN LEGEND', desc: 'Score 10 in one run', check: (s, g) => g.score >= 10 },
  { id: 'city25', name: 'CITY SLICKER', desc: 'Score 25 in one run', check: (s, g) => g.score >= 25 },
  { id: 'cali', name: 'GOLDEN STATE OF FEAR', desc: 'Reach California', check: (s, g) => g.level >= 2 },
  { id: 'finish', name: 'YOU TURNED FLOCK OFF', desc: 'Escape through the portal', check: (s) => s.victory },
  { id: 'coins100', name: 'SHINY THINGS', desc: 'Collect 100 coins total', check: (s) => s.stats.coinsCollected >= 100 },
  { id: 'coins500', name: 'DOWNY MOGUL', desc: 'Collect 500 coins total', check: (s) => s.stats.coinsCollected >= 500 },
  { id: 'flap1000', name: 'FEATHER DUSTER', desc: 'Flap 1000 times', check: (s) => s.stats.flaps >= 1000 },
  { id: 'games25', name: 'FREQUENT FLYER', desc: 'Play 25 runs', check: (s) => s.stats.games >= 25 },
  { id: 'drones10', name: 'DRONE DODGER', desc: 'Outfly 10 hunter drones', check: (s) => s.stats.dronesDodged >= 10 },
  { id: 'combo5', name: 'THREADING THE NEEDLE', desc: 'Chain a x5 near-miss combo', check: (s, g) => g.runMaxCombo >= 5 },
  { id: 'shopper', name: 'RETAIL THERAPY', desc: 'Buy something from the shop', check: (s) => Object.keys(s.owned).length > 1 || s.upgrades.magnet > 0 || s.upgrades.revive > 0 },
  { id: 'km', name: 'AS THE DOVE FLIES', desc: 'Fly 10000 m total', check: (s) => s.stats.distance >= 10000 },
];

export const SHOP = [
  { id: 'shades', kind: 'disguise', name: 'INCOGNITO SHADES', desc: 'Nobody suspects the cool dove', price: 60 },
  { id: 'detective', kind: 'disguise', name: 'PRIVATE EYE', desc: 'Fedora and monocle. Classy.', price: 120 },
  { id: 'luchador', kind: 'disguise', name: 'EL PALOMO', desc: 'Masked and mysterious', price: 200 },
  { id: 'gold', kind: 'trail', name: 'GOLDEN FEATHERS', desc: 'Leave a golden trail', price: 80 },
  { id: 'rainbow', kind: 'trail', name: 'RAINBOW FEATHERS', desc: 'Taste the sky', price: 150 },
  { id: 'magnet', kind: 'upgrade', name: 'COIN MAGNET', desc: 'Pull in nearby coins', price: 100, max: 3 },
  { id: 'revive', kind: 'upgrade', name: 'SPARE FEATHERS', desc: 'One revive per run', price: 250, max: 1 },
];

export const TRAIL_COLORS = {
  white: ['#f8f8f8', '#c9cede'],
  gold: ['#f0c030', '#f8e080'],
  rainbow: ['#ff5050', '#f0c030', '#40e080', '#40a0ff', '#c060ff'],
};

export const CREDITS = [
  'FLOCKOFF FLAPPY',
  '',
  'A GAME ABOUT ONE BRAVE DOVE',
  'AND TOO MANY CAMERAS',
  '',
  'GAME DESIGN',
  'THE FLOCKOFF TEAM',
  '',
  'CODE, ART AND MUSIC',
  'MADE WITH LOVE AND PIXELS',
  '',
  'STARRING',
  'A VERY PARANOID DOVE',
  '',
  'ANTAGONIST',
  'FLOUK OPTICAL SYSTEMS',
  'NOT A REAL COMPANY',
  '',
  'NO DOVES WERE SCANNED',
  'IN THE MAKING OF THIS GAME',
  '',
  'TURNFLOCKOFF.COM',
  '',
  'THANKS FOR PLAYING!',
];
