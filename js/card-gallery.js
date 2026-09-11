/* =====================================================================
   card-gallery.js — 讀取 card/ 資料夾的卡片，並在金色名牌上疊出名稱

   ・清單：card/cards.json（例如 ["card_Kazek.png", "card_Duck.png"]）
     GitHub Pages 是靜態網站，沒辦法自己列出資料夾，所以要有這個清單。
     雙擊「更新卡片清單.cmd」會自動掃描 card/ 幫你產生。
   ・名稱：從檔名自動取，card_Kazek.png → "Kazek"（底線會變成空格）
   ・金色名牌位置：程式直接掃描圖片裡的金色像素自動找，不用手動填座標
   ・字體：Unifont（assets/fonts/unifont.otf），以整數倍率渲染，
     不管卡片縮放到多大，字都保持像素風的銳利
   ===================================================================== */
(function () {
  const CONFIG = {
    list: 'card/cards.json',
    folder: 'card/',
    font: 'assets/fonts/unifont.otf',
    TEXT_COLOR: '#352133',          // 名牌上的字色（深紫棕）
    TEXT_SCALE: 2,                  // 文字放大倍率（整數）。Unifont 原生 16px × 2 = 32px 高；名牌塞不下時會自動降到 1
    // 金色判定範圍（RGB）：名牌是亮金 + 較深的橘邊
    isGold: (r, g, b) => r > 170 && g > 110 && g < 215 && b < 120 && r - b > 90,
  };

  const grid = document.getElementById('modelGrid');
  if (!grid) return;

  // ---------- 字體 ----------
  const fontReady = (async () => {
    try {
      const face = new FontFace('CardUnifont', `url(${CONFIG.font})`);
      await face.load();
      document.fonts.add(face);
      return true;
    } catch (e) { console.warn('[cards] unifont 載入失敗，改用備用字體', e); return false; }
  })();

  // ---------- 名稱 ----------
  function nameFromFile(file) {
    return file.replace(/\.[a-z0-9]+$/i, '').replace(/^card[_-]?/i, '').replace(/_/g, ' ').trim() || file;
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
  // 先在 16px（Unifont 原生尺寸）畫一次、把 alpha 二值化，再以整數倍放大 → 每個像素都是完整方塊
  const glyphCache = new Map();
  function renderName(text, scale) {
    const key = text + '|' + scale;
    if (glyphCache.has(key)) return glyphCache.get(key);

    const pen = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    pen.font = '16px CardUnifont, monospace';
    const width = Math.max(1, Math.ceil(pen.measureText(text).width));
    pen.canvas.width = width; pen.canvas.height = 16;
    pen.font = '16px CardUnifont, monospace';         // 設定尺寸後要再設一次
    pen.textBaseline = 'alphabetic';
    pen.fillStyle = CONFIG.TEXT_COLOR;
    pen.fillText(text, 0, 14);                        // Unifont 16px 格子的基線在 14px
    const bmp = pen.getImageData(0, 0, width, 16);
    for (let i = 3; i < bmp.data.length; i += 4) bmp.data[i] = bmp.data[i] >= 128 ? 255 : 0;
    pen.putImageData(bmp, 0, 0);

    const out = document.createElement('canvas');
    out.width = width * scale; out.height = 16 * scale;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pen.canvas, 0, 0, width, 16, 0, 0, out.width, out.height);
    glyphCache.set(key, out);
    return out;
  }

  // 依卡片目前顯示的大小，把名字放到名牌正中央
  function layoutName(card) {
    const plate = card._plate, label = card._label, img = card._img;
    if (!plate || !label || !img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const s = rect.width / plate.imgW;                // 1 圖片像素 = s CSS 像素

    // 名牌在裝置像素上的尺寸
    const plateWdev = plate.w * s * dpr, plateHdev = plate.h * s * dpr;

    // 固定倍率 TEXT_SCALE；名牌寬度塞不下時才逐步降低，最少 1
    let scale = Math.max(1, Math.floor(CONFIG.TEXT_SCALE));
    let tile = renderName(card._name, scale);
    while (scale > 1 && tile.width > plateWdev * 0.9) { scale--; tile = renderName(card._name, scale); }

    label.width = tile.width; label.height = tile.height;
    const lctx = label.getContext('2d');
    lctx.imageSmoothingEnabled = false;
    lctx.clearRect(0, 0, label.width, label.height);
    lctx.drawImage(tile, 0, 0);

    // 置中，並把位置對齊到裝置像素，避免半像素造成模糊
    const cx = (plate.x + plate.w / 2) * s, cy = (plate.y + plate.h / 2) * s;   // CSS px（相對 img 左上）
    const left = Math.round((cx - tile.width / dpr / 2) * dpr) / dpr;
    const top  = Math.round((cy - tile.height / dpr / 2) * dpr) / dpr;
    Object.assign(label.style, {
      left: left + 'px', top: top + 'px',
      width: (tile.width / dpr) + 'px', height: (tile.height / dpr) + 'px',
    });
  }

  // ---------- 建卡片 ----------
  function makeCard(file) {
    const name = nameFromFile(file);
    const card = document.createElement('article');
    card.className = 'card model card--artwork card--auto';
    card.dataset.name = name;
    card.setAttribute('aria-label', name);

    const img = new Image();
    img.src = CONFIG.folder + file;
    img.alt = name;
    img.decoding = 'async';
    card.append(img);

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
    if (!files.length) return;                        // 沒清單就保留 index.html 裡原本的佔位卡

    const mount = () => grid.replaceChildren(...files.map(makeCard));
    mount();
    // js/cards.js（卡片工具的舊清單）也會往 #modelGrid 塞卡片；若它晚一步蓋掉這裡的卡片，就再放回來
    new MutationObserver(() => { if (!grid.querySelector('.card--auto')) mount(); }).observe(grid, { childList: true });

    // 視窗縮放 / 版面變動時重新排版名字
    let raf = 0;
    const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => grid.querySelectorAll('.card--auto').forEach(layoutName)); };
    new ResizeObserver(relayout).observe(grid);
    window.addEventListener('resize', relayout);
  })();
})();
