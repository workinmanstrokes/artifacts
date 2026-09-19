// ============================== ENGINE ==============================
// RNG, the paytable math, the currency economy, leveling, and the syndicate /
// war-points system. No UI here — render.js and app.js own the DOM.
"use strict";

var VV = window.VV || {};

(function () {

  var LS_PREFIX = "velvetVault:";
  function lsGet(key, fallback) {
    try {
      var raw = window.localStorage.getItem(LS_PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function makeId() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }

  // A stable per-device identity so the shared syndicate roster and war
  // leaderboard can tell players apart without any account system.
  var deviceId = lsGet("deviceId", null);
  if (!deviceId) { deviceId = makeId(); lsSet("deviceId", deviceId); }

  var defaultState = {
    coins: 5000,
    gems: 60,
    xp: 0,
    level: 1,
    playerName: "Player " + deviceId.slice(-4).toUpperCase(),
    syndicateTag: null,
    unlockedMachines: { bootlegger: true },
    lastDailyClaim: null,
    dailyStreak: 0,
    totalSpins: 0,
    totalWagered: 0,
    totalWon: 0,
    biggestWin: 0,
    jackpotsHit: 0,
    freeSpins: {}
  };

  var state = Object.assign({}, defaultState, lsGet("state", {}));
  function persist() { lsSet("state", state); }

  // ---------------- RNG & paytable ----------------

  function weightedPick(symbols) {
    var total = symbols.reduce(function (s, sym) { return s + sym.weight; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < symbols.length; i++) {
      r -= symbols[i].weight;
      if (r <= 0) return symbols[i];
    }
    return symbols[symbols.length - 1];
  }

  // One reel = 3 stacked symbols (top/mid/bottom), each drawn independently.
  function spinReel(symbols) {
    return [weightedPick(symbols), weightedPick(symbols), weightedPick(symbols)];
  }

  // wildKey is null on machines with no wild symbol, in which case this is
  // byte-for-byte the old literal-match logic (nonWild === keys, and no key
  // is ever === null) — wild support is purely additive, never a behavior
  // change for a machine that doesn't have one.
  function evaluateLine(cells, wildKey) {
    var keys = cells.map(function (c) { return c.key; });
    var nonWild = wildKey ? keys.filter(function (k) { return k !== wildKey; }) : keys;
    var distinctNonWild = nonWild.filter(function (k, i) { return nonWild.indexOf(k) === i; });

    // 3-of-a-kind, wild-assisted: at most one distinct real symbol among the
    // three cells (the rest, if any, are wild). All-wild pays the wild's own
    // rate; a real symbol's own pay3 is 0 if it doesn't pay a straight triple,
    // so that's checked too rather than assumed.
    if (distinctNonWild.length <= 1) {
      var matchKey = distinctNonWild.length === 1 ? distinctNonWild[0] : wildKey;
      if (matchKey != null) {
        var matchCell = cells.find(function (c) { return c.key === matchKey; });
        if (matchCell && matchCell.pay3 > 0) return { mult: matchCell.pay3, key: matchKey, kind: 3 };
      }
    }

    // 2-of-a-kind — literal match only; a wild helping a pair would make the
    // minor payout trigger far too often, so it only ever assists the triple.
    var counts = {};
    keys.forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
    var pairKey = Object.keys(counts).find(function (k) { return counts[k] === 2 && k !== wildKey; });
    if (pairKey) {
      var sym = cells.find(function (c) { return c.key === pairKey; });
      if (sym.pay2 > 0) return { mult: sym.pay2, key: pairKey, kind: 2 };
    }
    return { mult: 0, key: null, kind: 0 };
  }

  // grid: [reel0[3], reel1[3], reel2[3]] -> evaluates the 3 horizontal
  // paylines, plus a scatter count over the full 3x3 grid for machines that
  // have one (scatters pay on appearance anywhere, not on a payline).
  function evaluateGrid(grid, machine) {
    var wildSym = machine.symbols.find(function (s) { return s.wild; });
    var scatterSym = machine.symbols.find(function (s) { return s.scatter; });
    var wildKey = wildSym ? wildSym.key : null;
    var scatterKey = scatterSym ? scatterSym.key : null;

    var lines = [];
    var totalMult = 0;
    var jackpot = false;
    for (var row = 0; row < 3; row++) {
      var cells = [grid[0][row], grid[1][row], grid[2][row]];
      var result = evaluateLine(cells, wildKey);
      lines.push({ row: row, result: result });
      totalMult += result.mult;
      // Look up the cell that actually matched result.key — with wilds, that
      // is no longer always cells[0] (a wild-completed jackpot line has a
      // wild in some position, but still pays and counts as the jackpot).
      if (result.kind === 3) {
        var payingCell = cells.find(function (c) { return c.key === result.key; });
        if (payingCell && payingCell.jackpot) jackpot = true;
      }
    }

    var scatterCount = 0;
    if (scatterKey) {
      for (var c = 0; c < 3; c++) {
        for (var r = 0; r < 3; r++) if (grid[c][r].key === scatterKey) scatterCount++;
      }
    }

    return { lines: lines, totalMult: totalMult, jackpot: jackpot, scatterCount: scatterCount };
  }

  function machineById(id) {
    return VV.MACHINES.find(function (m) { return m.id === id; });
  }

  function isUnlocked(machine) {
    return !!state.unlockedMachines[machine.id] || state.level >= machine.unlockLevel;
  }

  function unlockWithGems(machine) {
    if (isUnlocked(machine)) return { ok: true };
    if (state.gems < machine.unlockGems) return { ok: false, reason: "Not enough gems." };
    state.gems -= machine.unlockGems;
    state.unlockedMachines[machine.id] = true;
    persist();
    return { ok: true };
  }

  // ---------------- currency & leveling ----------------

  function canAffordBet(bet) { return state.coins >= bet; }

  function addXp(n) {
    state.xp += n;
    var leveled = false;
    while (state.level < VV.LEVELS.length - 1 && state.xp >= VV.LEVELS[state.level]) {
      state.level++;
      leveled = true;
      state.gems += 10; // small level-up bonus keeps gems reachable without paying
    }
    return leveled;
  }

  function xpProgress() {
    var floor = VV.LEVELS[state.level - 1] || 0;
    var ceil = VV.LEVELS[state.level] || (floor + 1000);
    return { pct: Math.max(0, Math.min(100, ((state.xp - floor) / (ceil - floor)) * 100)), floor: floor, ceil: ceil };
  }

  // ---------------- spin ----------------

  // A free spin in progress locks the bet to whatever triggered it (the
  // standard convention — spinning "for free" at a bet of 0 would also pay
  // 0, which isn't free, it's worthless) and costs no coins; everything else
  // about the spin — the grid, the paylines, a jackpot, even a retrigger —
  // works exactly like a paid spin underneath.
  function freeSpinsFor(machineId) {
    var fs = state.freeSpins[machineId];
    return (fs && fs.remaining > 0) ? fs : null;
  }

  function spin(machineId, uiBet) {
    var machine = machineById(machineId);
    if (!machine || !isUnlocked(machine)) return { ok: false, reason: "Machine locked." };

    var fs = freeSpinsFor(machineId);
    var inBonus = !!fs;
    var bet = inBonus ? fs.bet : uiBet;

    if (!inBonus) {
      if (!canAffordBet(bet)) return { ok: false, reason: "Not enough coins." };
      state.coins -= bet;
    }

    var grid = [spinReel(machine.symbols), spinReel(machine.symbols), spinReel(machine.symbols)];
    var evald = evaluateGrid(grid, machine);
    var payMult = inBonus ? fs.multiplier : 1;
    var payout = Math.round(bet * evald.totalMult * payMult);

    state.coins += payout;
    state.totalSpins++;
    if (!inBonus) state.totalWagered += bet;
    state.totalWon += payout;
    if (payout > state.biggestWin) { state.biggestWin = payout; maybeSubmitHighScore(); }
    if (evald.jackpot) state.jackpotsHit++;

    var leveled = addXp(Math.max(1, Math.round(bet / 10)));

    // Every spin owes the syndicate at least 1 point for showing up — at the
    // table minimum (10), round(bet/25) rounds down to 0, which silently
    // zeroed out war contribution for anyone playing min-bet unless they won.
    // A free spin risked no coins, so it only banks points from what it won.
    var warPoints = inBonus
      ? Math.round(payout / 50)
      : (Math.max(1, Math.round(bet / 25)) + Math.round(payout / 50));

    if (inBonus) {
      fs.remaining--;
      if (fs.remaining <= 0) delete state.freeSpins[machineId];
    }

    // Scatters can retrigger mid-bonus (adds to whatever's left) as well as
    // start one from a paid spin — same check either way.
    var freeSpinsAwarded = 0;
    if (machine.scatterTrigger && evald.scatterCount >= machine.scatterTrigger) {
      freeSpinsAwarded = machine.freeSpinsAwarded || 8;
      var existing = state.freeSpins[machineId];
      if (existing) existing.remaining += freeSpinsAwarded;
      else state.freeSpins[machineId] = { remaining: freeSpinsAwarded, multiplier: machine.freeSpinMultiplier || 2, bet: bet };
    }

    persist();

    return {
      ok: true, grid: grid, evald: evald, payout: payout, leveled: leveled,
      newLevel: state.level, warPoints: warPoints,
      usedFreeSpin: inBonus, freeSpinsAwarded: freeSpinsAwarded,
      freeSpinsRemaining: (state.freeSpins[machineId] && state.freeSpins[machineId].remaining) || 0
    };
  }

  // ---------------- daily bonus ----------------

  function dayKey(d) { return d.toISOString().slice(0, 10); }

  function dailyStatus() {
    var today = dayKey(new Date());
    var claimed = state.lastDailyClaim === today;
    var streakIdx = Math.min(state.dailyStreak, VV.DAILY_BONUS.length - 1);
    return { claimed: claimed, streakDay: state.dailyStreak + 1, amount: VV.DAILY_BONUS[claimed ? streakIdx : streakIdx] };
  }

  function claimDaily() {
    var today = dayKey(new Date());
    if (state.lastDailyClaim === today) return { ok: false };
    var yesterday = dayKey(new Date(Date.now() - 86400000));
    state.dailyStreak = (state.lastDailyClaim === yesterday) ? Math.min(state.dailyStreak + 1, VV.DAILY_BONUS.length - 1) : 0;
    var amount = VV.DAILY_BONUS[state.dailyStreak];
    state.coins += amount;
    state.lastDailyClaim = today;
    persist();
    return { ok: true, amount: amount, streakDay: state.dailyStreak + 1 };
  }

  // ---------------- store (stubbed — no real payment processor here) ----------------

  function simulatePurchase(kind, item) {
    if (kind === "coins") state.coins += item.coins;
    else if (kind === "gems") state.gems += item.gems;
    persist();
  }

  // ---------------- syndicates (shared via the artifact's db capability) ----------------

  var db = null;
  function setDb(instance) { db = instance; }

  function weekKey(d) {
    var onejan = new Date(d.getFullYear(), 0, 1);
    var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + "-W" + week;
  }

  function createSyndicate(name, tag, color) {
    if (!db) return Promise.reject(new Error("offline"));
    tag = tag.toUpperCase().slice(0, 5);
    return db.doc("syndicates/" + tag).get().then(function (snap) {
      if (snap.exists) throw new Error("taken");
      return db.doc("syndicates/" + tag).set({
        tag: tag, name: name, color: color, createdAt: Date.now(), memberCount: 1, totalPoints: 0
      });
    }).then(function () {
      state.syndicateTag = tag;
      persist();
      return db.doc("members/" + tag + "_" + deviceId).set({
        tag: tag, deviceId: deviceId, name: state.playerName, joinedAt: Date.now()
      });
    });
  }

  function joinSyndicate(tag) {
    if (!db) return Promise.reject(new Error("offline"));
    return db.doc("syndicates/" + tag).get().then(function (snap) {
      if (!snap.exists) throw new Error("not_found");
      state.syndicateTag = tag;
      persist();
      return db.doc("members/" + tag + "_" + deviceId).set({
        tag: tag, deviceId: deviceId, name: state.playerName, joinedAt: Date.now()
      });
    });
  }

  function leaveSyndicate() {
    var tag = state.syndicateTag;
    state.syndicateTag = null;
    persist();
    if (db && tag) db.doc("members/" + tag + "_" + deviceId).delete().catch(function () {});
  }

  function listSyndicates() {
    if (!db) return Promise.resolve([]);
    return db.collection("syndicates").orderBy("memberCount", "desc").limit(20).get()
      .then(function (snap) { return snap.docs.map(function (d) { return d.data(); }); })
      .catch(function () { return []; });
  }

  // Read-then-write: the db capability has no transactions, so concurrent
  // contributions can race and undercount slightly. Acceptable for a fun
  // leaderboard; a real backend would use a proper counter/transaction.
  // Two docs get this treatment: the weekly war standing (resets every week)
  // and the syndicate's own lifetime total (never resets — what its rank
  // badge is earned from).
  function contributeWarPoints(points) {
    if (!db || !state.syndicateTag || points <= 0) return Promise.resolve();
    var tag = state.syndicateTag;
    var wk = weekKey(new Date());
    var docId = tag + "_" + wk;
    var weeklyWrite = db.doc("wars/" + docId).get().then(function (snap) {
      var syn = VV_lastKnownSyndicate(tag);
      var prev = snap.exists ? snap.data() : {
        tag: tag, name: (syn && syn.name) || tag,
        color: (syn && syn.color) || "#C9A24B", points: 0, week: wk
      };
      prev.points = (prev.points || 0) + points;
      prev.updatedAt = Date.now();
      return db.doc("wars/" + docId).set(prev);
    }).catch(function () {});
    var lifetimeWrite = db.doc("syndicates/" + tag).get().then(function (snap) {
      if (!snap.exists) return;
      var syn = snap.data();
      syn.totalPoints = (syn.totalPoints || 0) + points;
      cacheSyndicate(syn);
      return db.doc("syndicates/" + tag).set(syn);
    }).catch(function () {});
    return Promise.all([weeklyWrite, lifetimeWrite]);
  }

  function getSyndicateInfo(tag) {
    if (!db || !tag) return Promise.resolve(null);
    return db.doc("syndicates/" + tag).get().then(function (snap) {
      var data = snap.exists ? snap.data() : null;
      if (data) cacheSyndicate(data);
      return data;
    }).catch(function () { return null; });
  }

  var SYNDICATE_TIERS = [
    { min: 10000, label: "Kingpin", icon: "👑" },
    { min: 3000, label: "Boss", icon: "🎩" },
    { min: 800, label: "Made Guy", icon: "🃏" },
    { min: 0, label: "Rookie", icon: "🔰" }
  ];
  function syndicateTier(totalPoints) {
    var t = totalPoints || 0;
    for (var i = 0; i < SYNDICATE_TIERS.length; i++) {
      if (t >= SYNDICATE_TIERS[i].min) return SYNDICATE_TIERS[i];
    }
    return SYNDICATE_TIERS[SYNDICATE_TIERS.length - 1];
  }

  var cachedSyndicates = {};
  function VV_lastKnownSyndicate(tag) { return cachedSyndicates[tag] || null; }
  function cacheSyndicate(row) { if (row && row.tag) cachedSyndicates[row.tag] = row; }

  // ---------------- high rollers (individual leaderboard, shared via db) ----------------
  // A personal-best board, not a running total — biggestWin is a single
  // spin's payout, so it only writes when a NEW best is actually set rather
  // than on every spin.
  function maybeSubmitHighScore() {
    if (!db) return Promise.resolve();
    return db.doc("players/" + deviceId).get().then(function (snap) {
      var prev = snap.exists ? snap.data() : null;
      if (prev && (prev.biggestWin || 0) >= state.biggestWin) return;
      return db.doc("players/" + deviceId).set({
        deviceId: deviceId, name: state.playerName, biggestWin: state.biggestWin,
        level: state.level, updatedAt: Date.now()
      });
    }).catch(function () {});
  }

  function subscribeHighRollers(onData) {
    if (!db) { onData([]); return function () {}; }
    return db.collection("players").orderBy("biggestWin", "desc").limit(15)
      .onSnapshot(function (snap) { onData(snap.docs.map(function (d) { return d.data(); })); },
        function () { onData([]); });
  }

  function subscribeWarLeaderboard(onData) {
    if (!db) { onData([]); return function () {}; }
    var wk = weekKey(new Date());
    return db.collection("wars").where("week", "==", wk).orderBy("points", "desc").limit(15)
      .onSnapshot(function (snap) {
        var rows = snap.docs.map(function (d) { return d.data(); });
        rows.forEach(cacheSyndicate);
        onData(rows);
      }, function () { onData([]); });
  }

  function subscribeMyRoster(onData) {
    var tag = state.syndicateTag;
    if (!db || !tag) { onData([]); return function () {}; }
    return db.collection("members").where("tag", "==", tag).limit(50)
      .onSnapshot(function (snap) { onData(snap.docs.map(function (d) { return d.data(); })); },
        function () { onData([]); });
  }

  VV.deviceId = deviceId;
  VV.state = state;
  VV.persist = persist;
  VV.engine = {
    machineById: machineById, isUnlocked: isUnlocked, unlockWithGems: unlockWithGems,
    canAffordBet: canAffordBet, spin: spin, xpProgress: xpProgress, freeSpinsFor: freeSpinsFor,
    dailyStatus: dailyStatus, claimDaily: claimDaily, simulatePurchase: simulatePurchase,
    setDb: setDb, createSyndicate: createSyndicate, joinSyndicate: joinSyndicate,
    leaveSyndicate: leaveSyndicate, listSyndicates: listSyndicates,
    contributeWarPoints: contributeWarPoints, subscribeWarLeaderboard: subscribeWarLeaderboard,
    subscribeMyRoster: subscribeMyRoster, weekKey: weekKey,
    getSyndicateInfo: getSyndicateInfo, syndicateTier: syndicateTier,
    subscribeHighRollers: subscribeHighRollers
  };

  window.VV = VV;
})();
