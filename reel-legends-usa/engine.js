// ============================================================
// REEL LEGENDS: USA — Engine
// Save state, economy, idle simulation, and catch resolution.
// No rendering or DOM here — render.js and ui.js own that.
// ============================================================

const SAVE_KEY = "reel-legends-save-v1";

function defaultState() {
  const now = Date.now();
  return {
    version: 1,
    createdAt: now,
    lastSeen: now,
    coins: 50,
    gems: 0,
    xp: 0,
    level: 1,
    rodTier: 0,
    reelTier: 0,
    lineTier: 0,
    lureIndex: 0,
    ownedLures: [0],
    currentLocation: "whispering_pines",
    unlockedLocations: ["whispering_pines"],
    dex: {},           // speciesId -> { count, bestLb }
    legendaryCaught: {}, // legendaryId -> { weightLb, caughtAt }
    stats: { totalCatches: 0, totalCoinsEarned: 0, biggestLb: 0, escapes: 0 },
    settings: { sound: true },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Shallow-merge onto defaults so new fields added in updates don't crash old saves.
    const base = defaultState();
    return Object.assign(base, parsed, {
      dex: Object.assign({}, parsed.dex),
      legendaryCaught: Object.assign({}, parsed.legendaryCaught),
      stats: Object.assign(base.stats, parsed.stats),
      settings: Object.assign(base.settings, parsed.settings),
    });
  } catch (e) {
    console.warn("Save load failed, starting fresh:", e);
    return defaultState();
  }
}

function saveState(state) {
  try {
    state.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Save failed:", e);
  }
}

// ---------- Economy / progression ----------

