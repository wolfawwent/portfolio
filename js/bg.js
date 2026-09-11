/* =====================================================================
   bg.js — 全頁背景：像素磚塊圖片重複鋪滿，持續往左上緩慢移動（純 WebGL）

   ・圖片：assets/img/bg-tile.png（64×64，會放大 TILE_SCALE 倍後無限重複）
   ・移動是連續的（不是一格一格跳），所以很流暢
   ・貼圖用 NEAREST 取樣，放大後像素邊緣保持銳利
   ・圖片透明的部分會露出底色 BG_COLOR

   想調整 → 改下面 CONFIG 就好。
   ===================================================================== */
(function () {
  const CONFIG = {
    image: 'assets/img/bg-tile.png',
    TILE_SCALE: 5,             // 圖片放大倍數（CSS 像素）
    SPEED_X: 12,               // 每秒往左移動幾個 CSS 像素
    SPEED_Y: 12,               // 每秒往上移動幾個 CSS 像素
    BG_COLOR: [0x1f / 255, 0x12 / 255, 0x20 / 255],   // 透明處的底色（= CSS --bg #1f1220）
    TINT: [1.0, 1.0, 1.0],     // 想把磚塊染色可以改，例如 [1.1, 0.9, 1.0]
  };

  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.style.background = '#1f1220'; return; }

  // ---------- shaders ----------
  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;
  const FRAG = `
    precision mediump float;
    uniform sampler2D u_tex;
    uniform vec2  u_tileSize;   // 一塊磚圖放大後的裝置像素尺寸
    uniform vec2  u_offset;     // 位移（裝置像素）
    uniform vec3  u_bg;
    uniform vec3  u_tint;
    void main() {
      // 螢幕像素 → 貼圖 uv（fract 讓它無限重複；y 方向翻轉讓圖片不上下顛倒）
      vec2 uv = fract((gl_FragCoord.xy + u_offset) / u_tileSize);
      uv.y = 1.0 - uv.y;
      vec4 c = texture2D(u_tex, uv);
      vec3 col = mix(u_bg, c.rgb * u_tint, c.a);
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

  const U = {
    tex: gl.getUniformLocation(prog, 'u_tex'),
    tileSize: gl.getUniformLocation(prog, 'u_tileSize'),
    offset: gl.getUniformLocation(prog, 'u_offset'),
    bg: gl.getUniformLocation(prog, 'u_bg'),
    tint: gl.getUniformLocation(prog, 'u_tint'),
  };
  gl.uniform3fv(U.bg, CONFIG.BG_COLOR);
  gl.uniform3fv(U.tint, CONFIG.TINT);

  // ---------- 貼圖 ----------
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); // 先放 1px 佔位
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.uniform1i(U.tex, 0);

  let imgW = 64, imgH = 64;
  const img = new Image();
  img.onload = () => {
    imgW = img.naturalWidth; imgH = img.naturalHeight;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  };
  img.src = CONFIG.image;

  // ---------- 尺寸 ----------
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 動畫 ----------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); frame(); } });

  let last = performance.now();
  let ox = 0, oy = 0;   // 累積位移（CSS 像素），用 dt 累加所以掉幀也不會跳
  function frame() {
    if (!running) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!reduceMotion) {
      // 內容往左上：取樣點要往右下走 → offset 往 +x；GL 的 y 向上，所以內容往上 = 取樣往 -y
      ox += CONFIG.SPEED_X * dt;
      oy -= CONFIG.SPEED_Y * dt;
    }
    const tileW = imgW * CONFIG.TILE_SCALE * dpr, tileH = imgH * CONFIG.TILE_SCALE * dpr;
    // 讓位移在一塊磚的範圍內循環，避免數字越來越大導致浮點精度變差
    ox %= tileW / dpr; oy %= tileH / dpr;

    gl.uniform2f(U.tileSize, tileW, tileH);
    gl.uniform2f(U.offset, ox * dpr, oy * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  frame();
})();
