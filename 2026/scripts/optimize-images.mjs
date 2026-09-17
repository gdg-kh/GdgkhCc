import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_2026 = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_2026, 'images');

export const IMAGE_TARGET_CONFIG = [
  { dir: 'speakers', sizes: [64, 160, 320, 640] },
  { dir: 'staff', sizes: [160, 320, 640] },
  { dir: 'booths', sizes: [160, 320, 640] },
  { dir: 'thanks', sizes: [160, 320, 640] },
];

export async function optimizeDirectory(subDir, sizes, { force = false } = {}) {
  const dirPath = path.join(IMAGES_DIR, subDir);
  let files;
  try {
    files = await fs.readdir(dirPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { processed: 0, skipped: 0, total: 0 };
    }
    throw err;
  }

  const rawSources = files.filter((file) => /\.(jpg|jpeg|png)$/i.test(file) && !/-\d+\.webp$/i.test(file));

  const filesByBaseName = new Map();
  for (const file of rawSources) {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, path.extname(file));
    if (!filesByBaseName.has(baseName)) {
      filesByBaseName.set(baseName, []);
    }
    filesByBaseName.get(baseName).push({ file, ext });
  }

  let processedCount = 0;
  let skippedCount = 0;

  for (const [baseName, candidates] of filesByBaseName.entries()) {
    let chosenFile = candidates[0].file;
    if (candidates.length > 1) {
      const pngCandidate = candidates.find((c) => c.ext === '.png');
      chosenFile = pngCandidate ? pngCandidate.file : candidates[0].file;
      console.warn(
        `[警告] ${subDir}/ 發現多個同名母圖 (${candidates.map((c) => c.file).join(', ')})，優先使用: ${chosenFile}`
      );
    }

    const inputPath = path.join(dirPath, chosenFile);
    const inputStat = await fs.stat(inputPath);

    for (const size of sizes) {
      const outputPath = path.join(dirPath, `${baseName}-${size}.webp`);

      if (!force) {
        try {
          const outputStat = await fs.stat(outputPath);
          if (outputStat.mtimeMs >= inputStat.mtimeMs) {
            skippedCount += 1;
            continue;
          }
        } catch {
          // Output file does not exist yet
        }
      }

      await sharp(inputPath)
        .rotate()
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .webp({
          quality: 80,
          effort: 4,
          alphaQuality: 85,
        })
        .toFile(outputPath);

      processedCount += 1;
      console.log(`[生成完成] 2026/images/${subDir}/${baseName}-${size}.webp (來源: ${chosenFile})`);
    }
  }

  return { processed: processedCount, skipped: skippedCount, total: rawSources.length * sizes.length };
}

export async function optimizeAllImages(options = {}) {
  console.log('開始執行圖片多尺寸轉碼（支援 JPG、PNG -> WebP）...');
  let totalProcessed = 0;
  let totalSkipped = 0;

  for (const config of IMAGE_TARGET_CONFIG) {
    const res = await optimizeDirectory(config.dir, config.sizes, options);
    totalProcessed += res.processed;
    totalSkipped += res.skipped;
  }

  console.log(`轉碼作業完成：新生成 ${totalProcessed} 個檔案，略過已存在 ${totalSkipped} 個檔案。`);
  return { totalProcessed, totalSkipped };
}

// 當直接以 node 執行時
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  optimizeAllImages({ force }).catch((err) => {
    console.error('轉碼失敗：', err);
    process.exit(1);
  });
}
