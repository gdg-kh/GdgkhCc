import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 官方色票定義 ---
const COLORS = {
  bg: '#dcdddd',
  border: '#221714',
  white: '#ffffff',
  greenBox: '#009944',
  ink: '#1A1B1B',
  subText: '#555555',
  descText: '#333333',
  line: '#d0d0d0',
  blue: '#4285f4',
  red: '#ea4335',
  yellow: '#f9ab00',
  green: '#34a853',
  bluePastel: '#c3ecf6',
  greenPastel: '#ccf6c5',
  yellowPastel: '#ffe7a5',
  yellowHalftone: '#ffd427',
};

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;

const FONT_FAMILY = '"Noto Serif TC", "Google Sans", "Microsoft JhengHei", serif';
const FONT_DIR = path.resolve(__dirname, '..', 'assets', 'fonts');

let fontsRegistered = false;

export function pickLang(field, fallback = '') {
  if (!field) {
    return fallback;
  }
  if (typeof field === 'string') {
    return field;
  }
  if (typeof field === 'object') {
    return field['zh-Hant'] || field.zh || field.en || field.ja || fallback;
  }
  return fallback;
}

function registerFontsOnce() {
  if (fontsRegistered) {
    return;
  }
  fontsRegistered = true;

  const fontCandidates = [
    { file: 'NotoSerifTC-Black.ttf', weight: '900' },
    { file: 'NotoSerifTC-Bold.ttf', weight: '700' },
    { file: 'NotoSerifTC-Regular.ttf', weight: '400' },
  ];

  let registered = 0;
  for (const entry of fontCandidates) {
    // 1. 優先檢查專案 assets/fonts
    let targetPath = path.join(FONT_DIR, entry.file);
    if (!existsSync(targetPath)) {
      // 2. 備用外部路徑
      const extPath = path.join(
        'D:/舊時代的黑洞/Download/程式/64bit/字體/Chocolate_Classical_Sans,Noto_Sans_TC,Noto_Serif_TC,Roboto_Mono/Noto_Serif_TC/static',
        entry.file
      );
      if (existsSync(extPath)) {
        targetPath = extPath;
      }
    }

    if (existsSync(targetPath)) {
      try {
        registerFont(targetPath, { family: 'Noto Serif TC', weight: entry.weight });
        registered += 1;
      } catch (err) {
        console.warn(`[render-og] 註冊字型失敗 ${entry.file}：${err.message}`);
      }
    }
  }

  // 嘗試載入系統字型 NotoSerifTC-VF.ttf
  if (registered === 0) {
    const sysVf = 'C:/Windows/Fonts/NotoSerifTC-VF.ttf';
    if (existsSync(sysVf)) {
      try {
        registerFont(sysVf, { family: 'Noto Serif TC', weight: '900' });
        registered += 1;
      } catch (err) {
        console.warn(`[render-og] 註冊系統字型失敗：${err.message}`);
      }
    }
  }

  if (registered === 0) {
    console.warn(`[render-og] 找不到可用 Noto Serif TC 字型檔，將使用系統預設字型`);
  }
}

// 智慧詞彙分詞：將西文單字/數字保留為完整語素，中文字元個別分詞，避免西文單詞被斷字腰斬
function tokenizeText(text) {
  const regex = /(\s+|[A-Za-z0-9_#+@./:-]+|[^\s])/gu;
  const tokens = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

// 支援中英混排、西文單詞保護、省略號截斷之文字換行函式
export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  if (!text) {
    return 0;
  }

  const paragraphs = String(text).split(/\r?\n/);
  const lines = [];

  for (const para of paragraphs) {
    if (lines.length >= maxLines) {
      break;
    }
    const tokens = tokenizeText(para);
    let current = '';

    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      if (!current && /^\s+$/.test(tok)) {
        continue;
      }

      const attempt = current + tok;
      if (ctx.measureText(attempt).width <= maxWidth) {
        current = attempt;
      } else {
        if (current) {
          lines.push(current);
          if (lines.length >= maxLines) {
            let last = lines[lines.length - 1];
            while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
              last = last.slice(0, -1);
            }
            lines[lines.length - 1] = `${last}…`;
            break;
          }
          current = /^\s+$/.test(tok) ? '' : tok;
        } else {
          // 當單一 token 本身寬度即大於 maxWidth（如超長網址），逐字拆分
          for (const ch of Array.from(tok)) {
            if (ctx.measureText(current + ch).width <= maxWidth) {
              current += ch;
            } else {
              lines.push(current);
              if (lines.length >= maxLines) {
                let last = lines[lines.length - 1];
                while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
                  last = last.slice(0, -1);
                }
                lines[lines.length - 1] = `${last}…`;
                break;
              }
              current = ch;
            }
          }
        }
      }
    }

    if (lines.length < maxLines && current) {
      lines.push(current);
    }
  }

  ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return lines.length;
}

