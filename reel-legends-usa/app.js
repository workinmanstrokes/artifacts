// ============================================================
// REEL LEGENDS: USA — App
// Ties engine (state/rules) + render (canvas) + DOM (UI) together.
// First-person casting: you never see yourself, only your rod, the
// water stretching out toward the horizon, and whatever's out there.
// ============================================================

const CLOSE_KEY = "reel-legends-last-close-v1";
const RARITY_ORDER = ["common", "uncommon", "rare", "legendary"];
const ZONE_DIST = { 1: 0.3, 2: 0.55, 3: 0.82 };

let state = loadState();
const canvas = document.getElementById("scene");
const renderer = new PixelRenderer(canvas);

let castState = {
  phase: "idle", // idle | cast | wait | bite | fight | result
  zone: 1,
  distT: null,      // 0 (at your feet) .. 1 (horizon) — how far out the line is
  lateral: 0,       // sideways pixel offset (near-plane) for this cast
  targetDistT: null,
  castT: 0,
  biteDip: 0,
  biteTimer: 0,
  fish: null,       // the live candidate fish while waiting/biting
  target: null,     // the committed species/legendary once it strikes
  fight: null,
  resultAnim: null,
  resultColor: null,
};

// ---------- helpers ----------
function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function markClosed() { try { localStorage.setItem(CLOSE_KEY, String(Date.now())); } catch (e) {} }

function setLocationVisuals() {
  const loc = currentLocationData(state);
  renderer.setLocation(loc);
  document.getElementById("loc-name").textContent = loc.name;
  document.getElementById("loc-region").textContent = loc.region;
}

function refreshTopbar() {
  document.getElementById("level-num").textContent = state.level;
  document.getElementById("coins-num").textContent = fmt(state.coins);
  document.getElementById("gems-num").textContent = fmt(state.gems);
  const need = xpForLevel(state.level);
  document.getElementById("xp-fill").style.width = Math.min(100, (state.xp / need) * 100) + "%";
}

function setStatus(msg) {
  document.getElementById("fish-status").textContent = msg;
}

function showButtons({ cast, hook, reel, cont }) {
  document.getElementById("btn-cast").classList.toggle("hidden", !cast);
  document.getElementById("btn-hook").classList.toggle("hidden", !hook);
  document.getElementById("btn-reel").classList.toggle("hidden", !reel);
  document.getElementById("btn-continue").classList.toggle("hidden", !cont);
}

function updateZoneButtons() {
  const rod = RODS[state.rodTier];
  document.querySelectorAll(".zone-btn").forEach(btn => {
    const z = parseInt(btn.dataset.zone, 10);
    btn.classList.toggle("active", z === castState.zone);
    btn.disabled = z > rod.castZones;
  });
}

// ---------- zone selection ----------
document.querySelectorAll(".zone-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (castState.phase !== "idle") return;
    const z = parseInt(btn.dataset.zone, 10);
    const rod = RODS[state.rodTier];
    if (z > rod.castZones) {
      setStatus("You need a better rod to cast that far out.");
      return;
    }
    castState.zone = z;
    updateZoneButtons();
  });
});

// ---------- fish candidate simulation ----------
function spawnCandidate() {
  const loc = currentLocationData(state);
  const legId = rollForLegendary(state, loc, castState.zone);
  let legendary = false, id, speciesId, fightPower, minLine, rarityIdx;
  if (legId) {
    legendary = true;
    id = legId;
    const leg = LEGENDARIES[legId];
    speciesId = leg.species;
    fightPower = leg.fightPower;
    minLine = leg.minLine;
    rarityIdx = 3;
  } else {
    speciesId = rollSpecies(state, loc, castState.zone);
    id = speciesId;
    const sp = SPECIES[speciesId];
    fightPower = sp.fightPower;
    minLine = sp.minLine;
    rarityIdx = RARITY_ORDER.indexOf(sp.rarity);
  }
  const caution = 0.12 + rarityIdx * 0.16; // wary fish take longer to commit
  return {
    legendary, id, speciesId, fightPower, minLine, caution,
    interest: 0,
    driftSeed: Math.random() * 10,
    timer: 0.5 + Math.random() * 0.6,
    approachT: 0,
    approachDuration: 0,
    state: "patrolling",
  };
}

