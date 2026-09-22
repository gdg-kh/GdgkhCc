import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from 'canvas';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outPath = path.resolve(__dirname, '..', 'images', 'og', 'site.png');

const WIDTH = 1200;
const HEIGHT = 630;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

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

const FONT_FAMILY = '"Segoe UI", "Google Sans", "Microsoft JhengHei", "Noto Sans TC", sans-serif';

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
function drawStickerBadge(opts) {
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

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  const halfW = width / 2;
  const halfH = height / 2;

  // 硬邊陰影
  if (shadowSize > 0) {
    safeRoundRect(ctx, -halfW + shadowSize, -halfH + shadowSize, width, height, radius);
    ctx.fillStyle = COLORS.ink;
    ctx.fill();
  }

  // 本體
  safeRoundRect(ctx, -halfW, -halfH, width, height, radius);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // 內容定位
  let startX = -halfW + 16;
  if (prefix) {
    if (prefix.type === 'dots') {
      const dotColors = [COLORS.blue, COLORS.red, COLORS.yellow, COLORS.green];
      dotColors.forEach((c, idx) => {
        ctx.beginPath();
        ctx.arc(startX + idx * 13, 0, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
      });
      startX += dotColors.length * 13 + 8;
    } else if (prefix.type === 'circle') {
      ctx.beginPath();
      ctx.arc(startX + 6, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = prefix.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = COLORS.ink;
      ctx.stroke();
      startX += 20;
    } else if (prefix.type === 'sparkle') {
      ctx.save();
      ctx.translate(startX + 7, 0);
      ctx.fillStyle = prefix.color;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(2.5, -2.5);
      ctx.lineTo(9, 0);
      ctx.lineTo(2.5, 2.5);
      ctx.lineTo(0, 9);
      ctx.lineTo(-2.5, 2.5);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-2.5, -2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      startX += 22;
    }
  }

  // 文字
  ctx.fillStyle = textColor;
  ctx.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  if (alignCenter) {
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, 1);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(text, startX, 1);
  }
  ctx.restore();
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

// 1. 最外層底色 (GDG OFF White)
ctx.fillStyle = COLORS.paper;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// 2. 主卡片設定 (Neo-brutalism 經典外框與硬邊陰影)
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

// 繪製卡片主體漸層背景 (Hero 漸層: bluePastel -> paper)
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

// 繪製卡片內精緻微點陣 (Dot Grid Pattern)
ctx.fillStyle = 'rgba(30, 30, 30, 0.05)';
const dotSpacing = 26;
for (let dx = CARD.x + 20; dx < CARD.x + CARD.w - 10; dx += dotSpacing) {
  for (let dy = CARD.y + 20; dy < CARD.y + CARD.h - 10; dy += dotSpacing) {
    ctx.beginPath();
    ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 卡片頂部半透明大文字裝飾水印 "DEVFEST 2026"
ctx.save();
ctx.font = `900 120px ${FONT_FAMILY}`;
ctx.fillStyle = 'rgba(66, 133, 244, 0.04)';
ctx.textAlign = 'right';
ctx.textBaseline = 'top';
ctx.fillText('DEVFEST 2026', CARD.x + CARD.w - 30, CARD.y + 18);
ctx.restore();

// ==========================================
// 右側視覺背景層 (在剪裁區內繪製，避免旋轉邊角溢出外框)
// ==========================================
const rightCenterX = 918;
const rightCenterY = 286;

// 4.1 背景幾何裝飾層 (傾斜 Neo-brutalism 大方塊)
ctx.save();
ctx.translate(rightCenterX, rightCenterY);
ctx.rotate((7 * Math.PI) / 180);

// 硬陰影
safeRoundRect(ctx, -165 + 6, -165 + 6, 330, 330, 24);
ctx.fillStyle = COLORS.ink;
ctx.fill();

// 本體背景
safeRoundRect(ctx, -165, -165, 330, 330, 24);
ctx.fillStyle = COLORS.yellowPastel;
ctx.fill();
ctx.lineWidth = 2.5;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// 內層細節：Google 4 色小圓角邊角
const cornerSize = 40;
safeRoundRect(ctx, -165, -165, cornerSize, cornerSize, [24, 0, 0, 0]);
ctx.fillStyle = COLORS.blue;
ctx.fill();
safeRoundRect(ctx, 165 - cornerSize, -165, cornerSize, cornerSize, [0, 24, 0, 0]);
ctx.fillStyle = COLORS.red;
ctx.fill();
safeRoundRect(ctx, 165 - cornerSize, 165 - cornerSize, cornerSize, cornerSize, [0, 0, 24, 0]);
ctx.fillStyle = COLORS.green;
ctx.fill();
safeRoundRect(ctx, -165, 165 - cornerSize, cornerSize, cornerSize, [0, 0, 0, 24]);
ctx.fillStyle = COLORS.yellow;
ctx.fill();

ctx.restore();

// 4.2 次層白底圓形徽章 (中心 Gemini 核心舞台)
ctx.save();
ctx.translate(rightCenterX, rightCenterY);

// 硬陰影
ctx.beginPath();
ctx.arc(5, 5, 102, 0, Math.PI * 2);
ctx.fillStyle = COLORS.ink;
ctx.fill();

// 白色圓形舞台
ctx.beginPath();
ctx.arc(0, 0, 102, 0, Math.PI * 2);
ctx.fillStyle = COLORS.white;
ctx.fill();
ctx.lineWidth = 2.5;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// 旋轉的精緻微光芒線條裝飾
ctx.strokeStyle = 'rgba(66, 133, 244, 0.22)';
ctx.lineWidth = 1.5;
for (let i = 0; i < 12; i++) {
  const ang = (i * Math.PI) / 6;
  ctx.beginPath();
  ctx.moveTo(68 * Math.cos(ang), 68 * Math.sin(ang));
  ctx.lineTo(92 * Math.cos(ang), 92 * Math.sin(ang));
  ctx.stroke();
}

// 核心大 Gemini 星芒
const starGradient = ctx.createLinearGradient(-45, -45, 45, 45);
starGradient.addColorStop(0, COLORS.blue);
starGradient.addColorStop(1, COLORS.blueHalftone);

drawGeminiStar(ctx, 0, -10, 60, 16, starGradient, COLORS.ink, 2.5);

// 4 個精緻 Google 色星芒微光粒子 (圍繞中心)
drawGeminiStar(ctx, -68, -45, 8, 3, COLORS.yellow, null, 0);
drawGeminiStar(ctx, 68, -45, 8, 3, COLORS.red, null, 0);
drawGeminiStar(ctx, -70, 35, 7, 2.5, COLORS.green, null, 0);
drawGeminiStar(ctx, 70, 35, 7, 2.5, COLORS.blue, null, 0);

// 核心文字標籤 "AI AGENT ERA"
safeRoundRect(ctx, -56, 46, 112, 28, 6);
ctx.fillStyle = COLORS.ink;
ctx.fill();

ctx.fillStyle = COLORS.white;
ctx.font = `bold 12px ${FONT_FAMILY}`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('AI AGENT ERA', 0, 60);
ctx.restore();

ctx.restore(); // 結束主卡片剪裁區

// 繪製卡片外框 (3px solid #1e1e1e)
safeRoundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.radius);
ctx.lineWidth = 3;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// ==========================================
// 左側內容區 (Left Column): 品牌、標題、雙軌、資訊
// ==========================================
const leftX = CARD.x + 36; // 64

// 3.1 頂部 Header: GDG Kaohsiung 品牌膠囊 + 年度盛會徽章
drawStickerBadge({
  x: leftX,
  y: CARD.y + 24,
  width: 410,
  height: 38,
  bgColor: COLORS.white,
  radius: 19,
  borderWidth: 2,
  shadowSize: 2.5,
  prefix: { type: 'dots' },
  text: 'GDG Kaohsiung · Google Developer Groups',
  fontSize: 15.5,
  textColor: COLORS.ink,
});

drawStickerBadge({
  x: leftX + 422,
  y: CARD.y + 24,
  width: 178,
  height: 38,
  bgColor: COLORS.yellowPastel,
  radius: 8,
  borderWidth: 2,
  shadowSize: 2.5,
  text: '⚡ 南台灣年度盛會',
  fontSize: 15,
  textColor: COLORS.ink,
  alignCenter: true,
});

// 3.2 主標題區 (DevFest 2026 + 高雄場印章)
const titleY = CARD.y + 80;

ctx.save();
ctx.textAlign = 'left';
ctx.textBaseline = 'top';

// 主標題：DevFest 2026
ctx.font = `900 58px ${FONT_FAMILY}`;
// 微偏移立體字影
ctx.fillStyle = 'rgba(30, 30, 30, 0.1)';
ctx.fillText('DevFest 2026', leftX + 3, titleY + 3);
// 實心文字
ctx.fillStyle = COLORS.ink;
ctx.fillText('DevFest 2026', leftX, titleY);
ctx.restore();

// 高雄場立體印章 Badge
const khBadgeX = leftX + 422;
const khBadgeY = titleY + 5;
drawStickerBadge({
  x: khBadgeX,
  y: khBadgeY,
  width: 178,
  height: 54,
  bgColor: COLORS.yellowHalftone,
  radius: 10,
  borderWidth: 2.5,
  shadowSize: 3.5,
  text: '高雄場',
  fontSize: 28,
  fontWeight: '900',
  textColor: COLORS.ink,
  alignCenter: true,
  rotation: 1.5,
});

// 3.3 大會主題橫幅 (Theme Banner)
const themeY = titleY + 70;
const themeW = 600;
const themeH = 60;

// 硬陰影
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

// 左側標籤塊 "THEME"
const themeTagW = 92;
safeRoundRect(ctx, leftX, themeY, themeTagW, themeH, [10, 0, 0, 10]);
ctx.fillStyle = COLORS.blue;
ctx.fill();
ctx.lineWidth = 2;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

ctx.save();
ctx.fillStyle = COLORS.white;
ctx.font = `900 15px ${FONT_FAMILY}`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('✦ 主題', leftX + themeTagW / 2, themeY + 20);
ctx.font = `bold 12px ${FONT_FAMILY}`;
ctx.fillText('THEME', leftX + themeTagW / 2, themeY + 40);

// 主題文案兩行排版，兼具氣勢與可讀性
ctx.fillStyle = COLORS.ink;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.font = `bold 18.5px ${FONT_FAMILY}`;
ctx.fillText('建構 · 保護 · 擴充', leftX + themeTagW + 18, themeY + 20);

ctx.fillStyle = '#555555';
ctx.font = `bold 14.5px ${FONT_FAMILY}`;
ctx.fillText('AI 代理時代的開發人員和建構者', leftX + themeTagW + 18, themeY + 42);
ctx.restore();

// 3.4 雙軌議程：雙子焦點卡片 (Dual Track Twin Cards)
const trackY = themeY + themeH + 16;
const trackW = 292;
const trackH = 142;
const trackGap = 16;

// --- Track 1: 開發者軌 Developer Track ---
const t1X = leftX;
// 硬陰影
safeRoundRect(ctx, t1X + 3.5, trackY + 3.5, trackW, trackH, 12);
ctx.fillStyle = COLORS.ink;
ctx.fill();
// 本體卡片
safeRoundRect(ctx, t1X, trackY, trackW, trackH, 12);
ctx.fillStyle = COLORS.white;
ctx.fill();
ctx.lineWidth = 2;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// 頂部色彩標題列
const trackHeaderH = 40;
safeRoundRect(ctx, t1X, trackY, trackW, trackHeaderH, [12, 12, 0, 0]);
ctx.fillStyle = COLORS.bluePastel;
ctx.fill();
ctx.lineWidth = 2;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// 標題列文字與藍點
ctx.save();
ctx.beginPath();
ctx.arc(t1X + 18, trackY + trackHeaderH / 2, 6, 0, Math.PI * 2);
ctx.fillStyle = COLORS.blue;
ctx.fill();
ctx.lineWidth = 1.5;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

ctx.fillStyle = COLORS.ink;
ctx.font = `900 17px ${FONT_FAMILY}`;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText('開發者軌', t1X + 32, trackY + trackHeaderH / 2 + 1);

// 右側英文標籤
ctx.font = `bold 13px ${FONT_FAMILY}`;
ctx.fillStyle = COLORS.blue;
ctx.textAlign = 'right';
ctx.fillText('Developer', t1X + trackW - 14, trackY + trackHeaderH / 2 + 1);

// 卡片內容區
ctx.fillStyle = COLORS.ink;
ctx.textAlign = 'left';
ctx.font = `bold 16px ${FONT_FAMILY}`;
ctx.fillText('Developer Track', t1X + 16, trackY + 64);

ctx.fillStyle = '#444444';
ctx.font = `medium 13.5px ${FONT_FAMILY}`;
ctx.fillText('• 智慧代理架構 (A2A)', t1X + 16, trackY + 90);
ctx.fillText('• Gemini、Android、GCP 生態', t1X + 16, trackY + 114);
ctx.restore();

// --- Track 2: 建構者軌 Builder Track ---
const t2X = leftX + trackW + trackGap;
// 硬陰影
safeRoundRect(ctx, t2X + 3.5, trackY + 3.5, trackW, trackH, 12);
ctx.fillStyle = COLORS.ink;
ctx.fill();
// 本體卡片
safeRoundRect(ctx, t2X, trackY, trackW, trackH, 12);
ctx.fillStyle = COLORS.white;
ctx.fill();
ctx.lineWidth = 2;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// 頂部色彩標題列
safeRoundRect(ctx, t2X, trackY, trackW, trackHeaderH, [12, 12, 0, 0]);
ctx.fillStyle = COLORS.greenPastel;
ctx.fill();
ctx.lineWidth = 2;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// 標題列文字與綠點
ctx.save();
ctx.beginPath();
ctx.arc(t2X + 18, trackY + trackHeaderH / 2, 6, 0, Math.PI * 2);
ctx.fillStyle = COLORS.green;
ctx.fill();
ctx.lineWidth = 1.5;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

ctx.fillStyle = COLORS.ink;
ctx.font = `900 17px ${FONT_FAMILY}`;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.fillText('建構者軌', t2X + 32, trackY + trackHeaderH / 2 + 1);

// 右側英文標籤
ctx.font = `bold 13px ${FONT_FAMILY}`;
ctx.fillStyle = COLORS.green;
ctx.textAlign = 'right';
ctx.fillText('Builder', t2X + trackW - 14, trackY + trackHeaderH / 2 + 1);

// 卡片內容區
ctx.fillStyle = COLORS.ink;
ctx.textAlign = 'left';
ctx.font = `bold 16px ${FONT_FAMILY}`;
ctx.fillText('Builder Track', t2X + 16, trackY + 64);

ctx.fillStyle = '#444444';
ctx.font = `medium 13.5px ${FONT_FAMILY}`;
ctx.fillText('• 創新解決方案落地', t2X + 16, trackY + 90);
ctx.fillText('• 賦能多元想法與跨界實踐', t2X + 16, trackY + 114);
ctx.restore();

// 3.5 底部活動資訊卡 (Event Info Panel)
const infoY = trackY + trackH + 16;
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

// 左側 Google 四色直立色條
const barW = 7;
const barSegmentH = infoH / 4;
const googleColors = [COLORS.blue, COLORS.red, COLORS.yellow, COLORS.green];
googleColors.forEach((color, i) => {
  const rad = i === 0 ? [12, 0, 0, 0] : i === 3 ? [0, 0, 0, 12] : 0;
  safeRoundRect(ctx, leftX, infoY + i * barSegmentH, barW, barSegmentH, rad);
  ctx.fillStyle = color;
  ctx.fill();
});

// 資訊內容
ctx.save();
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';

// 第一行：時間
ctx.fillStyle = COLORS.ink;
ctx.font = `bold 16px ${FONT_FAMILY}`;
ctx.fillText('📅 時間：2026-11-14（六）08:30 – 17:30', leftX + 22, infoY + 28);

// 第二行：地點
ctx.fillText('📍 地點：KO-IN 智高點（高雄市新興區中正三路 25 號 14 樓）', leftX + 22, infoY + 60);

// 分隔線
ctx.strokeStyle = '#e6e6e6';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(leftX + 22, infoY + 84);
ctx.lineTo(leftX + infoW - 20, infoY + 84);
ctx.stroke();

// 第三行：官網與主辦
ctx.fillStyle = '#555555';
ctx.font = `bold 14px ${FONT_FAMILY}`;
ctx.fillText('🌐 官網：gdgkh.cc/2026/', leftX + 22, infoY + 102);
ctx.fillText('🏛 主辦：GDG Kaohsiung', leftX + 320, infoY + 102);
ctx.restore();

// ==========================================
// 右側 5 大活動亮點貼紙卡片 (Highlight Badges)
// ==========================================

// ① Gemini AI (左上)
drawStickerBadge({
  x: 678,
  y: 74,
  width: 175,
  height: 48,
  bgColor: COLORS.bluePastel,
  radius: 8,
  borderWidth: 2,
  shadowSize: 3.5,
  prefix: { type: 'sparkle', color: COLORS.blue },
  text: 'Gemini AI',
  fontSize: 17,
  textColor: COLORS.ink,
  rotation: -5,
});

// ② Google 技術 (右上)
drawStickerBadge({
  x: 888,
  y: 68,
  width: 210,
  height: 48,
  bgColor: COLORS.redPastel,
  radius: 8,
  borderWidth: 2,
  shadowSize: 3.5,
  prefix: { type: 'dots' },
  text: 'Google 技術',
  fontSize: 17,
  textColor: COLORS.ink,
  rotation: 3,
});

// ③ 人脈交流 (左下)
drawStickerBadge({
  x: 678,
  y: 408,
  width: 170,
  height: 48,
  bgColor: COLORS.greenPastel,
  radius: 8,
  borderWidth: 2,
  shadowSize: 3.5,
  prefix: { type: 'circle', color: COLORS.green },
  text: '人脈交流',
  fontSize: 17,
  textColor: COLORS.ink,
  rotation: -3,
});

// ④ 高雄社群 (右下)
drawStickerBadge({
  x: 885,
  y: 414,
  width: 170,
  height: 48,
  bgColor: COLORS.yellowPastel,
  radius: 8,
  borderWidth: 2,
  shadowSize: 3.5,
  prefix: { type: 'circle', color: COLORS.yellow },
  text: '高雄社群',
  fontSize: 17,
  textColor: COLORS.ink,
  rotation: 2.5,
});

// ⑤ 第二屆技術創作市集 (旗艦亮點，底部吸睛大卡片，與左側資訊卡等高對齊)
const mktX = 680;
const mktY = 494;
const mktW = 440;
const mktH = 60;

// 硬陰影
safeRoundRect(ctx, mktX + 4, mktY + 4, mktW, mktH, 10);
ctx.fillStyle = COLORS.ink;
ctx.fill();

// 本體
safeRoundRect(ctx, mktX, mktY, mktW, mktH, 10);
ctx.fillStyle = COLORS.white;
ctx.fill();
ctx.lineWidth = 2.5;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

// 左側紅色亮點標籤 "SPECIAL"
const mktTagW = 95;
safeRoundRect(ctx, mktX, mktY, mktTagW, mktH, [10, 0, 0, 10]);
ctx.fillStyle = COLORS.red;
ctx.fill();
ctx.lineWidth = 2;
ctx.strokeStyle = COLORS.ink;
ctx.stroke();

ctx.save();
ctx.fillStyle = COLORS.white;
ctx.font = `900 14px ${FONT_FAMILY}`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('特別企劃', mktX + mktTagW / 2, mktY + 20);
ctx.font = `bold 11px ${FONT_FAMILY}`;
ctx.fillText('SPECIAL', mktX + mktTagW / 2, mktY + 40);

// 右側市集文字
ctx.fillStyle = COLORS.red;
ctx.textAlign = 'left';
ctx.textBaseline = 'middle';
ctx.font = `900 20px ${FONT_FAMILY}`;
ctx.fillText('🎪 第二屆技術創作市集', mktX + mktTagW + 18, mktY + mktH / 2 + 1);
ctx.restore();

// --- 輸出 PNG ---
await fs.mkdir(path.dirname(outPath), { recursive: true });
const rawBuffer = canvas.toBuffer('image/png');
const buffer = await sharp(rawBuffer).png({ compressionLevel: 9, effort: 7 }).toBuffer();
await fs.writeFile(outPath, buffer);
console.log(`[generate-site-og] 成功生成：${outPath}`);
