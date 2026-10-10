import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE = path.join(__dirname, '..');
const ROOT = path.join(SITE, '..');

let total = 0;
let passed = 0;

function test(name, fn) {
  total += 1;
  try {
    fn();
    passed += 1;
    console.warn(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

console.warn('\n=== 1. Service Worker 快取機制與策略驗證 (sw.js) ===');

const swContent = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');

test('CACHE_VERSION 已升級至 gk-2026-v5 以上以廢除舊有快取', () => {
  const match = swContent.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
  assert.ok(match, '必須定義 CACHE_VERSION');
  assert.match(match[1], /^gk-2026-v[5-9]\d*$/, '快取版本應為 gk-2026-v5 以上');
});

test('資料 (JSON) 請求採用 Network-First 策略以確保連線時獲得最新資料', () => {
  const isDataIdx = swContent.indexOf('資料檔案 (JSON)');
  assert.ok(isDataIdx !== -1, '必須存在資料檔案區塊');
  const dataBlock = swContent.slice(isDataIdx, isDataIdx + 1200);
  assert.ok(dataBlock.includes('Network-First'), '資料區塊應註明 Network-First 策略');
  assert.ok(dataBlock.includes('const networkResponse = await fetch(request);'), '資料檔案應優先從網路拉取最新內容');
  assert.ok(dataBlock.includes('ignoreSearch: true'), '資料檔案離線時應支援 ignoreSearch 降級');
});

test('導航請求 (HTML) 採用 Network-First 策略以確保重新整理載入最新頁面', () => {
  const navIdx = swContent.indexOf('頁面導航（HTML）');
  assert.ok(navIdx !== -1, '必須處理頁面導航 navigate');
  const navBlock = swContent.slice(navIdx, navIdx + 1200);
  assert.ok(navBlock.includes('Network-First'), '導航區塊應註明 Network-First 策略');
  assert.ok(navBlock.includes('const networkResponse = await fetch(request);'), '導航請求應優先 fetch 最新 HTML');
});

test('靜態圖片請求採用 Network-First 策略與精確比對，避免使用者在有網路時看見過期圖片', () => {
  const isImgIdx = swContent.indexOf('靜態圖片');
  assert.ok(isImgIdx !== -1, '必須存在靜態圖片處理區塊');
  const imgBlock = swContent.slice(isImgIdx, isImgIdx + 2000);
  assert.ok(imgBlock.includes('Network-First'), '圖片區塊應採用 Network-First 策略');
  assert.ok(imgBlock.includes('const networkResponse = await fetch(request);'), '圖片應優先從網路拉取最新圖檔');
  assert.ok(imgBlock.includes('const cachedResponse = await cache.match(request);'), '圖片離線時應先以精確 URL 比對');
  assert.ok(imgBlock.includes('ignoreSearch: true'), '圖片離線時應具備 ignoreSearch 降級');
});

test('支援明確快取跳過條件（request.cache === reload / no-store / no-cache / _t / nocache）', () => {
  assert.ok(swContent.includes('isExplicitBypass'), '必須定義明確快取跳過條件 isExplicitBypass');
  assert.ok(swContent.includes("request.cache === 'reload'"), '支援瀏覽器重新整理 reload');
  assert.ok(swContent.includes("request.cache === 'no-store'"), '支援 no-store');
  assert.ok(swContent.includes("request.cache === 'no-cache'"), '支援條件式驗證 no-cache');
  assert.ok(swContent.includes("url.searchParams.has('_t')"), '支援 _t 時間戳破快取');
  assert.ok(swContent.includes("url.searchParams.has('nocache')"), '支援 nocache 參數');
});

test('支援 SKIP_WAITING message 事件監聽', () => {
  assert.ok(swContent.includes("event.data.type === 'SKIP_WAITING'"), 'SW 應支援跳過等待通知');
});

console.warn('\n=== 2. 前端 Store 與圖檔路徑版號驗證 (store.js) ===');

const storeContent = fs.readFileSync(path.join(SITE, 'assets', 'js', 'core', 'store.js'), 'utf8');

test('fetchJson 確保請求網址必帶版本參數 (?v=...) 阻擋瀏覽器 HTTP 磁碟快取', () => {
  assert.ok(storeContent.includes("const sep = path.includes('?') ? '&' : '?';"), '應正確處理 query 分隔符號');
  assert.ok(storeContent.includes('${path}${sep}v=${encodeURIComponent(version)}'), 'URL 應帶有版本查詢參數');
});

test('fetchJson 明確指定 cache: "no-cache" 進行條件式驗證', () => {
  assert.ok(storeContent.includes("fetch(url, { cache: 'no-cache' })"), 'fetch 必須傳入 cache: "no-cache"');
});

test('assetPath 與 responsiveAssetPath 支援帶入版本參數 (?v=...) 進行圖檔快取清除', () => {
  assert.ok(storeContent.includes('const version = getAssetVersion();'), 'assetPath 應獲取資產版本');
  assert.ok(storeContent.includes('?v=${encodeURIComponent(version)}'), 'assetPath 應支援附加版號參數');
});

test('getAssetVersion 於 meta 缺失時仍能安全提供預設版本防呆', () => {
  assert.ok(
    storeContent.includes("getAssetVersion() || '2026.10.10'"),
    '當 meta 不存在時應有版本備援，避免回傳空字串或 null'
  );
});

console.warn('\n=== 3. 響應式圖片解析與查詢參數保留驗證 (card.js / detail-modal.js / about.js / ballot-card.js) ===');

const cardContent = fs.readFileSync(path.join(SITE, 'assets', 'js', 'ui', 'card.js'), 'utf8');
const modalContent = fs.readFileSync(path.join(SITE, 'assets', 'js', 'ui', 'detail-modal.js'), 'utf8');
const aboutContent = fs.readFileSync(path.join(SITE, 'assets', 'js', 'sections', 'about.js'), 'utf8');
const ballotContent = fs.readFileSync(path.join(SITE, 'assets', 'js', 'ui', 'ballot-card.js'), 'utf8');

test('card.js makePersonImage 正確保留圖片版本查詢參數至 webp 與 srcset', () => {
  assert.ok(
    cardContent.includes("images/${type}/${id}-320.webp${query}"),
    'makePersonImage 應保留 query 至 320.webp'
  );
  assert.ok(
    cardContent.includes("images/${type}/${id}-160.webp${query} 160w"),
    'makePersonImage 應保留 query 至 srcset'
  );
});

test('card.js 議程講者頭像正確保留圖片版本查詢參數', () => {
  assert.ok(
    cardContent.includes("images/${type}/${id}-64.webp${query}"),
    '議程講者小頭像應保留 query 至 64.webp'
  );
});

test('detail-modal.js renderMedia 正確保留圖片版本查詢參數至 640.webp 與 srcset', () => {
  assert.ok(
    modalContent.includes("images/${type}/${id}-640.webp${query}"),
    'detail-modal 應保留 query 至 640.webp'
  );
  assert.ok(
    modalContent.includes("images/${type}/${id}-320.webp${query} 320w"),
    'detail-modal 應保留 query 至 srcset'
  );
});

test('about.js 與 ballot-card.js 正確保留圖片版本查詢參數', () => {
  assert.ok(aboutContent.includes("images/${type}/${id}-640.webp${query}"), 'about.js 應保留 query');
  assert.ok(ballotContent.includes("images/${type}/${id}-160.webp${query}"), 'ballot-card.js 應保留 query');
});

console.warn('\n=== 4. 主頁與範本檔快取標頭 (Cache-Control & version) ===');

const index2026 = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const rootIndex = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const shareTemplate = fs.readFileSync(path.join(SITE, 'scripts', 'share-template.html'), 'utf8');

test('2026/index.html 包含 meta version 與 Cache-Control', () => {
  assert.ok(index2026.includes('<meta name="version" content="2026.10.10" />'), '2026/index.html 應有 meta version');
  assert.ok(
    index2026.includes('<meta http-equiv="Cache-Control" content="no-cache, must-revalidate" />'),
    '2026/index.html 應有 Cache-Control 標籤'
  );
});

test('根目錄 index.html 轉址頁面設定防快取標籤避免轉址鎖死', () => {
  assert.ok(
    rootIndex.includes('http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"'),
    '根目錄 index.html 應禁止快取'
  );
  assert.ok(rootIndex.includes('http-equiv="Pragma" content="no-cache"'), '應提供 Pragma 標頭');
  assert.ok(rootIndex.includes('http-equiv="Expires" content="0"'), '應提供 Expires 標頭');
});

test('2026 分享頁範本 share-template.html 包含 meta version 與 Cache-Control', () => {
  assert.ok(
    shareTemplate.includes('<meta name="version" content="2026.10.10" />'),
    'share-template.html 應包含 meta version'
  );
  assert.ok(
    shareTemplate.includes('<meta http-equiv="Cache-Control" content="no-cache, must-revalidate" />'),
    'share-template.html 應包含 Cache-Control 標籤'
  );
});

test('2026 所有已生成之靜態分享頁面皆包含 meta version 與 Cache-Control', () => {
  const shareDir = path.join(SITE, 'share');
  assert.ok(fs.existsSync(shareDir), 'share 目錄應存在');
  const subdirs = ['speakers', 'staff', 'thanks', 'booths'];
  let checkedCount = 0;
  for (const sub of subdirs) {
    const parentDir = path.join(shareDir, sub);
    if (!fs.existsSync(parentDir)) continue;
    for (const entry of fs.readdirSync(parentDir)) {
      const pageFile = path.join(parentDir, entry, 'index.html');
      if (fs.existsSync(pageFile)) {
        const html = fs.readFileSync(pageFile, 'utf8');
        assert.ok(html.includes('<meta name="version"'), `${pageFile} 應包含 meta version`);
        assert.ok(html.includes('Cache-Control'), `${pageFile} 應包含 Cache-Control 標頭`);
        checkedCount += 1;
      }
    }
  }
  assert.ok(checkedCount >= 20, `應至少驗證 20 個已生成的獨立分享頁面，實際驗證：${checkedCount}`);
});

console.warn('\n=== 5. Service Worker 生命週期與自動更新 (main.js) ===');

const mainContent = fs.readFileSync(path.join(SITE, 'assets', 'js', 'main.js'), 'utf8');

test('registerServiceWorker 設定 updateViaCache: "none" 防止 sw.js 遭 HTTP 快取鎖定', () => {
  assert.ok(mainContent.includes("updateViaCache: 'none'"), 'SW 註冊時必須設定 updateViaCache: "none"');
});

test('頁面能見度變更 (visibilitychange) 自動觸發 SW 更新與資料重載', () => {
  assert.ok(mainContent.includes("document.addEventListener('visibilitychange'"), '必須監聽 visibilitychange');
  assert.ok(mainContent.includes('reg.update()'), '當切換回分頁時應觸發 reg.update()');
  assert.ok(mainContent.includes('loadData()'), '當切換回分頁時應重新呼叫 loadData()');
});

test('監聽 controllerchange 自動確保新版 Service Worker 啟用時更新資料', () => {
  assert.ok(
    mainContent.includes("navigator.serviceWorker.addEventListener('controllerchange'"),
    '必須監聽 controllerchange'
  );
});

console.warn('\n=== 6. 2025 動態內容與範本快取驗證 ===');

const dynamicContent2025 = fs.readFileSync(path.join(ROOT, '2025', 'js', 'dynamic-content.js'), 'utf8');

test('2025 dynamic-content.js 之 loadJSON 傳入 cache: "no-cache"', () => {
  assert.ok(
    dynamicContent2025.includes("fetch(url, { cache: 'no-cache' })"),
    '2025 loadJSON 必須設定 cache: "no-cache"'
  );
});

const tpls = [
  'speaker-template.html',
  'staff-template.html',
  'thanks-template.html',
  'twm-template.html',
  'community-template.html',
  'about-template.html',
];

for (const tpl of tpls) {
  test(`2025 ${tpl} 載入 JSON 時傳入 cache: "no-cache"`, () => {
    const content = fs.readFileSync(path.join(ROOT, '2025', tpl), 'utf8');
    assert.ok(content.includes("{ cache: 'no-cache' }"), `${tpl} 的 fetch 必須帶有 cache: 'no-cache'`);
  });
}

test('package.json 中 2025 生成腳本路徑正確指向 2025/ 目錄', () => {
  const pkgContent = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgContent);
  assert.ok(pkg.scripts['generate:speakers'].includes('2025/'), 'generate:speakers 應指向 2025 目錄');
  assert.ok(pkg.scripts['generate:thanks'].includes('2025/'), 'generate:thanks 應指向 2025 目錄');
});

console.warn(`\n✔ 快取修復機制全數通過！總共 ${passed}/${total} 項測試通過。\n`);
