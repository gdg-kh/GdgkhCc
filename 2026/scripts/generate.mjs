import { promises as fs, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { ENTITY_TYPES, assetPath, ogPath } from './entity-types.mjs';
import { renderOgImage } from './render-og.mjs';
import { renderSharePage } from './render-page.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_2026 = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT_2026, '..');
const CONFIG_PATH = path.join(ROOT_2026, 'data', 'config.json');
const CONTENT_PATH = path.join(ROOT_2026, 'data', 'content.json');
const CACHE_PATH = path.join(ROOT_2026, '.generate-cache.json');
const SHARE_DIR = path.join(ROOT_2026, 'share');
const IMAGES_OG_DIR = path.join(ROOT_2026, 'images', 'og');
const SITEMAP_PATH = path.join(ROOT_2026, 'sitemap.xml');
const ROBOTS_PATH = path.join(REPO_ROOT, 'robots.txt');
const RENDER_OG_PATH = path.join(__dirname, 'render-og.mjs');

async function readJson(p) {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

function statMtime(p) {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function hashKey(payload) {
  return crypto.createHash('sha1').update(payload).digest('hex');
}

async function loadCache() {
  try {
    return await readJson(CACHE_PATH);
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
}

function buildStore(content) {
  const sessionById = new Map();
  const list = Array.isArray(content && content.sessions) ? content.sessions : [];
  for (const session of list) {
    if (session && typeof session.id === 'string') {
      sessionById.set(session.id, session);
    }
  }
  return { sessionById };
}

function firstSessionTitle(item, store) {
  if (!Array.isArray(item.sessionIds) || item.sessionIds.length === 0) {
    return null;
  }
  for (const sid of item.sessionIds) {
    const session = store.sessionById.get(sid);
    if (session && session.title) {
      return session.title;
    }
  }
  return null;
}

function buildLayout({ type, typeEntry, item, store, imageAbs }) {
  const layout = {
    kind: typeEntry.ogLayout,
    imagePath: imageAbs,
  };
  if (type === 'speakers') {
    layout.sessionTitle = firstSessionTitle(item, store);
  }
  return layout;
}

function hashForItem({ item, layout, imageAbs }) {
  const layoutSummary = {
    kind: layout.kind,
    sessionTitle: layout.sessionTitle || null,
  };
  const payload = JSON.stringify({
    item,
    layout: layoutSummary,
    imageMtime: statMtime(imageAbs),
    renderMtime: statMtime(RENDER_OG_PATH),
  });
  return hashKey(payload);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function processEntity({ type, typeEntry, item, config, store, cache, stats }) {
  const cacheKey = `${type}/${item.id}`;
  const relativeImage = assetPath(type, item.id);
  const relativeOgImage = ogPath(type, item.id);
  const imageAbs = path.join(ROOT_2026, relativeImage);
  const ogAbs = path.join(ROOT_2026, relativeOgImage);
  const pageDir = path.join(SHARE_DIR, type, item.id);
  const pageAbs = path.join(pageDir, 'index.html');

  const layout = buildLayout({ type, typeEntry, item, store, imageAbs });
  const currentHash = hashForItem({ item, layout, imageAbs });
  const cached = cache[cacheKey];
  const outputsExist = existsSync(ogAbs) && existsSync(pageAbs);
  const isForce = process.argv.includes('--force');

  if (!isForce && cached && cached.hash === currentHash && outputsExist) {
    stats.skipped += 1;
    return;
  }

  try {
    await ensureDir(pageDir);
    await ensureDir(path.dirname(ogAbs));
    await renderOgImage({
      type,
      item,
      layout,
      config,
      outPath: ogAbs,
    });
    stats.images += 1;
    const html = renderSharePage({
      type,
      item,
      typeConfig: typeEntry,
      config,
      store,
    });
    await fs.writeFile(pageAbs, html);
    stats.pages += 1;
    cache[cacheKey] = { hash: currentHash, updatedAt: new Date().toISOString() };
  } catch (err) {
    stats.failed += 1;
    console.warn(`[generate] 產生失敗 ${type}/${item.id}：${err.message}`);
  }
}

async function detectOrphans({ type, itemIds, stats, orphans }) {
  const dir = path.join(SHARE_DIR, type);
  if (!existsSync(dir)) {
    return;
  }
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`[generate] 讀取 ${dir} 失敗：${err.message}`);
    return;
  }
  const valid = new Set(itemIds);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!valid.has(entry.name)) {
      orphans.push(`${type}/${entry.name}`);
      stats.orphans += 1;
    }
  }
}

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function xmlEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function writeSitemap({ baseUrl, urls }) {
  const today = todayIsoDate();
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  lines.push('  <url>');
  lines.push(`    <loc>${xmlEscape(baseUrl)}</loc>`);
  lines.push(`    <lastmod>${today}</lastmod>`);
  lines.push('    <changefreq>weekly</changefreq>');
  lines.push('    <priority>1.0</priority>');
  lines.push('  </url>');
  for (const url of urls) {
    lines.push('  <url>');
    lines.push(`    <loc>${xmlEscape(url)}</loc>`);
    lines.push(`    <lastmod>${today}</lastmod>`);
    lines.push('    <changefreq>monthly</changefreq>');
    lines.push('    <priority>0.7</priority>');
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  await fs.writeFile(SITEMAP_PATH, `${lines.join('\n')}\n`);
}

async function writeRobots({ baseUrl }) {
  const sitemapUrl = `${baseUrl}sitemap.xml`;
  const lines = ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''];
  await fs.writeFile(ROBOTS_PATH, lines.join('\n'));
}

const DEPRECATED_ROLE_LABEL = `GDG ${'L' + 'ead'}`;

function warnIfLead(config, content) {
  const payload = `${JSON.stringify(config)}${JSON.stringify(content)}`;
  if (/GDG\s*Lead/i.test(payload)) {
    console.warn(`[generate] 資料中出現「${DEPRECATED_ROLE_LABEL}」用語，請改為「GDG Organizer」`);
  }
}

async function processSiteOg({ config, cache, stats }) {
  const siteOgAbs = path.join(IMAGES_OG_DIR, 'site.png');
  const cacheKey = 'site';
  const sitePayload = JSON.stringify({
    site: config.site || {},
    theme: config.theme || {},
    renderMtime: statMtime(RENDER_OG_PATH),
  });
  const currentHash = hashKey(sitePayload);
  const cached = cache[cacheKey];
  const outputsExist = existsSync(siteOgAbs);
  const isForce = process.argv.includes('--force');

  if (!isForce && cached && cached.hash === currentHash && outputsExist) {
    stats.skipped += 1;
    return;
  }

  try {
    await ensureDir(path.dirname(siteOgAbs));
    await renderOgImage({
      type: 'site',
      item: { name: 'DevFest 2026' },
      layout: { kind: 'site' },
      config,
      outPath: siteOgAbs,
    });
    stats.images += 1;
    cache[cacheKey] = { hash: currentHash, updatedAt: new Date().toISOString() };
  } catch (err) {
    stats.failed += 1;
    console.warn(`[generate] 產生 site.png 失敗：${err.message}`);
  }
}

async function main() {
  console.warn('[generate] 開始產生 2026 分享頁與 OG 圖…');

  const [config, content] = await Promise.all([readJson(CONFIG_PATH), readJson(CONTENT_PATH)]);
  warnIfLead(config, content);

  const baseUrl = (config.site && config.site.baseUrl) || '';
  if (!baseUrl) {
    throw new Error('config.site.baseUrl 未設定，無法產生分享頁');
  }

  const store = buildStore(content);
  const cache = await loadCache();
  const stats = { images: 0, pages: 0, skipped: 0, failed: 0, orphans: 0 };
  const orphans = [];
  const sitemapUrls = [];

  await ensureDir(SHARE_DIR);
  await ensureDir(IMAGES_OG_DIR);

  for (const typeEntry of ENTITY_TYPES) {
    const type = typeEntry.key;
    const list = Array.isArray(content[typeEntry.source]) ? content[typeEntry.source] : [];
    const itemIds = [];
    await ensureDir(path.join(SHARE_DIR, type));
    await ensureDir(path.join(IMAGES_OG_DIR, type));
    for (const item of list) {
      if (!item || typeof item.id !== 'string' || !item.id) {
        continue;
      }
      itemIds.push(item.id);
      await processEntity({ type, typeEntry, item, config, store, cache, stats });
      sitemapUrls.push(`${baseUrl}share/${type}/${item.id}/`);
    }
    await detectOrphans({ type, itemIds, stats, orphans });
  }

  await processSiteOg({ config, cache, stats });

  await saveCache(cache);
  await writeSitemap({ baseUrl, urls: sitemapUrls });
  await writeRobots({ baseUrl });

  if (orphans.length > 0) {
    console.warn('[generate] 以下資料夾不在 JSON 中，請手動確認是否刪除：');
    for (const key of orphans) {
      console.warn(`  - share/${key}`);
    }
  }

  console.warn(
    `[generate] 完成：產生 ${stats.images} 張圖、${stats.pages} 頁、` +
      `跳過 ${stats.skipped} 筆、失敗 ${stats.failed} 筆、殘留 ${stats.orphans} 個資料夾`
  );

  if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[generate] 發生未預期錯誤：', err);
  process.exit(1);
});
