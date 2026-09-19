// ============================================================
// REEL LEGENDS: USA — Game Data
// All static game-balance data lives here: locations, species,
// gear tiers, rarity/economy constants.
// ============================================================

const RARITY = {
  common:    { label: "Common",    color: "#9fd48a", coinMult: 1.0,  xpMult: 1.0,  weight: 62 },
  uncommon:  { label: "Uncommon",  color: "#7fc7e8", coinMult: 1.6,  xpMult: 1.4,  weight: 26 },
  rare:      { label: "Rare",      color: "#c99cf0", coinMult: 2.8,  xpMult: 2.2,  weight: 10 },
  legendary: { label: "Legendary", color: "#f5c542", coinMult: 12,   xpMult: 8,    weight: 2 },
};

// Fight difficulty scales tension speed & required progress.
// fightPower: how hard the fish yanks (tension rises faster)
// minLine: line tier index (0-based) recommended to safely land it
const SPECIES = {
  bluegill:        { name: "Bluegill",              rarity: "common",   minLb: 0.3, maxLb: 1.5,  fightPower: 1,  minLine: 0, baseValue: 8 },
  largemouth_bass: { name: "Largemouth Bass",       rarity: "uncommon", minLb: 1.5, maxLb: 8.0,  fightPower: 3,  minLine: 1, baseValue: 14 },
  walleye:         { name: "Walleye",               rarity: "rare",     minLb: 2.0, maxLb: 10.0, fightPower: 3,  minLine: 1, baseValue: 18 },
  northern_pike:   { name: "Northern Pike",         rarity: "rare",     minLb: 3.0, maxLb: 18.0, fightPower: 5,  minLine: 2, baseValue: 16 },

  peacock_bass:    { name: "Peacock Bass",          rarity: "common",   minLb: 1.0, maxLb: 6.0,  fightPower: 3,  minLine: 1, baseValue: 12 },
  bowfin:          { name: "Bowfin",                rarity: "uncommon", minLb: 2.0, maxLb: 9.0,  fightPower: 4,  minLine: 1, baseValue: 10 },
  longnose_gar:    { name: "Longnose Gar",          rarity: "rare",     minLb: 4.0, maxLb: 22.0, fightPower: 5,  minLine: 2, baseValue: 15 },

  rainbow_trout:   { name: "Rainbow Trout",         rarity: "common",   minLb: 0.5, maxLb: 4.0,  fightPower: 2,  minLine: 0, baseValue: 11 },
  coho_salmon:     { name: "Coho Salmon",           rarity: "uncommon", minLb: 3.0, maxLb: 12.0, fightPower: 4,  minLine: 2, baseValue: 17 },
  chinook_salmon:  { name: "Chinook Salmon",        rarity: "rare",     minLb: 6.0, maxLb: 30.0, fightPower: 6,  minLine: 3, baseValue: 22 },
  steelhead:       { name: "Steelhead",             rarity: "rare",     minLb: 4.0, maxLb: 20.0, fightPower: 6,  minLine: 2, baseValue: 24 },

  speckled_trout:  { name: "Speckled Trout",        rarity: "common",   minLb: 0.8, maxLb: 5.0,  fightPower: 2,  minLine: 1, baseValue: 13 },
  flounder:        { name: "Flounder",              rarity: "uncommon", minLb: 1.0, maxLb: 6.0,  fightPower: 3,  minLine: 1, baseValue: 15 },
  redfish:         { name: "Redfish",               rarity: "uncommon", minLb: 2.0, maxLb: 15.0, fightPower: 4,  minLine: 2, baseValue: 19 },
  black_drum:      { name: "Black Drum",             rarity: "rare",     minLb: 5.0, maxLb: 35.0, fightPower: 6,  minLine: 3, baseValue: 21 },

  brook_trout:     { name: "Brook Trout",           rarity: "common",   minLb: 0.3, maxLb: 2.5,  fightPower: 2,  minLine: 0, baseValue: 12 },
  whitefish:       { name: "Rocky Mtn Whitefish",   rarity: "uncommon", minLb: 0.8, maxLb: 4.0,  fightPower: 2,  minLine: 1, baseValue: 13 },
  cutthroat_trout: { name: "Cutthroat Trout",       rarity: "uncommon", minLb: 1.0, maxLb: 5.0,  fightPower: 3,  minLine: 1, baseValue: 16 },
  brown_trout:     { name: "Brown Trout",           rarity: "rare",     minLb: 2.0, maxLb: 14.0, fightPower: 5,  minLine: 2, baseValue: 23 },

  yellow_perch:    { name: "Yellow Perch",          rarity: "common",   minLb: 0.2, maxLb: 1.2,  fightPower: 1,  minLine: 0, baseValue: 9 },
  smallmouth_bass: { name: "Smallmouth Bass",       rarity: "uncommon", minLb: 1.0, maxLb: 6.0,  fightPower: 3,  minLine: 1, baseValue: 15 },
  lake_trout:      { name: "Lake Trout",            rarity: "rare",     minLb: 3.0, maxLb: 20.0, fightPower: 5,  minLine: 3, baseValue: 22 },
  muskellunge:     { name: "Muskellunge",           rarity: "rare",     minLb: 6.0, maxLb: 30.0, fightPower: 7,  minLine: 3, baseValue: 26 },
};

