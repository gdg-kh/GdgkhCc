import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 官方色票定義 ---
const COLORS = {
  bg: '#DBDCDC',
  border: '#1E1E1E',
  white: '#FFFFFF',
  ink: '#1E1E1E',
  subText: '#555555',
  descText: '#333333',
  badgeBg: '#1E1E1E',
  badgeText: '#FFFFFF',
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
    let targetPath = path.join(FONT_DIR, entry.file);
    if (!existsSync(targetPath)) {
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
    console.warn('[render-og] 找不到可用 Noto Serif TC 字型檔，將使用系統預設字型');
  }
}

// 智慧詞彙分詞
function tokenizeText(text) {
  const regex = /(\s+|[A-Za-z0-9_#+@./:-]+|[^\s])/gu;
  const tokens = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

// 自動換行函式
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

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 均勻分佈字距繪製文字（用於精確還原向量設計稿中徽章文字間距）
function drawTrackedText(ctx, text, cx, cy, targetSpan) {
  const chars = Array.from(text);
  if (chars.length <= 1) {
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, cy);
    return;
  }
  const charWidths = chars.map((c) => ctx.measureText(c).width);
  const totalCharsW = charWidths.reduce((a, b) => a + b, 0);
  const gap = (targetSpan - totalCharsW) / (chars.length - 1);
  let curX = cx - targetSpan / 2;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], curX, cy);
    curX += charWidths[i] + gap;
  }
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

// 快取預處理好的底圖向量圖層
let baseImagePromise = null;

async function loadBaseImage() {
  const localBaseSvg = path.resolve(__dirname, '..', 'assets', 'og-template', 'share-og-3-base.svg');
  let svgBuffer = null;

  if (existsSync(localBaseSvg)) {
    svgBuffer = await fs.readFile(localBaseSvg);
  } else {
    const rawExternal =
      'D:/舊時代的黑洞/Download/程式/64bit/3D印表機/列印圖檔/雷射雕刻圖庫/DevFest/DevFest2026/og/share-og-3_工作區域 1.svg';
    if (existsSync(rawExternal)) {
      const raw = await fs.readFile(rawExternal, 'utf8');
      const badgeIdx = raw.indexOf('M761.72,368.16');
      if (badgeIdx !== -1) {
        const gStart = raw.lastIndexOf('<g>', badgeIdx);
        const outerGStart = raw.lastIndexOf('<g>', gStart - 1);
        const cleaned = `${raw.slice(0, outerGStart)}</g>\n</svg>\n`;
        svgBuffer = Buffer.from(cleaned);
      } else {
        svgBuffer = Buffer.from(raw);
      }
    }
  }

  if (!svgBuffer) {
    throw new Error('找不到分享圖底圖向量檔 (share-og-3-base.svg)');
  }

  const pngBuf = await sharp(svgBuffer, { density: 144 })
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT)
    .png()
    .toBuffer();

  return await loadImage(pngBuf);
}

async function getBaseImage() {
  if (!baseImagePromise) {
    baseImagePromise = loadBaseImage();
  }
  return baseImagePromise;
}

// 繪製左側視覺區塊 (350x350，位置 70.13, 73.16)
async function drawLeftVisual(ctx, imagePath, fallbackInitial, isLogo = false, isPlaceholder = false, hasBorder = true) {
  const boxX = 70.13;
  const boxY = 73.16;
  const boxSize = 350;

  const img = await tryLoadImage(imagePath);

  // 首頁官方底圖或純佔位時，呈現乾淨底色
  if (isPlaceholder || (!img && !fallbackInitial && !isLogo)) {
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);
    if (hasBorder) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS.border;
      ctx.strokeRect(boxX, boxY, boxSize, boxSize);
    }
    return;
  }

  if (isLogo) {
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);

    if (img) {
      const padding = 32;
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
      ctx.font = `900 100px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fallbackInitial || '✦', boxX + boxSize / 2, boxY + boxSize / 2);
    }

    if (hasBorder) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS.border;
      ctx.strokeRect(boxX, boxY, boxSize, boxSize);
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

      if (hasBorder) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLORS.border;
        ctx.strokeRect(boxX, boxY, boxSize, boxSize);
      }
    } else {
      ctx.fillStyle = '#d2e3d5';
      ctx.fillRect(boxX, boxY, boxSize, boxSize);

      ctx.fillStyle = COLORS.border;
      ctx.font = `900 100px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fallbackInitial || '👤', boxX + boxSize / 2, boxY + boxSize / 2);

      if (hasBorder) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = COLORS.border;
        ctx.strokeRect(boxX, boxY, boxSize, boxSize);
      }
    }
  }
}

