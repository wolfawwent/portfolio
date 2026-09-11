/* =====================================================================
   main.js — 一般互動：出現動畫、卡片 tilt、打字機、語言按鈕
   ===================================================================== */
(function () {
  // ---------- 1. 捲動出現動畫 ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // ---------- 2. 卡片 3D tilt（跟著滑鼠傾斜 + 亮光）----------
  const MAX_TILT = 10; // 度
  document.querySelectorAll('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;   // 0~1
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * MAX_TILT * 2;
      const ry = (px - 0.5) * MAX_TILT * 2;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.transition = 'transform .4s ease';
      card.style.transform = '';
      setTimeout(() => (card.style.transition = ''), 400);
    });
  });

  // ---------- 3. Hero 打字機 ----------
  const lines = [
    'pixel-art 3D models',
    'voxel characters · props · creatures',
    'hand-painted pixel textures',
  ];
  const tw = document.getElementById('typewriter');
  if (tw) {
    let li = 0, ci = 0, deleting = false;
    function tick() {
      const text = lines[li];
      tw.textContent = deleting ? text.slice(0, ci--) : text.slice(0, ci++);
      let delay = deleting ? 35 : 70;
      if (!deleting && ci > text.length) { delay = 1800; deleting = true; }
      if (deleting && ci < 0) { deleting = false; ci = 0; li = (li + 1) % lines.length; delay = 400; }
      setTimeout(tick, delay);
    }
    tick();
  }

  // ---------- 4. 語言切換（之後接中文用）----------
  // 之後可以做成：把所有文字放進 i18n 物件，依 lang 換 textContent。
  const langBtn = document.getElementById('langBtn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      langBtn.textContent = langBtn.textContent === 'EN' ? '中' : 'EN';
      document.documentElement.dataset.lang = langBtn.textContent === 'EN' ? 'en' : 'zh';
    });
  }

  // ---------- 5. 年份 ----------
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