// A signature named legendary fish per location — always a unique
// one-time trophy catch, far bigger than the species' normal range.
const LEGENDARIES = {
  old_slab:        { name: "Old Slab",          species: "walleye",         weightLb: 14.2, fightPower: 9,  minLine: 3 },
  swamp_king:      { name: "Swamp King",        species: "largemouth_bass", weightLb: 13.9, fightPower: 9,  minLine: 2 },
  ghost:           { name: "Ghost",             species: "steelhead",       weightLb: 22.4, fightPower: 10, minLine: 3 },
  bull_of_flats:   { name: "Bull of the Flats", species: "redfish",         weightLb: 41.6, fightPower: 11, minLine: 4 },
  old_whiskers:    { name: "Old Whiskers",      species: "brown_trout",     weightLb: 18.7, fightPower: 10, minLine: 3 },
  grey_ghost:      { name: "The Grey Ghost",    species: "muskellunge",     weightLb: 52.3, fightPower: 12, minLine: 4 },
};

const LOCATIONS = [
  {
    id: "whispering_pines",
    name: "Whispering Pines Lake",
    region: "Minnesota Northwoods",
    unlockCost: 0,
    unlockLevel: 1,
    palette: { sky: "#8fd0e8", skyNight: "#0e1c33", water: "#2b6f8f", waterNight: "#122a3d", land: "#3f6b3a" },
    species: ["bluegill", "largemouth_bass", "walleye", "northern_pike"],
    legendary: "old_slab",
  },
  {
    id: "gatorback_canal",
    name: "Gatorback Canal",
    region: "Florida Everglades",
    unlockCost: 500,
    unlockLevel: 3,
    palette: { sky: "#bfe6c8", skyNight: "#101f18", water: "#3f7d5c", waterNight: "#0f2a1e", land: "#5a7a3a" },
    species: ["peacock_bass", "largemouth_bass", "bowfin", "longnose_gar"],
    legendary: "swamp_king",
  },
  {
    id: "cascade_fork",
    name: "Cascade Fork River",
    region: "Pacific Northwest, Oregon",
    unlockCost: 1500,
    unlockLevel: 6,
    palette: { sky: "#c9d8e0", skyNight: "#101720", water: "#4c7f95", waterNight: "#132530", land: "#375436" },
    species: ["rainbow_trout", "coho_salmon", "chinook_salmon", "steelhead"],
    legendary: "ghost",
  },
  {
    id: "redfish_flats",
    name: "Redfish Flats",
    region: "Gulf Coast, Texas",
    unlockCost: 3500,
    unlockLevel: 10,
    palette: { sky: "#bfe9e6", skyNight: "#0c2020", water: "#3fa6a0", waterNight: "#0e2a28", land: "#c9b978" },
    species: ["speckled_trout", "flounder", "redfish", "black_drum"],
    legendary: "bull_of_flats",
  },
  {
    id: "ironwater_gorge",
    name: "Ironwater Gorge",
    region: "Rocky Mountains, Colorado",
    unlockCost: 7000,
    unlockLevel: 15,
    palette: { sky: "#d8e7f2", skyNight: "#0d1826", water: "#5a92b0", waterNight: "#152838", land: "#5c6b5a" },
    species: ["brook_trout", "whitefish", "cutthroat_trout", "brown_trout"],
    legendary: "old_whiskers",
  },
  {
    id: "muskie_bay",
    name: "Muskie Bay",
    region: "Great Lakes, Michigan",
    unlockCost: 15000,
    unlockLevel: 22,
    palette: { sky: "#9fc7e0", skyNight: "#0a1522", water: "#2e5f80", waterNight: "#0f202f", land: "#4a5a42" },
    species: ["yellow_perch", "smallmouth_bass", "lake_trout", "muskellunge"],
    legendary: "grey_ghost",
  },
];