function commitToBite(f) {
  castState.target = { legendary: f.legendary, id: f.id, speciesId: f.speciesId, fightPower: f.fightPower, minLine: f.minLine };
  castState.fish = null;
  castState.phase = "bite";
  castState.biteDip = 3;
  const window_ = Math.max(0.55, 1.3 - castState.zone * 0.06 - state.level * 0.002 - (f.legendary ? 0.15 : 0));
  castState.biteTimer = window_;
  setStatus(f.legendary ? "STRIKE! Something HUGE hit the line!" : "STRIKE! Set the hook!");
  showButtons({ cast: false, hook: true, reel: false, cont: false });
}

function updateWaitPhase(dt) {
  let f = castState.fish;
  if (!f) { castState.fish = spawnCandidate(); return; }

  if (f.state === "patrolling") {
    f.timer -= dt;
    if (f.timer <= 0) {
      const lureMult = lureMultiplierFor(state, f.speciesId);
      const gain = (0.16 + Math.max(0, lureMult - 1) * 0.4) / (1 + f.caution * 1.6);
      f.interest = Math.min(1, f.interest + gain);
      f.timer = 0.45 + Math.random() * 0.5;
      if (f.interest < 0.3 && Math.random() < f.caution * 0.22) {
        castState.fish = spawnCandidate();
        setStatus("Whatever that was drifted off. Hold steady...");
        return;
      }
      if (f.interest >= 1) {
        f.state = "approaching";
        f.approachDuration = 0.5 + f.caution * 0.6;
        f.timer = f.approachDuration;
        f.approachT = 0;
        setStatus(f.legendary ? "Something MASSIVE is circling in..." : "It's moving in for a closer look...");
      } else if (f.interest > 0.55) {
        setStatus("Something's circling your lure...");
      } else {
        setStatus("You feel a shape out there...");
      }
    }
  } else if (f.state === "approaching") {
    f.timer -= dt;
    f.approachT = clamp(1 - f.timer / f.approachDuration, 0, 1);
    if (f.timer <= 0) commitToBite(f);
  }
}

// ---------- casting flow ----------
function startCast() {
  if (castState.phase !== "idle") return;
  const rod = RODS[state.rodTier];
  if (castState.zone > rod.castZones) castState.zone = 1;
  castState.phase = "cast";
  castState.castT = 0;
  castState.distT = 0.04;
  castState.targetDistT = ZONE_DIST[castState.zone];
  castState.lateral = (Math.random() * 2 - 1) * 14;
  setStatus("Casting...");
  showButtons({ cast: false, hook: false, reel: false, cont: false });
}

function beginWait() {
  castState.phase = "wait";
  castState.fish = spawnCandidate();
  setStatus("You feel something out there...");
}

function missBite() {
  castState.phase = "idle";
  castState.distT = null;
  castState.biteDip = 0;
  castState.target = null;
  setStatus("It felt the hook and let go. Try again!");
  showButtons({ cast: true, hook: false, reel: false, cont: false });
}

function setHook() {
  if (castState.phase !== "bite") return;
  const t = castState.target;
  const p = fightParamsFor(state, t.fightPower, t.minLine);
  castState.fight = Object.assign({
    tension: 0.2,
    progress: 0,
    stamina: 1,
    mode: "normal",
    modeTimer: 0.8 + Math.random() * 1.2,
    shake: 0,
    breach: 0,
    overCap: 0,
    holding: false,
  }, p);
  castState.phase = "fight";
  castState.biteDip = 0;
  setStatus(t.legendary ? "Keep the line tight — don't fight the runs!" : "Reel it in — but ease off when it runs.");
  showButtons({ cast: false, hook: false, reel: true, cont: false });
}

