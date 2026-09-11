/* =====================================================================
   bg.js — 全頁 shader 背景（純 WebGL，不需要任何函式庫）

   原理：畫一個蓋滿整個畫面的三角形，所有視覺效果都在 fragment shader 裡算。
   想改背景 → 直接改下面 FRAG 字串裡的 GLSL 程式碼。

   可用的 uniform：
     u_time   秒數
     u_res    畫布解析度（像素）
     u_mouse  滑鼠位置 0~1（左下為原點）
     u_scroll 頁面捲動比例 0~1
   ===================================================================== */
(function () {
  const canvas = document.getElementById('bg');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { canvas.style.background = '#07080f'; return; }

  // ---------- shaders ----------
  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform float u_time;
    uniform vec2  u_res;
    uniform vec2  u_mouse;
    uniform float u_scroll;

    // --- 2D simplex-ish noise（hash 版，夠用又快）---
    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }
    float noise(vec2 p) {
      const float K1 = 0.366025404; const float K2 = 0.211324865;
      vec2 i = floor(p + (p.x + p.y) * K1);
      vec2 a = p - i + (i.x + i.y) * K2;
      vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec2 b = a - o + K2;
      vec2 c = a - 1.0 + 2.0 * K2;
      vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
      vec3 n = h*h*h*h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
      return dot(n, vec3(70.0));
    }
    // fractal brownian motion：疊幾層噪點做出雲霧感
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot * p * 2.0 + 10.0; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      vec2 p  = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;   // 置中、等比例
      float t = u_time * 0.08;

      // 滑鼠：畫面會輕微往滑鼠方向「拉」
      vec2 m = (u_mouse - 0.5) * vec2(u_res.x / u_res.y, 1.0);
      float md = length(p - m);
      p += (m - p) * 0.06 * smoothstep(0.9, 0.0, md);

      // 兩層流動 fbm 互相扭曲（domain warping）
      vec2 q = vec2(fbm(p + t), fbm(p - t * 0.7 + 3.1));
      float f = fbm(p * 1.6 + q * 1.4 + u_scroll * 0.8);

      // 配色：深藍 → 青 → 粉；隨 scroll 微調色相
      vec3 c1 = vec3(0.03, 0.04, 0.09);
      vec3 c2 = vec3(0.10, 0.45, 0.60);
      vec3 c3 = vec3(0.75, 0.25, 0.55);
      vec3 col = mix(c1, c2, smoothstep(0.1, 0.75, f));
      col = mix(col, c3, smoothstep(0.55, 0.95, q.y * 0.5 + 0.5) * 0.55);

      // 滑鼠附近的一圈微光
      col += vec3(0.35, 0.9, 1.0) * 0.08 * smoothstep(0.35, 0.0, md);

      // 淡淡的掃描線（呼應像素感，但很輕）
      col *= 0.96 + 0.04 * sin(gl_FragCoord.y * 1.5);

      // 邊緣暗角，讓文字更好讀
      float vig = smoothstep(1.3, 0.35, length(uv - 0.5) * 1.4);
      col *= mix(0.55, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[bg] shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  // 一個大三角形蓋住整個 clip space
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {
    time:   gl.getUniformLocation(prog, 'u_time'),
    res:    gl.getUniformLocation(prog, 'u_res'),
    mouse:  gl.getUniformLocation(prog, 'u_mouse'),
    scroll: gl.getUniformLocation(prog, 'u_scroll'),
  };

  // ---------- 狀態 ----------
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };   // 平滑跟隨
  let scroll = 0;

  window.addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = 1 - e.clientY / window.innerHeight;
  }, { passive: true });
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scroll = max > 0 ? window.scrollY / max : 0;
  }, { passive: true });

  // 解析度：背景是雲霧狀，用 0.5x 畫再拉大就夠了，省效能
  const SCALE = 0.5;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(window.innerWidth  * dpr * SCALE);
    canvas.height = Math.floor(window.innerHeight * dpr * SCALE);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = performance.now();
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) frame(); });

  function frame() {
    if (!running) return;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    gl.uniform1f(U.time, reduceMotion ? 0 : (performance.now() - start) / 1000);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.uniform1f(U.scroll, scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!reduceMotion) requestAnimationFrame(frame);
  }
  frame();
})();
