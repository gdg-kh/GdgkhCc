import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const shareDir = path.resolve(__dirname, '..', 'share');

async function walk(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await walk(full));
    } else if (entry.name === 'index.html') {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const files = await walk(shareDir);
  console.log(`找到 ${files.length} 個分享頁，開始檢查並補上臉書 meta 資料…`);

  let updated = 0;
  for (const file of files) {
    let html = await fs.readFile(file, 'utf8');
    // 替換可能殘留的 Bevy 網址
    html = html.replaceAll('https://gdg.community.dev/e/mjbj5s/', 'https://gdgkh.cc/2026/');

    const ogTypeMatch = html.match(/<meta property="og:type" content="([^"]*)"/);
    const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
    const ogDescMatch = html.match(/<meta property="og:description" content="([^"]*)"/);
    const ogImgMatch = html.match(/<meta property="og:image" content="([^"]*)"/);
    const ogUrlMatch = html.match(/<meta property="og:url" content="([^"]*)"/);

    if (!ogTypeMatch || !ogTitleMatch) {
      continue;
    }

    const ogType = ogTypeMatch[1];
    const ogTitle = ogTitleMatch[1];
    const ogDesc = ogDescMatch ? ogDescMatch[1] : '';
    const ogImg = ogImgMatch ? ogImgMatch[1] : '';
    const ogUrl = ogUrlMatch ? ogUrlMatch[1] : '';

    const newBlock = [
      '    <!-- Open Graph / Facebook -->',
      `    <meta property="og:type" content="${ogType}" />`,
      `    <meta property="og:url" content="${ogUrl}" />`,
      `    <meta property="og:title" content="${ogTitle}" />`,
      `    <meta property="og:description" content="${ogDesc}" />`,
      `    <meta property="og:image" content="${ogImg}" />`,
      `    <meta property="og:image:secure_url" content="${ogImg}" />`,
      '    <meta property="og:image:width" content="1200" />',
      '    <meta property="og:image:height" content="630" />',
      `    <meta property="og:image:alt" content="${ogTitle}" />`,
      '    <meta property="og:image:type" content="image/png" />',
      '    <meta property="og:site_name" content="DevFest 2026 高雄場" />',
      '    <meta property="og:locale" content="zh_TW" />',
      '    <meta property="og:locale:alternate" content="en_US" />',
      '    <meta property="og:locale:alternate" content="ja_JP" />',
      '    <meta property="article:publisher" content="https://www.facebook.com/GDGKaohsiung" />',
      '',
      '    <!-- Twitter Card -->',
      '    <meta name="twitter:card" content="summary_large_image" />',
      `    <meta name="twitter:url" content="${ogUrl}" />`,
      `    <meta name="twitter:title" content="${ogTitle}" />`,
      `    <meta name="twitter:description" content="${ogDesc}" />`,
      `    <meta name="twitter:image" content="${ogImg}" />`,
      `    <meta name="twitter:image:alt" content="${ogTitle}" />`,
    ].join('\n');

    const existingBlockRegex =
      /[ \t]*(<!-- Open Graph \/ Facebook -->[\s\S]*?<!-- Twitter Card -->[\s\S]*?<meta name="twitter:image:alt" content="[^"]*" \/>)/;
    const oldBlockRegex =
      /[ \t]*<meta property="og:type" content="[^"]*" \/>\r?\n[ \t]*<meta property="og:title" content="[^"]*" \/>\r?\n[ \t]*<meta property="og:description" content="[^"]*" \/>\r?\n[ \t]*<meta property="og:image" content="[^"]*" \/>\r?\n[ \t]*<meta property="og:url" content="[^"]*" \/>\r?\n[ \t]*<meta name="twitter:card" content="summary_large_image" \/>/;

    if (existingBlockRegex.test(html)) {
      html = html.replace(existingBlockRegex, newBlock);
      await fs.writeFile(file, html, 'utf8');
      updated += 1;
    } else if (oldBlockRegex.test(html)) {
      html = html.replace(oldBlockRegex, newBlock);
      await fs.writeFile(file, html, 'utf8');
      updated += 1;
    } else {
      console.warn(`[warn] 無法匹配替換區塊：${path.relative(shareDir, file)}`);
    }
  }

  console.log(`成功更新 ${updated} 個分享頁的 Meta 標籤！`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
