import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderOgImage } from './render-og.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_2026 = path.resolve(__dirname, '..');
const PREVIEW_DIR = path.join(ROOT_2026, 'images', 'og-preview');

const content = JSON.parse(await fs.readFile(path.join(ROOT_2026, 'data', 'content.json'), 'utf8'));

await fs.mkdir(PREVIEW_DIR, { recursive: true });

console.warn('[preview] 開始產生分享 OG 圖片預覽…');

// 1. Staff: andyawd (戴維廷) - 純白無框版（完全依原 SVG）
console.warn('產生活動志工預覽：andyawd (戴維廷)...');
await renderOgImage({
  type: 'staff',
  item: content.staff[0],
  layout: { imagePath: path.join(ROOT_2026, 'images', 'staff', 'andyawd.jpg') },
  outPath: path.join(PREVIEW_DIR, 'staff-andyawd.png'),
});

// 2. Thanks: 合作夥伴（純白無框，徽章與名稱上下置中）
for (const item of content.thanks) {
  console.warn(`產生合作夥伴預覽：${item.id}...`);
  await renderOgImage({
    type: 'thanks',
    item,
    layout: { imagePath: path.join(ROOT_2026, 'images', 'thanks', `${item.id}.png`) },
    outPath: path.join(PREVIEW_DIR, `thanks-${item.id}.png`),
  });
}

// 3. Booths: 社群攤位
for (const item of content.booths) {
  console.warn(`產生社群攤位預覽：${item.id}...`);
  await renderOgImage({
    type: 'booths',
    item,
    layout: { imagePath: path.join(ROOT_2026, 'images', 'booths', `${item.id}.png`) },
    outPath: path.join(PREVIEW_DIR, `booths-${item.id}.png`),
  });
}

// 4. Speakers: 活動講者範例（靠左對齊 {DevFest} 的左邊，名字接職稱，議題主題黑底白字可換行）
console.warn('產生活動講者範例預覽：完整版...');
await renderOgImage({
  type: 'speakers',
  item: {
    name: { 'zh-Hant': '王小明' },
    title: { 'zh-Hant': '資深工程師' },
    org: { 'zh-Hant': 'Google Taiwan' },
  },
  layout: {
    imagePath: path.join(ROOT_2026, 'images', 'staff', 'andyawd.jpg'),
    sessionTitle: '以大型語言模型驅動的現代化全端 AI 應用架構設計與邊緣部署實務分享',
  },
  outPath: path.join(PREVIEW_DIR, 'speakers-sample.png'),
});

console.warn(`[preview] 完成！所有預覽圖片皆已儲存至：${PREVIEW_DIR}`);

