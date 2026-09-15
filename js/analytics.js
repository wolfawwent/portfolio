/* =====================================================================
   analytics.js — 網站流量統計（GoatCounter）

   免費、不用 cookie、不記錄個資，個人網站可直接用。
   後台看得到：總瀏覽次數、每日趨勢、各頁面、來源、國家。

   後台：https://wolfawwent.goatcounter.com

   ・SITE_CODE 留空 = 完全不載入統計
   ・本機測試（localhost）不會被計入，不會污染數據
   ・訪客若開廣告攔截器可能擋掉 gc.zgo.at，數字會略低於實際值
   ===================================================================== */
(function () {
  const SITE_CODE = 'wolfawwent';   // ← 你的 GoatCounter 代碼；留空 = 停用統計

  if (!SITE_CODE) return;
  const host = location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:') return;

  const s = document.createElement('script');
  s.async = true;
  s.setAttribute('data-goatcounter', 'https://' + SITE_CODE + '.goatcounter.com/count');
  s.src = 'https://gc.zgo.at/count.js';
  document.head.appendChild(s);
})();
