import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 官方色票定義 (tokens.css) ---
const COLORS = {
  red: '#ea4335',
  blue: '#4285f4',
  yellow: '#f9ab00',
  green: '#34a853',
  ink: '#1e1e1e',
  paper: '#f0f0f0',
  line: '#d0d0d0',
  bluePastel: '#c3ecf6',
  greenPastel: '#ccf6c5',
  yellowPastel: '#ffe7a5',
  redPastel: '#f8d8d8',
  blueHalftone: '#57caff',
  yellowHalftone: '#ffd427',
  white: '#ffffff',
  grayText: '#555555',
  borderGray: '#e2e2e2',
};

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;
const BORDER_WIDTH = 24;

const FONT_FAMILY = '"GDG Sans", "Segoe UI", "Google Sans", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
const FONT_DIR = path.resolve(__dirname, '..', 'assets', 'fonts');

let fontsRegistered = false;

function pickLang(field, fallback) {
  if (!field || typeof field !== 'object') {
    return fallback || '';
  }
  return field['zh-Hant'] || field.en || field.ja || fallback || '';
}

function registerFontsOnce() {
  if (fontsRegistered) {
    return;
  }
  fontsRegistered = true;
  if (!existsSync(FONT_DIR)) {
    console.warn(`[render-og] 找不到字型資料夾：${FONT_DIR}，將使用系統預設字型`);
    return;
  }
  const candidates = [
    { file: 'NotoSansTC-Regular.ttf', weight: '400' },
    { file: 'NotoSansTC-Medium.ttf', weight: '500' },
    { file: 'NotoSansTC-Bold.ttf', weight: '700' },
    { file: 'NotoSansTC-Black.ttf', weight: '900' },
  ];
  let registered = 0;
  candidates.forEach((entry) => {
    const abs = path.join(FONT_DIR, entry.file);
    if (!existsSync(abs)) {
      return;
    }
    try {
      registerFont(abs, { family: 'GDG Sans', weight: entry.weight });
      registered += 1;
    } catch (err) {
      console.warn(`[render-og] 註冊字型失敗 ${entry.file}：${err.message}`);
    }
  });
  if (registered === 0) {
    console.warn(`[render-og] 字型資料夾存在但沒有可用字型檔：${FONT_DIR}`);
  }
}

// 安全圓角繪製函式，避免半徑超過尺寸導致 node-canvas (Cairo) 出現射線 bug
function safeRoundRect(targetCtx, x, y, width, height, radius) {
  targetCtx.beginPath();
  if (Array.isArray(radius)) {
    const maxR = Math.min(width / 2, height / 2);
    const clamped = radius.map((r) => Math.max(0, Math.min(r, maxR)));
    targetCtx.roundRect(x, y, width, height, clamped);
  } else {
    const maxR = Math.min(width / 2, height / 2);
    const r = Math.max(0, Math.min(radius, maxR));
    targetCtx.roundRect(x, y, width, height, r);
  }
}

