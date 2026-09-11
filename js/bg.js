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
    LIGHT_STRENGTH: 0.20,      // 亮度上限（0.10 = 最亮處加 10%，很含蓄）
    LIGHT_COLOR: [1.0, 0.72, 0.42],   // 火光暖色
    LIGHT_FLICKER: 0.15,       // 閃爍幅度 0~1（0 = 不閃）
    LIGHT_FOLLOW: 0.05,        // 游標跟隨的平滑程度（越小越慢越柔）
  };

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
  };
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  frame();
})();
