# wolfawwent portfolio

純 HTML / CSS / JS 作品集網站，Three.js 只用在 3D 預覽，不需要 Node、不需要 build。

```
portfolio/
├─ index.html          # 所有內容都在這裡（改文字、換作品就改這支）
├─ css/style.css       # 樣式（顏色在最上面的 :root 變數）
├─ js/bg.js            # 背景 shader（GLSL 寫在 FRAG 字串裡）
├─ js/main.js          # 出現動畫、卡片 tilt、打字機
├─ js/playground.js    # 互動小遊戲（Canvas 2D）
├─ js/viewer.js        # 3D 模型預覽（Three.js）
├─ assets/img/         # GIF / 圖片（目前是佔位用的範例）
├─ assets/models/      # .glb 模型放這裡
├─ CNAME               # 自訂網域（GitHub Pages 用）
└─ .nojekyll           # 告訴 GitHub 不要用 Jekyll 處理
```

---

## 1. 本機預覽

因為 `viewer.js` 是 ES module，直接雙擊 `index.html`（file://）瀏覽器會擋。
用任何一種本機伺服器就好：

- **VS Code**：裝「Live Server」擴充，右鍵 index.html → Open with Live Server
- **Python**（有裝的話）：在資料夾內開終端機 → `python -m http.server 8000` → 開 http://localhost:8000
- **Node**（有裝的話）：`npx serve .`

---

## 2. 第一次上 GitHub

1. 到 https://github.com/new 建一個 **public** repo，名字例如 `portfolio`（不要勾 README）。
2. 在 `D:\portfolio` 開終端機（PowerShell 或 Git Bash），輸入：

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/你的帳號/portfolio.git
git push -u origin main
```

3. 到 repo 的 **Settings → Pages**：
   - Source 選 **Deploy from a branch**
   - Branch 選 **main** / **/(root)** → Save
4. 等 1～2 分鐘，`https://你的帳號.github.io/portfolio/` 就能看到網站。

之後每次改完：

```bash
git add .
git commit -m "說明改了什麼"
git push
```

---

## 3. 綁定自己的網域（wolfawwent-pf.me）

### Namecheap 設定
Domain List → 你的網域 → **Manage** → **Advanced DNS** → 把預設的紀錄刪掉，新增：

| Type         | Host | Value                   | TTL       |
|--------------|------|-------------------------|-----------|
| A Record     | @    | 185.199.108.153         | Automatic |
| A Record     | @    | 185.199.109.153         | Automatic |
| A Record     | @    | 185.199.110.153         | Automatic |
| A Record     | @    | 185.199.111.153         | Automatic |
| CNAME Record | www  | 你的帳號.github.io       | Automatic |

（如果 Namecheap 有自動加一筆 `URL Redirect` 或 parking 的 CNAME，要刪掉。）

### GitHub 設定
Settings → Pages → **Custom domain** 填 `wolfawwent-pf.me` → Save。
DNS 生效後（幾分鐘到幾小時）會出現綠色勾勾，接著勾選 **Enforce HTTPS**。

repo 裡的 `CNAME` 檔已經寫好網域，GitHub 會自動讀取，不要刪它。

---

## 4. 換成自己的作品

- **文字**：改 `index.html`，每個區塊都有註解。
- **作品卡片**：`<article class="card tilt">` 一張卡一份，複製貼上即可；GIF 放 `assets/img/`。
- **3D 模型**：`.glb` 放 `assets/models/`，改 `<div id="viewer" data-model="...">` 的路徑。
- **背景**：`js/bg.js` 裡的 `FRAG`。想換顏色改 `c1 / c2 / c3`；想換流動速度改 `u_time * 0.08`。
- **顏色 / 字體**：`css/style.css` 最上方的 `:root`。
- **互動區**：`js/playground.js` 整支都可以換成別的 demo。

---

## 5. 之後可以加的東西

- 中文版：`main.js` 已留 `langBtn`，可以做成 i18n 物件切換文字。
- 多個模型：在 viewer 加一排縮圖按鈕呼叫 `loadModel(url)`。
- 作品詳細頁：每個作品一支 `works/xxx.html`。
