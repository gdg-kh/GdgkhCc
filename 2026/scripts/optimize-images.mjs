import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_2026 = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_2026, 'images');
const CACHE_FILE = path.join(ROOT_2026, '.optimize-cache.json');

export const IMAGE_TARGET_CONFIG = [
  { dir: 'speakers', sizes: [64, 160, 320, 640], square: true },
  { dir: 'staff', sizes: [160, 320, 640], square: true },
  { dir: 'booths', sizes: [160, 320, 640], square: true },
  { dir: 'thanks', sizes: [160, 320, 640], square: true },
  { dir: 'about', sizes: [320, 640, 1024], square: false },
  { dir: '', sizes: [720, 1200], square: false, generateFullWebp: true },
];

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  try {
    await fs.writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  } catch (err) {
    console.warn(`[警告] 無法儲存快取檔 ${CACHE_FILE}：`, err.message);
  }
}

async function computeSha1(filePath) {
  const buf = await fs.readFile(filePath);
  return crypto.createHash('sha1').update(buf).digest('hex');
}

export async function optimizeDirectory(
  subDir,
  sizes,
  { force = false, square = true, generateFullWebp = false, cache = {} } = {}
) {
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

  const rawSources = files.filter(
    (file) => /\.(jpg|jpeg|png)$/i.test(file) && !/-\d+\.webp$/i.test(file) && !/\.webp$/i.test(file)
  );

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
        `[警告] ${subDir ? `${subDir}/` : ''} 發現多個同名母圖 (${candidates.map((c) => c.file).join(', ')})，優先使用: ${chosenFile}`
      );
    }

    const inputPath = path.join(dirPath, chosenFile);
    const inputSha1 = await computeSha1(inputPath);

    // 衍生多尺寸 WebP
    for (const size of sizes) {
      const outputName = `${baseName}-${size}.webp`;
      const outputPath = path.join(dirPath, outputName);
      const cacheKey = subDir ? `${subDir}/${outputName}` : outputName;

      if (!force && cache[cacheKey] === inputSha1 && existsSync(outputPath)) {
        skippedCount += 1;
        continue;
      }

      const pipeline = sharp(inputPath).rotate();
      if (square) {
        pipeline.resize(size, size, {
          fit: 'cover',
          position: 'center',
        });
      } else {
        pipeline.resize(size, null, {
          withoutEnlargement: true,
        });
      }

      await pipeline
        .webp({
          quality: 80,
          effort: 4,
          alphaQuality: 85,
        })
        .toFile(outputPath);

      cache[cacheKey] = inputSha1;
      processedCount += 1;
      console.log(`[生成完成] 2026/images/${cacheKey} (來源: ${chosenFile})`);
    }

    // 若設定 generateFullWebp，額外輸出無後綴的原尺寸 WebP
    if (generateFullWebp) {
      const outputName = `${baseName}.webp`;
      const outputPath = path.join(dirPath, outputName);
      const cacheKey = subDir ? `${subDir}/${outputName}` : outputName;

      if (!force && cache[cacheKey] === inputSha1 && existsSync(outputPath)) {
        skippedCount += 1;
      } else {
        const pipeline = sharp(inputPath).rotate();
        await pipeline
          .webp({
            quality: 80,
            effort: 4,
            alphaQuality: 85,
          })
          .toFile(outputPath);

        cache[cacheKey] = inputSha1;
        processedCount += 1;
        console.log(`[生成完成] 2026/images/${cacheKey} (來源: ${chosenFile})`);
      }
    }
  }

  const totalPossible = rawSources.length * (sizes.length + (generateFullWebp ? 1 : 0));
  return { processed: processedCount, skipped: skippedCount, total: totalPossible };
}

export async function optimizeAllImages(options = {}) {
  console.log('開始執行圖片多尺寸轉碼（支援 JPG、PNG -> WebP）...');
  const cache = await loadCache();
  let totalProcessed = 0;
  let totalSkipped = 0;

  for (const config of IMAGE_TARGET_CONFIG) {
    const res = await optimizeDirectory(config.dir, config.sizes, {
      ...options,
      square: config.square !== false,
      generateFullWebp: config.generateFullWebp === true,
      cache,
    });
    totalProcessed += res.processed;
    totalSkipped += res.skipped;
  }

  await saveCache(cache);
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