// 繪製黑底徽章標籤與名稱（同一行並排，整組於右側內容區左右水平置中）
function drawBadgeAndName(ctx, badgeLabel, nameText) {
  const badgeW = 230;
  const badgeH = 65;
  const centerY = 335.66;
  const badgeY = centerY - badgeH / 2;

  const isPureCjk = /^[\u4e00-\u9fa5]+$/.test(nameText);
  const nameLen = Array.from(nameText).length;

  let fontSize = 52;
  let letterGap = 0;
  let nameW = 0;
  let gap = 32;

  if (isPureCjk && nameLen === 3) {
    fontSize = 55;
    letterGap = 24;
    nameW = 55 * 3 + 24 * 2; // 213
    gap = 36;
  } else if (isPureCjk && nameLen === 2) {
    fontSize = 55;
    letterGap = 36;
    nameW = 55 * 2 + 36; // 146
    gap = 40;
  } else if (isPureCjk && nameLen === 4) {
    fontSize = 52;
    letterGap = 14;
    nameW = 52 * 4 + 14 * 3; // 250
    gap = 32;
  } else {
    fontSize = 44;
    ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
    nameW = ctx.measureText(nameText).width;
    const maxNameW = 440;
    while (fontSize > 26 && nameW > maxNameW) {
      fontSize -= 2;
      ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
      nameW = ctx.measureText(nameText).width;
    }
    gap = 24;
  }

  // 整組在 centerX = 794 左右水平置中
  const totalW = badgeW + gap + nameW;
  const startX = Math.round(794 - totalW / 2);

  // 1. 繪製黑底圓角徽章
  ctx.fillStyle = COLORS.badgeBg;
  drawRoundedRect(ctx, startX, badgeY, badgeW, badgeH, 4.5);
  ctx.fill();

  // 2. 徽章白色文字：均勻分佈字距（對齊原稿「活 動 志 工」195px 寬度分佈）
  ctx.fillStyle = COLORS.badgeText;
  ctx.font = `900 38px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  drawTrackedText(ctx, badgeLabel, startX + badgeW / 2, centerY + 1, 195);

  // 3. 繪製名稱
  ctx.fillStyle = COLORS.ink;
  ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const nameStartX = startX + badgeW + gap;
  if (letterGap > 0) {
    let curX = nameStartX;
    for (const ch of Array.from(nameText)) {
      ctx.fillText(ch, curX, centerY + 1);
      curX += ctx.measureText(ch).width + letterGap;
    }
  } else {
    ctx.fillText(nameText, nameStartX, centerY + 1);
  }
}

// 主渲染函式
export async function renderOgImage({ type, item, layout, _config, outPath }) {
  if (type === 'site' || (outPath && outPath.replace(/\\/g, '/').endsWith('images/og/site.png'))) {
    throw new Error(
      '[render-og] 首頁 Open Graph 圖檔為固定靜態資源（images/og/site.png），嚴禁自動產生或覆寫！'
    );
  }
  registerFontsOnce();
  const baseImg = await getBaseImage();

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. 繪製官方指定向量底圖（包含手繪外框、底部分隔線、DevFest 標誌、主辦與場地 LOGO）
  ctx.drawImage(baseImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. 判斷實體型別與左側頭圖/Logo (350x350，純白無外框完全依原 SVG)
  const isLogo = type === 'thanks' || type === 'booths';
  const isPlaceholder = type === 'raw_test';
  const hasBorder = Boolean(layout && layout.border === true);
  const nameText = pickLang(item && item.name, 'DevFest 2026');
  const initial = isPlaceholder ? '' : initialCharacter(nameText);
  await drawLeftVisual(ctx, layout && layout.imagePath, initial, isLogo, isPlaceholder, hasBorder);

  // 3. 右側文字內容區域
  if (type === 'staff') {
    drawBadgeAndName(ctx, '活動志工', nameText);
  } else if (type === 'thanks') {
    drawBadgeAndName(ctx, '合作夥伴', nameText);
  } else if (type === 'booths') {
    drawBadgeAndName(ctx, '社群攤位', nameText);
  } else if (type === 'speakers') {
    // 講者排版：靠左對齊 {DevFest} 的左邊 (X: 502)
    const leftX = 502;
    const maxW = 1140 - leftX; // 638px

    // 1. 活動講者徽章（黑底白字）
    const badge1W = 180;
    const badge1H = 42;

    // 2. 名字後面接職稱
    const title = pickLang(item && item.title);
    const org = pickLang(item && item.org);
    const affil = [title, org].filter(Boolean).join(' · ');
    const nameLine = affil ? `${nameText} · ${affil}` : nameText;

    let nameFontSize = 32;
    ctx.font = `900 ${nameFontSize}px ${FONT_FAMILY}`;
    while (nameFontSize > 22 && ctx.measureText(nameLine).width > maxW) {
      nameFontSize -= 2;
      ctx.font = `900 ${nameFontSize}px ${FONT_FAMILY}`;
    }
    let dispNameLine = nameLine;
    if (ctx.measureText(dispNameLine).width > maxW) {
      while (dispNameLine.length > 0 && ctx.measureText(`${dispNameLine}…`).width > maxW) {
        dispNameLine = dispNameLine.slice(0, -1);
      }
      dispNameLine = `${dispNameLine}…`;
    }
    const nameLineH = nameFontSize + 4;

    // 3. [ 議程主題 ] 徽章（黑底白字）與內容（黑字可換行）
    const sessionTitle = pickLang(layout && layout.sessionTitle);
    const badge2W = 150;
    const badge2H = 38;
    let sessionLines = [];
    const sessionLineH = 30;

    if (sessionTitle) {
      ctx.font = `900 22px ${FONT_FAMILY}`;
      const rawLines = wrapHeadline(ctx, sessionTitle, maxW);
      if (rawLines.length > 2) {
        let last = rawLines[1];
        while (last.length > 0 && ctx.measureText(`${last}…`).width > maxW) {
          last = last.slice(0, -1);
        }
        sessionLines = [rawLines[0], `${last}…`];
      } else {
        sessionLines = rawLines;
      }
    }

    const sessionTextH = sessionLines.length * sessionLineH;

    // 動態垂直置中計算總高度
    const gap1 = 10; // 活動講者徽章與姓名職稱間距
    const gap2 = sessionTitle ? 12 : 0; // 姓名職稱與議程徽章間距
    const gap3 = sessionTitle ? 8 : 0; // 議程徽章與議程文字間距
    const totalH = badge1H + gap1 + nameLineH + gap2 + (sessionTitle ? badge2H + gap3 + sessionTextH : 0);
    const zoneCenterY = 350;
    const topY = Math.max(245, Math.round(zoneCenterY - totalH / 2));

    // 繪製活動講者徽章
    ctx.fillStyle = COLORS.badgeBg;
    drawRoundedRect(ctx, leftX, topY, badge1W, badge1H, 4.5);
    ctx.fill();

    ctx.fillStyle = COLORS.badgeText;
    ctx.font = `900 28px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    drawTrackedText(ctx, '活動講者', leftX + badge1W / 2, topY + badge1H / 2 + 1, 145);

    // 繪製姓名職稱（靠左 502）
    const nameY = topY + badge1H + gap1;
    ctx.fillStyle = COLORS.ink;
    ctx.font = `900 ${nameFontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(dispNameLine, leftX, nameY);

    // 繪製 [ 議程主題 ] 徽章與內容
    if (sessionTitle && sessionLines.length > 0) {
      const badge2Y = nameY + nameLineH + gap2;
      ctx.fillStyle = COLORS.badgeBg;
      drawRoundedRect(ctx, leftX, badge2Y, badge2W, badge2H, 4);
      ctx.fill();

      ctx.fillStyle = COLORS.badgeText;
      ctx.font = `900 24px ${FONT_FAMILY}`;
      ctx.textBaseline = 'middle';
      drawTrackedText(ctx, '議程主題', leftX + badge2W / 2, badge2Y + badge2H / 2 + 1, 120);

      // 繪製議程主題內容（黑字可換行，靠左 502）
      const textY = badge2Y + badge2H + gap3;
      ctx.fillStyle = COLORS.ink;
      ctx.font = `900 22px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      sessionLines.forEach((l, idx) => {
        ctx.fillText(l, leftX, textY + idx * sessionLineH);
      });
    }
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const rawBuffer = canvas.toBuffer('image/png');
  const buffer = await sharp(rawBuffer).png({ compressionLevel: 9, effort: 7, palette: false }).toBuffer();
  await fs.writeFile(outPath, buffer);
  return outPath;
}
