// ============================== APP ==============================
// UI-only state, event wiring, and the spin animation sequence. Game state
// lives in VV.state (engine.js); this file never touches it except through
// VV.engine's functions.
"use strict";

(function () {
  var VV = window.VV;
  var R = VV.render;

  var ui = {
    tab: "slots",
    activeMachineId: null,
    bets: {},
    lastResult: {},
    spinning: false,
    synDraft: { name: "", tag: "", color: VV.SYN_COLORS[0], error: null },
    warRows: [],
    roster: [],
    joinable: [],
    highRollers: [],
    mySyndicateInfo: null
  };

  var unsubWar = null, unsubRoster = null, unsubHighRollers = null;

  function $(id) { return document.getElementById(id); }

  function showModal(html) {
    $("modal-box").innerHTML = '<button class="modal-close" data-action="close-modal">×</button>' + html;
    $("modal-overlay").classList.remove("hidden");
  }
  function closeModal() { $("modal-overlay").classList.add("hidden"); }

  // ---------------- tab rendering ----------------

  function renderTab(tab) {
    if (tab === "slots") {
      var content = ui.activeMachineId
        ? R.stage(VV.engine.machineById(ui.activeMachineId), currentBet(ui.activeMachineId), ui.lastResult[ui.activeMachineId])
        : R.machinePicker();
      $("slots-content").innerHTML = content;
    } else if (tab === "store") {
      $("store-content").innerHTML = R.storeTab();
    } else if (tab === "syndicate") {
      $("syndicate-content").innerHTML = R.syndicateTab(joinedSyndicate(), ui.roster, ui.warRows, ui.synDraft);
    } else if (tab === "stats") {
      $("stats-content").innerHTML = R.statsTab(ui.highRollers);
    }
  }

  // Merges the weekly war-standings row (name/color, fresh whenever the war
  // leaderboard ticks) with the syndicate's own lifetime totalPoints (only
  // fetched on join/create and after a contribution — that field isn't part
  // of the weekly wars doc, see engine.js's contributeWarPoints).
  function joinedSyndicate() {
    var tag = VV.state.syndicateTag;
    if (!tag) return null;
    var fromWar = ui.warRows.find(function (r) { return r.tag === tag; });
    var base = fromWar || { tag: tag, name: tag, color: "#C9A24B" };
    if (ui.mySyndicateInfo && ui.mySyndicateInfo.tag === tag) {
      return Object.assign({}, base, {
        totalPoints: ui.mySyndicateInfo.totalPoints,
        name: ui.mySyndicateInfo.name || base.name,
        color: ui.mySyndicateInfo.color || base.color
      });
    }
    return base;
  }

  function refreshMySyndicateInfo() {
    var tag = VV.state.syndicateTag;
    if (!tag) { ui.mySyndicateInfo = null; return Promise.resolve(); }
    return VV.engine.getSyndicateInfo(tag).then(function (info) {
      ui.mySyndicateInfo = info;
      if (ui.tab === "syndicate") renderTab("syndicate");
    });
  }

  function currentBet(machineId) {
    if (ui.bets[machineId]) return ui.bets[machineId];
    var m = VV.engine.machineById(machineId);
    ui.bets[machineId] = m.minBet;
    return ui.bets[machineId];
  }

  function switchTab(tab) {
    ui.tab = tab;
    document.querySelectorAll(".tab").forEach(function (el) { el.classList.toggle("active", el.id === "tab-" + tab); });
    document.querySelectorAll(".nav-btn").forEach(function (el) { el.classList.toggle("active", el.getAttribute("data-tab") === tab); });
    renderTab(tab);
  }

  // Called once, right when the db capability actually resolves (boot()) —
  // never gated on which tab is open, so a listener set up while the user is
  // elsewhere still keeps ui.warRows/ui.roster warm for when they do visit.
  function startSyndicateSubscriptions() {
    if (unsubWar) return;
    unsubWar = VV.engine.subscribeWarLeaderboard(function (rows) {
      ui.warRows = rows;
      if (ui.tab === "syndicate") renderTab("syndicate");
    });
    unsubHighRollers = VV.engine.subscribeHighRollers(function (rows) {
      ui.highRollers = rows;
      if (ui.tab === "stats") renderTab("stats");
    });
    if (VV.state.syndicateTag) { subscribeRoster(); refreshMySyndicateInfo(); }
    if (!VV.state.syndicateTag) refreshJoinable();
  }
  function subscribeRoster() {
    if (unsubRoster) unsubRoster();
    unsubRoster = VV.engine.subscribeMyRoster(function (rows) {
      ui.roster = rows;
      if (ui.tab === "syndicate") renderTab("syndicate");
    });
  }
  function refreshJoinable() {
    VV.engine.listSyndicates().then(function (rows) {
      ui.roster = rows;
      if (ui.tab === "syndicate" && !VV.state.syndicateTag) renderTab("syndicate");
    });
  }

  // ---------------- slots ----------------

  function openMachine(id) {
    ui.activeMachineId = id;
    renderTab("slots");
  }
  function backToMachines() {
    ui.activeMachineId = null;
    renderTab("slots");
  }
  function changeBet(delta) {
    var m = VV.engine.machineById(ui.activeMachineId);
    var next = currentBet(ui.activeMachineId) + delta * m.betStep;
    ui.bets[ui.activeMachineId] = Math.max(m.minBet, Math.min(m.maxBet, next));
    renderTab("slots");
  }
  function togglePaytable() {
    var panel = $("paytable-panel");
    if (panel) panel.classList.toggle("hidden");
  }

  function doSpin() {
    if (ui.spinning) return;
    var machine = VV.engine.machineById(ui.activeMachineId);
    var bet = currentBet(machine.id);
    var freeSpin = VV.engine.freeSpinsFor(machine.id);
    if (!freeSpin && !VV.engine.canAffordBet(bet)) { R.toast("Not enough coins for that bet."); return; }

    ui.spinning = true;
    document.querySelectorAll(".reel").forEach(function (el) { el.classList.add("spinning"); });
    var spinBtn = document.querySelector('[data-action="spin"]');
    if (spinBtn) spinBtn.disabled = true;
    $("win-banner").textContent = "";
    $("win-banner").classList.remove("jackpot");

    setTimeout(function () {
      var result = VV.engine.spin(machine.id, bet);
      finishSpin(machine, bet, result);
    }, 750);
  }

  function finishSpin(machine, bet, result) {
    ui.spinning = false;
    document.querySelectorAll(".reel").forEach(function (el) { el.classList.remove("spinning"); });

    if (!result.ok) { R.toast(result.reason || "Couldn't spin."); renderTab("slots"); return; }

    // A wild that completed a line has a different key than the line's own
    // result.key (the real symbol it substituted for), so it needs its own
    // check here or it wins the payout but never lights up on the reels.
    var wildKey = (machine.symbols.find(function (s) { return s.wild; }) || {}).key;
    var winMap = {};
    result.evald.lines.forEach(function (line) {
      if (line.result.mult <= 0) return;
      for (var reelIdx = 0; reelIdx < 3; reelIdx++) {
        var cellKey = result.grid[reelIdx][line.row].key;
        if (cellKey === line.result.key || (wildKey && cellKey === wildKey)) winMap[reelIdx + "_" + line.row] = true;
      }
    });
    var bannerText = "";
    if (result.evald.jackpot) bannerText = "JACKPOT! +" + R.fmt(result.payout) + " 🪙";
    else if (result.payout > 0) bannerText = "+" + R.fmt(result.payout) + " 🪙" + (result.usedFreeSpin ? " · free spin" : "");
    else bannerText = result.usedFreeSpin ? "No luck this free spin" : "No luck this spin";

    ui.lastResult[machine.id] = { grid: result.grid, winMap: winMap, jackpot: result.evald.jackpot, bannerText: bannerText };
    renderTab("slots");
    R.paintTopbar();

    if (result.freeSpinsAwarded > 0) {
      R.toast("🎁 " + result.freeSpinsAwarded + " free spins" + (result.usedFreeSpin ? " added" : " awarded") + "!");
    }

    if (VV.state.syndicateTag && result.warPoints > 0) {
      VV.engine.contributeWarPoints(result.warPoints).then(refreshMySyndicateInfo);
    }

    if (result.leveled) {
      showModal(
        '<h2 class="modal-title">Level ' + result.newLevel + '!</h2>' +
        '<p class="page-copy">The house takes notice. +10 💎 credited.</p>' +
        (VV.MACHINES.some(function (m) { return m.unlockLevel === result.newLevel; })
          ? '<p class="fine">A new table just unlocked — check the Slots tab.</p>' : '') +
        '<button class="btn btn-brass btn-block" data-action="close-modal">Great!</button>'
      );
    }
  }

  // ---------------- store ----------------

  function buy(kind, id) {
    var list = kind === "coins" ? VV.SHOP_COINS : VV.SHOP_GEMS;
    var item = list.find(function (i) { return i.id === id; });
    if (!item) return;
    showModal(
      '<h2 class="modal-title">Confirm purchase</h2>' +
      '<p class="page-copy">' + (kind === "coins" ? R.fmt(item.coins) + " coins" : R.fmt(item.gems) + " gems") + ' for ' + R.esc(item.price) + '.</p>' +
      '<p class="fine">This preview has no payment processor connected, so this button grants the amount locally instead of charging a card — a real build would call Google Play Billing here.</p>' +
      '<div class="btn-row"><button class="btn btn-outline" data-action="close-modal">Cancel</button>' +
      '<button class="btn btn-brass" data-action="confirm-buy" data-kind="' + kind + '" data-id="' + id + '">Simulate purchase</button></div>'
    );
  }
  function confirmBuy(kind, id) {
    var list = kind === "coins" ? VV.SHOP_COINS : VV.SHOP_GEMS;
    var item = list.find(function (i) { return i.id === id; });
    if (!item) return;
    VV.engine.simulatePurchase(kind, item);
    closeModal();
    R.paintTopbar();
    renderTab("store");
    R.toast((kind === "coins" ? "+" + R.fmt(item.coins) + " coins" : "+" + R.fmt(item.gems) + " gems"));
  }
  function unlockMachine(id) {
    var m = VV.engine.machineById(id);
    var res = VV.engine.unlockWithGems(m);
    if (!res.ok) { R.toast(res.reason); return; }
    R.paintTopbar();
    renderTab(ui.tab === "store" ? "store" : "slots");
    R.toast(m.name + " unlocked!");
  }

  // ---------------- syndicate ----------------

  function pickColor(c) { ui.synDraft.color = c; renderTab("syndicate"); }

  function captureDraftInputs() {
    var n = $("syn-name"), t = $("syn-tag");
    if (n) ui.synDraft.name = n.value;
    if (t) ui.synDraft.tag = t.value;
  }

  function createSyndicate() {
    captureDraftInputs();
    var name = (ui.synDraft.name || "").trim();
    var tag = (ui.synDraft.tag || "").trim();
    if (!name) { ui.synDraft.error = "Give your syndicate a name."; renderTab("syndicate"); return; }
    if (!/^[A-Za-z0-9]{3,5}$/.test(tag)) { ui.synDraft.error = "Tag must be 3–5 letters or numbers."; renderTab("syndicate"); return; }
    VV.engine.createSyndicate(name, tag, ui.synDraft.color).then(function () {
      ui.synDraft.error = null;
      subscribeRoster();
      refreshMySyndicateInfo();
      renderTab("syndicate");
      R.toast("Syndicate founded.");
    }).catch(function (e) {
      ui.synDraft.error = (e && e.message === "taken") ? "That tag is already taken." : "Couldn't reach the syndicate ledger — try again.";
      renderTab("syndicate");
    });
  }

  function joinSyndicate(tag) {
    VV.engine.joinSyndicate(tag).then(function () {
      subscribeRoster();
      refreshMySyndicateInfo();
      renderTab("syndicate");
      R.toast("Joined " + tag + ".");
    }).catch(function () { R.toast("Couldn't join that syndicate — try again."); });
  }

  function leaveSyndicate() {
    VV.engine.leaveSyndicate();
    if (unsubRoster) { unsubRoster(); unsubRoster = null; }
    ui.roster = [];
    ui.mySyndicateInfo = null;
    refreshJoinable();
    renderTab("syndicate");
  }

  // ---------------- daily ----------------

  function claimDaily() {
    var res = VV.engine.claimDaily();
    if (!res.ok) return;
    R.paintTopbar();
    renderTab("stats");
    R.toast("+" + R.fmt(res.amount) + " 🪙 — day " + res.streakDay + " streak");
  }

  // ---------------- boot ----------------

  function dispatch(action, el) {
    switch (action) {
      case "open-machine": openMachine(el.getAttribute("data-id")); break;
      case "back-to-machines": backToMachines(); break;
      case "bet-down": changeBet(-1); break;
      case "bet-up": changeBet(1); break;
      case "spin": doSpin(); break;
      case "toggle-paytable": togglePaytable(); break;
      case "unlock-machine": unlockMachine(el.getAttribute("data-id")); break;
      case "buy": buy(el.getAttribute("data-kind"), el.getAttribute("data-id")); break;
      case "confirm-buy": confirmBuy(el.getAttribute("data-kind"), el.getAttribute("data-id")); break;
      case "pick-color": pickColor(el.getAttribute("data-color")); break;
      case "create-syndicate": createSyndicate(); break;
      case "join-syndicate": joinSyndicate(el.getAttribute("data-tag")); break;
      case "leave-syndicate": leaveSyndicate(); break;
      case "claim-daily": claimDaily(); break;
      case "close-modal": closeModal(); break;
      default: break;
    }
  }

  document.addEventListener("click", function (e) {
    if (e.target.id === "modal-overlay") { closeModal(); return; }
    var el = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!el) return;
    dispatch(el.getAttribute("data-action"), el);
  });

  document.querySelectorAll(".nav-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.getAttribute("data-tab")); });
  });

  function boot() {
    R.paintTopbar();
    renderTab("slots");

    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("db").then(function (db) {
        if (!db) return;
        VV.engine.setDb(db);
        startSyndicateSubscriptions();
      }).catch(function () {});
    }
  }

  boot();
})();
