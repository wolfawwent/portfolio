/* =====================================================================
   bg.js — 全頁背景（純 WebGL，不需要任何函式庫）

   兩層貼圖：
     assets/img/bg-tile_bg.png  底層，固定不動
     assets/img/bg-tile.png     磚塊層，持續往左上緩慢移動（透明處露出底層）
   游標 = 火把：游標周圍一圈的磚塊會微微亮起（帶一點暖色與輕微閃爍）

   ・移動是連續的次像素位移，不是一格一格跳
   ・「銳利雙線性」取樣：像素保持硬邊，邊界有 1 螢幕像素的平滑，慢速移動不會抖
   想調整 → 改下面 CONFIG 就好。
   ===================================================================== */
(function () {
  const CONFIG = {
    tileImage: 'assets/img/bg-tile.png',
    bgImage:   'assets/img/bg-tile_bg.png',
    TILE_SCALE: 5,             // 圖片放大倍數（CSS 像素）
    SPEED_X: 18,               // 磚塊層每秒往左移動幾個 CSS 像素
    SPEED_Y: 18,               // 磚塊層每秒往上移動幾個 CSS 像素
    TINT: [1.0, 1.0, 1.0],     // 磚塊亮度 / 染色（1.0 = 原圖）
    BG_TINT: [1.0, 1.0, 1.0],  // 底層亮度 / 染色

    // --- 火把 ---
    LIGHT_RADIUS: 240,         // 亮起的半徑（CSS 像素）
    LIGHT_STRENGTH: 0.10,      // 亮度上限（0.10 = 最亮處加 10%，很含蓄）
    LIGHT_COLOR: [1.0, 0.72, 0.42],   // 火光暖色
    LIGHT_FLICKER: 0.25,       // 閃爍幅度 0~1（0 = 不閃）
    LIGHT_FOLLOW: 0.12,        // 游標跟隨的平滑程度（越小越慢越柔）

    // --- 螢火蟲（橘色小方塊，緩慢隨機飛行，會照亮附近磚塊）---
    FLY_COUNT: 10,             // 數量（最多 16）
    FLY_SIZE: [3, 8],          // 方塊（內核）邊長範圍（CSS 像素）；外圈會再大一倍
    FLY_SPEED: [12, 30],       // 飛行速度範圍（CSS 像素 / 秒）
    FLY_COLOR: [0.45, 0.85, 1.0],     // 方塊顏色（鬼火藍）
    FLY_GLOW_RADIUS: 70,       // 照亮磚塊的半徑（CSS 像素）
    FLY_GLOW_STRENGTH: 0.16,   // 照亮強度
  };
  const FLY_MAX = 16;

  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.style.background = '#000'; return; }

  // ---------- shaders ----------
  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;
  const FRAG = `
    precision mediump float;
    uniform sampler2D u_tile;
    uniform sampler2D u_bg;
    uniform vec2  u_tileSize;   // 一塊磚圖放大後的裝置像素尺寸
    uniform vec2  u_offset;     // 磚塊層位移（裝置像素）
    uniform vec2  u_texSize;    // 原圖像素尺寸（64×64）
    uniform float u_texelPerPx; // 一個螢幕像素等於幾個原圖像素
    uniform vec3  u_tint;
    uniform vec3  u_bgTint;
    uniform vec2  u_light;      // 火把位置（裝置像素，y 向上）
    uniform float u_lightRadius;
    uniform float u_lightStrength;
    uniform vec3  u_lightColor;
    uniform vec4  u_fly[16];    // x, y（裝置像素）, 邊長（裝置像素）, 亮度 0~1
    uniform int   u_flyCount;
    uniform vec3  u_flyColor;
    uniform float u_flyRadius;
    uniform float u_flyStrength;

    // 銳利雙線性：只在原圖像素邊界一個螢幕像素寬的範圍內做漸變
    vec2 sharpUV(vec2 texel) {
      vec2 f = fract(texel);
      vec2 w = vec2(u_texelPerPx);
      vec2 fs = clamp(f / w, 0.0, 0.5) + clamp((f - 1.0) / w + 0.5, 0.0, 0.5);
      return (floor(texel) + fs) / u_texSize;
    }

    void main() {
      // 底層：固定不動
      vec2 tb = gl_FragCoord.xy / u_tileSize * u_texSize;
      tb.y = -tb.y;
      vec4 b = texture2D(u_bg, sharpUV(tb));
      vec3 col = b.rgb * u_bgTint;

      // 磚塊層：移動
      vec2 tt = (gl_FragCoord.xy + u_offset) / u_tileSize * u_texSize;
      tt.y = -tt.y;
      vec4 t = texture2D(u_tile, sharpUV(tt));   // 已預乘 alpha
      col = col * (1.0 - t.a) + t.rgb * u_tint;

      // 火把：只照亮磚塊（t.a），由中心往外平滑衰減
      float d = distance(gl_FragCoord.xy, u_light) / u_lightRadius;
      float glow = 1.0 - smoothstep(0.0, 1.0, d);
      glow = glow * glow;                          // 中心集中一點
      col += u_lightColor * (glow * u_lightStrength * t.a);

      // 螢火蟲：先把每隻對磚塊的照明加上去，再畫方塊本體（方塊在最上層）
      float body = 0.0, ring = 0.0;
      for (int i = 0; i < 16; i++) {
        if (i >= u_flyCount) break;
        vec4 f = u_fly[i];
        vec2 dv = gl_FragCoord.xy - f.xy;
        float fd = length(dv) / u_flyRadius;
        float fg = 1.0 - smoothstep(0.0, 1.0, fd);
        col += u_flyColor * (fg * fg * u_flyStrength * f.w * t.a);
        // 蟲體：兩圈硬邊正方形 —— 內核亮橘、外圈暗橘，永遠可見（不受磚塊 / 縫隙影響）
        vec2 a = abs(dv);
        float inner = step(a.x, f.z * 0.5) * step(a.y, f.z * 0.5);
        float outer = step(a.x, f.z * 1.0) * step(a.y, f.z * 1.0);
        ring = max(ring, outer);
        body = max(body, inner);
      }
      col = mix(col, u_flyColor * 0.62, ring);          // 外圈：暗橘
      col = mix(col, u_flyColor * 1.10, body);          // 內核：亮橘

      gl_FragColor = vec4(col, 1.0);
    }
  `;
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('[bg]', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(prog, n);
  const U = {
    tile: u('u_tile'), bg: u('u_bg'), tileSize: u('u_tileSize'), offset: u('u_offset'),
    texSize: u('u_texSize'), texelPerPx: u('u_texelPerPx'), tint: u('u_tint'), bgTint: u('u_bgTint'),
    light: u('u_light'), lightRadius: u('u_lightRadius'), lightStrength: u('u_lightStrength'), lightColor: u('u_lightColor'),
    fly: u('u_fly'), flyCount: u('u_flyCount'), flyColor: u('u_flyColor'), flyRadius: u('u_flyRadius'), flyStrength: u('u_flyStrength'),
  };
  gl.uniform3fv(U.flyColor, CONFIG.FLY_COLOR);
  gl.uniform3fv(U.tint, CONFIG.TINT);
  gl.uniform3fv(U.bgTint, CONFIG.BG_TINT);
  gl.uniform3fv(U.lightColor, CONFIG.LIGHT_COLOR);

  // ---------- 貼圖 ----------
  let imgW = 64, imgH = 64;
  function makeTexture(unit, url, onSize) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const img = new Image();
    img.onload = () => {
      if (onSize) onSize(img.naturalWidth, img.naturalHeight);
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);   // 預乘 alpha：邊緣不會出現黑邊
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    };
    img.src = url;
    return tex;
  }
  makeTexture(0, CONFIG.tileImage, (w, h) => { imgW = w; imgH = h; });
  makeTexture(1, CONFIG.bgImage);
  gl.uniform1i(U.tile, 0);
  gl.uniform1i(U.bg, 1);

  // ---------- 尺寸 ----------
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 游標（火把）----------
  // 目標位置與顯示位置分開，每幀往目標靠近一點 → 火光柔柔地跟著游標
  const light = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, ton: 0 };
  window.addEventListener('pointermove', (e) => {
    light.tx = e.clientX; light.ty = e.clientY; light.ton = 1;
    if (light.x < -1000) { light.x = light.tx; light.y = light.ty; }   // 第一次直接跳到位
  }, { passive: true });
  document.addEventListener('pointerleave', () => { light.ton = 0; });
  document.addEventListener('mouseleave', () => { light.ton = 0; });

  // ---------- 螢火蟲 ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const flies = [];
  function spawnFly() {
    return {
      x: rand(0, window.innerWidth), y: rand(0, window.innerHeight),
      size: Math.round(rand(CONFIG.FLY_SIZE[0], CONFIG.FLY_SIZE[1])),
      angle: rand(0, Math.PI * 2), speed: rand(CONFIG.FLY_SPEED[0], CONFIG.FLY_SPEED[1]),
      turn: 0, phase: rand(0, Math.PI * 2), pulse: rand(0.6, 1.4),
    };
  }
  for (let i = 0; i < Math.min(CONFIG.FLY_COUNT, FLY_MAX); i++) flies.push(spawnFly());
  const flyBuf = new Float32Array(FLY_MAX * 4);
  function updateFlies(dt, t) {
    const W = window.innerWidth, H = window.innerHeight, m = 40;   // m：超出畫面多少後從另一邊回來
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      // 轉向速度緩慢隨機變化 → 像蟲子飄來飄去的曲線，而不是直線或抖動
      f.turn += (Math.random() - 0.5) * dt * 3;
      f.turn = Math.max(-1.2, Math.min(1.2, f.turn)) * 0.98;
      f.angle += f.turn * dt;
      f.x += Math.cos(f.angle) * f.speed * dt;
      f.y += Math.sin(f.angle) * f.speed * dt * 0.7;   // 垂直方向慢一點
      if (f.x < -m) f.x = W + m; if (f.x > W + m) f.x = -m;
      if (f.y < -m) f.y = H + m; if (f.y > H + m) f.y = -m;
      // 亮度慢慢呼吸（每隻節奏不同）
      const b = 0.55 + 0.45 * Math.sin(t * f.pulse + f.phase);
      flyBuf[i * 4] = f.x * dpr;
      flyBuf[i * 4 + 1] = canvas.height - f.y * dpr;   // GL 的 y 向上
      flyBuf[i * 4 + 2] = Math.max(1, Math.round(f.size * dpr));
      flyBuf[i * 4 + 3] = b;
    }
  }

  // ---------- 動畫 ----------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); frame(); } });

  let last = performance.now();
  let ox = 0, oy = 0;
  function frame() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!reduceMotion) { ox += CONFIG.SPEED_X * dt; oy -= CONFIG.SPEED_Y * dt; }
    const tileW = imgW * CONFIG.TILE_SCALE * dpr, tileH = imgH * CONFIG.TILE_SCALE * dpr;
    ox %= tileW / dpr; oy %= tileH / dpr;

    // 火把跟隨 + 閃爍
    const k = 1 - Math.pow(1 - CONFIG.LIGHT_FOLLOW, dt * 60);
    light.x += (light.tx - light.x) * k;
    light.y += (light.ty - light.y) * k;
    light.on += (light.ton - light.on) * k;
    const t = now / 1000;
    const flicker = 1 - CONFIG.LIGHT_FLICKER * (0.5 + 0.3 * Math.sin(t * 9.3) + 0.2 * Math.sin(t * 23.7 + 1.3)) * 0.5;
    const strength = CONFIG.LIGHT_STRENGTH * light.on * (reduceMotion ? 1 : flicker);

    gl.uniform2f(U.tileSize, tileW, tileH);
    gl.uniform2f(U.texSize, imgW, imgH);
    gl.uniform1f(U.texelPerPx, 1 / (CONFIG.TILE_SCALE * dpr));
    gl.uniform2f(U.offset, ox * dpr, oy * dpr);
    gl.uniform2f(U.light, light.x * dpr, canvas.height - light.y * dpr);   // GL 的 y 向上
    gl.uniform1f(U.lightRadius, CONFIG.LIGHT_RADIUS * dpr);
    gl.uniform1f(U.lightStrength, strength);
    if (!reduceMotion) updateFlies(dt, t);
    gl.uniform4fv(U.fly, flyBuf);
    gl.uniform1i(U.flyCount, flies.length);
    gl.uniform1f(U.flyRadius, CONFIG.FLY_GLOW_RADIUS * dpr);
    gl.uniform1f(U.flyStrength, CONFIG.FLY_GLOW_STRENGTH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  frame();
})();