function lineSnap() {
  state.stats.escapes += 1;
  saveState(state);
  castState.phase = "idle";
  castState.distT = null;
  castState.fight = null;
  castState.target = null;
  setStatus("SNAP! The line broke and it got away.");
  showButtons({ cast: true, hook: false, reel: false, cont: false });
}

function catchSuccess() {
  const t = castState.target;
  let name, weightLb, rarityColor, result, isLegendary = false;
  if (t.legendary) {
    isLegendary = true;
    const leg = LEGENDARIES[t.id];
    weightLb = +(leg.weightLb * (0.96 + Math.random() * 0.08)).toFixed(2);
    result = recordLegendaryCatch(state, t.id, weightLb);
    name = leg.name;
    rarityColor = RARITY.legendary.color;
  } else {
    const sp = SPECIES[t.speciesId];
    weightLb = rollWeight(sp.minLb, sp.maxLb);
    result = recordCatch(state, t.speciesId, weightLb);
    name = sp.name;
    rarityColor = RARITY[sp.rarity].color;
  }
  saveState(state);
  refreshTopbar();

  castState.phase = "result";
  castState.resultAnim = 0;
  castState.resultColor = rarityColor;
  castState.fight = null;

  let msg = `${isLegendary ? "🏆 LEGENDARY! " : ""}${name} — ${weightLb} lb! +${fmt(result.coins)} coins, +${fmt(result.xp)} xp`;
  if (result.gems) msg += `, +${result.gems} gems`;
  if (result.leveledUp) msg += ` — LEVEL UP! You're now level ${state.level}!`;
  setStatus(msg);
  showButtons({ cast: false, hook: false, reel: false, cont: true });
}

function backToIdle() {
  castState.phase = "idle";
  castState.distT = null;
  castState.fish = null;
  castState.target = null;
  castState.resultAnim = null;
  setStatus("Cast your line to begin.");
  showButtons({ cast: true, hook: false, reel: false, cont: false });
}

document.getElementById("btn-cast").addEventListener("click", startCast);
document.getElementById("btn-continue").addEventListener("click", backToIdle);
document.getElementById("btn-hook").addEventListener("click", setHook);

const reelBtn = document.getElementById("btn-reel");
["pointerdown"].forEach(ev => reelBtn.addEventListener(ev, e => { e.preventDefault(); if (castState.fight) castState.fight.holding = true; }));
["pointerup", "pointerleave", "pointercancel"].forEach(ev => reelBtn.addEventListener(ev, () => { if (castState.fight) castState.fight.holding = false; }));

