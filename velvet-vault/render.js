// ============================== RENDER ==============================
// Pure HTML-string builders. app.js owns state mutation and event wiring;
// these functions just turn the current state into markup.
"use strict";

var VV = window.VV || {};

(function () {

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }

  // ---------------- topbar ----------------
  function paintTopbar() {
    var s = VV.state, prog = VV.engine.xpProgress();
    document.getElementById("level-num").textContent = s.level;
    document.getElementById("coins-num").textContent = fmt(s.coins);
    document.getElementById("gems-num").textContent = fmt(s.gems);
    document.getElementById("xp-fill").style.width = prog.pct + "%";
  }

  // ---------------- slots: machine picker ----------------
  function machinePicker() {
    var s = VV.state;
    var html = '<div class="eyebrow">Velvet Vault</div><h1 class="page-title">Pick your table</h1>' +
      '<p class="page-copy">Three machines, three sets of odds. Every payout is spelled out on the paytable before you spin a dime.</p>' +
      '<div class="machine-grid">';
    VV.MACHINES.forEach(function (m) {
      var unlocked = VV.engine.isUnlocked(m);
      var jackpotSym = m.symbols.find(function (sy) { return sy.jackpot; });
      html += '<button class="machine-card' + (unlocked ? '' : ' locked') + '" style="--mc-accent:' + m.accent + '" data-action="open-machine" data-id="' + m.id + '">' +
        '<span class="machine-glyph">' + jackpotSym.glyph + '</span>' +
        '<span class="machine-info"><span class="machine-name">' + esc(m.name) + '</span>' +
        '<span class="machine-tag">' + esc(m.tag) + '</span>' +
        '<span class="machine-meta">Bet ' + m.minBet + '–' + m.maxBet + ' coins</span></span>' +
        (unlocked ? '' : '<span class="lock-pill">🔒 Lv.' + m.unlockLevel + ' or ' + m.unlockGems + '💎</span>') +
        '</button>';
    });
    html += '</div>';
    if (!s.syndicateTag) {
      html += '<div class="panel"><div class="panel-title">Tip</div><p class="fine">Every spin also banks points for your syndicate’s weekly war. Join or found one from the Syndicate tab.</p></div>';
    }
    return html;
  }

  function reelsHtml(machine, grid, winMap) {
    var html = '';
    for (var r = 0; r < 3; r++) {
      html += '<div class="reel" id="reel-' + r + '"><div class="reel-strip" id="strip-' + r + '">';
      for (var row = 0; row < 3; row++) {
        var sym = grid ? grid[r][row] : machine.symbols[0];
        var isWin = winMap && winMap[r + "_" + row];
        html += '<div class="reel-cell' + (isWin ? ' win' : '') + '">' + sym.glyph + '</div>';
      }
      html += '</div>' +
        '<div class="payline-mark p0"></div><div class="payline-mark p1"></div><div class="payline-mark p2"></div>' +
        '</div>';
    }
    return html;
  }

  function stage(machine, uiBet, lastResult) {
    var unlocked = VV.engine.isUnlocked(machine);
    var html = '<div class="stage">';
    html += '<div class="stage-head"><button class="btn-outline btn-sm" data-action="back-to-machines">← Tables</button>' +
      '<div style="text-align:right"><div class="stage-title">' + esc(machine.name) + '</div><div class="stage-sub">' + esc(machine.tag) + '</div></div></div>';

    if (!unlocked) {
      html += '<div class="panel"><div class="panel-title">Locked</div>' +
        '<p class="fine">Unlocks automatically at level ' + machine.unlockLevel + ', or spend ' + machine.unlockGems + ' 💎 to open it now.</p>' +
        '<button class="btn btn-brass btn-block" style="margin-top:12px" data-action="unlock-machine" data-id="' + machine.id + '">Unlock for ' + machine.unlockGems + ' 💎</button></div>';
      return html + '</div>';
    }

    var fs = VV.engine.freeSpinsFor(machine.id);

    html += '<div class="frame" id="frame">';
    if (fs) {
      html += '<div class="freespin-banner">🎁 Free Spins — ' + fs.remaining + ' left · ' + fs.multiplier + '× payouts</div>';
    }
    html += '<div class="reels" id="reels">' + reelsHtml(machine, lastResult && lastResult.grid, lastResult && lastResult.winMap) + '</div>' +
      '</div>';
    html += '<div class="win-banner' + (lastResult && lastResult.jackpot ? ' jackpot' : '') + '" id="win-banner">' +
      (lastResult && lastResult.bannerText ? esc(lastResult.bannerText) : '') + '</div>';

    html += '<div class="bet-row">' +
      '<div class="bet-control">' +
      '<button class="bet-btn" data-action="bet-down" ' + (fs || uiBet <= machine.minBet ? 'disabled' : '') + '>–</button>' +
      '<span class="bet-value mono" id="bet-value">' + (fs ? fs.bet : uiBet) + '</span>' +
      '<button class="bet-btn" data-action="bet-up" ' + (fs || uiBet >= machine.maxBet ? 'disabled' : '') + '>+</button>' +
      '</div>' +
      '<button class="btn btn-brass spin-btn" data-action="spin" ' + (!fs && VV.state.coins < uiBet ? 'disabled' : '') + '>' + (fs ? 'Free Spin' : 'Spin') + '</button>' +
      '</div>';

    html += '<button class="paytable-toggle" data-action="toggle-paytable">View paytable &amp; odds ▾</button>' +
      '<div class="panel hidden" id="paytable-panel">' + paytableHtml(machine) + '</div>';

    return html + '</div>';
  }

  function paytableHtml(machine) {
    var html = '<div class="panel-title">Paytable — ' + esc(machine.name) + '</div><div class="paytable">';
    machine.symbols.slice().reverse().forEach(function (s) {
      html += '<div class="paytable-row"><span class="pt-sym">' + s.glyph + '</span>' +
        '<span class="pt-label">' + esc(s.label) + '</span>' +
        '<span class="pt-pay mono">' + (s.note ? esc(s.note) : ((s.pay2 > 0 ? s.pay2 + '× / ' : '') + s.pay3 + '×')) + '</span></div>';
    });
    html += '</div><div class="rtp-note">Three matching on a row pays the larger multiple; some symbols also pay on two-of-a-kind. Odds are weighted like a real machine — house-favored, disclosed here in full, and tuned for fun rather than a certified payout table.</div>';
    return html;
  }

  // ---------------- store ----------------
  function storeTab() {
    var html = '<div class="eyebrow">Cashier</div><h1 class="page-title">The Cashier’s Window</h1>' +
      '<p class="page-copy">Coins and gems here have no cash value and can’t be redeemed for money or prizes — they’re for play only.</p>';

    html += '<div class="store-section"><div class="panel-title" style="margin-left:2px">Coins</div><div class="store-grid">';
    VV.SHOP_COINS.forEach(function (item) {
      html += '<button class="store-card' + (item.best ? ' best' : '') + '" data-action="buy" data-kind="coins" data-id="' + item.id + '">' +
        (item.best ? '<span class="best-flag">Best value</span>' : '') +
        '<div class="glyph">' + item.glyph + '</div><div class="amount mono">' + fmt(item.coins) + '</div>' +
        (item.bonus ? '<div class="bonus">' + esc(item.bonus) + '</div>' : '') +
        '<div class="price">' + esc(item.price) + '</div></button>';
    });
    html += '</div></div>';

    html += '<div class="store-section"><div class="panel-title" style="margin-left:2px">Gems</div><div class="store-grid">';
    VV.SHOP_GEMS.forEach(function (item) {
      html += '<button class="store-card' + (item.best ? ' best' : '') + '" data-action="buy" data-kind="gems" data-id="' + item.id + '">' +
        (item.best ? '<span class="best-flag">Best value</span>' : '') +
        '<div class="glyph">' + item.glyph + '</div><div class="amount mono">' + fmt(item.gems) + '</div>' +
        (item.bonus ? '<div class="bonus">' + esc(item.bonus) + '</div>' : '') +
        '<div class="price">' + esc(item.price) + '</div></button>';
    });
    html += '</div></div>';

    html += '<div class="store-section"><div class="panel-title" style="margin-left:2px">Unlock a table early</div>';
    VV.MACHINES.filter(function (m) { return !VV.engine.isUnlocked(m); }).forEach(function (m) {
      html += '<div class="gate-card"><div><div class="list-main">' + esc(m.name) + '</div><div class="list-sub">Free at level ' + m.unlockLevel + '</div></div>' +
        '<button class="btn btn-outline btn-sm" data-action="unlock-machine" data-id="' + m.id + '">' + m.unlockGems + ' 💎</button></div>';
    });
    html += '</div>';

    html += '<div class="disclosure"><b>About purchases in this preview.</b> This is a design prototype, so the buttons above grant coins/gems locally instead of charging real money — there’s no payment processor wired in here. A published build would route these through Google Play Billing.</div>';
    return html;
  }

  // ---------------- syndicate ----------------
  function syndicateTab(joined, roster, warRows, draft) {
    var s = VV.state;
    var html = '<div class="eyebrow">Syndicate</div><h1 class="page-title">' + (joined ? esc(joined.name) : 'Find your syndicate') + '</h1>';

    if (!joined) {
      html += '<p class="page-copy">Every spin banks war points for whichever syndicate you run with. Found one or join an existing family below.</p>';
      html += '<div class="panel"><div class="panel-title">Found a syndicate</div>' +
        '<label class="field"><label>Name</label><input id="syn-name" placeholder="e.g. The Ivory Room" value="' + esc(draft.name) + '"></label>' +
        '<label class="field"><label>Tag (3–5 letters)</label><input id="syn-tag" maxlength="5" placeholder="IVORY" value="' + esc(draft.tag) + '"></label>' +
        '<div class="field"><label>Color</label><div class="swatch-row">' +
        VV.SYN_COLORS.map(function (c) { return '<span class="swatch' + (draft.color === c ? ' active' : '') + '" style="background:' + c + '" data-action="pick-color" data-color="' + c + '"></span>'; }).join('') +
        '</div></div>' +
        (draft.error ? '<p class="fine" style="color:var(--bad)">' + esc(draft.error) + '</p>' : '') +
        '<button class="btn btn-brass btn-block" data-action="create-syndicate">Found syndicate</button></div>';

      html += '<div class="panel"><div class="panel-title">Join an existing syndicate</div>';
      if (!roster || !roster.length) {
        html += '<div class="war-empty">No syndicates yet — be the first to found one.</div>';
      } else {
        html += '<div class="list">' + roster.map(function (r) {
          var tier = VV.engine.syndicateTier(r.totalPoints);
          return '<div class="list-row"><div style="display:flex;align-items:center;gap:10px"><span class="war-dot" style="background:' + r.color + '"></span>' +
            '<div><div class="list-main">' + esc(r.name) + ' <span class="tier-badge" title="' + tier.label + '">' + tier.icon + '</span></div>' +
            '<div class="list-sub">' + esc(r.tag) + ' · ' + (r.memberCount || 1) + ' members</div></div></div>' +
            '<button class="btn btn-outline btn-sm" data-action="join-syndicate" data-tag="' + esc(r.tag) + '">Join</button></div>';
        }).join('') + '</div>';
      }
      html += '</div>';
    } else {
      var myTier = VV.engine.syndicateTier(joined.totalPoints);
      html += '<div class="panel"><div class="syn-header"><div class="syn-badge" style="background:' + joined.color + '22;color:' + joined.color + ';border-color:' + joined.color + '">' + esc(joined.tag) + '</div>' +
        '<div><div class="syn-name">' + esc(joined.name) + ' <span class="tier-badge" title="' + myTier.label + ' — ' + fmt(joined.totalPoints || 0) + ' lifetime pts">' + myTier.icon + ' ' + myTier.label + '</span></div><div class="syn-tag">' + esc(joined.tag) + '</div></div></div>' +
        '<div class="syn-stat-row"><div class="syn-stat"><strong>' + (roster ? roster.length : 1) + '</strong><span>Members</span></div>' +
        '<div class="syn-stat"><strong>' + fmt(myWarPoints(warRows, joined.tag)) + '</strong><span>War pts</span></div>' +
        '<div class="syn-stat"><strong>#' + (myWarRank(warRows, joined.tag) || '—') + '</strong><span>Rank</span></div></div>' +
        '<button class="btn btn-danger btn-sm" style="margin-top:14px" data-action="leave-syndicate">Leave syndicate</button></div>';

      html += '<div class="panel"><div class="panel-title">Roster</div><div class="list">' +
        (roster && roster.length ? roster.map(function (m) {
          return '<div class="list-row"><div class="list-main">' + esc(m.name) + (m.deviceId === VV.deviceId ? ' (you)' : '') + '</div>' +
            '<div class="list-sub">Joined ' + new Date(m.joinedAt).toLocaleDateString() + '</div></div>';
        }).join('') : '<div class="war-empty">Just you so far.</div>') + '</div></div>';
    }

    html += '<div class="panel"><div class="panel-title">This week’s war standings</div>';
    if (!warRows || !warRows.length) {
      html += '<div class="war-empty">No syndicate has banked war points yet this week.</div>';
    } else {
      warRows.forEach(function (row, i) {
        var mine = joined && row.tag === joined.tag;
        html += '<div class="war-row' + (mine ? ' you' : '') + '"><span class="war-rank">' + (i + 1) + '</span>' +
          '<span class="war-dot" style="background:' + row.color + '"></span>' +
          '<span class="war-name">' + esc(row.name) + '</span>' +
          '<span class="war-points mono">' + fmt(row.points) + '</span></div>';
      });
    }
    html += '<p class="fine" style="margin-top:12px">Resets every week. This leaderboard is shared live with anyone who opens this preview — a published app would run its own backend for real cross-device syndicates.</p></div>';

    return html;
  }

  function myWarPoints(rows, tag) {
    var row = (rows || []).find(function (r) { return r.tag === tag; });
    return row ? row.points : 0;
  }
  function myWarRank(rows, tag) {
    var idx = (rows || []).findIndex(function (r) { return r.tag === tag; });
    return idx === -1 ? null : idx + 1;
  }

  // ---------------- stats ----------------
  function highRollersHtml(rows) {
    if (!rows || !rows.length) return '<div class="war-empty">No big wins on record yet — spin and set one.</div>';
    return rows.map(function (r, i) {
      var mine = r.deviceId === VV.deviceId;
      return '<div class="war-row' + (mine ? ' you' : '') + '"><span class="war-rank">' + (i + 1) + '</span>' +
        '<span class="war-name">' + esc(r.name) + (mine ? ' (you)' : '') + '</span>' +
        '<span class="war-points mono">' + fmt(r.biggestWin) + ' 🪙</span></div>';
    }).join('');
  }

  function statsTab(highRollers) {
    var s = VV.state;
    var html = '<div class="eyebrow">Ledger</div><h1 class="page-title">Your Ledger</h1>';
    html += '<div class="stat-grid">' +
      '<div class="stat-tile"><strong>' + fmt(s.totalSpins) + '</strong><span>Spins</span></div>' +
      '<div class="stat-tile"><strong>' + fmt(s.totalWagered) + '</strong><span>Wagered</span></div>' +
      '<div class="stat-tile"><strong>' + fmt(s.totalWon) + '</strong><span>Won</span></div>' +
      '<div class="stat-tile"><strong>' + fmt(s.biggestWin) + '</strong><span>Biggest win</span></div>' +
      '<div class="stat-tile"><strong>' + s.jackpotsHit + '</strong><span>Jackpots</span></div>' +
      '<div class="stat-tile"><strong>' + s.level + '</strong><span>Level</span></div>' +
      '</div>';

    html += '<div class="panel"><div class="panel-title">High Rollers — biggest single win</div>' +
      highRollersHtml(highRollers) +
      '<p class="fine" style="margin-top:12px">Shared live with anyone who opens this preview. All-time, never resets.</p></div>';

    var daily = VV.engine.dailyStatus();
    html += '<div class="panel"><div class="panel-title">Daily bonus · day ' + daily.streakDay + '</div>';
    if (daily.claimed) {
      html += '<p class="fine">Come back tomorrow to keep the streak and grow the bonus.</p>';
    } else {
      html += '<p class="page-copy" style="margin:0 0 12px">Today’s bonus: <strong class="mono">' + fmt(daily.amount) + ' 🪙</strong></p>' +
        '<button class="btn btn-brass btn-block" data-action="claim-daily">Claim daily bonus</button>';
    }
    html += '</div>';

    html += '<div class="disclosure"><b>For entertainment only.</b> Coins and gems have no real-world value, cannot be exchanged for cash, and winning here has no bearing on any real game of chance. Please play responsibly.</div>';
    return html;
  }

  // ---------------- modal / toast ----------------
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.add("hidden"); }, 2600);
  }

  VV.render = {
    esc: esc, fmt: fmt, paintTopbar: paintTopbar, machinePicker: machinePicker,
    stage: stage, reelsHtml: reelsHtml, paytableHtml: paytableHtml,
    storeTab: storeTab, syndicateTab: syndicateTab, statsTab: statsTab, toast: toast
  };

  window.VV = VV;
})();