const RODS = [
  { name: "Cane Pole",            cost: 0,     idleBonus: 0.0, castZones: 1 },
  { name: "Fiberglass Spin Rod",  cost: 300,   idleBonus: 0.3, castZones: 2 },
  { name: "Baitcaster Pro",       cost: 1200,  idleBonus: 0.6, castZones: 2 },
  { name: "Graphite Tournament",  cost: 4000,  idleBonus: 1.0, castZones: 3 },
  { name: "Carbon Fiber Elite",   cost: 10000, idleBonus: 1.6, castZones: 3 },
  { name: "Driftwood Legend",     cost: 25000, idleBonus: 2.4, castZones: 3 },
];

// safeZone: fraction (0-1) of the tension bar that's a "safe" landing window
const REELS = [
  { name: "Rusty Reel",          cost: 0,    safeZone: 0.34, idleBonus: 0.0 },
  { name: "Standard Spin Reel",  cost: 250,  safeZone: 0.40, idleBonus: 0.2 },
  { name: "Precision Baitcast",  cost: 1000, safeZone: 0.47, idleBonus: 0.4 },
  { name: "Tournament Reel",     cost: 3500, safeZone: 0.55, idleBonus: 0.7 },
  { name: "Pro Series Reel",     cost: 9000, safeZone: 0.64, idleBonus: 1.1 },
];

// breakCap: max sustained tension (0-1) before the line snaps
const LINES = [
  { name: "6 lb Mono",        cost: 0,    breakCap: 0.55 },
  { name: "10 lb Mono",       cost: 200,  breakCap: 0.65 },
  { name: "20 lb Fluorocarbon", cost: 800,  breakCap: 0.75 },
  { name: "30 lb Braid",      cost: 2500, breakCap: 0.86 },
  { name: "50 lb Braid",      cost: 7000, breakCap: 0.96 },
];

// bonus: map of species-id -> bite-rate multiplier; "*" is the default for
// species not listed. idleBonus nudges idle catch rate.
const LURES = [
  { name: "Worm & Bobber",  cost: 0,    idleBonus: 0.0, bonus: { "*": 1.0, bluegill: 1.4, yellow_perch: 1.4 } },
  { name: "Spinnerbait",    cost: 150,  idleBonus: 0.1, bonus: { "*": 1.0, largemouth_bass: 1.5, northern_pike: 1.5, muskellunge: 1.3, smallmouth_bass: 1.3 } },
  { name: "Crankbait",      cost: 350,  idleBonus: 0.2, bonus: { "*": 1.0, walleye: 1.5, rainbow_trout: 1.4, coho_salmon: 1.4, lake_trout: 1.3 } },
  { name: "Live Shrimp",    cost: 600,  idleBonus: 0.2, bonus: { "*": 1.0, redfish: 1.6, speckled_trout: 1.6, flounder: 1.5, black_drum: 1.4 } },
  { name: "Topwater Popper", cost: 900, idleBonus: 0.3, bonus: { "*": 1.0, largemouth_bass: 1.6, peacock_bass: 1.6, bowfin: 1.3, northern_pike: 1.3 } },
  { name: "Pro Jig",        cost: 1800, idleBonus: 0.5, bonus: { "*": 1.2 } },
];

// XP required to reach each level (index = level-1 -> xp needed FROM previous level)
function xpForLevel(level) {
  return Math.round(80 * Math.pow(level, 1.35));
}

const IDLE_CAP_HOURS = 10; // max offline progress accrued at once

if (typeof module !== "undefined") {
  module.exports = { RARITY, SPECIES, LEGENDARIES, LOCATIONS, RODS, REELS, LINES, LURES, xpForLevel, IDLE_CAP_HOURS };
}
