# GDG Kaohsiung 活動官方網站 (gdgkh.cc)

本專案為 **GDG Kaohsiung**（Google 開發者社群 高雄，Google Developer Groups Kaohsiung）的官方活動入口網站與歷年活動網頁儲存庫，線上託管於 [gdgkh.cc](https://gdgkh.cc)。

專案採用**年份分類架構（Year-based Architecture）**，將各年度的活動網站獨立收納於專屬目錄中。此設計既能完整保留歷史活動內容，也能支援不同年度活動的主題演進與獨立維護。

**語言版本**: **繁體中文** | [English](README.en.md) | [日本語](README.ja.md)

## 📌 專案定位

- **活動統一入口**：作為 GDG Kaohsiung 舉辦之年度大型技術研討會（如 DevFest Kaohsiung）與各項社群活動的主要門戶。
- **歷史活動存檔**：各年度網站、講者陣容、演講主題、贊助名單與合作夥伴皆獨立留存，活動結束後網址長期有效。
- **社群協同維護**：採用靜態網站技術與資料分離設計，搭配視覺化編輯工具，方便志工團隊與社群組織者更新內容。

## 🌟 核心特色

- **多語言支援（i18n）**：支援繁體中文、英文與日文，便於國際講者與海外社群瀏覽。
- **響應式網頁設計**：採用 Material Design 等現代化介面風格，適應行動裝置、平板與桌上型電腦。
- **資料與視圖分離**：講者名單、贊助商資訊、活動議程、社群名錄等均以 JSON 檔案統一管理。
- **視覺化內容編輯器**：內建網頁端視覺化編輯工具（如 `json-editor.html`、`editor.html`），可透過表單介面檢視並匯出資料。
- **靜態分享頁面與社群預覽**：提供個別講者與主題的靜態頁面產生功能，結合 Open Graph 標籤與社群分享預覽圖片最佳化。
- **輕量化架構**：以原生 HTML、CSS 與 JavaScript 為核心，無須重度建置框架即可直接部署於靜態網頁代管服務。

## 🏗️ 專案架構

儲存庫採用以年度劃分的模組化架構：

```text
/
├── index.html                    # 根目錄重新導向頁面（自動跳轉至最新年度活動）
├── CNAME                         # 自訂網域設定（gdgkh.cc）
├── package.json                  # 專案相依套件與指令碼設定
├── 2025/                         # 2025 年度活動網站（DevFest 2025）
│   ├── index.html                # 2025 活動首頁
│   ├── json-editor.html          # 2025 視覺化內容編輯器
│   ├── css/                      # 樣式表檔案
│   ├── js/                       # 核心邏輯與動態資料渲染
│   ├── data/                     # 講者、贊助商、社群等 JSON 資料
│   ├── images/                   # 圖片資源
│   └── share/                    # 靜態分享頁面
├── 2026/                         # 2026 年度活動網站（DevFest 2026）
│   ├── index.html                # 2026 活動首頁
│   ├── editor.html               # 2026 視覺化內容編輯器
│   ├── data/                     # 2026 資料檔案
│   ├── scripts/                  # 建置與最佳化指令碼
│   └── share/                    # 靜態分享頁面
└── ...                           # 未來各年度活動目錄
```

### 網址與跳轉機制

- **根網域 (`https://gdgkh.cc/`)**：透過根目錄 [index.html](file:///Users/a00911914/Project/GdgkhCc/index.html) 重新導向至最新年度活動（例如目前的 `/2026/`）。
- **年度活動頁面 (`https://gdgkh.cc/<年份>/`)**：直接存取特定年度活動完整頁面（如 `https://gdgkh.cc/2025/` 或 `https://gdgkh.cc/2026/`）。
- **個別分享頁面 (`https://gdgkh.cc/<年份>/share/...`)**：提供講者或主題之靜態分享預覽頁面。

## 🚀 本地開發與預覽

由於網站使用非同步方式載入 JSON 資料，受瀏覽器安全性限制，需透過本地網頁伺服器（Web Server）執行預覽：

### 啟動本地伺服器

可於專案根目錄或特定年度目錄下執行下列命令：

```bash
# 方法 1：使用 Node.js serve 套件
npx serve .

# 方法 2：使用 Python 內建 HTTP 伺服器
python3 -m http.server 8000

# 方法 3：使用 VS Code 的 Live Server 擴充功能
```

伺服器啟動後，於瀏覽器造訪提示之網址（如 `http://localhost:8000` 或 `http://localhost:3000`）即可預覽。

### 專案指令

專案根目錄 [package.json](file:///Users/a00911914/Project/GdgkhCc/package.json) 內建常用指令：

```bash
# 程式碼格式化與檢查
npm run lint          # 執行 ESLint 程式碼檢查
npm run format        # 執行 Prettier 程式碼格式化
npm run format:check  # 檢查程式碼格式

# 各年度專屬靜態產生與最佳化指令請參閱 package.json 中的 scripts 定義
```

## 📝 內容管理方式

1. **透過視覺化編輯器**：開啟該年度的編輯器頁面（例如 `/2025/json-editor.html` 或 `/2026/editor.html`），可透過表單載入既有 JSON、修改資料並下載更新後的檔案。
2. **手動編輯 JSON 檔案**：直接修改各年度 `data/` 目錄下的 JSON 檔案。
3. **產生靜態分享頁面**：更新資料後，執行對應年度的生成指令碼，以產生包含社群預覽標籤的靜態頁面。

## 📄 授權條款

本專案採用 [MIT License](file:///Users/a00911914/Project/GdgkhCc/LICENSE) 授權條款開源發布。

## 🤝 參與貢獻

歡迎社群夥伴回報問題或提出建議。如有任何修改需求，歡迎透過 [GitHub Issues](https://github.com/gdg-kh/GdgkhCc/issues) 回報或發送 Pull Request。

---

**組織**：[GDG Kaohsiung](https://www.facebook.com/GDGKaohsiung)