// ---------- fight (run / rest) simulation ----------
function updateFightPhase(dt) {
  const f = castState.fight;
  if (!f) return;

  // Breach animation counts down on its own regardless of mode.
  if (f.breach > 0) f.breach = Math.max(0, f.breach - dt * 1.8);

  f.modeTimer -= dt;
  if (f.modeTimer <= 0) {
    if (f.mode === "normal") {
      const willRun = Math.random() < 0.35 + f.stamina * 0.45;
      if (willRun) {
        f.mode = "running";
        f.modeTimer = lerp(f.runDurationMin, f.runDurationMax, Math.random());
        f.stamina = Math.max(0.08, f.stamina - f.staminaDrainPerRun);
        if (Math.random() < f.breachChance * f.stamina) f.breach = 1;
      } else {
        f.modeTimer = 0.6 + Math.random() * 0.9;
      }
    } else if (f.mode === "running") {
      f.mode = "resting";
      f.modeTimer = lerp(f.restDurationMin, f.restDurationMax, Math.random());
    } else {
      f.mode = "normal";
      f.modeTimer = 0.8 + Math.random() * 1.2;
    }
  }
  // Fish tires a little just from the fight itself, win or lose.
  f.stamina = Math.max(0, f.stamina - dt * 0.01);

  // Screen shake eases toward a mode-driven target.
  const shakeTarget = f.mode === "running" ? 0.5 + f.fightPower * 0.05 : 0;
  f.shake = lerp(f.shake, shakeTarget, Math.min(1, dt * 6));

  let tRate = f.tensionRate, pGain = f.progressPerReel;
  if (f.mode === "running") tRate *= f.runTensionMult;
  else if (f.mode === "resting") { tRate *= f.restTensionMult; pGain *= f.restProgressMult; }

  if (f.holding) {
    f.tension = Math.min(1, f.tension + tRate * dt);
    const efficiency = f.tension < f.breakCap ? 1 : 0.3;
    f.progress = Math.min(1, f.progress + pGain * dt * 10 * efficiency);
  } else if (f.mode === "running") {
    // Letting it run: the rod absorbs most of it, but the line still pays out.
    f.tension = Math.min(1, f.tension + tRate * 0.35 * dt);
  } else {
    f.tension = Math.max(0, f.tension - f.decayRate * dt);
  }

  if (f.tension > f.breakCap) {
    f.overCap += dt;
    if (f.overCap > 0.65) { lineSnap(); return; }
  } else {
    f.overCap = 0;
  }
  if (f.progress >= 1) catchSuccess();
}

// ---------- per-frame update ----------
function update(dt) {
  if (castState.phase === "cast") {
    castState.castT += dt;
    const tt = Math.min(1, castState.castT / 0.35);
    castState.distT = lerp(0.04, castState.targetDistT, tt);
    if (tt >= 1) beginWait();
  } else if (castState.phase === "wait") {
    updateWaitPhase(dt);
  } else if (castState.phase === "bite") {
    castState.biteTimer -= dt;
    if (castState.biteTimer <= 0) missBite();
  } else if (castState.phase === "fight") {
    updateFightPhase(dt);
  } else if (castState.phase === "result") {
    castState.resultAnim += dt;
  }
}

// ---------- idle / offline ----------
function runOfflineCatchUp() {
  const raw = localStorage.getItem(CLOSE_KEY);
  const lastClose = raw ? parseInt(raw, 10) : state.createdAt;
  const elapsed = Date.now() - lastClose;
  markClosed();
  if (elapsed < 60 * 1000) return;
  const result = simulateIdle(state, elapsed);
  saveState(state);
  refreshTopbar();
  if (result.catches.length > 0) {
    showWelcomeBackModal(result);
  }
}

function showWelcomeBackModal(result) {
  const bySpecies = {};
  result.catches.forEach(c => {
    const e = bySpecies[c.speciesId] || { count: 0, coins: 0, bestLb: 0 };
    e.count += 1;
    e.coins += c.coins;
    e.bestLb = Math.max(e.bestLb, c.weightLb);
    bySpecies[c.speciesId] = e;
  });
  const hoursTxt = result.hoursSimmed < 1
    ? `${Math.round(result.hoursSimmed * 60)} minutes`
    : `${result.hoursSimmed.toFixed(1)} hours`;
  let html = `<p>While you were away for <b>${hoursTxt}</b>, your line kept working:</p>`;
  Object.keys(bySpecies).forEach(id => {
    const sp = SPECIES[id];
    const e = bySpecies[id];
    html += `<div class="catch-line"><span>${sp.name} ×${e.count} (best ${e.bestLb.toFixed(1)} lb)</span><span>+${fmt(e.coins)}🪙</span></div>`;
  });
  html += `<p style="margin-top:10px">Total: <b>+${fmt(result.coins)} coins</b>, +${fmt(result.xp)} xp</p>`;
  document.getElementById("modal-title").textContent = "Welcome back!";
  document.getElementById("modal-body").innerHTML = html;
  document.getElementById("modal-overlay").classList.remove("hidden");
}
document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("modal-overlay").classList.add("hidden");
});

