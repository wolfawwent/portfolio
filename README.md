# wolfawwent portfolio

## 本機卡片工作台

最快的開啟方式：雙擊 `start-card-editor.cmd`，會自動開啟專用編輯頁。

在 `D:\portfolio` 開啟 PowerShell，執行 `& '.\啟動卡片工具.ps1'`。啟動器會使用本機 Python 3.10 以上版本，自動打開具有專用登入憑證的卡片編輯器。若 Windows 阻擋腳本，可直接執行 `python tools/card-editor/server.py`。目前電腦也可使用 Codex 隨附的 Python；啟動腳本會優先尋找它。

1. 選擇包含內嵌貼圖的 GLB（上限 64 MB）。模型會自動置中、縮放並套用暖主光、冷輪廓光與補光。Blockbench 匯出時請包含需要的動畫。
2. 選擇一段動畫或原始姿勢。可播放、暫停，或拖動時間軸選擇卡片縮圖使用的姿勢。同一時間只播放選中的動畫。
3. 直接拖曳模型，或使用左右／上下、前後深度、大小與三個旋轉滑桿。深度負值往後、正值往前。卡框與模型依實際深度決定遮擋：位於卡框前方的部分可出框，後方的部分受卡框遮擋；下方金色名牌與底框固定置頂。
4. 填入最多 40 個字的名稱；使用本地 GNU Unifont，文字自動換行／縮放到名牌中。可另存透明背景 PNG。
5. 按「儲存到作品集」。程式將原始 GLB、當下姿勢的卡片 PNG 與動畫／構圖設定寫入 `assets/models/`、`assets/cards/` 和 `assets/cards/manifest.json`。選取已儲存的卡片後可再次編輯。每次更新使用新資產檔名，舊資產保留供回復。
6. 重新整理本機作品集即可看見新卡片；點卡片仍會開啟 3D 預覽，套用選中的動畫和播放狀態。尚未建立卡片時保留原有示範卡片。最後按原本流程 git add、commit、push 才會更新正式網站；編輯器不會自動推送或部署。

工作台僅監聽 `127.0.0.1`，每次啟動使用隨機登入憑證與 HttpOnly / SameSite cookie。讀取管理頁與寫入 API 皆需驗證；寫入亦檢查 Origin。正式静態網站沒有上傳／修改 API，且不顯示工具入口。編輯器源碼本身不含密碼。登入資料與清單備份位於被 Git 忽略的 `tools/card-editor/.local/`；不要將此資料夾另行公開。關閉啟動器視窗或按 Ctrl+C 可停止服務。

卡框來自提供的 Aseprite 檔 `Layer 1`，匯出為 `assets/cards/frame.png`（800×1200）。原始 `.aseprite` 不會被修改。Unifont 字體與授權文件在 `assets/fonts/`。Three.js 沿用網站既有的 0.170.0 CDN；第一次使用需要網路載入，支援內嵌 GLB 的 Draco、Meshopt 與 KTX2 解碼。

---

純 HTML / CSS / JS 作品集網站，Three.js 只用在 3D 預覽，不需要 Node、不需要 build。

```
portfolio/
├─ index.html          # 所有內容都在這裡（改文字、換作品就改這支）
├─ css/style.css       # 樣式（顏色在最上面的 :root 變數）
├─ js/bg.js            # 背景 shader（GLSL 寫在 FRAG 字串裡）
├─ js/main.js          # 出現動畫、卡片 tilt、打字機
├─ js/viewer.js        # 3D 模型預覽（Three.js）
├─ assets/img/         # 頭像、模型縮圖
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

## 4. 放上自己的模型

1. Blockbench：File → Export → **Export glTF/glb**（勾 .glb），存到 `assets/models/`。
2. 幫模型截一張縮圖（建議 400×250）存到 `assets/img/`。沒有也可以，卡片會顯示 NO PREVIEW。
3. 在 `index.html` 的 `#modelGrid` 複製一個 `<article class="card tilt model">`，改
   `data-model`、`data-name`、`img src` 和文字。
4. 第一張卡片會在網頁打開時自動載入。
5. 想先看模型效果、還不想改檔案？直接把 .glb **拖進預覽器**就會顯示（只在你的瀏覽器裡，不會上傳）。

其他：
- **文字**：改 `index.html`，每個區塊都有註解。
- **背景**：`js/bg.js` 裡的 `FRAG`。想換顏色改 `c1 / c2 / c3`；想換流動速度改 `u_time * 0.08`。
- **顏色 / 字體**：`css/style.css` 最上方的 `:root`。
- **互動區**：`js/playground.js` 整支都可以換成別的 demo。

---

## 5. 之後可以加的東西

- 中文版：`main.js` 已留 `langBtn`，可以做成 i18n 物件切換文字。
- 多個模型：在 viewer 加一排縮圖按鈕呼叫 `loadModel(url)`。
- 作品詳細頁：每個作品一支 `works/xxx.html`。
