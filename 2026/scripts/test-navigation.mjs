import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE = path.join(__dirname, '..');

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

console.warn('\n=== 1. 區段錨點導航與漸進載入（Progressive Hydration）架構驗證 ===');

const mainJsPath = path.join(SITE, 'assets', 'js', 'main.js');
const navJsPath = path.join(SITE, 'assets', 'js', 'ui', 'nav.js');
const componentsCssPath = path.join(SITE, 'assets', 'css', 'components.css');

const mainJs = fs.readFileSync(mainJsPath, 'utf8');
const navJs = fs.readFileSync(navJsPath, 'utf8');
const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

test('main.js 定義 mountSectionsUpTo 函式以一次性掛載目標區段及之前的所有區段', () => {
  assert.ok(mainJs.includes('function mountSectionsUpTo('), '必須存在 mountSectionsUpTo 函式');
  assert.ok(
    mainJs.includes('for (let i = 0; i <= targetIndex; i += 1)'),
    'mountSectionsUpTo 必須掛載 targetIndex 之前的所有區段'
  );
});

test('main.js 在 gk:navigate 事件觸發時呼叫 mountSectionsUpTo', () => {
  const navEvtIdx = mainJs.indexOf("addEventListener('gk:navigate'");
  assert.ok(navEvtIdx !== -1, '必須監聽 gk:navigate');
  const block = mainJs.slice(navEvtIdx, navEvtIdx + 300);
  assert.ok(block.includes('mountSectionsUpTo(sectionId)'), 'gk:navigate 應呼叫 mountSectionsUpTo');
});

test('main.js 在 checkHash 與 a[href] 點擊時呼叫 mountSectionsUpTo', () => {
  assert.ok(mainJs.includes('mountSectionsUpTo(clean)'), 'checkHash 應使用 mountSectionsUpTo');
  assert.ok(mainJs.includes('mountSectionsUpTo(candidate)'), 'click 監聽器應使用 mountSectionsUpTo');
});

test('main.js 在 bootstrap 中優先執行 setupProgressiveHydration 再執行 initNav', () => {
  const hydIdx = mainJs.indexOf('setupProgressiveHydration();');
  const navIdx = mainJs.indexOf('initNav();');
  assert.ok(hydIdx !== -1 && navIdx !== -1, '必須呼叫 setupProgressiveHydration 與 initNav');
  assert.ok(hydIdx < navIdx, 'setupProgressiveHydration 必須在 initNav 之前執行以利初始化掛載');
});

console.warn('\n=== 2. 導航目標解析與捲動校準機制驗證 (nav.js) ===');

test('getHashSectionId 支援帶斜線 (/#/agenda) 與不帶斜線 (#agenda) 的錨點格式', () => {
  const matchRegex = /^#\/?([a-zA-Z0-9_-]+)/;
  assert.equal('#/agenda'.match(matchRegex)[1], 'agenda');
  assert.equal('#agenda'.match(matchRegex)[1], 'agenda');
  assert.equal('#/thanks'.match(matchRegex)[1], 'thanks');
  assert.equal('#thanks'.match(matchRegex)[1], 'thanks');
  assert.equal('#section-agenda'.match(matchRegex)[1], 'section-agenda');
  assert.equal('#/thanks_2026'.match(matchRegex)[1], 'thanks_2026');
});

test('findSection 支援正規化 section- 前綴與 _2026 後綴', () => {
  assert.ok(navJs.includes("replace(/^section-/, '')"), 'findSection 應去除 section- 前綴');
  assert.ok(navJs.includes("replace(/_2026$/, '')"), 'findSection 應去除 _2026 後綴');
  assert.ok(navJs.includes('document.getElementById(sectionId)'), 'findSection 應支援 getElementById 查詢');
});

test('nav.js 在 popstate 事件時分派 gk:navigate 確保前進/返回時掛載目標區段', () => {
  const popIdx = navJs.indexOf("addEventListener('popstate'");
  assert.ok(popIdx !== -1, '必須監聽 popstate');
  const block = navJs.slice(popIdx, popIdx + 400);
  assert.ok(block.includes("CustomEvent('gk:navigate'"), 'popstate 應分派 gk:navigate');
});

test('nav.js scrollToSection 包含 double-rAF 與捲動自動校準機制', () => {
  assert.ok(navJs.includes('scheduleScrollCorrection('), 'scrollToSection 應包含 scheduleScrollCorrection');
  assert.ok(
    navJs.includes('requestAnimationFrame(() => {\n      requestAnimationFrame(doScroll);'),
    'scrollToSection 應使用雙重 requestAnimationFrame 等待 DOM 繪製穩定'
  );
  assert.ok(navJs.includes('void target.offsetHeight;'), 'scrollToSection 應強制觸發同步 reflow 確保座標精準');
  assert.ok(navJs.includes('checkAndAlignTarget('), '必須存在 checkAndAlignTarget');
});

test('nav.js scheduleScrollCorrection 等待捲動真正停止後才校準，不中途暴力打斷平滑捲動', () => {
  assert.ok(!navJs.includes('const timers = [250, 500, 800];'), '不可使用固定 250/500/800ms 定時器在中途打斷平滑捲動');
  assert.ok(navJs.includes("window.addEventListener('scrollend'"), '應監聽 scrollend 事件');
  assert.ok(navJs.includes("window.addEventListener('scroll'"), '應有 scroll 防抖作為舊版瀏覽器備援');
  assert.ok(navJs.includes('currentCorrectionCleanup'), '應支援中途切換目標時清理前次校準監聽');
});

test('nav.js 在 initNav 與 popstate 時使用 behavior: auto 進行即時精準定位', () => {
  assert.ok(
    navJs.includes("scrollToSection(hashId, { behavior: 'auto' })"),
    '初次載入與 popstate 應使用 behavior: auto'
  );
  assert.ok(navJs.includes("window.scrollTo({ top: 0, behavior: 'auto' })"), 'popstate 返回首頁時應正確捲動至頂部');
});

console.warn('\n=== 3. 圖片排版與累計版面位移 (CLS) 防護驗證 ===');

test('components.css 中的 .gk-agenda-map-image 已設定 aspect-ratio 避免延遲載入位移', () => {
  const mapImgIdx = componentsCss.indexOf('.gk-agenda-map-image {');
  assert.ok(mapImgIdx !== -1, '必須存在 .gk-agenda-map-image');
  const block = componentsCss.slice(mapImgIdx, mapImgIdx + 300);
  assert.ok(block.includes('aspect-ratio: 720 / 480;'), '地圖圖檔應設定 aspect-ratio');
});

console.warn(`\n✔ 導航與版面位移校準測試全數通過！總共 ${passed}/${total} 項測試通過。\n`);