let idleFeedTimer = null;
function idleTick() {
  const result = simulateIdle(state, 60 * 1000);
  saveState(state);
  refreshTopbar();
  if (result.catches.length > 0) {
    const last = result.catches[result.catches.length - 1];
    const sp = SPECIES[last.speciesId];
    const feed = document.getElementById("idle-feed");
    feed.textContent = `🎣 Idle catch: ${sp.name} ${last.weightLb} lb (+${fmt(last.coins)})`;
    clearTimeout(idleFeedTimer);
    idleFeedTimer = setTimeout(() => { feed.textContent = ""; }, 5000);
    renderShopIfActive();
  }
}
setInterval(idleTick, 60 * 1000);

document.addEventListener("visibilitychange", () => { if (document.hidden) { markClosed(); saveState(state); } });
window.addEventListener("pagehide", () => { markClosed(); saveState(state); });

// ---------- tabs ----------
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "shop") renderShop();
    if (btn.dataset.tab === "spots") renderSpots();
    if (btn.dataset.tab === "almanac") renderAlmanac();
    if (btn.dataset.tab === "stats") renderStats();
  });
});
function renderShopIfActive() {
  if (document.getElementById("tab-shop").classList.contains("active")) renderShop();
}

// ---------- shop ----------
function renderTierShop(containerId, tiers, currentTier, statText, onBuy) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  tiers.forEach((tier, i) => {
    const card = document.createElement("div");
    card.className = "shop-card" + (i === currentTier ? " equipped" : "");
    const status = i < currentTier ? "owned" : i === currentTier ? "equipped" : i === currentTier + 1 ? "next" : "locked";
    let btnHtml = "";
    if (status === "equipped") btnHtml = `<button disabled class="equipped-tag">Equipped</button>`;
    else if (status === "owned") btnHtml = `<button disabled>Owned</button>`;
    else if (status === "next") btnHtml = `<button ${state.coins < tier.cost ? "disabled" : ""} data-i="${i}">Buy $${fmt(tier.cost)}</button>`;
    else btnHtml = `<button disabled>Locked</button>`;
    card.innerHTML = `<div><span class="name">${tier.name}</span><br><span class="sub">${statText(tier)}${status !== "equipped" && status !== "owned" ? " · $" + fmt(tier.cost) : ""}</span></div>${btnHtml}`;
    el.appendChild(card);
  });
  el.querySelectorAll("button[data-i]").forEach(b => b.addEventListener("click", () => onBuy(parseInt(b.dataset.i, 10))));
}

