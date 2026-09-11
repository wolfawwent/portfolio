/* =====================================================================
   card-gallery.js — 讀取 card/ 資料夾的卡片，並在金色名牌上疊出名稱

   ・清單：card/cards.json（例如 ["card_Kazek.png", "card_Duck.png"]）
     GitHub Pages 是靜態網站，沒辦法自己列出資料夾，所以要有這個清單。
     雙擊「更新卡片清單.cmd」會自動掃描 card/ 幫你產生。
   ・檔名格式：card_類型_名稱.png（類型 = entity / weapon …）
     card_entity_Kazek.png → 放進 data-category="entity" 的 .shelf，名牌顯示 Kazek
     沒寫類型的舊檔名（card_Kazek.png）會歸到第一個 shelf
   ・每一列可以左右拖曳 / 滑動；卡片有滑鼠傾斜 + 亮光效果
   ・金色名牌位置：程式直接掃描圖片裡的金色像素自動找，不用手動填座標
   ・字體：VT323（網站內文用的像素字，Google Fonts），先在 20px 畫成點陣、
     二值化後以整數倍率放大，不管卡片縮放到多大都保持像素銳利
   ===================================================================== */
(function () {
  const CONFIG = {
    list: 'card/cards.json',
    folder: 'card/',
    FONT: 'VT323',                  // 跟網站內文同一個字體（index.html 已從 Google Fonts 載入）
    FONT_BASE: 20,                  // VT323 在 20px 時最接近原始點陣格（每字 8px 寬）
    TEXT_COLOR: '#352133',          // 名牌上的字色（深紫棕）
    TEXT_SCALE: 3,                  // 文字的 1 個像素 = 卡片圖的幾個像素（卡片圖是 1000px 寬；3 = 跟卡片工具烙上去的字一樣大）
    // 金色判定範圍（RGB）：名牌是亮金 + 較深的橘邊
    isGold: (r, g, b) => r > 170 && g > 110 && g < 215 && b < 120 && r - b > 90,
  };

  const shelves = [...document.querySelectorAll('.shelf[data-category]')];
  if (!shelves.length) return;
  const trackOf = (cat) => (shelves.find((sh) => sh.dataset.category === cat) || shelves[0]).querySelector('.shelf__track');
  const TILT_MAX = 10;   // 傾斜最大角度（度），跟原本模板的卡片一樣

  // ---------- 字體 ----------
  const fontReady = document.fonts.load(`${CONFIG.FONT_BASE}px ${CONFIG.FONT}`).catch(() => null);

  // ---------- 名稱 ----------
  const KNOWN = shelves.map((sh) => sh.dataset.category.toLowerCase());
  function parseFile(file) {
    const stem = file.replace(/\.[a-z0-9]+$/i, '').replace(/^card[_-]?/i, '');
    const parts = stem.split('_');
    let category = KNOWN[0];
    if (parts.length > 1 && KNOWN.includes(parts[0].toLowerCase())) category = parts.shift().toLowerCase();
    const name = parts.join(' ').trim() || file;
    return { category, name };
  }

  // ---------- 找金色名牌 ----------
  // 掃描圖片下半部的金色像素，回傳它們的外框（以圖片像素為單位）
  function findNameplate(img) {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    const step = 2;                                   // 隔 2 像素取樣就夠準，也快
    c.width = Math.ceil(w / step); c.height = Math.ceil(h / step);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const gold = (x, y) => { const i = (y * c.width + x) * 4; return d[i + 3] >= 128 && CONFIG.isGold(d[i], d[i + 1], d[i + 2]); };

    // 1. 每一列有多少金色像素。名牌是一整條橫向的金色，會是最「寬」的那幾列；
    //    模型身上零星的橘色只會讓某幾列有少量金色，不會過門檻。
    const rows = new Int32Array(c.height);
    let maxRow = 0;
    for (let y = Math.floor(c.height * 0.4); y < c.height; y++) {
      let n = 0;
      for (let x = 0; x < c.width; x++) if (gold(x, y)) n++;
      rows[y] = n; if (n > maxRow) maxRow = n;
    }
    if (maxRow < c.width * 0.15) return null;
    // 2. 取「從下往上」第一段連續達到門檻的列 → 名牌的上下邊
    const th = maxRow * 0.5;
    let bottom = -1, top = -1;
    for (let y = c.height - 1; y >= 0; y--) {
      if (rows[y] >= th) { if (bottom < 0) bottom = y; top = y; }
      else if (bottom >= 0) break;
    }
    if (bottom < 0) return null;
    // 3. 在這段列裡找左右邊
    let minX = 1e9, maxX = -1;
    for (let y = top; y <= bottom; y++) for (let x = 0; x < c.width; x++) if (gold(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    return { x: minX * step, y: top * step, w: (maxX - minX + 1) * step, h: (bottom - top + 1) * step, imgW: w, imgH: h };
  }

  // ---------- 畫名稱（整數倍率的像素字）----------
  // 1) 用 FONT_BASE 大小畫一次  2) alpha 二值化成純點陣  3) 裁掉四周空白  4) 整數倍放大
  const glyphCache = new Map();
  function renderName(text, scale) {
    const key = text + '|' + scale;
    if (glyphCache.has(key)) return glyphCache.get(key);

    const base = CONFIG.FONT_BASE;
    const font = `${base}px ${CONFIG.FONT}, monospace`;
    const pen = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    pen.font = font;
    const width = Math.max(1, Math.ceil(pen.measureText(text).width) + 2);
    const height = Math.ceil(base * 1.4);
    pen.canvas.width = width; pen.canvas.height = height;
    pen.font = font;                                  // 設定尺寸後要再設一次
    pen.textBaseline = 'top';
    pen.fillStyle = CONFIG.TEXT_COLOR;
    pen.fillText(text, 1, Math.floor(base * 0.1));
    const bmp = pen.getImageData(0, 0, width, height);
    const d = bmp.data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4 + 3;
      if (d[i] >= 128) { d[i] = 255; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      else d[i] = 0;
    }
    pen.putImageData(bmp, 0, 0);
    if (maxX < 0) { minX = 0; minY = 0; maxX = width - 1; maxY = height - 1; }
    const cw = maxX - minX + 1, ch = maxY - minY + 1;

    const out = document.createElement('canvas');
    out.width = cw * scale; out.height = ch * scale;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pen.canvas, minX, minY, cw, ch, 0, 0, out.width, out.height);
    glyphCache.set(key, out);
    return out;
  }

  // 把名字放到名牌正中央。
  // 文字先以 1:1 點陣畫在 canvas 上，再用 CSS 放大成「TEXT_SCALE 個卡片像素」大小，
  // 所以文字像素和卡片像素永遠是固定比例，卡片縮放到多大都一致（跟卡片圖用同樣的 pixelated 縮放）。
  function layoutName(card) {
    const plate = card._plate, label = card._label, img = card._img;
    if (!plate || !label || !img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0) return;
    const s = rect.width / plate.imgW;                // 1 卡片像素 = s CSS 像素

    // 文字像素 = TEXT_SCALE 個卡片像素；名牌塞不下時逐步縮小，最少 1
    let scale = Math.max(1, Math.floor(CONFIG.TEXT_SCALE));
    let tile = renderName(card._name, 1);
    while (scale > 1 && tile.width * scale > plate.w * 0.9) scale--;

    label.width = tile.width; label.height = tile.height;
    const lctx = label.getContext('2d');
    lctx.imageSmoothingEnabled = false;
    lctx.clearRect(0, 0, label.width, label.height);
    lctx.drawImage(tile, 0, 0);

    const wCss = tile.width * scale * s, hCss = tile.height * scale * s;
    const cx = (plate.x + plate.w / 2) * s, cy = (plate.y + plate.h / 2) * s;   // CSS px（相對 img 左上）
    // 位置對齊到卡片像素格，讓文字像素跟卡片像素落在同一個格子上
    const snap = (v) => Math.round(v / s) * s;
    Object.assign(label.style, {
      left: snap(cx - wCss / 2) + 'px', top: snap(cy - hCss / 2) + 'px',
      width: wCss + 'px', height: hCss + 'px',
    });
  }

  // ---------- 滑鼠傾斜（原本模板 main.js 的 tilt 效果）----------
  let dragging = false;
  function attachTilt(card) {
    card.addEventListener('pointermove', (e) => {
      if (dragging || e.pointerType === 'touch') return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * TILT_MAX * 2, ry = (px - 0.5) * TILT_MAX * 2;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.transition = 'transform .4s ease';
      card.style.transform = '';
      setTimeout(() => (card.style.transition = ''), 400);
    });
  }

  // ---------- 拖曳捲動（桌機用滑鼠拖；手機用原生觸控滑動）----------
  function attachDragScroll(track) {
    let startX = 0, startLeft = 0, active = false, moved = false, vx = 0, lastX = 0, lastT = 0, raf = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      cancelAnimationFrame(raf);
      active = true; moved = false; startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now(); vx = 0;
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; dragging = true; track.classList.add('is-dragging'); track.querySelectorAll('.card--auto').forEach((c) => (c.style.transform = '')); }
      if (!moved) return;
      track.scrollLeft = startLeft - dx;
      const now = performance.now();
      vx = (e.clientX - lastX) / Math.max(now - lastT, 1);   // px/ms
      lastX = e.clientX; lastT = now;
    });
    const end = () => {
      if (!active) return;
      active = false; dragging = false; track.classList.remove('is-dragging');
      // 放開後帶一點慣性
      let v = vx * 16;
      const glide = () => { if (Math.abs(v) < 0.5) return; track.scrollLeft -= v; v *= 0.92; raf = requestAnimationFrame(glide); };
      if (moved) glide();
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('lostpointercapture', end);
    // 滑鼠滾輪：在列上垂直滾動 → 改成左右捲動（列已到底時就讓頁面正常捲）
    track.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 0) return;
      const next = track.scrollLeft + e.deltaY;
      if ((e.deltaY > 0 && track.scrollLeft >= max - 1) || (e.deltaY < 0 && track.scrollLeft <= 0)) return;
      e.preventDefault();
      track.scrollLeft = Math.max(0, Math.min(max, next));
    }, { passive: false });
  }
  shelves.forEach((sh) => attachDragScroll(sh.querySelector('.shelf__track')));

  // ---------- 建卡片 ----------
  function makeCard(file) {
    const { category, name } = parseFile(file);
    const card = document.createElement('article');
    card.className = 'card card--auto';
    card.dataset.name = name; card.dataset.category = category;
    card.setAttribute('aria-label', name);
    card.style.setProperty('--img', `url("${CONFIG.folder + file}")`);   // 給亮光層當遮罩

    const img = new Image();
    img.src = CONFIG.folder + file;
    img.alt = name;
    img.decoding = 'async';
    card.append(img);
    attachTilt(card);

    const label = document.createElement('canvas');
    label.className = 'card__name';
    label.setAttribute('aria-hidden', 'true');
    card.append(label);

    card._name = name; card._img = img; card._label = label;

    img.addEventListener('load', async () => {
      card._plate = findNameplate(img);
      if (!card._plate) { console.warn('[cards] 找不到金色名牌：', file); label.remove(); return; }
      await fontReady;
      layoutName(card);
    });
    img.addEventListener('error', () => card.remove());
    return card;
  }

  // ---------- 啟動 ----------
  (async () => {
    let files = [];
    try {
      const r = await fetch(CONFIG.list, { cache: 'no-cache' });
      if (r.ok) files = await r.json();
    } catch (e) { console.warn('[cards] 讀不到 cards.json', e); }
    files = (Array.isArray(files) ? files : []).filter((f) => typeof f === 'string' && /^[\w\-. ]+\.(png|webp|gif)$/i.test(f));
    if (!files.length) return;

    shelves.forEach((sh) => sh.querySelector('.shelf__track').replaceChildren());
    for (const file of files) {
      const card = makeCard(file);
      trackOf(card.dataset.category).append(card);
    }

    // 視窗縮放 / 版面變動時重新排版名字
    let raf = 0;
    const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => document.querySelectorAll('.shelf .card--auto').forEach(layoutName)); };
    shelves.forEach((sh) => new ResizeObserver(relayout).observe(sh));
    window.addEventListener('resize', relayout);
  })();
})();
