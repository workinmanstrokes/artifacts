// ============================== GAME DATA ==============================
// Everything here is tunable by design, not code changes. Weights control how
// often a symbol lands (higher weight = more common = lower payout); pay2/pay3
// are the multiplier on the bet for two- or three-of-a-kind on a payline.
// These are demo odds sized to feel generous for a prototype — before a real
// launch, run these through simulation and tune to the target RTP.
"use strict";

var VV = window.VV || {};

VV.LEVELS = (function () {
  // XP needed to reach level n+1, cumulative.
  var out = [0];
  for (var i = 1; i <= 40; i++) out.push(out[i - 1] + 80 + i * 22);
  return out;
})();

VV.MACHINES = [
  {
    id: "bootlegger",
    name: "The Bootlegger",
    tag: "Prohibition runs & payoffs",
    accent: "#D4AF37",
    unlockLevel: 1,
    unlockGems: 0,
    minBet: 10,
    betStep: 10,
    maxBet: 500,
    symbols: [
      { key: "crate", glyph: "📦", label: "Crate", weight: 28, pay2: 0, pay3: 1 },
      { key: "padlock", glyph: "🔒", label: "Padlock", weight: 23, pay2: 0, pay3: 2 },
      { key: "bottle", glyph: "🥃", label: "Bootleg Bottle", weight: 18, pay2: 0.5, pay3: 4 },
      { key: "gun", glyph: "🔫", label: "Tommy Gun", weight: 14, pay2: 1, pay3: 8 },
      { key: "cash", glyph: "💰", label: "Money Bag", weight: 11, pay2: 2, pay3: 16 },
      { key: "vault", glyph: "🗝️", label: "The Vault Key — JACKPOT", weight: 6, pay2: 4, pay3: 50, jackpot: true }
    ]
  },
  {
    id: "speakeasy",
    name: "The Speakeasy",
    tag: "Knock twice, ask for Rosie",
    accent: "#B0264F",
    unlockLevel: 2,
    unlockGems: 25,
    minBet: 15,
    betStep: 15,
    maxBet: 750,
    symbols: [
      { key: "cigar", glyph: "🚬", label: "Cigar", weight: 26, pay2: 0, pay3: 1 },
      { key: "cards", glyph: "🎴", label: "Card Table", weight: 22, pay2: 0, pay3: 2 },
      { key: "sax", glyph: "🎷", label: "Sax Solo", weight: 17, pay2: 0.5, pay3: 5 },
      { key: "pearls", glyph: "📿", label: "Pearl Necklace", weight: 13, pay2: 1, pay3: 9 },
      { key: "champagne", glyph: "🍾", label: "Champagne Tower", weight: 10, pay2: 2, pay3: 18 },
      { key: "door", glyph: "🚪", label: "The Hidden Door — JACKPOT", weight: 5, pay2: 4, pay3: 55, jackpot: true },
      { key: "rosie", glyph: "💄", label: "Rosie the Doorkeep — WILD, stands in for any symbol", weight: 7, pay2: 0, pay3: 30, wild: true, note: "WILD · subs for anything" }
    ]
  },
  {
    id: "highroller",
    name: "High Roller",
    tag: "Cards, chips & champagne",
    accent: "#3FA675",
    unlockLevel: 3,
    unlockGems: 40,
    minBet: 20,
    betStep: 20,
    maxBet: 1000,
    symbols: [
      { key: "chip", glyph: "🔴", label: "House Chip", weight: 28, pay2: 0, pay3: 1 },
      { key: "dice", glyph: "🎲", label: "Dice", weight: 23, pay2: 0, pay3: 2 },
      { key: "card", glyph: "🃏", label: "Wild Card", weight: 18, pay2: 0.5, pay3: 4 },
      { key: "glass", glyph: "🍸", label: "Martini", weight: 14, pay2: 1, pay3: 8 },
      { key: "diamond", glyph: "💎", label: "Diamond", weight: 11, pay2: 2, pay3: 16 },
      { key: "crown", glyph: "👑", label: "The Crown — JACKPOT", weight: 6, pay2: 4, pay3: 50, jackpot: true }
    ]
  },
  {
    id: "midnight",
    name: "Midnight Express",
    tag: "The last train out of town",
    accent: "#5C7FB5",
    unlockLevel: 6,
    unlockGems: 90,
    minBet: 30,
    betStep: 30,
    maxBet: 1500,
    symbols: [
      { key: "ticket", glyph: "🎫", label: "Ticket Stub", weight: 28, pay2: 0, pay3: 1 },
      { key: "case", glyph: "🧳", label: "Suitcase", weight: 23, pay2: 0, pay3: 2 },
      { key: "watch", glyph: "🕰️", label: "Pocket Watch", weight: 18, pay2: 0.5, pay3: 4 },
      { key: "hat", glyph: "🎩", label: "Top Hat", weight: 14, pay2: 1, pay3: 8 },
      { key: "moon", glyph: "🌙", label: "Moonstone", weight: 11, pay2: 2, pay3: 16 },
      { key: "train", glyph: "🚂", label: "The Locomotive — JACKPOT", weight: 6, pay2: 4, pay3: 50, jackpot: true }
    ]
  },
  {
    id: "kingpin",
    name: "Kingpin’s Table",
    tag: "Sit down. The don is watching.",
    accent: "#F5D576",
    unlockLevel: 10,
    unlockGems: 150,
    minBet: 50,
    betStep: 50,
    maxBet: 3000,
    scatterTrigger: 3,
    freeSpinsAwarded: 8,
    freeSpinMultiplier: 2,
    symbols: [
      { key: "knife", glyph: "🔪", label: "Letter Opener", weight: 27, pay2: 0, pay3: 1 },
      { key: "ledger", glyph: "📒", label: "The Ledger", weight: 22, pay2: 0, pay3: 2 },
      { key: "pistol", glyph: "🔫", label: "Piece", weight: 17, pay2: 0.5, pay3: 5 },
      { key: "cigarbox", glyph: "🎁", label: "Cigar Box", weight: 13, pay2: 1, pay3: 9 },
      { key: "crownjewel", glyph: "💍", label: "The Family Ring", weight: 9, pay2: 2, pay3: 20 },
      { key: "badge", glyph: "🎖️", label: "Dirty Badge — SCATTER, 3+ anywhere: 8 free spins at 2×", weight: 8, pay2: 0, pay3: 0, scatter: true, note: "SCATTER · 3+: 8 free spins @2×" },
      { key: "don", glyph: "🐺", label: "The Don — JACKPOT", weight: 4, pay2: 5, pay3: 75, jackpot: true }
    ]
  }
];

VV.SHOP_COINS = [
  { id: "coin_s", glyph: "🪙", coins: 5000, price: "$0.99" },
  { id: "coin_m", glyph: "🪙", coins: 28000, bonus: "+12% bonus", price: "$4.99", best: true },
  { id: "coin_l", glyph: "🪙", coins: 65000, bonus: "+20% bonus", price: "$9.99" },
  { id: "coin_xl", glyph: "🪙", coins: 150000, bonus: "+30% bonus", price: "$19.99" }
];

VV.SHOP_GEMS = [
  { id: "gem_s", glyph: "💎", gems: 50, price: "$1.99" },
  { id: "gem_m", glyph: "💎", gems: 300, bonus: "+15% bonus", price: "$6.99", best: true },
  { id: "gem_l", glyph: "💎", gems: 700, bonus: "+25% bonus", price: "$13.99" }
];

VV.SYN_COLORS = ["#D4AF37", "#B0264F", "#3FA675", "#5C7FB5", "#9B59B6", "#C97B5A"];

VV.DAILY_BONUS = [500, 800, 1200, 1800, 2500, 3400, 5000];

window.VV = VV;