// 輔助繪圖：Neo-brutalism 標籤卡片 (Sticker Badge)
function drawStickerBadge(targetCtx, opts) {
  const {
    x,
    y,
    width,
    height,
    bgColor = COLORS.white,
    borderColor = COLORS.ink,
    borderWidth = 2,
    shadowSize = 3.5,
    radius = 8,
    textColor = COLORS.ink,
    fontSize = 17,
    fontWeight = 'bold',
    text = '',
    prefix = null,
    rotation = 0,
    alignCenter = false,
  } = opts;

  targetCtx.save();
  targetCtx.translate(x + width / 2, y + height / 2);
  if (rotation !== 0) {
    targetCtx.rotate((rotation * Math.PI) / 180);
  }
  const halfW = width / 2;
  const halfH = height / 2;

  // 硬邊陰影
  if (shadowSize > 0) {
    safeRoundRect(targetCtx, -halfW + shadowSize, -halfH + shadowSize, width, height, radius);
    targetCtx.fillStyle = COLORS.ink;
    targetCtx.fill();
  }

  // 本體
  safeRoundRect(targetCtx, -halfW, -halfH, width, height, radius);
  targetCtx.fillStyle = bgColor;
  targetCtx.fill();
  targetCtx.lineWidth = borderWidth;
  targetCtx.strokeStyle = borderColor;
  targetCtx.stroke();

  // 內容定位
  let startX = -halfW + 16;
  if (prefix) {
    if (prefix.type === 'dots') {
      const dotColors = [COLORS.blue, COLORS.red, COLORS.yellow, COLORS.green];
      dotColors.forEach((c, idx) => {
        targetCtx.beginPath();
        targetCtx.arc(startX + idx * 13, 0, 4.2, 0, Math.PI * 2);
        targetCtx.fillStyle = c;
        targetCtx.fill();
      });
      startX += dotColors.length * 13 + 8;
    } else if (prefix.type === 'circle') {
      targetCtx.beginPath();
      targetCtx.arc(startX + 6, 0, 6, 0, Math.PI * 2);
      targetCtx.fillStyle = prefix.color;
      targetCtx.fill();
      targetCtx.lineWidth = 1.5;
      targetCtx.strokeStyle = COLORS.ink;
      targetCtx.stroke();
      startX += 20;
    } else if (prefix.type === 'sparkle') {
      targetCtx.save();
      targetCtx.translate(startX + 7, 0);
      targetCtx.fillStyle = prefix.color;
      targetCtx.beginPath();
      targetCtx.moveTo(0, -9);
      targetCtx.lineTo(2.5, -2.5);
      targetCtx.lineTo(9, 0);
      targetCtx.lineTo(2.5, 2.5);
      targetCtx.lineTo(0, 9);
      targetCtx.lineTo(-2.5, 2.5);
      targetCtx.lineTo(-9, 0);
      targetCtx.lineTo(-2.5, -2.5);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.restore();
      startX += 22;
    }
  }

  // 文字
  targetCtx.fillStyle = textColor;
  targetCtx.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
  targetCtx.textBaseline = 'middle';
  if (alignCenter) {
    targetCtx.textAlign = 'center';
    targetCtx.fillText(text, 0, 1);
  } else {
    targetCtx.textAlign = 'left';
    targetCtx.fillText(text, startX, 1);
  }
  targetCtx.restore();
}

// 繪製 4 芒星 (Gemini 核心幾何星芒)
function drawGeminiStar(targetCtx, cx, cy, outerR, innerR, fillStyle, strokeStyle, strokeW) {
  targetCtx.save();
  targetCtx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 4;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) targetCtx.moveTo(px, py);
    else targetCtx.lineTo(px, py);
  }
  targetCtx.closePath();
  if (fillStyle) {
    targetCtx.fillStyle = fillStyle;
    targetCtx.fill();
  }
  if (strokeStyle && strokeW > 0) {
    targetCtx.lineWidth = strokeW;
    targetCtx.strokeStyle = strokeStyle;
    targetCtx.stroke();
  }
  targetCtx.restore();
}

