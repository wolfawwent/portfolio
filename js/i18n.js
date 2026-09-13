/* Public website translations. Model names and brand names stay unchanged. */
(() => {
  const messages = {
  "wolfawwent's Model Dungeon": "wolfawwent 模型地下城",
  "All Models — wolfawwent's Model Dungeon": "全部模型 — wolfawwent 的模型地下城",
  "wolfawwent's portfolio of pixel / voxel 3D models.": "wolfawwent 的像素與體素 3D 模型作品集。",
  "About": "關於我",
  "Models": "作品集",
  "Contact": "聯絡我",
  "wolfawwent's": "wolfawwent 的",
  "Model Dungeon": "模型地下城",
  "View Models": "查看模型",
  "Scroll down": "向下捲動",
  "avatar": "wolfawwent 的頭像",
  "Hi, I'm": "Hey，我是",
  "— a pixel artist.": "—— 像素藝術創作者。",
  "He / Him · GMT+8": "GMT+8",
  "I make random stuff.": "喜歡做一些隨機的東西。",
  "→ Items, Entities, VFX, Furniture, Animations": "→ 道具、生物、特效、家具、動畫",
  "Hit me up on": "我的",
  "Drag or swipe a row to see more.": "左右拖曳可以滑動卡片列，探索更多作品。",
  "Click a card to see its details.": "點擊卡片查看模型預覽。",
  "Entity": "生物",
  "Weapon": "武器",
  "Item": "道具",
  "SEE ALL": "查看全部",
  "Entity cards": "生物卡片",
  "Weapon cards": "武器卡片",
  "Item cards": "道具卡片",
  "Commissions, collabs, or just say hi.": "委託製作、合作邀約，或只是來打聲招呼，都歡迎聯繫我的Discord wolfawwent。",
  "← BACK": "← 返回作品",
  "All Models": "全部模型",
  "All cards": "全部卡片",
  "pixel-art 3D models": "像素 3D 模型",
  "items · entities · vfx · furniture": "道具 · 生物 · 特效 · 家具",
  "Close model preview": "關閉模型預覽",
  "Loading model…": "模型載入中…",
  "Model preview is not available for this card yet.": "這張卡片尚未提供模型預覽。",
  "Unable to load this model. Please close and try again.": "無法載入模型，請關閉後再試一次。",
  "Unable to load the preview. Please close and try again.": "無法載入預覽，請關閉後再試一次。",
  "fixed-angle model preview": "固定視角模型預覽",
  "Preview ": "預覽 ",
  "no cards yet": "尚無作品",
  "Browse left · or drag": "向左瀏覽 · 也可拖曳",
  "Browse right · or drag": "向右瀏覽 · 也可拖曳"
};
  const query = new URLSearchParams(location.search).get('lang');
  let saved;
  try { saved = localStorage.getItem('portfolio-language'); } catch {}
  const lang = (query || saved) === 'en' ? 'en' : 'zh-Hant';
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;
  const t = text => lang === 'en' ? text : (messages[text] ?? text);
  const category = type => t(({entity:'Entity',weapon:'Weapon',item:'Item'})[type] || type);
  window.PortfolioI18n = {lang, t, category,
    count: n => lang === 'en' ? (n ? n + ' model' + (n === 1 ? '' : 's') + ' · click a card to preview' : 'no cards yet') : (n ? '共 ' + n + ' 件模型 · 點擊卡片查看預覽' : '尚無作品')
  };
  document.addEventListener('DOMContentLoaded', () => {
    // Translate exact text nodes, preserving nested links, names and icons.
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('script, style, canvas')) continue;
      const text = node.textContent.trim();
      if (Object.hasOwn(messages, text)) node.textContent = node.textContent.replace(text, t(text));
    }
    document.querySelectorAll('[title], [alt], [aria-label], [data-text], meta[name="description"]').forEach(el => {
      for (const attr of ['title', 'alt', 'aria-label', 'data-text', 'content']) {
        if (el.hasAttribute(attr)) el.setAttribute(attr, t(el.getAttribute(attr)));
      }
    });
    const btn = document.getElementById('langBtn');
    if (!btn) return;
    btn.textContent = lang === 'en' ? '中' : 'EN';
    btn.title = btn.ariaLabel = lang === 'en' ? 'Switch to Traditional Chinese' : '切換為英文';
    btn.addEventListener('click', () => {
      const next = lang === 'en' ? 'zh-Hant' : 'en';
      try { localStorage.setItem('portfolio-language', next); } catch {}
      const url = new URL(location.href);
      url.searchParams.set('lang', next);
      location.assign(url.href);
    });
    // Carry the chosen language across pages even when storage is unavailable.
    document.querySelectorAll('a[href]').forEach(link => {
      const url = new URL(link.href);
      if (url.origin === location.origin && /\/(?:index|gallery)\.html$/.test(url.pathname)) {
        url.searchParams.set('lang', lang); link.href = url.href;
      }
    });
  });
})();