function addXp(state, amount) {
  state.xp += amount;
  let leveledUp = false;
  while (state.xp >= xpForLevel(state.level)) {
    state.xp -= xpForLevel(state.level);
    state.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

function currentLocationData(state) {
  return LOCATIONS.find(l => l.id === state.currentLocation) || LOCATIONS[0];
}

function isLocationUnlocked(state, locId) {
  return state.unlockedLocations.includes(locId);
}

function canUnlockLocation(state, loc) {
  return state.level >= loc.unlockLevel && state.coins >= loc.unlockCost && !isLocationUnlocked(state, loc.id);
}

function unlockLocation(state, locId) {
  const loc = LOCATIONS.find(l => l.id === locId);
  if (!loc || !canUnlockLocation(state, loc)) return false;
  state.coins -= loc.unlockCost;
  state.unlockedLocations.push(locId);
  return true;
}

function equippedLure(state) {
  return LURES[state.lureIndex];
}

function lureMultiplierFor(state, speciesId) {
  const lure = equippedLure(state);
  return (lure.bonus[speciesId] !== undefined ? lure.bonus[speciesId] : lure.bonus["*"]);
}

// zone: 1 = shore, 2 = mid, 3 = deep. Deeper water skews toward rarer fish.
const ZONE_RARITY_BOOST = {
  1: { common: 1.3, uncommon: 1.0, rare: 0.6, legendary: 0.5 },
  2: { common: 1.0, uncommon: 1.1, rare: 1.1, legendary: 1.0 },
  3: { common: 0.6, uncommon: 1.0, rare: 1.6, legendary: 1.8 },
};

// Weighted random pick of a species from the current location's table,
// using each species' rarity weight * current lure bonus * zone boost.
function rollSpecies(state, loc, zone = 1) {
  const boost = ZONE_RARITY_BOOST[zone] || ZONE_RARITY_BOOST[1];
  const pool = loc.species.map(id => {
    const sp = SPECIES[id];
    const w = RARITY[sp.rarity].weight * lureMultiplierFor(state, id) * (boost[sp.rarity] || 1);
    return { id, w };
  });
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) {
    if ((r -= p.w) <= 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

// Small chance per catch attempt (active only) that it's the location's
// legendary fish instead of a normal roll, if not already caught.
function rollForLegendary(state, loc, zone = 1) {
  const legId = loc.legendary;
  if (state.legendaryCaught[legId]) return null;
  const boost = ZONE_RARITY_BOOST[zone] || ZONE_RARITY_BOOST[1];
  const chance = (0.015 + state.level * 0.0006) * (boost.legendary || 1);
  return Math.random() < chance ? legId : null;
}

function rollWeight(minLb, maxLb) {
  // Bias toward the lower/middle of the range, with an occasional big one.
  const t = Math.pow(Math.random(), 2.2);
  return +(minLb + (maxLb - minLb) * t).toFixed(2);
}

function fishValue(speciesId, weightLb) {
  const sp = SPECIES[speciesId];
  const mult = RARITY[sp.rarity].coinMult;
  return Math.max(1, Math.round(sp.baseValue * weightLb * mult * 0.35));
}

function fishXp(speciesId, weightLb) {
  const sp = SPECIES[speciesId];
  const mult = RARITY[sp.rarity].xpMult;
  return Math.max(1, Math.round(sp.baseValue * weightLb * mult * 0.25));
}

// Records a successful catch (normal species) into state, returns a summary.
function recordCatch(state, speciesId, weightLb) {
  const coins = fishValue(speciesId, weightLb);
  const xp = fishXp(speciesId, weightLb);
  state.coins += coins;
  state.stats.totalCoinsEarned += coins;
  state.stats.totalCatches += 1;
  state.stats.biggestLb = Math.max(state.stats.biggestLb, weightLb);
  const entry = state.dex[speciesId] || { count: 0, bestLb: 0 };
  entry.count += 1;
  entry.bestLb = Math.max(entry.bestLb, weightLb);
  state.dex[speciesId] = entry;
  const leveledUp = addXp(state, xp);
  return { coins, xp, leveledUp };
}

function recordLegendaryCatch(state, legId, weightLb) {
  const leg = LEGENDARIES[legId];
  const coins = fishValue(leg.species, weightLb) * 3;
  const xp = fishXp(leg.species, weightLb) * 3;
  state.coins += coins;
  state.gems += 5;
  state.stats.totalCoinsEarned += coins;
  state.stats.totalCatches += 1;
  state.stats.biggestLb = Math.max(state.stats.biggestLb, weightLb);
  state.legendaryCaught[legId] = { weightLb, caughtAt: Date.now() };
  const leveledUp = addXp(state, xp);
  return { coins, xp, gems: 5, leveledUp };
}

// ---------- Fight parameters ----------
// Returns tuning numbers for the reel-in minigame given equipped gear and target fish.
// A real fish doesn't just pull steadily — it alternates hard "runs" (let it go,
// don't fight the drag) with "resting" lulls (reel hard while it's tired). These
// numbers drive that run/rest cycle in app.js; fightPower (how strong/large the
// fish is) makes runs more frequent, harder, and longer before it gasses out.
function fightParamsFor(state, fightPower, minLineTier) {
  const reel = REELS[state.reelTier];
  const line = LINES[state.lineTier];
  const underLeveled = Math.max(0, minLineTier - state.lineTier);
  // Tension rises faster the stronger the fish and the more under-geared the line is.
  const tensionRate = 0.07 + fightPower * 0.012 + underLeveled * 0.045;
  const decayRate = 0.16 + state.reelTier * 0.015;
  const breakCap = Math.max(0.3, line.breakCap - underLeveled * 0.12);
  const safeZone = reel.safeZone;
  const progressPerReel = 0.03 + state.reelTier * 0.004;
  return {
    tensionRate,
    decayRate,
    breakCap,
    safeZone,
    progressPerReel,
    fightPower,
    // run/rest cycle
    runChancePerSec: 0.12 + fightPower * 0.018,
    runDurationMin: 0.5 + fightPower * 0.02,
    runDurationMax: 0.9 + fightPower * 0.05,
    runTensionMult: 1.7 + fightPower * 0.07,
    restDurationMin: Math.max(0.5, 1.3 - fightPower * 0.03),
    restDurationMax: Math.max(0.9, 2.0 - fightPower * 0.04),
    restTensionMult: 0.35,
    restProgressMult: 1.7,
    staminaDrainPerRun: 0.12 + fightPower * 0.004,
    breachChance: 0.35 + fightPower * 0.02,
  };
}

// ---------- Idle / offline simulation ----------
// Simulates passive fishing for elapsedMs (capped) at the given location,
// returns { catches: [{speciesId, weightLb, coins, xp}], coins, xp, hoursSimmed }
function simulateIdle(state, elapsedMs) {
  const cappedMs = Math.min(elapsedMs, IDLE_CAP_HOURS * 3600 * 1000);
  const hours = cappedMs / 3600000;
  if (hours < 0.02) return { catches: [], coins: 0, xp: 0, hoursSimmed: 0 };

  const loc = currentLocationData(state);
  const rod = RODS[state.rodTier];
  const reel = REELS[state.reelTier];
  const lure = equippedLure(state);
  const ratePerHour = 1.2 + rod.idleBonus + reel.idleBonus + lure.idleBonus;
  const expectedCatches = ratePerHour * hours;
  // Poisson-ish approximation via repeated random draws capped at a sane max.
  let n = 0;
  let acc = 0;
  const maxCatches = 400;
  while (acc < expectedCatches && n < maxCatches) {
    acc += 0.5 + Math.random();
    n += 1;
  }

  const catches = [];
  let coins = 0, xp = 0;
  for (let i = 0; i < n; i++) {
    const speciesId = rollSpecies(state, loc);
    const sp = SPECIES[speciesId];
    const weightLb = rollWeight(sp.minLb, sp.maxLb * 0.85); // idle catches skew a bit smaller
    const result = recordCatch(state, speciesId, weightLb);
    coins += result.coins;
    xp += result.xp;
    catches.push({ speciesId, weightLb, coins: result.coins });
  }
  return { catches, coins, xp, hoursSimmed: +hours.toFixed(2) };
}

if (typeof module !== "undefined") {
  module.exports = {
    defaultState, loadState, saveState, addXp, currentLocationData,
    isLocationUnlocked, canUnlockLocation, unlockLocation, equippedLure,
    lureMultiplierFor, rollSpecies, rollForLegendary, rollWeight, fishValue,
    fishXp, recordCatch, recordLegendaryCatch, fightParamsFor, simulateIdle, SAVE_KEY,
  };
}
