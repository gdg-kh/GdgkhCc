#!/usr/bin/env node
/**
 * 規格檢查腳本 — 把能自動驗的驗收條件跑成一支指令。
 *
 * 用法：npm run check:2026
 *
 * 分兩類檢查：
 *   資料檢查 — 讀 data/*.json，驗關聯完整性、id 唯一性、時間格式與重疊
 *   程式碼檢查 — 掃 assets/js/ 與 scripts/，抓違反規格的寫法
 *
 * 這支腳本不取代人工驗收（版面、鍵盤操作、手機實機測試還是要自己看），
 * 但能把最常出錯、最容易漏看的那幾條變成秒級回饋。
 *
 * 退出碼：有 error 時為 1，只有 warning 時為 0。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(__dirname, '..');

const errors = [];
const warnings = [];

const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------- 工具

function readJson(relPath) {
  const full = path.join(SITE, relPath);
  if (!fs.existsSync(full)) {
    err(`找不到檔案：${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    err(`${relPath} 不是合法 JSON：${e.message}`);
    return null;
  }
}

function walk(dir, ext, acc = []) {
  if (!fs.existsSync(dir)) {
    return acc;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, ext, acc);
    } else if (entry.name.endsWith(ext)) {
      acc.push(full);
    }
  }
  return acc;
}

const rel = (full) => path.relative(SITE, full);

// 把 'YYYY-MM-DDTHH:mm' 轉成可比較的分鐘數，不用 Date 避免時區干擾
function toMinutes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(iso || '');
  if (!m) {
    return null;
  }
  const [, y, mo, d, h, mi] = m.map(Number);
  return (((y * 12 + mo) * 31 + d) * 24 + h) * 60 + mi;
}

const ID_RE = /^[a-z0-9_]+$/;
const RESERVED = new Set([
  'data',
  'css',
  'js',
  'assets',
  'images',
  'share',
  'scripts',
  'speakers',
  'staff',
  'thanks',
  'booths',
]);

const GDG_COLORS = new Set(['#ea4335', '#4285f4', '#f9ab00', '#34a853', '#1e1e1e', '#f0f0f0']);

// ---------------------------------------------------------------- 資料檢查

const config = readJson('data/config.json');
const content = readJson('data/content.json');

function checkIds(list, label) {
  const seen = new Set();
  for (const item of list || []) {
    if (!item.id) {
      err(`${label}: 有一筆沒有 id`);
      continue;
    }
    if (!ID_RE.test(item.id)) {
      err(`${label}/${item.id}: id 只能是小寫英數與底線`);
    }
    if (RESERVED.has(item.id)) {
      err(`${label}/${item.id}: id 使用了保留字`);
    }
    if (seen.has(item.id)) {
      err(`${label}/${item.id}: id 重複`);
    }
    seen.add(item.id);
    if (!item.name || !item.name['zh-Hant']) {
      err(`${label}/${item.id}: 缺少 name.zh-Hant`);
    }
  }
  return seen;
}

if (content) {
  const speakerIds = checkIds(content.speakers, 'speakers');
  const sessionIds = checkIds(
    content.sessions ? content.sessions.map((s) => ({ ...s, name: s.title })) : [],
    'sessions'
  );
  checkIds(content.staff, 'staff');
  checkIds(content.thanks, 'thanks');
  checkIds(content.booths, 'booths');

  const groupIds = new Set((content.sessionGroups || []).map((g) => g.id));
  const trackIds = new Set((content.tracks || []).map((t) => t.id));

  // 講者與議程的雙向關聯
  for (const sp of content.speakers || []) {
    for (const sid of sp.sessionIds || []) {
      if (!sessionIds.has(sid)) {
        err(`speakers/${sp.id}: sessionIds 指向不存在的議程「${sid}」`);
        continue;
      }
      const ses = content.sessions.find((s) => s.id === sid);
      if (!(ses.speakerIds || []).includes(sp.id)) {
        err(`關聯不對稱：speakers/${sp.id} 指向 ${sid}，但該議程的 speakerIds 沒有回指`);
      }
    }
  }

  for (const ses of content.sessions || []) {
    for (const spid of ses.speakerIds || []) {
      if (!speakerIds.has(spid)) {
        err(`sessions/${ses.id}: speakerIds 指向不存在的講者「${spid}」`);
        continue;
      }
      const sp = content.speakers.find((s) => s.id === spid);
      if (!(sp.sessionIds || []).includes(ses.id)) {
        err(`關聯不對稱：sessions/${ses.id} 指向 ${spid}，但該講者的 sessionIds 沒有回指`);
      }
    }
    if (ses.groupId && !groupIds.has(ses.groupId)) {
      err(`sessions/${ses.id}: groupId「${ses.groupId}」不存在`);
    }
    if (ses.trackId && ses.trackId !== 'all' && !trackIds.has(ses.trackId)) {
      err(`sessions/${ses.id}: trackId「${ses.trackId}」不存在`);
    }
    if (toMinutes(ses.start) === null) {
      err(`sessions/${ses.id}: start 格式錯誤，應為 YYYY-MM-DDTHH:mm`);
    }
    if (toMinutes(ses.end) === null) {
      err(`sessions/${ses.id}: end 格式錯誤，應為 YYYY-MM-DDTHH:mm`);
    }
    if (toMinutes(ses.start) !== null && toMinutes(ses.end) !== null && toMinutes(ses.end) <= toMinutes(ses.start)) {
      err(`sessions/${ses.id}: end 不晚於 start`);
    }
  }

  // 同一軌道的時間重疊
  const byTrack = {};
  for (const ses of content.sessions || []) {
    const key = ses.trackId || 'default';
    if (key === 'all') {
      continue;
    }
    (byTrack[key] ||= []).push(ses);
  }
  for (const [track, list] of Object.entries(byTrack)) {
    const sorted = [...list].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < sorted.length; i += 1) {
      if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
        err(`會場 ${track}: ${sorted[i - 1].id} 與 ${sorted[i].id} 時間重疊`);
      }
    }
  }

  // 群組歸屬
  const thanksGroupIds = new Set((content.thanksGroups || []).map((g) => g.id));
  for (const item of content.thanks || []) {
    if (item.groupId && !thanksGroupIds.has(item.groupId)) {
      warn(`thanks/${item.id}: groupId「${item.groupId}」不存在，會被歸到未分組`);
    }
  }

  // 群組顏色必須是 GDG 官方色
  for (const g of content.sessionGroups || []) {
    if (g.color && !GDG_COLORS.has(String(g.color).toLowerCase())) {
      err(`sessionGroups/${g.id}: color「${g.color}」不是 GDG 官方色票`);
    }
  }

  // 圖片路徑不該寫進 JSON
  const BANNED_FIELDS = ['avatar', 'image', 'logo', 'ogImage', 'photo', 'slug'];
  const scanBanned = (list, label) => {
    for (const item of list || []) {
      for (const f of BANNED_FIELDS) {
        if (f in item) {
          err(`${label}/${item.id}: 不該有 ${f} 欄位（圖片路徑由 id 推導，識別碼只用 id）`);
        }
      }
    }
  };
  scanBanned(content.speakers, 'speakers');
  scanBanned(content.staff, 'staff');
  scanBanned(content.thanks, 'thanks');
  scanBanned(content.booths, 'booths');

  // 圖片檔案是否存在（母圖警告、衍生 WebP 報錯）
  const REQUIRED_WEBP_SIZES = {
    speakers: [64, 160, 320, 640],
    staff: [160, 320, 640],
    thanks: [160, 320, 640],
    booths: [160, 320, 640],
  };

  const checkImages = (list, dir, ext) => {
    const sizes = REQUIRED_WEBP_SIZES[dir] || [];
    for (const item of list || []) {
      const p = path.join(SITE, 'images', dir, `${item.id}${ext}`);
      if (!fs.existsSync(p)) {
        warn(`缺少圖片：images/${dir}/${item.id}${ext}`);
      }
      for (const size of sizes) {
        const webpPath = path.join(SITE, 'images', dir, `${item.id}-${size}.webp`);
        if (!fs.existsSync(webpPath)) {
          err(`缺少衍生 WebP 圖檔：images/${dir}/${item.id}-${size}.webp（請執行 npm run optimize:images）`);
        }
      }
    }
  };
  checkImages(content.speakers, 'speakers', '.jpg');
  checkImages(content.staff, 'staff', '.jpg');
  checkImages(content.thanks, 'thanks', '.png');
  checkImages(content.booths, 'booths', '.png');

  for (const map of content.venueMaps || []) {
    if (map && typeof map.file === 'string') {
      const orig = path.join(SITE, 'images', map.file);
      if (!fs.existsSync(orig)) {
        warn(`缺少會場地圖母圖：images/${map.file}`);
      }
      const parsed = path.parse(map.file);
      if (/\.(jpg|jpeg|png)$/i.test(parsed.ext)) {
        for (const size of [720, 1200]) {
          const webpPath = path.join(SITE, 'images', parsed.dir, `${parsed.name}-${size}.webp`);
          if (!fs.existsSync(webpPath)) {
            const relDisplay = path.join(parsed.dir, `${parsed.name}-${size}.webp`);
            err(`缺少衍生 WebP 圖檔：images/${relDisplay}（請執行 npm run optimize:images）`);
          }
        }
      }
    }
  }

  // about 版型設定：columns 與每筆 sections.span
  if (content.about && typeof content.about === 'object') {
    const cols = content.about.columns;
    const validCols = Number.isInteger(cols) && cols >= 1 && cols <= 4;
    if (cols !== undefined && !validCols) {
      err(`about.columns: 必須是 1–4 的整數，目前是「${cols}」`);
    }
    const effectiveCols = validCols ? cols : 2;
    for (const sec of content.about.sections || []) {
      if (sec.span === undefined) {
        continue;
      }
      if (!Number.isInteger(sec.span) || sec.span < 1) {
        err(`about.sections/${sec.id || '?'}: span 必須是正整數，目前是「${sec.span}」`);
      } else if (sec.span > effectiveCols) {
        warn(
          `about.sections/${sec.id || '?'}: span=${sec.span} 超過 columns=${effectiveCols}，前台會被限制為 ${effectiveCols}`
        );
      }
    }
  }
}

if (config) {
  const menu = config.menu || [];
  const orders = menu.map((m) => m.order);
  if (new Set(orders).size !== orders.length) {
    err('config.menu: order 有重複');
  }
  for (const m of menu) {
    if (m.placement && !['nav', 'home', 'footer'].includes(m.placement)) {
      err(`config.menu/${m.id}: placement「${m.placement}」不是 nav / home / footer`);
    }
    if ((m.type === 'external' || m.type === 'cta') && !m.url) {
      warn(`config.menu/${m.id}: url 為空，該項目不會渲染`);
    }
  }

  const langs = (config.i18n && config.i18n.languages) || [];
  const codes = langs.map((l) => l.code);
  for (const c of codes) {
    if (!['zh-Hant', 'en', 'ja'].includes(c)) {
      err(`config.i18n: 語言代碼「${c}」不在 zh-Hant / en / ja 之內`);
    }
  }
  if (!langs.some((l) => l.enabled)) {
    err('config.i18n: 沒有任何語言的 enabled 為 true');
  }

  // 所有外部連結格式
  const urls = [
    ['virtualSpace.url', config.virtualSpace && config.virtualSpace.url],
    ...menu.filter((m) => m.url).map((m) => [`menu.${m.id}.url`, m.url]),
  ];
  for (const [label, url] of urls) {
    if (url && !/^https?:\/\//.test(url)) {
      err(`${label}: 網址必須以 http:// 或 https:// 開頭`);
    }
  }
}

// ---------------------------------------------------------------- 程式碼檢查

const jsFiles = walk(path.join(SITE, 'assets', 'js'), '.js');
const mjsFiles = walk(path.join(SITE, 'scripts'), '.mjs');
const cssFiles = walk(path.join(SITE, 'assets', 'css'), '.css');
const htmlFiles = fs
  .readdirSync(SITE)
  .filter((f) => f.endsWith('.html'))
  .map((f) => path.join(SITE, f));

for (const file of jsFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.innerHTML|\.outerHTML|document\.write/.test(text)) {
    err(`${rel(file)}: 使用了 innerHTML / outerHTML / document.write`);
  }
  if (/\bnew Date\(\s*['"`]/.test(text) && /agenda|calendar/i.test(file)) {
    err(`${rel(file)}: 用 new Date() 解析議程時間字串，會受裝置時區影響`);
  }
  const hardUrls = (text.match(/https?:\/\/[^\s'"`)]+/g) || []).filter(
    (u) => !u.includes('googletagmanager.com') && !u.includes('calendar.google.com')
  );
  if (hardUrls.length) {
    err(`${rel(file)}: 有寫死的外部網址 ${hardUrls[0]}（應從 JSON 取）`);
  }
  if (/\bvar\s+/.test(text)) {
    err(`${rel(file)}: 使用了 var`);
  }
  if (/console\.(log|info|debug)\(/.test(text)) {
    warn(`${rel(file)}: 有 console.log（ESLint 只允許 warn 與 error）`);
  }
}

for (const file of [...jsFiles, ...mjsFiles, ...htmlFiles]) {
  if (path.basename(file) === 'check.mjs') {
    continue; // 這支腳本本身的訊息裡就有這個字串
  }
  const text = fs.readFileSync(file, 'utf8');
  if (/GDG\s+Lead/i.test(text)) {
    err(`${rel(file)}: 出現「GDG Lead」，該用語已停用，請改為 GDG Organizer`);
  }
}

for (const file of [...jsFiles, ...cssFiles, ...htmlFiles]) {
  const base = path.basename(file);
  if (base === 'tokens.css' || base === 'editor.html') {
    continue; // tokens.css 是色碼定義處；editor.html 是後台單檔工具，含大量非品牌灰階
  }
  const text = fs.readFileSync(file, 'utf8');
  const hexes = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  if (hexes.length) {
    err(`${rel(file)}: 直接寫了色碼 ${hexes[0]}（顏色一律用 tokens.css 的 CSS 變數）`);
  }
}

const tokensFile = path.join(SITE, 'assets', 'css', 'tokens.css');
if (fs.existsSync(tokensFile)) {
  const text = fs.readFileSync(tokensFile, 'utf8');
  for (const c of ['#ea4335', '#4285f4', '#f9ab00', '#34a853', '#1e1e1e', '#f0f0f0']) {
    if (!text.toLowerCase().includes(c)) {
      err(`tokens.css: 缺少 GDG 官方色 ${c}`);
    }
  }
  for (const bad of ['#fbbc04', '#000000', '#ffffff', '#fff;', '#000;']) {
    if (text.toLowerCase().includes(bad)) {
      err(`tokens.css: 出現非官方色 ${bad}`);
    }
  }
  if (/Noto\s+Sans\s+(TC|JP)/i.test(text) && /@import/.test(text)) {
    const importLine = text.split('\n').find((l) => l.includes('@import')) || '';
    if (/Noto\+Sans/i.test(importLine)) {
      err('tokens.css: @import 引入了中文或日文 webfont（中日文應使用系統字體）');
    }
  }
  if (/(Arial|Helvetica|Open Sans|Archivo|Anton)/i.test(text)) {
    err('tokens.css: 使用了不被允許的替代字體');
  }
}

for (const file of cssFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const heavy = text.match(/font-weight:\s*(800|900)\b/g) || [];
  if (heavy.length) {
    err(`${rel(file)}: font-weight 超過 700（微軟正黑沒有該字重，中文會變假粗體）`);
  }
}

// 分享頁與 JSON 的一致性
const shareRoot = path.join(SITE, 'share');
if (fs.existsSync(shareRoot) && content) {
  const map = {
    speakers: content.speakers,
    staff: content.staff,
    thanks: content.thanks,
    booths: content.booths,
  };
  for (const [type, list] of Object.entries(map)) {
    const dir = path.join(shareRoot, type);
    if (!fs.existsSync(dir)) {
      continue;
    }
    const ids = new Set((list || []).map((i) => i.id));
    for (const folder of fs.readdirSync(dir)) {
      if (!ids.has(folder)) {
        warn(`殘留資料夾：share/${type}/${folder}（JSON 中已不存在，請手動刪除）`);
      }
    }
  }
}

// ---------------------------------------------------------------- 輸出

const line = '─'.repeat(60);
console.warn(line);
if (errors.length === 0 && warnings.length === 0) {
  console.warn('全部通過，沒有發現問題。');
} else {
  for (const m of errors) {
    console.error(`  [錯誤] ${m}`);
  }
  for (const m of warnings) {
    console.warn(`  [警告] ${m}`);
  }
  console.warn(line);
  console.warn(`錯誤 ${errors.length} 項、警告 ${warnings.length} 項`);
  console.warn('警告不會擋住上線，但錯誤必須修掉。');
}
console.warn(line);

process.exit(errors.length > 0 ? 1 : 0);
