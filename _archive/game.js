/**
 * Grassroots Green New Deal — simple 2D side-scroller
 * Theme: ordinary people protect the environment with wisdom & ingenuity
 * Message: 「草の音こそ消えない魔法」
 */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const overlay = document.getElementById("overlay");
  const messageEl = document.getElementById("message");
  const msgTitle = document.getElementById("msg-title");
  const msgBody = document.getElementById("msg-body");
  const btnStart = document.getElementById("btn-start");
  const btnAgain = document.getElementById("btn-again");

  // —— constants ——
  const GRAVITY = 0.55;
  const MOVE_SPEED = 3.4;
  const JUMP_V = -11.2;
  const FRICTION = 0.82;
  const TILE = 40;
  const WORLD_W = 72 * TILE; // ~2880px
  const GROUND_Y = H - 80;

  const KEYS = {};
const state = {
  mode: "title", // title | play | clear | fail
  cameraX: 0,
  score: { seed: 0, panel: 0, wisdom: 0 },
  totalItems: { seed: 0, panel: 0, wisdom: 0 },
  time: 0,
  particles: [],
  messageFlash: null,
  messageTimer: 0,
  isBoss: false,
};

/** @type {null | {
  x:number, y:number, w:number, h:number,
  name:string, purify:number, maxPurify:number,
  requiredType:string|null, active:boolean, label:string,
  anim:number
}} */
let boss = null;
function spawnBoss(x, y, name = "巨大スモッグ") {
  boss = {
    x,
    y,
    w: 90,
    h: 90,
    name,
    purify: 0,
    maxPurify: 100,
    requiredType: "wisdom",
    active: true,
    label: name,
    anim: 0,
  };
  state.isBoss = true;
  flashMsg(`${name}が現れた… 知恵で浄化しよう`);
}
// —— input ——
window.addEventListener("keydown", (e) => {

    KEYS[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    KEYS[e.code] = false;
  });

  // —— player ——
  const player = {
    x: 80,
    y: GROUND_Y - 48,
    w: 28,
    h: 44,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    invuln: 0,
    anim: 0,
  };

  // —— level geometry (platforms) ——
  /** @type {{x:number,y:number,w:number,h:number,kind?:string}[]} */
  let platforms = [];
  /** @type {{x:number,y:number,r:number,type:string,got:boolean,bob:number}[]} */
  let items = [];
  /** @type {{x:number,y:number,w:number,h:number,vx:number,minX:number,maxX:number,label:string}[]} */
  let hazards = [];
  /** goal tree */
  let goal = { x: 0, y: 0, w: 48, h: 100 };

  function buildLevel() {
    platforms = [];
    items = [];
    hazards = [];
    state.score = { seed: 0, panel: 0, wisdom: 0 };
    state.totalItems = { seed: 0, panel: 0, wisdom: 0 };
    state.particles = [];
    state.cameraX = 0;
    state.time = 0;
    state.messageFlash = null;
    state.messageTimer = 0;

    // Main ground strips with gaps
    const groundH = 80;
    // Continuous ground mostly, with a few pits
    addPlat(0, GROUND_Y, 14 * TILE, groundH, "soil");
    addPlat(16 * TILE, GROUND_Y, 10 * TILE, groundH, "soil");
    addPlat(28 * TILE, GROUND_Y, 12 * TILE, groundH, "soil");
    addPlat(42 * TILE, GROUND_Y, 8 * TILE, groundH, "soil");
    addPlat(52 * TILE, GROUND_Y, 20 * TILE, groundH, "soil");

    // Floating platforms (community gardens, rooftops, bridges)
    addPlat(5 * TILE, GROUND_Y - 100, 3 * TILE, 16, "wood");
    addPlat(10 * TILE, GROUND_Y - 160, 2.5 * TILE, 16, "wood");
    addPlat(18 * TILE, GROUND_Y - 120, 3 * TILE, 16, "wood");
    addPlat(24 * TILE, GROUND_Y - 180, 2 * TILE, 16, "wood");
    addPlat(32 * TILE, GROUND_Y - 110, 4 * TILE, 16, "wood");
    addPlat(38 * TILE, GROUND_Y - 170, 2.5 * TILE, 16, "wood");
    addPlat(46 * TILE, GROUND_Y - 130, 3 * TILE, 16, "wood");
    addPlat(55 * TILE, GROUND_Y - 100, 3 * TILE, 16, "wood");
    addPlat(60 * TILE, GROUND_Y - 160, 4 * TILE, 16, "wood");

    // Items: seeds, solar panels, wisdom notes
    const seedSpots = [
      [3.5, -20], [6.5, -120], [11, -180], [19.5, -140],
      [25, -200], [30, -20], [34, -130], [39, -190],
      [48, -150], [56.5, -120], [62, -180], [66, -20],
    ];
    seedSpots.forEach(([tx, oy], i) => {
      addItem(tx * TILE + 10, GROUND_Y + oy - 20, "seed");
    });

    const panelSpots = [
      [8, -20], [20, -20], [33.5, -130], [47, -20], [61, -180],
    ];
    panelSpots.forEach(([tx, oy]) => {
      addItem(tx * TILE + 8, GROUND_Y + oy - 22, "panel");
    });

    const wisdomSpots = [
      [12, -20], [26, -200], [40, -20], [58, -120],
    ];
    wisdomSpots.forEach(([tx, oy]) => {
      addItem(tx * TILE + 8, GROUND_Y + oy - 22, "wisdom");
    });

    // Soft "obstacles": smog blobs / waste that you avoid (not fight)
    // They patrol — represent problems to work around with ingenuity
    addHazard(15.2 * TILE, GROUND_Y - 36, 36, 36, 1.1, 14.5 * TILE, 20 * TILE, "スモッグ");
    addHazard(29 * TILE, GROUND_Y - 36, 36, 36, 1.4, 28 * TILE, 35 * TILE, "廃水");
    addHazard(44 * TILE, GROUND_Y - 36, 36, 36, 1.2, 42.5 * TILE, 49 * TILE, "ゴミ");
    addHazard(54 * TILE, GROUND_Y - 120, 32, 32, 0.9, 52 * TILE, 58 * TILE, "排気");

    // Goal: community tree
    goal = {
      x: 68 * TILE,
      y: GROUND_Y - 100,
      w: 56,
      h: 100,
    };

    // Reset player
    player.x = 80;
    player.y = GROUND_Y - 48;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.invuln = 0;
    player.anim = 0;
  }

  function addPlat(x, y, w, h, kind) {
    platforms.push({ x, y, w, h, kind: kind || "soil" });
  }

  function addItem(x, y, type) {
    items.push({ x, y, r: 12, type, got: false, bob: Math.random() * Math.PI * 2 });
    state.totalItems[type]++;
  }

  function addHazard(x, y, w, h, speed, minX, maxX, label) {
    hazards.push({
      x, y, w, h,
      vx: speed,
      minX, maxX,
      label,
    });
  }

  // —— physics helpers ——
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function circleRect(cx, cy, r, rect) {
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function updatePlayer() {
    const left = KEYS["ArrowLeft"] || KEYS["KeyA"];
    const right = KEYS["ArrowRight"] || KEYS["KeyD"];
    const jump = KEYS["Space"] || KEYS["ArrowUp"] || KEYS["KeyW"];

    if (left) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    } else if (right) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.08) player.vx = 0;
    }

    if (jump && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      spawnDust(player.x + player.w / 2, player.y + player.h, 4, "#8a9a6a");
    }

    player.vy += GRAVITY;
    if (player.vy > 14) player.vy = 14;

    // Horizontal
    player.x += player.vx;
    resolvePlatforms("x");

    // Vertical
    player.y += player.vy;
    player.onGround = false;
    resolvePlatforms("y");

    // World bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > WORLD_W) player.x = WORLD_W - player.w;

    // Fall into pit
    if (player.y > H + 80) {
      failGame("足場を踏み外してしまった…\n知恵と工夫で、もう一度挑戦しよう。");
      return;
    }

    if (player.invuln > 0) player.invuln--;
    player.anim += Math.abs(player.vx) > 0.5 && player.onGround ? 0.2 : 0.05;
  }

  function resolvePlatforms(axis) {
    const p = player;
    for (const plat of platforms) {
      if (!rectsOverlap(p, plat)) continue;
      if (axis === "x") {
        if (p.vx > 0) p.x = plat.x - p.w;
        else if (p.vx < 0) p.x = plat.x + plat.w;
        p.vx = 0;
      } else {
        if (p.vy > 0) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0) {
          p.y = plat.y + plat.h;
          p.vy = 0;
        }
      }
    }
  }

  function updateHazards() {
    for (const h of hazards) {
      h.x += h.vx;
      if (h.x < h.minX) {
        h.x = h.minX;
        h.vx *= -1;
      }
      if (h.x + h.w > h.maxX) {
        h.x = h.maxX - h.w;
        h.vx *= -1;
      }

      if (player.invuln > 0) continue;
      if (rectsOverlap(player, h)) {
        // Knock back, brief invuln — not instant death (hopeful/realistic)
        player.vx = player.facing * -4;
        player.vy = -6;
        player.invuln = 70;
        spawnDust(player.x + player.w / 2, player.y + player.h / 2, 8, "#888");
        flashMsg("環境の問題にぶつかった… 迂回して知恵を集めよう");
      }
    }
  }

  function updateItems() {
    const pr = {
      x: player.x,
      y: player.y,
      w: player.w,
      h: player.h,
    };
    for (const it of items) {
      if (it.got) continue;
      it.bob += 0.06;
      const cy = it.y + Math.sin(it.bob) * 4;
      if (circleRect(it.x, cy, it.r + 4, pr)) {
        it.got = true;
        state.score[it.type]++;
        const colors = {
          seed: "#7ec850",
          panel: "#f0c040",
          wisdom: "#6a9fd4",
        };
        spawnDust(it.x, cy, 10, colors[it.type] || "#fff");
        const labels = {
          seed: "種をまいた — 緑が広がる",
          panel: "太陽光パネル — まちのエネルギー",
          wisdom: "知恵のノート — 草の根の工夫",
        };
        flashMsg(labels[it.type] || "収集！");
      }
    }
  }

  function checkGoal() {
    if (rectsOverlap(player, goal)) {
      clearGame();
    }
  }

  function flashMsg(text) {
    state.messageFlash = text;
    state.messageTimer = 120;
  }

  function spawnDust(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      state.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 30 + Math.random() * 20,
        max: 50,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life--;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  // —— drawing ——
  function drawBackground() {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#7eb3d0");
    g.addColorStop(0.45, "#b8d4c0");
    g.addColorStop(1, "#d8e8c8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Soft sun
    const sunX = W * 0.78 - state.cameraX * 0.05;
    ctx.beginPath();
    ctx.arc(sunX, 70, 36, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(240, 215, 140, 0.9)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX, 70, 52, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(240, 215, 140, 0.25)";
    ctx.fill();

    // Distant hills (parallax)
    drawHills(0.15, "#9bc48a", 180);
    drawHills(0.28, "#7aaf68", 120);
    drawHills(0.4, "#5e9450", 70);

    // Subtle grass sway hint lines near ground (atmospheric)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = "#3d6b35";
    ctx.lineWidth = 1;
    const t = state.time * 0.04;
    for (let i = 0; i < 40; i++) {
      const gx = ((i * 97) % (W + 40)) - 20 - (state.cameraX * 0.5) % 40;
      const baseY = GROUND_Y - 8;
      ctx.beginPath();
      ctx.moveTo(gx, baseY);
      ctx.quadraticCurveTo(gx + Math.sin(t + i) * 4, baseY - 10, gx + Math.sin(t + i * 0.7) * 6, baseY - 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHills(parallax, color, baseLift) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const offset = -state.cameraX * parallax;
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 20) {
      const wx = x + offset;
      const y =
        GROUND_Y -
        baseLift +
        Math.sin(wx * 0.008) * 28 +
        Math.sin(wx * 0.003 + 1) * 40;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlatforms() {
    for (const plat of platforms) {
      const sx = plat.x - state.cameraX;
      if (sx + plat.w < -20 || sx > W + 20) continue;

      if (plat.kind === "soil") {
        // Soil block
        ctx.fillStyle = "#5a6e42";
        ctx.fillRect(sx, plat.y, plat.w, plat.h);
        // Grass top
        ctx.fillStyle = "#6a9e4e";
        ctx.fillRect(sx, plat.y, plat.w, 10);
        // Grass blades
        ctx.strokeStyle = "#4d8538";
        ctx.lineWidth = 1.5;
        const t = state.time * 0.05;
        for (let x = sx + 4; x < sx + plat.w; x += 8) {
          const sway = Math.sin(t + x * 0.1) * 2;
          ctx.beginPath();
          ctx.moveTo(x, plat.y + 2);
          ctx.lineTo(x + sway, plat.y - 6 - (x % 3));
          ctx.stroke();
        }
        // Dirt texture
        ctx.fillStyle = "rgba(60, 50, 30, 0.15)";
        for (let i = 0; i < plat.w / 20; i++) {
          ctx.fillRect(sx + i * 22 + 4, plat.y + 20 + (i % 3) * 12, 6, 4);
        }
      } else {
        // Wooden community platform
        ctx.fillStyle = "#a08050";
        ctx.fillRect(sx, plat.y, plat.w, plat.h);
        ctx.fillStyle = "#8a6a3e";
        ctx.fillRect(sx, plat.y, plat.w, 4);
        ctx.strokeStyle = "#6a5030";
        ctx.lineWidth = 1;
        for (let x = sx + 12; x < sx + plat.w; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, plat.y);
          ctx.lineTo(x, plat.y + plat.h);
          ctx.stroke();
        }
        // Supports
        ctx.fillStyle = "#7a6038";
        ctx.fillRect(sx + 4, plat.y + plat.h, 4, 12);
        ctx.fillRect(sx + plat.w - 8, plat.y + plat.h, 4, 12);
      }
    }
  }

  function drawItems() {
    for (const it of items) {
      if (it.got) continue;
      const sx = it.x - state.cameraX;
      const sy = it.y + Math.sin(it.bob) * 4;
      if (sx < -30 || sx > W + 30) continue;

      ctx.save();
      ctx.translate(sx, sy);

      if (it.type === "seed") {
        // Sprout / seed
        ctx.fillStyle = "#8b6914";
        ctx.beginPath();
        ctx.ellipse(0, 4, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#4a8a30";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.quadraticCurveTo(-4, -6, -8, -10);
        ctx.moveTo(0, 2);
        ctx.quadraticCurveTo(4, -6, 8, -10);
        ctx.stroke();
        ctx.fillStyle = "#6ec040";
        ctx.beginPath();
        ctx.ellipse(-8, -10, 5, 3, -0.5, 0, Math.PI * 2);
        ctx.ellipse(8, -10, 5, 3, 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.type === "panel") {
        // Solar panel
        ctx.fillStyle = "#3a5a80";
        ctx.fillRect(-10, -8, 20, 14);
        ctx.strokeStyle = "#2a4060";
        ctx.lineWidth = 1;
        ctx.strokeRect(-10, -8, 20, 14);
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 6);
        ctx.moveTo(-10, -1);
        ctx.lineTo(10, -1);
        ctx.stroke();
        ctx.fillStyle = "rgba(180, 220, 255, 0.35)";
        ctx.fillRect(-9, -7, 8, 5);
        // Stand
        ctx.fillStyle = "#666";
        ctx.fillRect(-2, 6, 4, 6);
      } else {
        // Wisdom notebook
        ctx.fillStyle = "#f5f0e0";
        ctx.fillRect(-9, -11, 18, 22);
        ctx.strokeStyle = "#5a7a9a";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-9, -11, 18, 22);
        ctx.fillStyle = "#6a9fd4";
        ctx.fillRect(-9, -11, 4, 22);
        ctx.strokeStyle = "#a0b0c0";
        ctx.lineWidth = 1;
        for (let ly = -6; ly < 8; ly += 4) {
          ctx.beginPath();
          ctx.moveTo(-3, ly);
          ctx.lineTo(6, ly);
          ctx.stroke();
        }
      }

      // Soft glow
      ctx.globalAlpha = 0.2 + Math.sin(it.bob * 2) * 0.1;
      ctx.fillStyle = it.type === "seed" ? "#8f8" : it.type === "panel" ? "#ff8" : "#8af";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHazards() {
    for (const h of hazards) {
      const sx = h.x - state.cameraX;
      if (sx + h.w < -20 || sx > W + 20) continue;
      const t = state.time * 0.08;

      ctx.save();
      ctx.translate(sx + h.w / 2, h.y + h.h / 2);
      ctx.globalAlpha = 0.75;

      // Soft blob (pollution — not a cartoon villain, just a problem)
      const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, h.w / 2 + 4);
      gr.addColorStop(0, "rgba(120, 120, 130, 0.9)");
      gr.addColorStop(0.6, "rgba(90, 95, 100, 0.6)");
      gr.addColorStop(1, "rgba(70, 75, 80, 0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        const r = h.w / 2 + Math.sin(t * 2 + i) * 3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Label
      ctx.fillStyle = "rgba(40,40,40,0.5)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(h.label, sx + h.w / 2, h.y - 4);
    }
  }

  function drawGoal() {
    const sx = goal.x - state.cameraX;
    const sy = goal.y;
    if (sx + goal.w < -40 || sx > W + 40) return;

    // Trunk
    ctx.fillStyle = "#6b4e2e";
    ctx.fillRect(sx + goal.w / 2 - 8, sy + 40, 16, 60);

    // Canopy
    ctx.fillStyle = "#3d8a3a";
    ctx.beginPath();
    ctx.arc(sx + goal.w / 2, sy + 30, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4ea04a";
    ctx.beginPath();
    ctx.arc(sx + goal.w / 2 - 14, sy + 40, 22, 0, Math.PI * 2);
    ctx.arc(sx + goal.w / 2 + 14, sy + 40, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5ab852";
    ctx.beginPath();
    ctx.arc(sx + goal.w / 2, sy + 18, 20, 0, Math.PI * 2);
    ctx.fill();

    // Flag / sign
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(sx + goal.w / 2 + 10, sy + 55, 40, 18);
    ctx.strokeStyle = "#2f5c34";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + goal.w / 2 + 10, sy + 55, 40, 18);
    ctx.fillStyle = "#2f5c34";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("まちの木", sx + goal.w / 2 + 30, sy + 67);

    // Sparkle
    if (Math.sin(state.time * 0.1) > 0.3) {
      ctx.fillStyle = "rgba(255,255,200,0.7)";
      ctx.beginPath();
      ctx.arc(sx + 12, sy + 20, 2, 0, Math.PI * 2);
      ctx.arc(sx + goal.w - 8, sy + 35, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    const sx = player.x - state.cameraX;
    const sy = player.y;
    const blink = player.invuln > 0 && Math.floor(player.invuln / 4) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(sx + player.w / 2, sy + player.h / 2);
    ctx.scale(player.facing, 1);

    // Body — ordinary person in work clothes / green scarf (grassroots activist)
    // Legs
    const legSwing = player.onGround && Math.abs(player.vx) > 0.5
      ? Math.sin(player.anim * 2) * 5
      : 0;
    ctx.fillStyle = "#3a4a5a";
    ctx.fillRect(-8, 8, 6, 14 + legSwing * 0.2);
    ctx.fillRect(2, 8, 6, 14 - legSwing * 0.2);

    // Torso
    ctx.fillStyle = "#5a8f4a";
    ctx.fillRect(-10, -8, 20, 20);

    // Scarf
    ctx.fillStyle = "#e8c050";
    ctx.fillRect(-10, -8, 20, 5);
    ctx.fillRect(player.facing > 0 ? 6 : -10, -4, 6, 12);

    // Head
    ctx.fillStyle = "#e8c8a8";
    ctx.beginPath();
    ctx.arc(0, -16, 9, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = "#4a3a28";
    ctx.beginPath();
    ctx.arc(0, -20, 8, Math.PI, 0);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(2, -17, 2, 2);
    ctx.fillRect(5, -17, 2, 2);

    // Arms
    ctx.fillStyle = "#5a8f4a";
    const armY = player.onGround ? Math.sin(player.anim * 2) * 3 : -4;
    ctx.fillRect(-14, -4 + armY, 5, 12);
    ctx.fillRect(9, -4 - armY, 5, 12);

    // Hand holding a small seedling when moving
    if (Math.abs(player.vx) > 0.3 || !player.onGround) {
      ctx.fillStyle = "#6ec040";
      ctx.beginPath();
      ctx.ellipse(12, 6 - armY, 3, 2, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(sx + player.w / 2, player.y + player.h + 2, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = p.life / p.max;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - state.cameraX, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    // Top bar
    ctx.fillStyle = "rgba(36, 48, 31, 0.55)";
    ctx.fillRect(0, 0, W, 36);

    ctx.font = "13px 'Segoe UI', Meiryo, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f4f1e8";

    const s = state.score;
    const t = state.totalItems;
    ctx.fillText(`🌱 種 ${s.seed}/${t.seed}`, 16, 23);
    ctx.fillText(`☀️ パネル ${s.panel}/${t.panel}`, 140, 23);
    ctx.fillText(`📘 知恵 ${s.wisdom}/${t.wisdom}`, 280, 23);

    // Message flash
    if (state.messageTimer > 0 && state.messageFlash) {
      state.messageTimer--;
      const a = Math.min(1, state.messageTimer / 30);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(244, 241, 232, 0.92)";
      const tw = ctx.measureText(state.messageFlash).width;
      const bx = W / 2 - tw / 2 - 16;
      ctx.fillRect(bx, 48, tw + 32, 28);
      ctx.strokeStyle = "#2f5c34";
      ctx.strokeRect(bx, 48, tw + 32, 28);
      ctx.fillStyle = "#2f5c34";
      ctx.textAlign = "center";
      ctx.fillText(state.messageFlash, W / 2, 67);
      ctx.globalAlpha = 1;
    }

    // Mini progress (camera position)
    const progress = Math.min(1, (player.x + player.w) / WORLD_W);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(W - 120, 14, 100, 8);
    ctx.fillStyle = "#7ec850";
    ctx.fillRect(W - 120, 14, 100 * progress, 8);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.strokeRect(W - 120, 14, 100, 8);
  }

  function draw() {
    drawBackground();
    drawPlatforms();
    drawGoal();
    drawItems();
    drawHazards();
    drawPlayer();
    drawParticles();
    drawHUD();
  }

  // —— game flow ——
  function startGame() {
    buildLevel();
    state.mode = "play";
    overlay.classList.add("hidden");
    messageEl.classList.add("hidden");
  }

  function clearGame() {
    if (state.mode !== "play") return;
    state.mode = "clear";
    const s = state.score;
    const t = state.totalItems;
    const total = s.seed + s.panel + s.wisdom;
    const max = t.seed + t.panel + t.wisdom;
    msgTitle.textContent = "草の音こそ消えない魔法";
    msgBody.innerHTML =
      `まちの木にたどり着いた。<br /><br />` +
      `種 ${s.seed}/${t.seed} · パネル ${s.panel}/${t.panel} · 知恵 ${s.wisdom}/${t.wisdom}<br />` +
      `（収集 ${total}/${max}）<br /><br />` +
      `特別な力はいらない。<br />` +
      `<strong>草の根の人々の知恵と工夫</strong>が、<br />` +
      `環境を守り、未来をつくる。<br /><br />` +
      `<em style="color:#2f5c34">草の音こそ消えない魔法</em>`;
    messageEl.classList.remove("hidden");
  }

  function failGame(reason) {
    if (state.mode !== "play") return;
    state.mode = "fail";
    msgTitle.textContent = "もう一度、草の根から";
    msgBody.innerHTML = reason.replace(/\n/g, "<br />") +
      `<br /><br /><em style="color:#5a6a52">失敗も、学びの一部だ。</em>`;
    messageEl.classList.remove("hidden");
  }

  function update() {
    if (state.mode !== "play") return;
    state.time++;
    updatePlayer();
    if (state.mode !== "play") return;
    updateHazards();
    updateItems();
    updateParticles();
    checkGoal();

    // Camera follow
    const target = player.x + player.w / 2 - W * 0.35;
    state.cameraX += (target - state.cameraX) * 0.12;
    if (state.cameraX < 0) state.cameraX = 0;
    if (state.cameraX > WORLD_W - W) state.cameraX = Math.max(0, WORLD_W - W);
  }

  function loop() {
    update();
    if (state.mode === "play" || state.mode === "clear" || state.mode === "fail") {
      // Still draw world under overlays when finished
      if (state.mode === "play") draw();
      else {
        draw();
      }
    } else {
      // Title: gentle idle preview
      state.time++;
      state.cameraX = (Math.sin(state.time * 0.01) * 0.5 + 0.5) * 200;
      // Minimal preview scene without full player update
      drawBackground();
      // Draw a soft title scene silhouette of grass
      ctx.fillStyle = "#5a8f4a";
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = "#6a9e4e";
      for (let x = 0; x < W; x += 6) {
        const h = 8 + Math.sin(x * 0.1 + state.time * 0.05) * 4;
        ctx.fillRect(x, GROUND_Y - h, 3, h);
      }
      ctx.fillStyle = "rgba(36,48,31,0.35)";
      ctx.font = "bold 22px 'Segoe UI', Meiryo, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("草の音こそ消えない魔法", W / 2, H * 0.42);
    }
    requestAnimationFrame(loop);
  }

  btnStart.addEventListener("click", startGame);
  btnAgain.addEventListener("click", startGame);

  // Build once for title preview geometry not needed
  buildLevel();
  loop();
})();
