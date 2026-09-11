/* =====================================================================
   playground.js — 互動小玩具：點擊丟彈跳球（純 Canvas 2D）
   靈感來自 Idle Sweeper 的鐵球挖礦。之後可以換成任何你想放的互動 demo。
   ===================================================================== */
(function () {
  const canvas = document.getElementById('play-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#5ef2ff', '#ff5ea8', '#ffd75e', '#8dff5e', '#c78dff'];
  const G = 1400;          // 重力 px/s²
  const BOUNCE = 0.82;     // 反彈保留的速度
  const CELL = 22;         // 地面方塊大小
  const balls = [];
  let blocks = [];         // 底部的「礦層」
  let W = 0, H = 0, dpr = 1;
  let charging = null;     // { x, y, t0 }
  const particles = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBlocks();
  }
  function buildBlocks() {
    blocks = [];
    const cols = Math.ceil(W / CELL), rows = 5;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      blocks.push({ x: c * CELL, y: H - (rows - r) * CELL, hp: 1 + r, max: 1 + r });
    }
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 輸入 ----------
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', (e) => { const p = pos(e); charging = { ...p, t0: performance.now() }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (charging) { const p = pos(e); charging.x = p.x; charging.y = p.y; } });
  canvas.addEventListener('pointerup', () => {
    if (!charging) return;
    const power = Math.min((performance.now() - charging.t0) / 800, 1);   // 按越久越大顆
    const r = 5 + power * 14;
    balls.push({
      x: charging.x, y: charging.y, r,
      vx: (Math.random() - 0.5) * 300, vy: -100 - power * 500,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 12 + power * 8,
    });
    if (balls.length > 60) balls.shift();
    charging = null;
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'c' || e.key === 'C') { balls.length = 0; buildBlocks(); } });

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.4, color });
    }
  }

  // ---------- 更新 ----------
  function update(dt) {
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.vy += G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;

      // 左右牆
      if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * BOUNCE; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * BOUNCE; }
      // 頂
      if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * BOUNCE; }

      // 撞方塊：找球心下方的方塊
      let hit = false;
      for (const k of blocks) {
        if (k.hp <= 0) continue;
        if (b.x + b.r > k.x && b.x - b.r < k.x + CELL && b.y + b.r > k.y && b.y - b.r < k.y + CELL) {
          k.hp -= 1;
          burst(b.x, b.y, b.color, k.hp <= 0 ? 10 : 4);
          // 簡化：從上方碰到就往上彈
          b.y = k.y - b.r; b.vy = -Math.abs(b.vy) * BOUNCE; b.vx += (Math.random() - 0.5) * 80;
          hit = true; break;
        }
      }
      if (!hit && b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * BOUNCE; }

      if (b.life <= 0 || (Math.abs(b.vy) < 20 && b.y >= H - b.r - 1 && Math.abs(b.vx) < 5)) balls.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += G * 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    // 礦挖光了就再生
    if (blocks.every((k) => k.hp <= 0)) buildBlocks();
  }

  // ---------- 繪製 ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 網格底
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += CELL) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = H % CELL; y < H; y += CELL) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // 方塊（像素風：無抗鋸齒方形）
    for (const k of blocks) {
      if (k.hp <= 0) continue;
      const t = k.hp / k.max;
      ctx.fillStyle = `hsl(${200 + (1 - t) * 40}, 40%, ${18 + t * 20}%)`;
      ctx.fillRect(k.x + 1, k.y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(k.x + 1, k.y + 1, CELL - 2, 3);
    }

    // 粒子
    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // 球
    for (const b of balls) {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, Math.PI * 2); ctx.fill();
    }

    // 蓄力指示
    if (charging) {
      const power = Math.min((performance.now() - charging.t0) / 800, 1);
      ctx.strokeStyle = '#5ef2ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(charging.x, charging.y, 5 + power * 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(94,242,255,0.15)'; ctx.fill();
    }

    // 空白提示
    if (balls.length === 0 && !charging) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center';
      ctx.fillText('CLICK TO DROP A BALL', W / 2, H / 2 - 40);
    }
  }

  // ---------- 主迴圈（不在畫面上時暫停）----------
  let last = performance.now(), visible = false;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) { last = performance.now(); loop(); } }, { threshold: 0.05 }).observe(canvas);
  function loop() {
    if (!visible) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.033); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }
  draw();
})();