function renderShop() {
  renderTierShop("shop-rods", RODS, state.rodTier, t => `Cast zones: ${t.castZones} · Idle +${t.idleBonus.toFixed(1)}/hr`, i => {
    if (i !== state.rodTier + 1 || state.coins < RODS[i].cost) return;
    state.coins -= RODS[i].cost; state.rodTier = i;
    saveState(state); refreshTopbar(); renderShop(); updateZoneButtons();
  });
  renderTierShop("shop-reels", REELS, state.reelTier, t => `Safe zone: ${Math.round(t.safeZone * 100)}% · Idle +${t.idleBonus.toFixed(1)}/hr`, i => {
    if (i !== state.reelTier + 1 || state.coins < REELS[i].cost) return;
    state.coins -= REELS[i].cost; state.reelTier = i;
    saveState(state); refreshTopbar(); renderShop();
  });
  renderTierShop("shop-lines", LINES, state.lineTier, t => `Break cap: ${Math.round(t.breakCap * 100)}%`, i => {
    if (i !== state.lineTier + 1 || state.coins < LINES[i].cost) return;
    state.coins -= LINES[i].cost; state.lineTier = i;
    saveState(state); refreshTopbar(); renderShop();
  });

  const el = document.getElementById("shop-lures");
  el.innerHTML = "";
  LURES.forEach((lure, i) => {
    const owned = state.ownedLures.includes(i);
    const equipped = state.lureIndex === i;
    const card = document.createElement("div");
    card.className = "shop-card" + (equipped ? " equipped" : "");
    let btnHtml;
    if (equipped) btnHtml = `<button disabled class="equipped-tag">Equipped</button>`;
    else if (owned) btnHtml = `<button data-i="${i}" data-act="equip">Equip</button>`;
    else btnHtml = `<button data-i="${i}" data-act="buy" ${state.coins < lure.cost ? "disabled" : ""}>Buy $${fmt(lure.cost)}</button>`;
    card.innerHTML = `<div><span class="name">${lure.name}</span><br><span class="sub">Idle +${lure.idleBonus.toFixed(1)}/hr${owned ? "" : " · $" + fmt(lure.cost)}</span></div>${btnHtml}`;
    el.appendChild(card);
  });
  el.querySelectorAll("button[data-i]").forEach(b => b.addEventListener("click", () => {
    const i = parseInt(b.dataset.i, 10);
    if (b.dataset.act === "buy") {
      if (state.coins < LURES[i].cost) return;
      state.coins -= LURES[i].cost;
      state.ownedLures.push(i);
    }
    state.lureIndex = i;
    saveState(state); refreshTopbar(); renderShop();
  }));
}

// ---------- spots ----------
function renderSpots() {
  const el = document.getElementById("spots-list");
  el.innerHTML = "";
  LOCATIONS.forEach(loc => {
    const unlocked = isLocationUnlocked(state, loc.id);
    const isCurrent = state.currentLocation === loc.id;
    const card = document.createElement("div");
    card.className = "spot-card" + (unlocked ? "" : " locked");
    const speciesTxt = unlocked
      ? loc.species.map(id => SPECIES[id].name).join(", ")
      : "???";
    let actionHtml = "";
    if (unlocked) {
      actionHtml = `<button data-loc="${loc.id}" data-act="travel" ${isCurrent ? "disabled" : ""}>${isCurrent ? "Current Spot" : "Travel Here"}</button>`;
    } else {
      const canUnlock = canUnlockLocation(state, loc);
      actionHtml = `<button data-loc="${loc.id}" data-act="unlock" ${canUnlock ? "" : "disabled"}>Unlock — Lvl ${loc.unlockLevel}, $${fmt(loc.unlockCost)}</button>`;
    }
    card.innerHTML = `
      <div class="spot-name">${unlocked ? loc.name : "??? " + loc.region}</div>
      <div class="spot-region">${loc.region}</div>
      <div class="spot-species">Species: ${speciesTxt}</div>
      <div class="spot-actions">${actionHtml}</div>`;
    el.appendChild(card);
  });
  el.querySelectorAll("button[data-loc]").forEach(b => b.addEventListener("click", () => {
    const locId = b.dataset.loc;
    if (b.dataset.act === "travel") {
      if (castState.phase !== "idle") backToIdle();
      state.currentLocation = locId;
      setLocationVisuals();
      saveState(state);
      renderSpots();
    } else if (b.dataset.act === "unlock") {
      if (unlockLocation(state, locId)) {
        saveState(state); refreshTopbar(); renderSpots();
      }
    }
  }));
}