// 2026 Neo-brutalism 共同主卡片基底 (外框 3px、硬陰影、Hero 漸層、微點陣、水印)
function drawNeoCardBase(ctx) {
  // 1. 最外層底色 (GDG OFF White)
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const CARD = {
    x: 28,
    y: 24,
    w: 1144,
    h: 582,
    radius: 18,
    shadowOffset: 8,
  };

  // 繪製卡片硬邊陰影
  safeRoundRect(ctx, CARD.x + CARD.shadowOffset, CARD.y + CARD.shadowOffset, CARD.w, CARD.h, CARD.radius);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();

  // 繪製卡片主體漸層背景
  ctx.save();
  safeRoundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.radius);
  ctx.clip();

  const bgGradient = ctx.createLinearGradient(0, CARD.y, 0, CARD.y + CARD.h);
  bgGradient.addColorStop(0, '#c3ecf6');
  bgGradient.addColorStop(0.32, '#e4f4f9');
  bgGradient.addColorStop(0.78, '#f0f0f0');
  bgGradient.addColorStop(1, '#ececec');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);

  // 繪製卡片內精緻微點陣
  ctx.fillStyle = 'rgba(30, 30, 30, 0.05)';
  const dotSpacing = 26;
  for (let dx = CARD.x + 20; dx < CARD.x + CARD.w - 10; dx += dotSpacing) {
    for (let dy = CARD.y + 20; dy < CARD.y + CARD.h - 10; dy += dotSpacing) {
      ctx.beginPath();
      ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 卡片頂部半透明大文字裝飾水印
  ctx.save();
  ctx.font = `900 120px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(66, 133, 244, 0.04)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('DEVFEST 2026', CARD.x + CARD.w - 30, CARD.y + 18);
  ctx.restore();

  ctx.restore(); // 結束主卡片剪裁區

  // 繪製卡片外框 (3px solid #1e1e1e)
  safeRoundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.radius);
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
}

// 舊版人物卡片底色與框線 (保留向下相容)
function drawBase(ctx, config) {
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, CANVAS_WIDTH, BORDER_WIDTH);
  ctx.fillRect(0, CANVAS_HEIGHT - BORDER_WIDTH, CANVAS_WIDTH, BORDER_WIDTH);
  ctx.fillRect(0, 0, BORDER_WIDTH, CANVAS_HEIGHT);
  ctx.fillRect(CANVAS_WIDTH - BORDER_WIDTH, 0, BORDER_WIDTH, CANVAS_HEIGHT);

  const eventName = pickLang((config && config.site && config.site.eventName) || {}, 'GDG Kaohsiung');
  const eventDate = (config && config.site && config.site.eventDate) || '';
  ctx.fillStyle = COLORS.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 32px ${FONT_FAMILY}`;
  ctx.fillText(eventName, 48, CANVAS_HEIGHT - 56);
  if (eventDate) {
    ctx.font = `400 26px ${FONT_FAMILY}`;
    ctx.fillStyle = '#555555';
    ctx.fillText(eventDate, 48, CANVAS_HEIGHT - 22);
  }
}

export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  if (!text) {
    return 0;
  }
  const chars = Array.from(String(text));
  const lines = [];
  let current = '';
  for (const ch of chars) {
    const attempt = current + ch;
    if (ctx.measureText(attempt).width > maxWidth) {
      if (current === '') {
        lines.push(attempt);
        current = '';
      } else {
        lines.push(current);
        current = ch;
      }
      if (lines.length >= maxLines) {
        break;
      }
    } else {
      current = attempt;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    const remainingIndex = chars.slice(lines.join('').length).length;
    if (remainingIndex > 0) {
      while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
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
    return '?';
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

function drawCircleAvatar(ctx, image, cx, cy, radius, fallbackText) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    const size = radius * 2;
    const ratio = Math.max(size / image.width, size / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    ctx.drawImage(image, cx - drawWidth / 2, cy - drawHeight / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = COLORS.line;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `900 220px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(fallbackText, cx, cy + 20);
    ctx.textAlign = 'start';
  }
  ctx.restore();
}

function drawNumberBadge(ctx, cx, cy, radius, order) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.red;
  ctx.fill();
  ctx.fillStyle = COLORS.paper;
  ctx.font = `900 56px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(order || ''), cx, cy + 4);
  ctx.textAlign = 'start';
  ctx.restore();
}

async function renderPerson(ctx, { type, item, layout }) {
  const avatarRadius = 190;
  const avatarCx = 100 + avatarRadius;
  const avatarCy = CANVAS_HEIGHT / 2;
  const nameText = pickLang(item.name);
  const initial = initialCharacter(nameText);

  const image = await tryLoadImage(layout && layout.imagePath);
  drawCircleAvatar(ctx, image, avatarCx, avatarCy, avatarRadius, initial);

  if (type === 'speakers' && item.order) {
    drawNumberBadge(ctx, avatarCx - avatarRadius + 40, avatarCy - avatarRadius + 40, 48, item.order);
  }

  const textX = 100 + avatarRadius * 2 + 60;
  const textMaxWidth = CANVAS_WIDTH - textX - 60;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `900 72px ${FONT_FAMILY}`;
  drawWrappedText(ctx, nameText, textX, 130, textMaxWidth, 88, 2);

  let cursorY = 300;
  if (type === 'speakers') {
    const titleText = pickLang(item.title);
    const orgText = pickLang(item.org);
    const affiliation = titleText && orgText ? `${titleText} · ${orgText}` : titleText || orgText;
    if (affiliation) {
      ctx.font = `700 34px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.ink;
      const lines = drawWrappedText(ctx, affiliation, textX, cursorY, textMaxWidth, 46, 1);
      cursorY += lines * 46 + 16;
    }
  }

  ctx.font = `500 40px ${FONT_FAMILY}`;
  ctx.fillStyle = '#333333';
  const sub = type === 'speakers' ? pickLang((layout && layout.sessionTitle) || null) : pickLang(item.role);
  drawWrappedText(ctx, sub || '', textX, cursorY, textMaxWidth, 56, 2);
}

function cleanDescription(text) {
  if (!text) {
    return '';
  }
  return String(text)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// 2026 Neo-brutalism 標誌版型繪製 (特別感謝 thanks / 活動擺攤 booths)
async function renderLogo(ctx, { type, item, layout, config }) {
  // 1. 繪製 2026 Neo-brutalism 主卡片基底
  drawNeoCardBase(ctx);

  const CARD = {
    x: 28,
    y: 24,
    w: 1144,
    h: 582,
  };

  const leftX = CARD.x + 36; // 64
  const nameText = pickLang(item.name, 'Partner');
  const descText = pickLang(item.description, '');
  const groupId = item.groupId || 'partner';

  // 取得群組標籤與代表色
  let groupBadgeText = '⚡ 特別感謝 · Special Thanks';
  let groupBadgeBg = COLORS.yellowPastel;
  let themeTagBg = COLORS.blue;
  let themeTagText = 'PARTNER';
  let themeTagSub = '✦ 合作夥伴';
  let stageBadgeText = '✦ SPECIAL THANKS ✦';
  let headerTitle = '合作夥伴簡介';
  let headerEn = 'Partner Story';
  let supportBadgeText = '社群鼎力支持';
  let supportBadgeBg = COLORS.greenPastel;
  let supportBadgeColor = COLORS.green;

  if (type === 'booths') {
    groupBadgeText = '🎪 活動擺攤 · Booth';
    groupBadgeBg = COLORS.greenPastel;
    themeTagBg = COLORS.green;
    themeTagText = 'BOOTH';
    themeTagSub = '✦ 活動擺攤';
    stageBadgeText = '✦ EVENT BOOTH ✦';
    headerTitle = '攤位介紹';
    headerEn = 'Booth Story';
    supportBadgeText = '精選技術攤位';
    supportBadgeBg = COLORS.greenPastel;
    supportBadgeColor = COLORS.green;
  } else if (groupId === 'partner') {
    groupBadgeText = '✦ 合作夥伴 · Partner';
    groupBadgeBg = COLORS.bluePastel;
    themeTagBg = COLORS.blue;
    themeTagText = 'PARTNER';
    themeTagSub = '✦ 合作夥伴';
    stageBadgeText = '✦ OFFICIAL PARTNER ✦';
    headerTitle = '合作夥伴簡介';
    headerEn = 'Partner Story';
    supportBadgeText = '社群鼎力支持';
    supportBadgeBg = COLORS.greenPastel;
    supportBadgeColor = COLORS.green;
  } else if (groupId === 'company') {
    groupBadgeText = '✦ 公司贊助 · Sponsor';
    groupBadgeBg = COLORS.yellowPastel;
    themeTagBg = COLORS.yellowHalftone;
    themeTagText = 'SPONSOR';
    themeTagSub = '✦ 公司贊助';
    stageBadgeText = '✦ OFFICIAL SPONSOR ✦';
    headerTitle = '贊助商簡介';
    headerEn = 'Sponsor Story';
    supportBadgeText = '企業鼎力贊助';
    supportBadgeBg = COLORS.yellowPastel;
    supportBadgeColor = COLORS.yellow;
  } else if (groupId === 'personal') {
    groupBadgeText = '✦ 個人贊助 · Supporter';
    groupBadgeBg = COLORS.greenPastel;
    themeTagBg = COLORS.green;
    themeTagText = 'SUPPORTER';
    themeTagSub = '✦ 個人贊助';
    stageBadgeText = '✦ SPECIAL SUPPORTER ✦';
    headerTitle = '贊助者簡介';
    headerEn = 'Supporter Story';
    supportBadgeText = '個人熱情贊助';
    supportBadgeBg = COLORS.greenPastel;
    supportBadgeColor = COLORS.green;
  }

  // ==========================================
  // 左側內容區 (Left Column)
  // ==========================================

  // 1. 頂部 Header: GDG Kaohsiung 品牌膠囊 + 贊助類別徽章
  const headerY = CARD.y + 23;
  drawStickerBadge(ctx, {
    x: leftX,
    y: headerY,
    width: 390,
    height: 38,
    bgColor: COLORS.white,
    radius: 19,
    borderWidth: 2,
    shadowSize: 2.5,
    prefix: { type: 'dots' },
    text: 'GDG Kaohsiung · Google Developer Groups',
    fontSize: 15,
    textColor: COLORS.ink,
  });

  drawStickerBadge(ctx, {
    x: leftX + 402,
    y: headerY,
    width: 200,
    height: 38,
    bgColor: groupBadgeBg,
    radius: 8,
    borderWidth: 2,
    shadowSize: 2.5,
    text: groupBadgeText,
    fontSize: 14,
    textColor: COLORS.ink,
    alignCenter: true,
  });

  // 2. 主標題橫幅 (Partner / Sponsor Banner)
  const themeY = headerY + 38 + 14;
  const themeW = 602;
  const themeH = 68;

  // 橫幅硬陰影
  safeRoundRect(ctx, leftX + 3.5, themeY + 3.5, themeW, themeH, 10);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();

  // 橫幅本體
  safeRoundRect(ctx, leftX, themeY, themeW, themeH, 10);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  // 橫幅左側色彩標籤塊
  const themeTagW = 100;
  safeRoundRect(ctx, leftX, themeY, themeTagW, themeH, [10, 0, 0, 10]);
  ctx.fillStyle = themeTagBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 15px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(themeTagSub, leftX + themeTagW / 2, themeY + 23);
  ctx.font = `bold 12px ${FONT_FAMILY}`;
  ctx.fillText(themeTagText, leftX + themeTagW / 2, themeY + 45);

  // 橫幅右側單位名稱 (動態自適應字體大小避免文字溢出)
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let titleFontSize = 30;
  ctx.font = `900 ${titleFontSize}px ${FONT_FAMILY}`;
  const maxTitleW = themeW - themeTagW - 36;
  while (titleFontSize > 16 && ctx.measureText(nameText).width > maxTitleW) {
    titleFontSize -= 1;
    ctx.font = `900 ${titleFontSize}px ${FONT_FAMILY}`;
  }
  ctx.fillText(nameText, leftX + themeTagW + 18, themeY + themeH / 2 + 1);
  ctx.restore();

  // 3. 單位介紹卡片 (Description Card)
  const cardY = themeY + themeH + 14;
  const cardW = themeW;
  const cardH = 268;

  // 硬陰影
  safeRoundRect(ctx, leftX + 3.5, cardY + 3.5, cardW, cardH, 12);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();

  // 本體卡片
  safeRoundRect(ctx, leftX, cardY, cardW, cardH, 12);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  // 頂部色彩標題列
  const cardHeaderH = 40;
  safeRoundRect(ctx, leftX, cardY, cardW, cardHeaderH, [12, 12, 0, 0]);
  ctx.fillStyle = COLORS.bluePastel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  // 標題列文字與藍點
  ctx.save();
  ctx.beginPath();
  ctx.arc(leftX + 20, cardY + cardHeaderH / 2, 6, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.blue;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  ctx.fillStyle = COLORS.ink;
  ctx.font = `900 16px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(headerTitle, leftX + 34, cardY + cardHeaderH / 2 + 1);

  ctx.font = `bold 13px ${FONT_FAMILY}`;
  ctx.fillStyle = COLORS.blue;
  ctx.textAlign = 'right';
  ctx.fillText(headerEn, leftX + cardW - 16, cardY + cardHeaderH / 2 + 1);

  // 內容描述區 (徹底清理 HTML 標籤與實體)
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `500 16.5px ${FONT_FAMILY}`;
  const effectiveDesc =
    cleanDescription(descText) ||
    '感謝對 GDG Kaohsiung 與 DevFest 2026 南台灣技術盛會的鼎力支持！攜手共創在地技術生態系。';
  drawWrappedText(ctx, effectiveDesc, leftX + 20, cardY + cardHeaderH + 18, cardW - 40, 27, 4);

  // 底部官網/連結標籤區 (若有連結)
  const links = Array.isArray(item.links) ? item.links : [];
  const primaryLink = links.find((l) => l.url) || null;
  const linkUrl = primaryLink ? primaryLink.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'gdgkh.cc/2026/';

  // 計算貼紙標籤寬度與安全截斷
  const maxBadgeWidth = cardW - 40 - 152; // 保留第二個標籤 (140px) 與間距 (12px)
  let displayLinkUrl = linkUrl;
  ctx.font = `bold 13px ${FONT_FAMILY}`;
  if (ctx.measureText(displayLinkUrl).width + 48 > maxBadgeWidth) {
    while (displayLinkUrl.length > 0 && ctx.measureText(`${displayLinkUrl}…`).width + 48 > maxBadgeWidth) {
      displayLinkUrl = displayLinkUrl.slice(0, -1);
    }
    displayLinkUrl = `${displayLinkUrl}…`;
  }
  const badgeWidth = Math.max(150, ctx.measureText(displayLinkUrl).width + 48);

  drawStickerBadge(ctx, {
    x: leftX + 20,
    y: cardY + cardH - 46,
    width: badgeWidth,
    height: 32,
    bgColor: COLORS.paper,
    radius: 6,
    borderWidth: 1.5,
    shadowSize: 2,
    prefix: { type: 'sparkle', color: COLORS.blue },
    text: displayLinkUrl,
    fontSize: 13,
    fontWeight: 'bold',
    textColor: '#444444',
  });

  // 附加小標籤：依群組自適應
  drawStickerBadge(ctx, {
    x: leftX + 20 + badgeWidth + 12,
    y: cardY + cardH - 46,
    width: 140,
    height: 32,
    bgColor: supportBadgeBg,
    radius: 6,
    borderWidth: 1.5,
    shadowSize: 2,
    prefix: { type: 'circle', color: supportBadgeColor },
    text: supportBadgeText,
    fontSize: 13,
    fontWeight: 'bold',
    textColor: COLORS.ink,
  });
  ctx.restore();

  // 4. 底部活動資訊卡 (Event Info Panel)
  const infoY = cardY + cardH + 14;
  const infoW = themeW;
  const infoH = 120;

  // 硬陰影
  safeRoundRect(ctx, leftX + 3.5, infoY + 3.5, infoW, infoH, 12);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();

  // 本體
  safeRoundRect(ctx, leftX, infoY, infoW, infoH, 12);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  // 左側 Google 四色直立色條 (每段精確 30px)
  const barW = 7;
  const barSegmentH = infoH / 4;
  const googleColors = [COLORS.blue, COLORS.red, COLORS.yellow, COLORS.green];
  googleColors.forEach((color, i) => {
    const rad = i === 0 ? [12, 0, 0, 0] : i === 3 ? [0, 0, 0, 12] : 0;
    safeRoundRect(ctx, leftX, infoY + i * barSegmentH, barW, barSegmentH, rad);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // 動態讀取 config.site 設定
  const site = (config && config.site) || {};
  const eventDate = site.eventDate || '2026-11-14';
  const venue = pickLang(site.venue, 'KO-IN 智高點');
  const venueAddress = pickLang(site.venueAddress, '高雄市新興區中正三路 25 號 14 樓');
  const baseUrl = site.baseUrl ? site.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'gdgkh.cc/2026';

  // 資訊內容
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // 第一行：時間
  ctx.fillStyle = COLORS.ink;
  ctx.font = `bold 16px ${FONT_FAMILY}`;
  ctx.fillText(`📅 時間：${eventDate}（六）08:30 – 17:30`, leftX + 22, infoY + 26);

  // 第二行：地點
  ctx.fillText(`📍 地點：${venue}（${venueAddress}）`, leftX + 22, infoY + 56);

  // 分隔線
  ctx.strokeStyle = '#e6e6e6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftX + 22, infoY + 80);
  ctx.lineTo(leftX + infoW - 20, infoY + 80);
  ctx.stroke();

  // 第三行：官網與主辦
  ctx.fillStyle = '#555555';
  ctx.font = `bold 14px ${FONT_FAMILY}`;
  ctx.fillText(`🌐 官網：${baseUrl}/`, leftX + 22, infoY + 100);
  ctx.fillText('🏛 主辦：GDG Kaohsiung', leftX + 320, infoY + 100);
  ctx.restore();

  // ==========================================
  // 右側視覺 Logo 舞台區 (Right Column - 精準居中於剩餘右側空間)
  // ==========================================
  const rightCenterX = 919; // (666 + 1172) / 2 = 919，左右間距各 88px 完全居中
  const rightCenterY = 315; // (24 + 606) / 2 = 315，垂直完全居中

  // 1. 傾斜背景裝飾方塊 (Yellow Pastel + Google 4 色圓角)
  ctx.save();
  ctx.translate(rightCenterX, rightCenterY);
  ctx.rotate((6.5 * Math.PI) / 180);

  const bgBoxSize = 350;
  const halfBox = bgBoxSize / 2;

  // 硬陰影
  safeRoundRect(ctx, -halfBox + 6, -halfBox + 6, bgBoxSize, bgBoxSize, 24);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();

  // 本體
  safeRoundRect(ctx, -halfBox, -halfBox, bgBoxSize, bgBoxSize, 24);
  ctx.fillStyle = COLORS.yellowPastel;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  // Google 4 色圓角邊角
  const cornerSize = 42;
  safeRoundRect(ctx, -halfBox, -halfBox, cornerSize, cornerSize, [24, 0, 0, 0]);
  ctx.fillStyle = COLORS.blue;
  ctx.fill();
  safeRoundRect(ctx, halfBox - cornerSize, -halfBox, cornerSize, cornerSize, [0, 24, 0, 0]);
  ctx.fillStyle = COLORS.red;
  ctx.fill();
  safeRoundRect(ctx, halfBox - cornerSize, halfBox - cornerSize, cornerSize, cornerSize, [0, 0, 24, 0]);
  ctx.fillStyle = COLORS.green;
  ctx.fill();
  safeRoundRect(ctx, -halfBox, halfBox - cornerSize, cornerSize, cornerSize, [0, 0, 0, 24]);
  ctx.fillStyle = COLORS.yellow;
  ctx.fill();

  ctx.restore();

  // 2. 前景主 Logo 舞台卡片 (白色圓角立體卡片)
  const stageW = 330;
  const stageH = 330;
  const halfStageW = stageW / 2;
  const halfStageH = stageH / 2;

  ctx.save();
  ctx.translate(rightCenterX, rightCenterY);

  // 硬陰影
  safeRoundRect(ctx, -halfStageW + 6, -halfStageH + 6, stageW, stageH, 18);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();

  // 本體
  safeRoundRect(ctx, -halfStageW, -halfStageH, stageW, stageH, 18);
  ctx.fillStyle = COLORS.white;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();

  // 繪製 Logo 圖片或初始字
  const image = await tryLoadImage(layout && layout.imagePath);
  if (image) {
    // 內部安全繪圖範圍 274x274 (padding 28)
    const pad = 28;
    const maxImgW = stageW - pad * 2;
    const maxImgH = stageH - pad * 2;
    const ratio = Math.min(maxImgW / image.width, maxImgH / image.height);
    const drawW = image.width * ratio;
    const drawH = image.height * ratio;
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    // Fallback: 初始字母 + Gemini 星芒背景
    ctx.fillStyle = COLORS.paper;
    safeRoundRect(ctx, -halfStageW + 20, -halfStageH + 20, stageW - 40, stageH - 40, 12);
    ctx.fill();

    drawGeminiStar(ctx, 0, 0, 70, 20, 'rgba(66, 133, 244, 0.12)', null, 0);

    const initial = initialCharacter(nameText);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `900 120px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, 0, 4);
  }
  ctx.restore();

  // 3. 舞台上下懸浮標籤
  // 上方標籤：對稱置中排版
  drawStickerBadge(ctx, {
    x: rightCenterX - 110,
    y: rightCenterY - halfStageH - 24,
    width: 220,
    height: 38,
    bgColor: COLORS.white,
    radius: 8,
    borderWidth: 2,
    shadowSize: 3,
    text: stageBadgeText,
    fontSize: 13.5,
    textColor: COLORS.ink,
    rotation: -3,
    alignCenter: true,
  });

  // 下方標籤：⚡ DevFest 2026 高雄場
  drawStickerBadge(ctx, {
    x: rightCenterX - 115,
    y: rightCenterY + halfStageH - 14,
    width: 230,
    height: 40,
    bgColor: COLORS.yellowHalftone,
    radius: 10,
    borderWidth: 2,
    shadowSize: 3,
    text: '⚡ DevFest 2026 高雄場',
    fontSize: 16,
    fontWeight: '900',
    textColor: COLORS.ink,
    rotation: 2.5,
    alignCenter: true,
  });

  // 4. 周圍 Gemini 星芒粒子 (Google 4 色，對稱分佈於舞台兩側)
  drawGeminiStar(ctx, rightCenterX - 220, 185, 13, 5, COLORS.blue, COLORS.ink, 1.5);
  drawGeminiStar(ctx, rightCenterX + 215, 175, 14, 5.5, COLORS.red, COLORS.ink, 1.5);
  drawGeminiStar(ctx, rightCenterX - 225, 455, 12, 4.5, COLORS.green, COLORS.ink, 1.5);
  drawGeminiStar(ctx, rightCenterX + 220, 450, 13, 5, COLORS.yellow, COLORS.ink, 1.5);

  // 微星芒
  drawGeminiStar(ctx, rightCenterX - 180, 315, 6, 2.5, COLORS.yellow, null, 0);
  drawGeminiStar(ctx, rightCenterX + 180, 315, 6, 2.5, COLORS.blue, null, 0);
}

export async function renderOgImage({ type, item, layout, config, outPath }) {
  registerFontsOnce();
  if (!item || typeof item !== 'object') {
    throw new Error('renderOgImage: item 為空');
  }
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  const layoutKind = (layout && layout.kind) || 'person';
  if (layoutKind === 'person') {
    drawBase(ctx, config || {});
    await renderPerson(ctx, { type, item, layout });
  } else if (layoutKind === 'logo') {
    await renderLogo(ctx, { type, item, layout, config });
  } else {
    throw new Error(`renderOgImage: 未知 layout.kind：${layoutKind}`);
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const rawBuffer = canvas.toBuffer('image/png');
  const buffer = await sharp(rawBuffer).png({ compressionLevel: 9, effort: 7 }).toBuffer();
  await fs.writeFile(outPath, buffer);
  return outPath;
}
