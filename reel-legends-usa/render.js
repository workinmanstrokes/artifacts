// ============================================================
// REEL LEGENDS: USA — First-Person Renderer
// You never see yourself — the camera looks out across the water
// the way the angler actually sees it. Distance is faked with a
// classic compressed-perspective water plane; the bobber, any fish,
// and the fight all live on that same distance axis (t: 0 = right
// at the rod tip, 1 = out at the horizon).
// ============================================================

const LOGICAL_W = 160;
const LOGICAL_H = 110;
const HORIZON_RATIO = 0.4;
const PERSPECTIVE_POWER = 1.7;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function mixColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
}

class PixelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.width = LOGICAL_W;
    this.canvas.height = LOGICAL_H;
    this.loc = null;
    this.startTime = performance.now();
    this.horizonY = LOGICAL_H * HORIZON_RATIO;
    this.silhouettes = {
      whispering_pines: this._pineSilhouette,
      gatorback_canal: this._mangroveSilhouette,
      cascade_fork: this._mountainSilhouette,
      redfish_flats: this._flatsSilhouette,
      ironwater_gorge: this._peakSilhouette,
      muskie_bay: this._duneSilhouette,
    };
  }

  setLocation(loc) {
    this.loc = loc;
  }

  dayNightFactor() {
    // Slow cosmetic day/night cycle, ~5 minutes per full loop. 0 = full day, 1 = full night.
    const elapsed = (performance.now() - this.startTime) / 1000;
    const cycle = (elapsed % 300) / 300; // 0..1
    return (Math.cos(cycle * Math.PI * 2) + 1) / 2 * 0.75; // stays mostly day-ish, dips at "night"
  }

  // Projects a point on the water plane. t: 0 (at your feet) .. 1 (horizon).
  // lateral: desired sideways offset in near-plane pixels (shrinks with distance).
  project(t, lateral = 0) {
    const tc = clamp(t, 0, 1);
    const y = this.horizonY + (LOGICAL_H - 6 - this.horizonY) * Math.pow(tc, PERSPECTIVE_POWER);
    const scale = lerp(1.0, 0.24, tc);
    const x = LOGICAL_W * 0.5 + lateral * scale;
    return { x, y, scale };
  }

  draw(castState) {
    const ctx = this.ctx;
    const loc = this.loc;
    if (!loc) return;
    const night = this.dayNightFactor();
    const t = (performance.now() - this.startTime) / 1000;
    const inFight = castState && castState.phase === "fight";
    const shake = inFight && castState.fight ? castState.fight.shake || 0 : 0;

    ctx.save();
    if (shake > 0.001) {
      ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake * 0.6);
    }

    const horizonY = this.horizonY;

    // Sky
    const skyTop = mixColor(loc.palette.sky, loc.palette.skyNight, night);
    const skyBot = mixColor("#ffffff", loc.palette.sky, 0.3 - night * 0.3 < 0 ? 0 : 0.3 - night * 0.3);
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(-4, -4, LOGICAL_W + 8, horizonY + 4);

    // Sun/moon
    ctx.fillStyle = night > 0.5 ? "#e8ecf5" : "#fff6c9";
    const bodyX = LOGICAL_W - 24 - (night * 20);
    ctx.beginPath();
    ctx.arc(bodyX, horizonY * 0.4, 6, 0, Math.PI * 2);
    ctx.fill();

    // Distant land silhouette, sitting right on the horizon line
    const landFn = this.silhouettes[loc.id] || this._pineSilhouette;
    ctx.fillStyle = mixColor(loc.palette.land, "#0a0f0a", night * 0.6);
    landFn(ctx, horizonY);

    // Water plane, compressed toward the horizon (fake perspective)
    const waterColor = mixColor(loc.palette.water, loc.palette.waterNight, night);
    const waterDeep = mixColor(waterColor, "#020608", 0.55);
    const waterGrad = ctx.createLinearGradient(0, horizonY, 0, LOGICAL_H);
    waterGrad.addColorStop(0, waterDeep);
    waterGrad.addColorStop(1, waterColor);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, horizonY, LOGICAL_W, LOGICAL_H - horizonY);

    // Perspective wave rows: evenly spaced in "distance" (t), which bunches
    // them up near the horizon and spreads them out near the camera.
    const rows = 9;
    ctx.lineWidth = 1;
    for (let i = 0; i < rows; i++) {
      const rt = i / rows;
      const p = this.project(rt, 0);
      const rowScale = p.scale;
      ctx.strokeStyle = mixColor("#ffffff", waterColor, 0.35 + rt * 0.4);
      ctx.globalAlpha = 0.5 + rowScale * 0.4;
      ctx.beginPath();
      const step = 5;
      for (let x = -4; x <= LOGICAL_W + 4; x += step) {
        const wobble = Math.sin(x * 0.12 * (1 + rt) + t * 1.6 + i) * (0.6 + rowScale * 1.6);
        if (x === -4) ctx.moveTo(x, p.y + wobble); else ctx.lineTo(x, p.y + wobble);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Murky darkening + gentle vignette while a fish is actively fighting —
    // you're staring hard at one spot on the water.
    if (inFight) {
      const intensity = 0.12 + Math.min(0.35, (castState.fight.tension || 0) * 0.3);
      const vg = ctx.createRadialGradient(
        LOGICAL_W / 2, LOGICAL_H * 0.55, LOGICAL_H * 0.15,
        LOGICAL_W / 2, LOGICAL_H * 0.55, LOGICAL_H * 0.85
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(0,0,0,${intensity})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    // Your own rod, entering from the bottom-right corner of view (first person)
    this._drawOwnRod(ctx, castState);

    // Underwater fish candidate (patrolling / approaching) before the strike
    if (castState && castState.fish && (castState.phase === "wait" || castState.phase === "bite")) {
      this._drawFishShadow(ctx, castState, waterColor, t);
    }

    // Fishing line + bobber
    if (castState && castState.distT != null) {
      this._drawLineAndBobber(ctx, castState, waterColor, t);
    }

    // Fight overlay (tension/progress HUD + fish silhouette pulling)
    if (castState && castState.phase === "fight") {
      this._drawFightScene(ctx, castState, waterColor, t);
    }

    // Result fish leaping toward camera
    if (castState && castState.phase === "result" && castState.resultAnim != null) {
      this._drawResultFish(ctx, castState);
    }

    ctx.restore();
  }

  _drawOwnRod(ctx, castState) {
    const casting = castState && (castState.phase === "cast" || castState.phase === "wait" || castState.phase === "bite" || castState.phase === "fight");
    const tipX = LOGICAL_W * 0.62, tipY = LOGICAL_H - 8;
    const bendT = castState && castState.phase === "fight" ? clamp(castState.fight.tension || 0, 0, 1) : 0;
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W + 6, LOGICAL_H + 6);
    const midX = tipX + 10 - bendT * 6, midY = tipY - 14;
    ctx.quadraticCurveTo(midX + 6, midY + 10, tipX, tipY - 20 + bendT * 8);
    ctx.stroke();
    if (!casting) return;
  }

  _drawFishShadow(ctx, castState, waterColor, t) {
    const f = castState.fish;
    const bp = this.project(castState.distT, castState.lateral || 0);
    const drift = Math.sin(t * 1.6 + (f.driftSeed || 0)) * (10 * (1 - f.interest * 0.6)) * bp.scale;
    const closeness = f.state === "approaching" ? lerp(0.5, 0.05, f.approachT || 0) : lerp(0.9, 0.5, f.interest);
    const fx = bp.x + drift;
    const fy = bp.y + 3 * bp.scale;
    const len = (7 + (f.fightPower || 2) * 0.5) * bp.scale * (1.4 - closeness * 0.5);
    ctx.globalAlpha = 0.35 + f.interest * 0.35;
    ctx.fillStyle = mixColor("#05130f", waterColor, 0.25);
    ctx.beginPath();
    const wag = Math.sin(t * 6) * 1.4 * bp.scale;
    ctx.ellipse(fx, fy + wag * 0.2, len, len * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail flick
    ctx.beginPath();
    ctx.moveTo(fx - len, fy);
    ctx.lineTo(fx - len * 1.5, fy - len * 0.35 + wag);
    ctx.lineTo(fx - len * 1.5, fy + len * 0.35 + wag);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawLineAndBobber(ctx, castState, waterColor, t) {
    const p = this.project(castState.distT, castState.lateral || 0);
    const tipX = LOGICAL_W * 0.62 - 2, tipY = LOGICAL_H - 26;
    const bobPhase = castState.phase === "bite" ? 0 : Math.sin(t * 3) * 1.2;
    const dip = castState.biteDip || 0;
    const by = p.y + bobPhase * p.scale + dip * p.scale;

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo((tipX + p.x) / 2, tipY + 10, p.x, by);
    ctx.stroke();

    // ripple ring, sized to distance
    ctx.strokeStyle = mixColor("#ffffff", waterColor, 0.4);
    ctx.beginPath();
    ctx.ellipse(p.x, by + 2 * p.scale, (4 + Math.sin(t * 2)) * p.scale, 1.3 * p.scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // bobber
    const r = 2.6 * p.scale;
    ctx.fillStyle = "#e5453f";
    ctx.beginPath();
    ctx.arc(p.x, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(p.x - r, by - r * 0.25, r * 2, r * 0.5);

    if (castState.phase === "bite") {
      ctx.fillStyle = "#fff8d6";
      ctx.font = `${Math.max(6, 9 * p.scale)}px monospace`;
      ctx.fillText("!", p.x + 4 * p.scale, by - 6 * p.scale);
    }

    castState._bobberScreen = { x: p.x, y: by, scale: p.scale };
  }

  _drawFightScene(ctx, castState, waterColor, t) {
    const fight = castState.fight;
    if (!fight) return;
    const p = this.project(castState.distT * (1 - fight.progress * 0.5), castState.lateral || 0);

    // fish silhouette straining under the surface, pulling toward its mode
    const pull = fight.mode === "running" ? Math.sin(t * 14) * 3 : Math.sin(t * 3) * 1;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#04100c";
    const flen = 10 + (fight.fightPower || 4) * 0.6;
    ctx.beginPath();
    ctx.ellipse(p.x + pull, p.y + 4, flen * p.scale, flen * 0.36 * p.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // breach splash
    if (fight.breach && fight.breach > 0) {
      const bt = 1 - fight.breach;
      const jumpY = p.y - Math.sin(bt * Math.PI) * 14 * p.scale;
      ctx.fillStyle = "#0a1c16";
      ctx.beginPath();
      ctx.ellipse(p.x, jumpY, 6 * p.scale, 2.6 * p.scale, Math.sin(t * 20) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + t * 4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * 5 * p.scale, p.y + Math.sin(a) * 2 * p.scale);
        ctx.stroke();
      }
    }

    // ---- HUD: tension bar (right) ----
    const x = LOGICAL_W - 14, y = 10, h = LOGICAL_H - 34, w = 8;
    ctx.fillStyle = "rgba(20,20,20,0.55)";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const safeH = h * fight.safeZone;
    const safeY = y + (h - safeH) / 2;
    ctx.fillStyle = "rgba(120,220,120,0.55)";
    ctx.fillRect(x, safeY, w, safeH);
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x, y, w, h);
    const markerY = y + h - fight.tension * h;
    ctx.fillStyle = fight.tension > fight.breakCap ? "#ff5555" : "#fff";
    ctx.fillRect(x - 2, markerY - 1, w + 4, 2);

    // mode indicator tag above the bar
    ctx.font = "7px monospace";
    ctx.fillStyle = fight.mode === "running" ? "#ff8a5c" : fight.mode === "resting" ? "#7fe08a" : "#cfe8f5";
    const label = fight.mode === "running" ? "RUNNING!" : fight.mode === "resting" ? "tiring..." : "";
    if (label) ctx.fillText(label, x - 24, y - 3);

    // progress bar (bottom)
    const pw = LOGICAL_W - 24;
    ctx.fillStyle = "rgba(20,20,20,0.55)";
    ctx.fillRect(10, LOGICAL_H - 10, pw, 6);
    ctx.fillStyle = "#5fd0e8";
    ctx.fillRect(10, LOGICAL_H - 10, pw * fight.progress, 6);
    ctx.strokeStyle = "#eee";
    ctx.strokeRect(10, LOGICAL_H - 10, pw, 6);

    // stamina sliver (bottom, thinner, above progress)
    ctx.fillStyle = "rgba(20,20,20,0.5)";
    ctx.fillRect(10, LOGICAL_H - 16, pw, 3);
    ctx.fillStyle = "#f0c860";
    ctx.fillRect(10, LOGICAL_H - 16, pw * clamp(fight.stamina, 0, 1), 3);
  }

  _drawResultFish(ctx, castState) {
    const tt = castState.resultAnim;
    const anchor = castState._bobberScreen || { x: LOGICAL_W / 2, y: LOGICAL_H * 0.6, scale: 0.6 };
    const arcY = anchor.y - Math.sin(Math.min(tt, 1) * Math.PI) * 26 * anchor.scale;
    ctx.fillStyle = castState.resultColor || "#bcbcbc";
    ctx.beginPath();
    ctx.ellipse(anchor.x, arcY, 7, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(anchor.x - 7, arcY);
    ctx.lineTo(anchor.x - 10, arcY - 3);
    ctx.lineTo(anchor.x - 10, arcY + 3);
    ctx.fill();
  }

  // ---- silhouettes per region (drawn right at the horizon line) ----
  _pineSilhouette(ctx, baseY) {
    for (let x = -4; x < LOGICAL_W; x += 11) {
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 5, baseY - 10 - (x % 20));
      ctx.lineTo(x + 10, baseY);
      ctx.fill();
    }
  }
  _mangroveSilhouette(ctx, baseY) {
    ctx.fillRect(0, baseY - 4, LOGICAL_W, 4);
    for (let x = 0; x < LOGICAL_W; x += 14) {
      ctx.fillRect(x, baseY - 8, 3, 8);
      ctx.fillRect(x - 3, baseY - 9, 9, 3);
    }
  }
  _mountainSilhouette(ctx, baseY) {
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(20, baseY - 14);
    ctx.lineTo(45, baseY - 6);
    ctx.lineTo(70, baseY - 18);
    ctx.lineTo(100, baseY - 5);
    ctx.lineTo(130, baseY - 15);
    ctx.lineTo(LOGICAL_W, baseY - 4);
    ctx.lineTo(LOGICAL_W, baseY);
    ctx.fill();
  }
  _flatsSilhouette(ctx, baseY) {
    ctx.fillRect(0, baseY - 3, LOGICAL_W, 3);
    for (let x = 4; x < LOGICAL_W; x += 6) {
      ctx.fillRect(x, baseY - 5 - (x % 3), 1, 5);
    }
  }
  _peakSilhouette(ctx, baseY) {
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(15, baseY - 22);
    ctx.lineTo(30, baseY - 9);
    ctx.lineTo(55, baseY - 26);
    ctx.lineTo(80, baseY - 8);
    ctx.lineTo(100, baseY - 19);
    ctx.lineTo(LOGICAL_W, baseY - 6);
    ctx.lineTo(LOGICAL_W, baseY);
    ctx.fill();
    ctx.fillStyle = "#e8eef5";
    ctx.fillRect(13, baseY - 22, 4, 3);
    ctx.fillRect(53, baseY - 26, 4, 3);
  }
  _duneSilhouette(ctx, baseY) {
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= LOGICAL_W; x += 8) {
      ctx.lineTo(x, baseY - 4 - Math.sin(x * 0.08) * 3);
    }
    ctx.lineTo(LOGICAL_W, baseY);
    ctx.fill();
  }
}

if (typeof module !== "undefined") module.exports = { PixelRenderer, LOGICAL_W, LOGICAL_H };