// ---------- almanac ----------
function renderAlmanac() {
  const el = document.getElementById("almanac-list");
  el.innerHTML = "";
  let lockedCount = 0;
  LOCATIONS.forEach(loc => {
    if (!isLocationUnlocked(state, loc.id)) { lockedCount++; return; }
    const wrap = document.createElement("div");
    wrap.className = "almanac-loc";
    let grid = `<div class="dex-grid">`;
    loc.species.forEach(id => {
      const sp = SPECIES[id];
      const entry = state.dex[id];
      const color = RARITY[sp.rarity].color;
      if (entry) {
        grid += `<div class="dex-card"><span class="dex-name" style="color:${color}">${sp.name}</span>Caught ${entry.count} · best ${entry.bestLb.toFixed(1)} lb</div>`;
      } else {
        grid += `<div class="dex-card uncaught"><span class="dex-name">???</span>Not yet caught</div>`;
      }
    });
    grid += `</div>`;
    const leg = LEGENDARIES[loc.legendary];
    const legCaught = state.legendaryCaught[loc.legendary];
    const legHtml = legCaught
      ? `<div class="legendary-card"><span class="leg-name">🏆 ${leg.name}</span> — caught at ${legCaught.weightLb.toFixed(1)} lb!</div>`
      : `<div class="legendary-card uncaught"><span class="leg-name">🏆 ???</span> — a legend still swims here...</div>`;
    wrap.innerHTML = `<h3>${loc.name}</h3>${grid}${legHtml}`;
    el.appendChild(wrap);
  });
  if (lockedCount > 0) {
    const p = document.createElement("p");
    p.style.color = "var(--text-dim)";
    p.style.fontSize = "11px";
    p.textContent = `${lockedCount} more fishing spot${lockedCount > 1 ? "s" : ""} yet to be discovered...`;
    el.appendChild(p);
  }
}

// ---------- stats ----------
function renderStats() {
  const el = document.getElementById("stats-list");
  const totalLegendaries = Object.keys(LEGENDARIES).length;
  const caughtLegendaries = Object.keys(state.legendaryCaught).length;
  const rows = [
    ["Level", state.level],
    ["Coins", fmt(state.coins)],
    ["Gems", fmt(state.gems)],
    ["Total Catches", fmt(state.stats.totalCatches)],
    ["Biggest Fish", state.stats.biggestLb.toFixed(1) + " lb"],
    ["Total Coins Earned", fmt(state.stats.totalCoinsEarned)],
    ["Lines Snapped", fmt(state.stats.escapes)],
    ["Legendary Fish Caught", `${caughtLegendaries} / ${totalLegendaries}`],
    ["Spots Unlocked", `${state.unlockedLocations.length} / ${LOCATIONS.length}`],
  ];
  el.innerHTML = rows.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join("");
}
document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm("Reset all progress? This cannot be undone.")) {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(CLOSE_KEY);
    state = defaultState();
    setLocationVisuals();
    refreshTopbar();
    backToIdle();
    renderStats();
  }
});

// ---------- boot ----------
function boot() {
  setLocationVisuals();
  refreshTopbar();
  updateZoneButtons();
  showButtons({ cast: true, hook: false, reel: false, cont: false });
  runOfflineCatchUp();

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    update(dt);
    renderer.draw(castState);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

// ---------- hot-reload state carry-over (for the published Artifact) ----------
// If the page is republished while someone has it open, hand the in-progress
// run (coins, gear, dex, current fight, etc.) forward instead of resetting it.
function start(hotData) {
  try {
    if (hotData && hotData.state) {
      const base = defaultState();
      state = Object.assign(base, hotData.state, {
        dex: Object.assign({}, hotData.state.dex),
        legendaryCaught: Object.assign({}, hotData.state.legendaryCaught),
        stats: Object.assign(base.stats, hotData.state.stats),
        settings: Object.assign(base.settings, hotData.state.settings),
      });
      saveState(state);
    }
  } catch (e) {
    console.warn("Hot-reload state carry-over failed, using saved state:", e);
  }
  boot();
}

if (typeof window !== "undefined" && window.claude && window.claude.hot && window.claude.hot.snapshot) {
  window.claude.hot.snapshot(() => ({ state }));
}
if (typeof window !== "undefined" && window.claude && window.claude.hot && window.claude.hot.ready) {
  window.claude.hot.ready(start);
} else {
  start(typeof window !== "undefined" ? window.claude?.hot?.data : undefined);
}
