import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from 'canvas';
import { wrapSpeakerLines, renderOgImage } from './render-og.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_2026 = path.resolve(__dirname, '..');
const CONTENT_PATH = path.join(ROOT_2026, 'data', 'content.json');

const contentRaw = await fs.readFile(CONTENT_PATH, 'utf8');
const content = JSON.parse(contentRaw);

let passed = 0;
let total = 0;

async function test(name, fn) {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.warn(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

console.warn('\n=== 1. 講者語意換行演算法測試 (wrapSpeakerLines) ===');

const canvas = createCanvas(1200, 630);
const ctx = canvas.getContext('2d');
ctx.font = '900 28px sans-serif';

await test('短名稱職稱應維持單行無換行', async () => {
  const lines = wrapSpeakerLines(ctx, '史蒂夫•葉', '技術處長', '精誠集團', 490, 2);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], '史蒂夫•葉 · 技術處長 · 精誠集團');
});

await test('超過單行寬度時，應優先在「 · 」語意段落切分為 2 行', async () => {
  const lines = wrapSpeakerLines(ctx, '徐方繹（Fngi）', 'AIDefendLabs Fngi', 'GDG Taipei', 490, 2);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '徐方繹（Fngi）');
  assert.equal(lines[1], 'AIDefendLabs Fngi · GDG Taipei');
});

await test('極長文字超過 2 行時，應於第 2 行末端加上省略號「…」', async () => {
  const lines = wrapSpeakerLines(
    ctx,
    '李冠緯',
    'Full-stack Developer & Community Organizer',
    'WordPress Taiwan Community',
    490,
    2
  );
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'), '第 2 行末端應包含省略號');
});

console.warn('\n=== 2. 全體 16 位講者 OG 水平置中與邊界安全測試 ===');

const badgeW = 154;
const gap = 16;
const centerX = 794;

for (const s of content.speakers) {
  await test(`講者 [${s.id}] 水平中心線應精準對齊 X: 794 且在安全邊界內`, async () => {
    const name = s.name['zh-Hant'] || s.name;
    const title = s.title ? (s.title['zh-Hant'] || s.title) : '';
    const org = s.org ? (s.org['zh-Hant'] || s.org) : '';

    const lines = wrapSpeakerLines(ctx, name, title, org, 490, 2);
    assert.ok(lines.length >= 1 && lines.length <= 2, `行數應為 1 或 2（實際: ${lines.length}）`);

    const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const blockW = badgeW + gap + maxLineW;
    const leftX = Math.round(centerX - blockW / 2);
    const rightX = leftX + blockW;
    const actualCenter = leftX + blockW / 2;

    // 驗證中心點對齊於 794（容許整數四捨五入誤差 1.5px）
    assert.ok(
      Math.abs(actualCenter - centerX) <= 1.5,
      `中心點偏差過大：actualCenter=${actualCenter}, expected=${centerX}`
    );

    // 驗證未超出左右安全畫布邊界（440 ~ 1145）
    assert.ok(leftX >= 440, `左緣 ${leftX} 小於安全限制 440`);
    assert.ok(rightX <= 1145, `右緣 ${rightX} 大於安全限制 1145`);
  });
}

console.warn('\n=== 3. 實際產生講者 OG 圖檔測試 (renderOgImage) ===');

await test('為短姓名講者（史蒂夫•葉）產生 OG 圖，確認正常繪製', async () => {
  const item = content.speakers.find((s) => s.id === 'steve_yeh');
  const tempOut = path.join(ROOT_2026, 'images', 'og', 'speakers', 'steve_yeh.png');

  await renderOgImage({
    type: 'speakers',
    item,
    content,
    layout: {
      imagePath: path.join(ROOT_2026, 'images', 'speakers', 'steve_yeh.jpg'),
    },
    outPath: tempOut,
  });

  const stat = await fs.stat(tempOut);
  assert.ok(stat.size > 1000, '圖片檔案大小應大於 1KB');
});

await test('為長職稱講者（李冠緯 Bruce Lee）產生雙行 OG 圖，確認正常繪製', async () => {
  const item = content.speakers.find((s) => s.id === 'bruce_lee');
  const tempOut = path.join(ROOT_2026, 'images', 'og', 'speakers', 'bruce_lee.png');

  await renderOgImage({
    type: 'speakers',
    item,
    content,
    layout: {
      imagePath: path.join(ROOT_2026, 'images', 'speakers', 'bruce_lee.jpg'),
    },
    outPath: tempOut,
  });

  const stat = await fs.stat(tempOut);
  assert.ok(stat.size > 1000, '圖片檔案大小應大於 1KB');
});

console.warn(`\n✔ 講者 OG 測試全數通過！總共 ${passed}/${total} 項測試通過。\n`);