function initialCharacter(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '✦';
  }
  return Array.from(trimmed)[0];
}

async function tryLoadImage(imagePath) {
  if (!imagePath) {
    return null;
  }
  try {
    if (!existsSync(imagePath)) {
      return null;
    }
    return await loadImage(imagePath);
  } catch (err) {
    console.warn(`[render-og] 載入圖片失敗 ${imagePath}：${err.message}`);
    return null;
  }
}

// 輔助函式：解析底圖元件路徑（優先使用使用者指定絕對路徑，找不到時使用專案內備用路徑）
function resolveAssetPath(preferredPath, fallbackRelative) {
  if (preferredPath && existsSync(preferredPath)) {
    return preferredPath;
  }
  const fallback = path.resolve(__dirname, '..', fallbackRelative);
  if (existsSync(fallback)) {
    return fallback;
  }
  return preferredPath;
}

// 快取預處理好的底圖向量圖層
let baseAssetsPromise = null;

async function loadBaseAssets() {
  const goSvgPath = resolveAssetPath(
    'D:/舊時代的黑洞/Download/程式/64bit/3D印表機/列印圖檔/雷射雕刻圖庫/DevFest/DevFest2026/og/share-og-go.svg',
    'assets/og-template/share-og-go.svg'
  );
  const dfSvgPath = resolveAssetPath(
    'D:/舊時代的黑洞/Download/程式/64bit/3D印表機/列印圖檔/雷射雕刻圖庫/DevFest/DevFest2026/og/share-og-df.svg',
    'assets/og-template/share-og-df.svg'
  );
  const gdgSvgPath = resolveAssetPath(
    'D:/舊時代的黑洞/Download/程式/64bit/3D印表機/列印圖檔/雷射雕刻圖庫/DevFest/DevFest2026/og/share-og-gdg.svg',
    'assets/og-template/share-og-gdg.svg'
  );
  const koinPngPath = resolveAssetPath(
    'D:/舊時代的黑洞/Download/程式/64bit/3D印表機/列印圖檔/雷射雕刻圖庫/DevFest/DevFest2024/宣傳/廠商/LOGO(K+D+誠)/190328KO-IN智高點_多媒體使用LOGO設計_OL-07.png',
    'assets/og-template/190328KO-IN智高點_多媒體使用LOGO設計_OL-07.png'
  );

  // 1. 選舉章 (大小 516x516，2x 解析度輸出以達極致清晰度)
  const goBuf = await sharp(goSvgPath, { density: 200 })
    .resize(516 * 2, 516 * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const goImg = await loadImage(goBuf);

  // 2. {DevFest} (SVG 原生 viewBox 為 0 0 580 190，內部幾何在 X+6.5, Y+10.4 處，以 2x 光柵化，完整保留官方組合標誌)
  const dfBuf = await sharp(dfSvgPath, { density: 200 })
    .resize(580 * 2, 190 * 2)
    .png()
    .toBuffer();
  const dfImg = await loadImage(dfBuf);

  // 3. GDG Kaohsiung (大小 339.168x44.999)
  const gdgRaw = await fs.readFile(gdgSvgPath, 'utf-8');
  const gdgFitted = gdgRaw
    .replace(/<rect y="-0.06" class="st0"[^>]+>/, '')
    .replace('viewBox="0 0 1960 860"', 'viewBox="226 343 1500 198"');
  const gdgBuf = await sharp(Buffer.from(gdgFitted), { density: 200 })
    .resize(Math.round(339.168 * 2), 45 * 2, { fit: 'fill' })
    .png()
    .toBuffer();
  const gdgImg = await loadImage(gdgBuf);

  // 4. KO-IN 智高點 (大小 95.7x60)
  const koinBuf = await sharp(koinPngPath)
    .resize(Math.round(95.7 * 2), 60 * 2, { fit: 'fill' })
    .png()
    .toBuffer();
  const koinImg = await loadImage(koinBuf);

  return { goImg, dfImg, gdgImg, koinImg };
}

async function getBaseAssets() {
  if (!baseAssetsPromise) {
    baseAssetsPromise = loadBaseAssets();
  }
  return baseAssetsPromise;
}

// 繪製官方指定底圖框架
function drawBaseFrame(ctx, baseAssets) {
  // 1. 背景 #dcdddd
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. 選舉章 (大小 516X516，右上位置 832.9, -143.7)
  ctx.drawImage(baseAssets.goImg, 832.9, -143.7, 516, 516);

  // 3. 下方白色區塊 1150X85 背景 #ffffff (Y=520 到 605，先填色以防蓋過 4px 外框線)
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(25, 520, 1150, 85);

  // 4. 外框線 1150X580 線粗 4px
  ctx.lineWidth = 4;
  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(25, 25, 1150, 580);

  // 下方白色區塊外側框線 1150X85 線粗 4px（確保底邊、左側、右側及頂部連接線皆具備完整的 4px 粗細）
  ctx.strokeRect(25, 520, 1150, 85);

  // 5. {DevFest} (SVG 580x190 放置於 (540, 68.5)，使 {DevFest} 內容精確座落於 (548, 82)，左右括號位置與官方設計稿零誤差)
  ctx.drawImage(baseAssets.dfImg, 540, 68.5, 580, 190);

  // 6. 活動主辦文字 (上下垂直置中於白框高度 85px，中心 Y = 562.5，視覺重心對齊 561.5)
  ctx.fillStyle = COLORS.border;
  ctx.font = `900 29.5px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('活動主辦', 203, 561.5);

  // 7. GDG Kaohsiung (左上位置 345, 540.5，寬高 339.168X44.999)
  ctx.drawImage(baseAssets.gdgImg, 345, 540.5, 339.168, 45);

  // 8. 活動主辦和場地中間的直線 (左上位置 721.7, 533，高 60px，粗 3px)
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(721.7, 533);
  ctx.lineTo(721.7, 593);
  ctx.stroke();

  // 9. 活動場地文字 (上下垂直置中於白框高度 85px，中心 Y = 562.5，視覺重心對齊 561.5)
  ctx.fillText('活動場地', 759.2, 561.5);

  // 10. 智高點圖片 (左上位置 900.452, 533，大小 95.7X60)
  ctx.drawImage(baseAssets.koinImg, 900.452, 533, 95.7, 60);
}

// 智慧折行標題輔助函式
function wrapHeadline(ctx, text, maxWidth) {
  const tokens = tokenizeText(text);
  const lines = [];
  let current = '';

  for (const tok of tokens) {
    if (!current && /^\s+$/.test(tok)) {
      continue;
    }
    const attempt = current + tok;
    if (ctx.measureText(attempt).width <= maxWidth) {
      current = attempt;
    } else {
      if (current) {
        lines.push(current);
        current = /^\s+$/.test(tok) ? '' : tok;
      } else {
        for (const ch of Array.from(tok)) {
          if (ctx.measureText(current + ch).width <= maxWidth) {
            current += ch;
          } else {
            lines.push(current);
            current = ch;
          }
        }
      }
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

// 繪製簡潔單行/多行標題（移除簡介與膠囊徽章，垂直置中於主要內容區）
function drawSimpleHeadline(ctx, label, name, contentX, maxContentW, boxTop = 250, boxBottom = 520) {
  const fullText = `${label}：${name}`;

  // 1. 優先嘗試單行自適應字級 (44px -> 34px)
  let fontSize = 44;
  let fitted = false;
  ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
  if (ctx.measureText(fullText).width <= maxContentW) {
    fitted = true;
  } else {
    for (let s = 42; s >= 34; s -= 2) {
      ctx.font = `900 ${s}px ${FONT_FAMILY}`;
      if (ctx.measureText(fullText).width <= maxContentW) {
        fontSize = s;
        fitted = true;
        break;
      }
    }
  }

  // 2. 若縮到 34px 仍超過單行寬度，則以 34px 進行智慧折行
  let lines = [];
  if (fitted) {
    lines = [fullText];
  } else {
    fontSize = 34;
    ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
    lines = wrapHeadline(ctx, fullText, maxContentW);
  }

  // 若折行超過 2 行，字級適度縮小為 30px
  if (lines.length > 2) {
    fontSize = 30;
    ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
    lines = wrapHeadline(ctx, fullText, maxContentW);
  }

  // 超過 3 行時，第 3 行加上省略號
  if (lines.length > 3) {
    let last = lines[2];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxContentW) {
      last = last.slice(0, -1);
    }
    lines[2] = `${last}…`;
  }

  const lineHeight = Math.round(fontSize * 1.35);
  const totalH = (Math.min(lines.length, 3) - 1) * lineHeight + fontSize;
  const startY = boxTop + Math.round((boxBottom - boxTop - totalH) / 2);

  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  lines.slice(0, 3).forEach((line, idx) => {
    ctx.fillText(line, contentX, startY + idx * lineHeight);
  });
}

// 繪製左側視覺區塊 (綠色頭圖位置：左上位置 70, 75，寬高 400X400)
async function drawLeftVisual(ctx, imagePath, fallbackInitial, isLogo = false, isPlaceholder = false) {
  const boxX = 70;
  const boxY = 75;
  const boxSize = 400;

  const img = await tryLoadImage(imagePath);

  // 首頁官方底圖或純佔位時，呈現乾淨綠色色塊（同 share-og 官方標準稿，不加黑外框、不放巨大首字）
  if (isPlaceholder || (!img && !fallbackInitial && !isLogo)) {
    ctx.fillStyle = COLORS.greenBox;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);
    return;
  }

  if (isLogo) {
    // 廠商與社群 Logo：白色襯底 + 4px 邊框 + 居中完整顯示 (contain)
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(boxX, boxY, boxSize, boxSize);

    if (img) {
      const padding = 36;
      const maxW = boxSize - padding * 2;
      const maxH = boxSize - padding * 2;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = boxX + (boxSize - drawW) / 2;
      const drawY = boxY + (boxSize - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
      ctx.fillStyle = COLORS.border;
      ctx.font = `900 120px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fallbackInitial || '✦', boxX + boxSize / 2, boxY + boxSize / 2);
    }
  } else {
    // 講者與工作人員頭像：裁切覆蓋 (cover)
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX, boxY, boxSize, boxSize);
      ctx.clip();

      const scale = Math.max(boxSize / img.width, boxSize / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = boxX + (boxSize - drawW) / 2;
      const drawY = boxY + (boxSize - drawH) / 2;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS.border;
      ctx.strokeRect(boxX, boxY, boxSize, boxSize);
    } else {
      // 人物缺圖時：優雅柔和綠底 + 首字縮寫
      ctx.fillStyle = '#d2e3d5';
      ctx.fillRect(boxX, boxY, boxSize, boxSize);
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS.border;
      ctx.strokeRect(boxX, boxY, boxSize, boxSize);

      ctx.fillStyle = COLORS.border;
      ctx.font = `900 120px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fallbackInitial || '👤', boxX + boxSize / 2, boxY + boxSize / 2);
    }
  }
}

// 主渲染函式
export async function renderOgImage({ type, item, layout, _config, outPath }) {
  registerFontsOnce();
  const baseAssets = await getBaseAssets();

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. 繪製官方指定底圖框架
  drawBaseFrame(ctx, baseAssets);

  // 2. 判斷實體型別與左側頭圖/Logo
  const isLogo = type === 'thanks' || type === 'booths';
  const isPlaceholder = type === 'site' || type === 'raw_test';
  const nameText = pickLang(item && item.name, 'DevFest 2026');
  const initial = isPlaceholder ? '' : initialCharacter(nameText);
  await drawLeftVisual(ctx, layout && layout.imagePath, initial, isLogo, isPlaceholder);

  // 3. 右側文字內容區域 (X: 545, Y: 250 到 520，最大寬度 585px)
  const contentX = 545;
  const maxContentW = 585;

  if (type === 'speakers') {
    // 講者姓名 (Noto Serif TC Black) - 清楚大方的簡潔格式
    const title = pickLang(item && item.title);
    const org = pickLang(item && item.org);
    const affiliation = [title, org].filter(Boolean).join(' · ');
    const sessionTitle = pickLang(layout && layout.sessionTitle);

    let nameSize = 48;
    ctx.font = `900 ${nameSize}px ${FONT_FAMILY}`;
    while (nameSize > 28 && ctx.measureText(nameText).width > maxContentW) {
      nameSize -= 2;
      ctx.font = `900 ${nameSize}px ${FONT_FAMILY}`;
    }

    let sessionLines = [];
    if (sessionTitle) {
      ctx.font = `900 24px ${FONT_FAMILY}`;
      sessionLines = wrapHeadline(ctx, `議程主題：${sessionTitle}`, maxContentW).slice(0, 2);
    }

    let totalSpeakerH = nameSize;
    if (affiliation) {
      totalSpeakerH += 14 + 22;
    }
    if (sessionLines.length > 0) {
      totalSpeakerH += (affiliation ? 18 : 14) + (sessionLines.length - 1) * 34 + 24;
    }

    const boxTop = 250;
    const boxBottom = 520;
    let cursorY = boxTop + Math.max(0, Math.round((boxBottom - boxTop - totalSpeakerH) / 2));

    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `900 ${nameSize}px ${FONT_FAMILY}`;
    let displayName = nameText;
    if (ctx.measureText(displayName).width > maxContentW) {
      while (displayName.length > 0 && ctx.measureText(`${displayName}…`).width > maxContentW) {
        displayName = displayName.slice(0, -1);
      }
      displayName = `${displayName}…`;
    }
    ctx.fillText(displayName, contentX, cursorY);
    cursorY += nameSize + 14;

    if (affiliation) {
      ctx.fillStyle = COLORS.subText;
      ctx.font = `900 22px ${FONT_FAMILY}`;
      let dispAff = affiliation;
      if (ctx.measureText(dispAff).width > maxContentW) {
        while (dispAff.length > 0 && ctx.measureText(`${dispAff}…`).width > maxContentW) {
          dispAff = dispAff.slice(0, -1);
        }
        dispAff = `${dispAff}…`;
      }
      ctx.fillText(dispAff, contentX, cursorY);
      cursorY += 22 + (sessionLines.length > 0 ? 18 : 0);
    }

    if (sessionLines.length > 0) {
      ctx.fillStyle = COLORS.ink;
      ctx.font = `900 24px ${FONT_FAMILY}`;
      sessionLines.forEach((line, idx) => {
        ctx.fillText(line, contentX, cursorY + idx * 34);
      });
    }
  } else if (type === 'booths') {
    // 社群攤位：不顯示膠囊圖示與簡介，格式為「社群攤位：{名稱}」
    drawSimpleHeadline(ctx, '社群攤位', nameText, contentX, maxContentW);
  } else if (type === 'thanks') {
    // 合作夥伴：不顯示膠囊圖示與簡介，格式為「合作夥伴：{名稱}」
    drawSimpleHeadline(ctx, '合作夥伴', nameText, contentX, maxContentW);
  } else if (type === 'staff') {
    // 活動志工：不顯示膠囊圖示與簡介，格式為「活動志工：{名稱}」
    drawSimpleHeadline(ctx, '活動志工', nameText, contentX, maxContentW);
  } else if (type === 'site') {
    // 全站 / 活動首頁 OG 圖（刪除膠囊圖示，清楚大方排版，垂直置中）
    const line1 = '高雄場 · Kaohsiung';
    const line2 = '大會主題：AI 代理時代的開發人員和建構者';
    const line3 = '議程演講 · 工作坊 · 交流聚會 · 社群擺攤 · 第二屆技術創作市集';

    ctx.font = `900 19px ${FONT_FAMILY}`;
    const descLines = wrapHeadline(ctx, line3, maxContentW).slice(0, 2);

    const totalSiteH = 48 + 14 + 22 + 16 + (descLines.length - 1) * 28 + 19;
    const boxTop = 250;
    const boxBottom = 520;
    let cursorY = boxTop + Math.max(0, Math.round((boxBottom - boxTop - totalSiteH) / 2));

    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `900 48px ${FONT_FAMILY}`;
    ctx.fillText(line1, contentX, cursorY);
    cursorY += 48 + 14;

    ctx.fillStyle = COLORS.subText;
    ctx.font = `900 22px ${FONT_FAMILY}`;
    ctx.fillText(line2, contentX, cursorY);
    cursorY += 22 + 16;

    ctx.fillStyle = COLORS.descText;
    ctx.font = `900 19px ${FONT_FAMILY}`;
    descLines.forEach((line, idx) => {
      ctx.fillText(line, contentX, cursorY + idx * 28);
    });
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const rawBuffer = canvas.toBuffer('image/png');
  const buffer = await sharp(rawBuffer).png({ compressionLevel: 9, effort: 7, palette: false }).toBuffer();
  await fs.writeFile(outPath, buffer);
  return outPath;
}
