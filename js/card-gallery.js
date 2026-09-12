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
   ・字體：A2 自製雕刻像素大寫字形；其他文字以俐方體 Cubic 11 補字
     以整數倍率放大，不管卡片縮放到多大都保持像素銳利
   ===================================================================== */
(function () {
  const CONFIG = {
    list: 'card/cards.json',
    folder: 'card/',
    PIN_LAST: ['Fulgora'],          // 這些名稱永遠排在該列最後（不分大小寫）；之後新增的卡片會排在它們前面
    PIN_FIRST: [],                  // 這些名稱永遠排在該列最前
    FONT: 'Cubic11',                // 俐方體11號（assets/fonts/cubic11.ttf），中英文都有
    FONT_FILE: 'assets/fonts/cubic11.ttf',
    FONT_BASE: 12,                  // 俐方體 11 號在 12px 時每個像素剛好落在整數格上（實測零抗鋸齒）
    TEXT_COLOR: '#713449',          // A2 深酒紅雕刻字
    TEXT_SHADOW: '#f4c772',         // 一格淡金硬陰影
    TEXT_SCALE: 2,                  // 桌面：原生字形的 2 倍；不因短名稱額外放大
    COMPACT_SCALE: 1,               // 小卡片統一使用原生字形，避免長短名稱大小不同
    // 金色判定範圍（RGB）：名牌是亮金 + 較深的橘邊
    isGold: (r, g, b) => r > 170 && g > 110 && g < 215 && b < 120 && r - b > 90,
  };

  const shelves = [...document.querySelectorAll('.shelf[data-category]')];
  if (!shelves.length) return;
  const trackOf = (cat) => (shelves.find((sh) => sh.dataset.category === cat) || shelves[0]).querySelector('.shelf__track');
  const TILT_MAX = 10;      // 傾斜最大角度（度），跟原本模板的卡片一樣
  const HOVER_SCALE = 1;    // 滑鼠移上去時放大倍率（1 = 不放大）

  // ---------- 字體 ----------
  let fontLoaded = false;
  const fontReady = (async () => {
    try {
      const face = new FontFace(CONFIG.FONT, `url(${CONFIG.FONT_FILE})`);
      await face.load(); document.fonts.add(face);
    } catch (e) { console.warn('[cards] 字體載入失敗，改用備用字體', e); }
    finally { fontLoaded = true; }
  })();

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
    // Use the main continuous bar on each row, not isolated gold on the model.
    // Median edges discard occasional rows where nearby artwork joins the bar.
    const lefts=[],rights=[];
    for(let y=top;y<=bottom;y++){
      let start=-1,bestStart=0,bestEnd=0;
      for(let x=0;x<=c.width;x++){
        if(x<c.width&&gold(x,y)){if(start<0)start=x;}
        else if(start>=0){if(x-start>bestEnd-bestStart){bestStart=start;bestEnd=x;}start=-1;}
      }
      if(bestEnd-bestStart>=c.width*.15){lefts.push(bestStart);rights.push(bestEnd);}
    }
    if(!lefts.length)return null;
    const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const left=median(lefts),right=median(rights);
    return { x: left * step, y: top * step, w: (right-left) * step, h: (bottom - top + 1) * step, imgW: w, imgH: h };
  }

  // ---------- 畫名稱（整數倍率的像素字）----------
  // 1) 用 FONT_BASE 大小畫一次  2) alpha 二值化成純點陣  3) 裁掉四周空白  4) 整數倍放大
  const ENGRAVED={
A:['00100','01010','10001','10001','11111','10001','10001','10001','11011'],
B:['11110','01001','01001','01110','01001','01001','01001','01001','11110'],
C:['01111','11001','10000','10000','10000','10000','10000','11001','01110'],
E:['11111','01001','01000','01000','01110','01000','01000','01001','11111'],
K:['11011','01010','01100','01100','01010','01010','01001','01001','11011'],
L:['11100','01000','01000','01000','01000','01000','01000','01001','11111'],
M:['10001','11011','10101','10101','10001','10001','10001','10001','11011'],
R:['11110','01001','01001','01110','01100','01010','01001','01001','11011'],
W:['11011','10001','10001','10001','10101','10101','10101','01010','01010'],
Z:['11111','10001','00010','00010','00100','01000','01000','10001','11111']};
  Object.assign(ENGRAVED,{"D": ["11110", "01001", "01001", "01001", "01001", "01001", "01001", "01001", "11110"], "F": ["11111", "01001", "01000", "01000", "01110", "01000", "01000", "01000", "11100"], "G": ["01110", "11001", "10000", "10000", "10111", "10001", "10001", "11001", "01110"], "H": ["11011", "01010", "01010", "01010", "01110", "01010", "01010", "01010", "11011"], "I": ["11111", "00100", "00100", "00100", "00100", "00100", "00100", "00100", "11111"], "J": ["00111", "00010", "00010", "00010", "00010", "00010", "10010", "10010", "01100"], "N": ["10001", "11001", "11001", "10101", "10101", "10011", "10011", "10001", "11011"], "O": ["01110", "11011", "10001", "10001", "10001", "10001", "10001", "11011", "01110"], "P": ["11110", "01001", "01001", "01001", "01110", "01000", "01000", "01000", "11100"], "Q": ["01110", "11011", "10001", "10001", "10001", "10101", "10011", "01110", "00001"], "S": ["01111", "11001", "10000", "11000", "01110", "00011", "00001", "10011", "11110"], "T": ["11111", "10101", "00100", "00100", "00100", "00100", "00100", "00100", "01110"], "U": ["11011", "10001", "10001", "10001", "10001", "10001", "10001", "11011", "01110"], "V": ["11011", "10001", "10001", "10001", "10001", "01010", "01010", "00100", "00100"], "X": ["11011", "10001", "01010", "01010", "00100", "01010", "01010", "10001", "11011"], "Y": ["11011", "10001", "01010", "01010", "00100", "00100", "00100", "00100", "01110"], " ": ["000", "000", "000", "000", "000", "000", "000", "000", "000"], "-": ["00000", "00000", "00000", "00000", "11111", "00000", "00000", "00000", "00000"]});
  const glyphCache = new Map();
  function renderName(text, scale) {
    const key = text + '|' + scale;
    if (glyphCache.has(key)) return glyphCache.get(key);

    const letters=Array.from(text.toUpperCase());
    const engraved=letters.every(ch=>ENGRAVED[ch]);
    const base = CONFIG.FONT_BASE;
    const font = `${base}px ${CONFIG.FONT}, monospace`;
    const pen = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    pen.font = font;
    const width = engraved?Math.max(1,letters.reduce((n,ch)=>n+ENGRAVED[ch][0].length+1,0)):Math.max(1,Math.ceil(pen.measureText(text).width)+2);
    const height = engraved?9:Math.ceil(base*1.4);
    pen.canvas.width=width;pen.canvas.height=height;pen.font=font;
    pen.fillStyle=CONFIG.TEXT_COLOR;
    if(engraved){
      let left=0;
      for(const ch of letters){const glyph=ENGRAVED[ch];glyph.forEach((row,y)=>Array.from(row).forEach((bit,x)=>{if(bit==='1')pen.fillRect(left+x,y,1,1);}));left+=glyph[0].length+1;}
    }else{pen.textBaseline='top';pen.fillText(text,1,Math.floor(base*.1));}
    const bmp = pen.getImageData(0, 0, width, height);
    const d = bmp.data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4 + 3;
      if (d[i] >= 128) { d[i] = 255; d[i-3]=0x71; d[i-2]=0x34; d[i-1]=0x49; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      else d[i] = 0;
    }
    pen.putImageData(bmp, 0, 0);
    if (maxX < 0) { minX = 0; minY = 0; maxX = width - 1; maxY = height - 1; }
    const cw = maxX - minX + 1, ch = maxY - minY + 1;

    const out = document.createElement('canvas');
    out.width = (cw+1) * scale; out.height = (ch+1) * scale;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pen.canvas,minX,minY,cw,ch,scale,scale,cw*scale,ch*scale);
    ctx.globalCompositeOperation='source-in';ctx.fillStyle=CONFIG.TEXT_SHADOW;ctx.fillRect(0,0,out.width,out.height);
    ctx.globalCompositeOperation='source-over';
    ctx.drawImage(pen.canvas,minX,minY,cw,ch,0,0,cw*scale,ch*scale);
    glyphCache.set(key, out);
    return out;
  }

  // 把名字放到名牌正中央。
  // 目標：文字的每個像素都是「整數個螢幕像素」的正方形（這樣才不會糊、比例才不會跑掉）。
  // 同一尺寸卡片使用相同目標倍率，再依裝置像素比取整數；不拉伸字形。
  function layoutName(card) {
    const plate = card._plate, label = card._label, img = card._img;
    if (!fontLoaded || !plate || !label || !img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const s = rect.width / plate.imgW;                // 1 卡片像素 = s CSS 像素
    const plateWdev = plate.w * s * dpr, plateHdev = plate.h * s * dpr;
    // Keep lettering inside the orange face, below the gold highlight.
    const textTop = plate.y + plate.h * .22;
    const textHeight = plate.h * .68;

    // Compact cards use a smaller common size, rather than enlarging short names.
    const targetScale = img.clientWidth < 300 ? CONFIG.COMPACT_SCALE : CONFIG.TEXT_SCALE;
    let k = Math.max(1, Math.round(targetScale * dpr));
    function wrapName(scale){
      const lines=[];let line='';
      for(const word of card._name.trim().split(/\s+/)){
        const next=line?line+' '+word:word;
        if(line&&renderName(next,scale).width>plateWdev*.9){lines.push(line);line=word;}else line=next;
      }
      if(line)lines.push(line);
      return lines.map(text=>renderName(text,scale));
    }
    let tiles;
    for(;;){
      tiles=wrapName(k);
      const height=tiles.reduce((sum,t)=>sum+t.height,0)+Math.max(0,tiles.length-1)*k*2;
      if(k===1||(height<=textHeight*s*dpr&&tiles.every(t=>t.width<=plateWdev*.9)))break;
      k--;
    }
    const tile=document.createElement('canvas');
    tile.width=Math.max(1,...tiles.map(t=>t.width));
    tile.height=tiles.reduce((sum,t)=>sum+t.height,0)+Math.max(0,tiles.length-1)*k*2;
    const composed=tile.getContext('2d');composed.imageSmoothingEnabled=false;
    let lineY=0;for(const line of tiles){composed.drawImage(line,Math.round((tile.width-line.width)/2),lineY);lineY+=line.height+k*2;}
    label.dataset.lines=String(tiles.length);
    label.dataset.pixelScale = String(k);
    label.width = tile.width; label.height = tile.height;
    const lctx = label.getContext('2d');
    lctx.imageSmoothingEnabled = false;
    lctx.clearRect(0, 0, label.width, label.height);
    lctx.drawImage(tile, 0, 0);

    // CSS 尺寸 = 裝置像素 / dpr，位置對齊到裝置像素
    const wCss = tile.width / dpr, hCss = tile.height / dpr;
    const cx = (plate.x + plate.w / 2) * s, cy = (textTop + textHeight / 2) * s;   // CSS px（相對 img 左上）
    const snap = (v) => Math.round(v * dpr) / dpr;
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
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${HOVER_SCALE})`;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerenter', (e) => {
      if (dragging || e.pointerType === 'touch') return;
      card.style.transition = 'transform .18s ease';          // 進入時放大是滑順的，之後跟隨滑鼠不加延遲
      setTimeout(() => (card.style.transition = ''), 180);
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
    track._stopGlide=()=>cancelAnimationFrame(raf);
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      cancelAnimationFrame(raf);
      active = true; moved = false; startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now(); vx = 0;
    });
    track.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; dragging = true; track.setPointerCapture(e.pointerId); track.classList.add('is-dragging'); track.querySelectorAll('.card--auto').forEach((c) => (c.style.transform = '')); }
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
      if (moved) { track._suppressClickUntil = performance.now() + 300;glide(); }
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('lostpointercapture', end);
    // 滾輪不做左右捲動：列上滾滾輪就是正常捲頁面，卡片只靠拖曳 / 觸控滑動移動
  }
  shelves.forEach((sh) => attachDragScroll(sh.querySelector('.shelf__track')));
  shelves.forEach((shelf,index)=>{
    const track=shelf.querySelector('.shelf__track');
    const viewport=document.createElement('div');viewport.className='shelf__viewport';
    track.before(viewport);viewport.append(track);track.id=track.id||`card-track-${index}`;
    let animation=0;
    const stop=()=>{cancelAnimationFrame(animation);track._stopGlide?.();};
    track.addEventListener('pointerdown',stop);
    const buttons=[-1,1].map(direction=>{
      const button=document.createElement('button');button.type='button';
      button.className='shelf__arrow '+(direction<0?'shelf__arrow--left':'shelf__arrow--right');
      button.setAttribute('aria-label',`${shelf.dataset.category}：${direction<0?'向左':'向右'}快速瀏覽卡片`);
      button.setAttribute('aria-controls',track.id);
      button.title=direction<0?'向左瀏覽 · 也可拖曳':'向右瀏覽 · 也可拖曳';
      button.innerHTML='<svg viewBox="0 0 9 13" aria-hidden="true" shape-rendering="crispEdges"><path d="M6 0H9V3H6V5H4V8H6V10H9V13H6V11H4V9H2V8H0V5H2V4H4V2H6Z"/></svg>';
      button.addEventListener('click',()=>{
        stop();const distance=direction*Math.max(240,track.clientWidth*.85);
        if(matchMedia('(prefers-reduced-motion: reduce)').matches){track.scrollLeft+=distance;return;}
        const start=performance.now();let previous=0;
        function move(now){const t=Math.min(1,(now-start)/360),progress=1-Math.pow(1-t,3);track.scrollLeft+=distance*(progress-previous);previous=progress;if(t<1)animation=requestAnimationFrame(move);}
        animation=requestAnimationFrame(move);
      });
      viewport.append(button);return button;
    });
    function update(){const overflow=track.scrollWidth>track.clientWidth+2;buttons.forEach((button,i)=>{button.hidden=!overflow;button.disabled=!overflow||(!track._loop&&(i===0?track.scrollLeft<=1:track.scrollLeft>=track.scrollWidth-track.clientWidth-1));});}
    track.addEventListener('scroll',update,{passive:true});
    new ResizeObserver(update).observe(track);
    new MutationObserver(update).observe(track,{childList:true});
    update();
  });

  // ---------- 建卡片 ----------
  function makeCard(file) {
    const { category, name } = parseFile(file);
    const card = document.createElement('article');
    card.className = 'card card--auto';
    card.dataset.name = name; card.dataset.category = category;
    card.setAttribute('aria-label', name);
    card.dataset.file = file;
    card.tabIndex = 0;card.setAttribute('role', 'button');
    card.setAttribute('aria-haspopup', 'dialog');card.setAttribute('aria-label', 'Preview '+name);
    card.addEventListener('click', () => {
      if (dragging || performance.now() < (card.parentElement._suppressClickUntil || 0)) return;
      window.openCardPreview?.(card);
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault();window.openCardPreview?.(card); }
    });
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

  // ---------- 無限迴圈軌道 ----------
  // 把同一組卡片重複放好幾份，捲到接近頭 / 尾時悄悄跳回中間那份 → 看起來像無限循環：
  // 最後一張（例如 Fulgora）會出現在第一張（Kazek）前面。
  function setupLoop(track, list) {
    track.replaceChildren();
    if (list.length < 2) { list.forEach((f) => track.append(makeCard(f))); return; }

    // 需要幾份：至少 3 份，而且每份加起來要比視窗寬 2 倍以上，這樣任何時候左右都有卡片
    const cardW = parseFloat(getComputedStyle(track.querySelector('.card--auto') || document.body).getPropertyValue('--card-w')) || 340;
    const setW = list.length * (cardW + 12);
    const reps = Math.max(3, Math.ceil((window.innerWidth * 2) / setW) + 2);
    for (let r = 0; r < reps; r++) {
      for (const f of list) {
        const card = makeCard(f);
        card.dataset.rep = r;
        track.append(card);
      }
    }
    track._loop = true;

    // 一份的實際寬度 = 第 2 份第一張 與 第 1 份第一張 的距離
    const period = () => {
      const a = track.querySelector('[data-rep="0"]'), b = track.querySelector('[data-rep="1"]');
      return a && b ? b.offsetLeft - a.offsetLeft : 0;
    };
    const mid = Math.floor(reps / 2);
    const goMiddle = () => { const p = period(); if (p) track.scrollLeft = p * mid; };
    // 捲到第一份或最後一份時，位移一份的寬度（畫面完全不變，因為每份長得一樣）
    track.addEventListener('scroll', () => {
      const p = period(); if (!p) return;
      if (track.scrollLeft < p * 1) track.scrollLeft += p * (mid - 1);
      else if (track.scrollLeft > p * (reps - 2)) track.scrollLeft -= p * (mid - 1);
    }, { passive: true });
    requestAnimationFrame(goMiddle);
    window.addEventListener('resize', goMiddle);
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

    // 依 cards.json 的順序（= 卡片工具最初儲存的順序）分到各列
    const byTrack = new Map();
    for (const file of files) {
      const { category } = parseFile(file);
      const track = trackOf(category);
      if (!byTrack.has(track)) byTrack.set(track, []);
      byTrack.get(track).push(file);
    }
    // 固定排在最前 / 最後的卡片
    const norm = (v) => v.trim().toLowerCase();
    const first = CONFIG.PIN_FIRST.map(norm), last = CONFIG.PIN_LAST.map(norm);
    for (const [track, list] of byTrack) {
      const rank = (f) => { const n = norm(parseFile(f).name); if (first.includes(n)) return -1; if (last.includes(n)) return 1; return 0; };
      list.sort((a, b) => rank(a) - rank(b));   // 穩定排序：同一組內維持原本順序
      byTrack.set(track, list);
    }
    shelves.forEach((sh) => sh.querySelector('.shelf__track').replaceChildren());
    for (const [track, list] of byTrack) setupLoop(track, list);

    // 視窗縮放 / 版面變動時重新排版名字
    let raf = 0;
    const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => document.querySelectorAll('.shelf .card--auto').forEach(layoutName)); };
    shelves.forEach((sh) => new ResizeObserver(relayout).observe(sh));
    window.addEventListener('resize', relayout);
  })();
})();
