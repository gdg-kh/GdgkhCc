import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from 'canvas';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { assetPath } from './entity-types.mjs';
import { FONT_FAMILY, pickLang, registerFontsOnce, wrapHeadline } from './render-og.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_2026 = path.resolve(__dirname, '..');

const CONFIG_PATH = path.join(ROOT_2026, 'data', 'config.json');
const CONTENT_PATH = path.join(ROOT_2026, 'data', 'content.json');
const CONSENT_PATH = path.join(ROOT_2026, 'data', 'speaker-consent.json');
const POSTERS_DIR = path.join(ROOT_2026, 'posters');
const PDF_FILENAME = 'devfest-2026-speaker-posters-a3.pdf';

// 邏輯設計畫布（150 DPI A3 橫式 420mm x 297mm 基準座標系）
const BASE_W = 2480.315;
const BASE_H = 1753.937;

// 300 DPI A3 橫式 PNG 像素尺寸（420mm x 297mm）
const PNG_W = 4961;
const PNG_H = 3508;

// PDF A3 橫式點數尺寸（420mm x 297mm, 72 pt/inch）
const PDF_W_PT = (420 / 25.4) * 72;
const PDF_H_PT = (297 / 25.4) * 72;

// 官方與底圖色票
const COLORS = {
  bg: '#DBDCDC',
  white: '#FFFFFF',
  paper: '#F0F0F0',
  ink: '#1E1E1E',
  subText: '#4A4A4A',
  muted: '#555555',
  red: '#EA4335',
  blue: '#4285F4',
  yellow: '#F9AB00',
  green: '#34A853',
  greenPastel: '#CCF6C5',
  redPastel: '#F8D8D8',
  avatarFallback: '#D2E3D5',
};

function sanitizeSpeakerText(text) {
  return String(text || '').trim();
}

function formatTimeRange(session) {
  if (!session || typeof session.start !== 'string' || typeof session.end !== 'string') {
    return '';
  }
  const start = session.start.length >= 16 ? session.start.slice(11, 16) : '';
  const end = session.end.length >= 16 ? session.end.slice(11, 16) : '';
  if (start && end) {
    return `${start} – ${end}`;
  }
  return start || end;
}

function parseMinutes(iso) {
  if (typeof iso !== 'string' || iso.length < 16) {
    return 9999;
  }
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatAffiliation(speaker) {
  const title = sanitizeSpeakerText(pickLang(speaker && speaker.title));
  const org = sanitizeSpeakerText(pickLang(speaker && speaker.org));
  if (title && org) {
    if (title.toLowerCase() === org.toLowerCase()) {
      return title;
    }
    return `${title} · ${org}`;
  }
  return title || org || '';
}

function initialCharacter(text) {
  const trimmed = String(text || '').trim();
  return trimmed ? Array.from(trimmed)[0] : '✦';
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function traceHandSegment(ctx, x1, y1, x2, y2, seed = 1, amplitude = 1.6, moveStart = false) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return;
  }
  const nx = -dy / dist;
  const ny = dx / dist;
  const step = 18;
  const count = Math.max(2, Math.round(dist / step));
  if (moveStart) {
    ctx.moveTo(x1, y1);
  }
  for (let i = 1; i <= count; i += 1) {
    const t = i / count;
    const taper = Math.sin(Math.PI * t);
    const wave = Math.sin(t * 29 + seed * 3.7) * 0.65 + Math.cos(t * 71 + seed * 9.1) * 0.35;
    const offset = wave * amplitude * taper;
    ctx.lineTo(x1 + dx * t + nx * offset, y1 + dy * t + ny * offset);
  }
}

function drawHandDrawnFrame(ctx, frameX, frameY, frameW, frameH, footerTopY) {
  // 1. 先以乾淨圓角矩形剪裁並填上頁尾白底
  ctx.save();
  roundRectPath(ctx, frameX, frameY, frameW, frameH, 10);
  ctx.clip();
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(frameX, footerTopY, frameW, frameY + frameH - footerTopY);
  ctx.restore();

  // 2. 繪製手繪感外框線
  ctx.save();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 7.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  traceHandSegment(ctx, frameX, frameY, frameX + frameW, frameY, 1, 1.8, true);
  traceHandSegment(ctx, frameX + frameW, frameY, frameX + frameW, frameY + frameH, 2, 1.8, false);
  traceHandSegment(ctx, frameX + frameW, frameY + frameH, frameX, frameY + frameH, 3, 1.8, false);
  traceHandSegment(ctx, frameX, frameY + frameH, frameX, frameY, 4, 1.8, false);
  ctx.closePath();
  ctx.stroke();

  // 3. 繪製底部白區手繪水平分隔線
  ctx.beginPath();
  traceHandSegment(ctx, frameX, footerTopY, frameX + frameW, footerTopY, 5, 1.8, true);
  ctx.stroke();
  ctx.restore();
}

function drawTrackedText(ctx, text, cx, cy, targetSpan) {
  const chars = Array.from(text);
  if (chars.length <= 1) {
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, cy);
    return;
  }
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalW = widths.reduce((sum, w) => sum + w, 0);
  const gap = (targetSpan - totalW) / (chars.length - 1);
  let curX = cx - targetSpan / 2;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i], curX, cy);
    curX += widths[i] + gap;
  }
}

function measureVisualMidOffset(ctx, font, sample = '活動中A') {
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(sample);
  ctx.restore();
  return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}

function measureGlyphDescent(ctx, font, sample = '活動中A') {
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(sample);
  ctx.restore();
  return m.actualBoundingBoxDescent;
}

function drawSectionBadge(ctx, x, y, w, h, label) {
  const badgeFont = `900 42px ${FONT_FAMILY}`;
  const midOffset = measureVisualMidOffset(ctx, badgeFont, label);
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  roundRectPath(ctx, x, y, w, h, 8);
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.font = badgeFont;
  ctx.textBaseline = 'alphabetic';
  drawTrackedText(ctx, label, x + w / 2, y + h / 2 + midOffset, 212);
  ctx.restore();
}

function drawPill(
  ctx,
  x,
  y,
  text,
  {
    bg = COLORS.white,
    fg = COLORS.ink,
    borderColor = COLORS.ink,
    borderWidth = 3,
    font = `700 28px ${FONT_FAMILY}`,
    padX = 28,
    height = 56,
    shadow = 4,
  } = {}
) {
  ctx.save();
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const w = Math.ceil(textW + padX * 2);
  const r = height / 2;

  if (shadow > 0) {
    ctx.fillStyle = COLORS.ink;
    roundRectPath(ctx, x + shadow, y + shadow, w, height, r);
    ctx.fill();
  }

  ctx.fillStyle = bg;
  roundRectPath(ctx, x, y, w, height, r);
  ctx.fill();

  if (borderWidth > 0) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + height / 2 + 2);
  ctx.restore();
  return w;
}

function wrapUrlLines(ctx, url, maxWidth) {
  const segments = url.split(/(?<=\/)/).filter(Boolean);
  const lines = [];
  let current = '';

  const pushWrappedChars = (chunk) => {
    for (const ch of Array.from(chunk)) {
      const next = `${current}${ch}`;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
  };

  for (const seg of segments) {
    const candidate = `${current}${seg}`;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = '';
      if (ctx.measureText(seg).width > maxWidth) {
        pushWrappedChars(seg);
      } else {
        current = seg;
      }
    } else if (!current && ctx.measureText(seg).width > maxWidth) {
      pushWrappedChars(seg);
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function drawVectorQr(ctx, url, boxX, boxY, boxSize) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const quietMargin = 16;
  const drawArea = boxSize - quietMargin * 2;
  const cell = drawArea / count;

  ctx.save();
  ctx.fillStyle = COLORS.white;
  ctx.fillRect(boxX, boxY, boxSize, boxSize);

  ctx.fillStyle = COLORS.ink;
  // 加極小重疊防止 PDF 向量檢視器縮放時出現細白縫
  const overlap = Math.min(0.4, cell * 0.04);
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(row, col)) {
        const rx = boxX + quietMargin + col * cell;
        const ry = boxY + quietMargin + row * cell;
        ctx.fillRect(rx, ry, cell + overlap, cell + overlap);
      }
    }
  }
  ctx.restore();
}

function drawConsentIcon(ctx, x, y, size, allowed) {
  ctx.save();
  const radius = 22;

  // 圖示硬陰影
  ctx.fillStyle = COLORS.ink;
  roundRectPath(ctx, x + 5, y + 5, size, size, radius);
  ctx.fill();

  // 圓角正方圖示底色（✅ 綠 / ❌ 紅）
  ctx.fillStyle = allowed ? COLORS.green : COLORS.red;
  roundRectPath(ctx, x, y, size, size, radius);
  ctx.fill();

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 5;
  ctx.stroke();

  // 內部白色向量符號
  ctx.strokeStyle = COLORS.white;
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (allowed) {
    ctx.beginPath();
    ctx.moveTo(x + size * 0.25, y + size * 0.53);
    ctx.lineTo(x + size * 0.43, y + size * 0.72);
    ctx.lineTo(x + size * 0.77, y + size * 0.3);
    ctx.stroke();
  } else {
    const pad = size * 0.28;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad);
    ctx.lineTo(x + size - pad, y + size - pad);
    ctx.moveTo(x + size - pad, y + pad);
    ctx.lineTo(x + pad, y + size - pad);
    ctx.stroke();
  }
  ctx.restore();
}

function drawConsentCard(ctx, x, y, w, h, label, allowed) {
  ctx.save();
  const radius = 24;

  // 卡片硬陰影
  ctx.fillStyle = COLORS.ink;
  roundRectPath(ctx, x + 8, y + 8, w, h, radius);
  ctx.fill();

  // 柔綠 / 柔紅膠囊背景
  ctx.fillStyle = allowed ? COLORS.greenPastel : COLORS.redPastel;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // 卡片內部水平置中計算：「拍照：」＋ 向量圖示（全形冒號自帶右側留白，故縮小 gap）
  const fontSize = 96;
  const iconSize = 120;
  const gap = 8;
  ctx.font = `900 ${fontSize}px ${FONT_FAMILY}`;
  const textW = ctx.measureText(label).width;
  const groupW = textW + gap + iconSize;
  const startX = x + (w - groupW) / 2;
  const centerY = y + h / 2;

  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, startX, centerY + 4);

  drawConsentIcon(ctx, startX + textW + gap, centerY - iconSize / 2, iconSize, allowed);
  ctx.restore();
}

function drawImageContain(ctx, img, boxX, boxY, boxW, boxH) {
  const scale = Math.min(boxW / img.width, boxH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = boxX + (boxW - drawW) / 2;
  const drawY = boxY + (boxH - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

async function loadBrandAssets() {
  const tplDir = path.join(ROOT_2026, 'assets', 'og-template');
  const [dfRaw, gdgRaw, koinRaw, goRaw] = await Promise.all([
    fs.readFile(path.join(tplDir, 'share-og-df.svg')),
    fs.readFile(path.join(tplDir, 'share-og-gdg.svg')),
    fs.readFile(path.join(tplDir, 'share-og-go-koin.svg')),
    fs.readFile(path.join(tplDir, 'share-og-go.svg')),
  ]);

  // 裁切 GDG Logo 周圍留白，維持純白背景且放得更飽滿清晰
  const gdgBuf = await sharp(gdgRaw, { density: 450 }).png().trim({ threshold: 10 }).toBuffer();
  const dfBuf = await sharp(dfRaw, { density: 450 }).png().toBuffer();
  const koinBuf = await sharp(koinRaw, { density: 450 }).png().toBuffer();
  const goBuf = await sharp(goRaw, { density: 300 }).png().toBuffer();

  const [dfImg, gdgImg, koinImg, goImg] = await Promise.all([
    loadImage(dfBuf),
    loadImage(gdgBuf),
    loadImage(koinBuf),
    loadImage(goBuf),
  ]);

  return { dfImg, gdgImg, koinImg, goImg };
}

async function tryLoadSpeakerPhoto(speakerId) {
  const relPath = assetPath('speakers', speakerId);
  const absPath = path.join(ROOT_2026, relPath);
  if (!existsSync(absPath)) {
    return null;
  }
  try {
    return await loadImage(absPath);
  } catch (err) {
    console.warn(`[render-poster] 載入講者頭像失敗 ${relPath}：${err.message}`);
    return null;
  }
}

function parseConsentLookup(consentJson, speakerId) {
  const rec = consentJson && consentJson.speakers && consentJson.speakers[speakerId];
  if (!rec || typeof rec !== 'object') {
    return { photo: false, video: false, rawConsent: '' };
  }
  return {
    photo: rec.photo === true,
    video: rec.video === true,
    rawConsent: String(rec.rawConsent || ''),
  };
}

function buildPosterEntries(content, consentJson, config) {
  const baseUrlRaw = (config && config.site && config.site.baseUrl) || 'https://gdgkh.cc/2026/';
  const baseUrl = baseUrlRaw.endsWith('/') ? baseUrlRaw : `${baseUrlRaw}/`;

  const trackMap = new Map((content.tracks || []).map((t) => [t.id, t]));
  const groupMap = new Map((content.sessionGroups || []).map((g) => [g.id, g]));
  const sessionMap = new Map((content.sessions || []).map((s) => [s.id, s]));

  const entries = [];
  const speakers = Array.isArray(content.speakers) ? content.speakers : [];

  speakers.forEach((speaker, speakerIndex) => {
    const sid = Array.isArray(speaker.sessionIds) ? speaker.sessionIds[0] : null;
    const session = sid ? sessionMap.get(sid) : null;
    const track = session && session.trackId ? trackMap.get(session.trackId) : null;
    const groupId = (session && session.groupId) || speaker.groupId;
    const group = groupId ? groupMap.get(groupId) : null;

    // 同場所有講者從嚴連坐：必須該場次每一位講者皆勾選同意才算同意
    const coSpeakerIds =
      session && Array.isArray(session.speakerIds) && session.speakerIds.length > 0 ? session.speakerIds : [speaker.id];

    const coConsents = coSpeakerIds.map((id) => parseConsentLookup(consentJson, id));
    const photoAllowed = coConsents.every((c) => c.photo === true);
    const videoAllowed = coConsents.every((c) => c.video === true);
    const ownConsent = parseConsentLookup(consentJson, speaker.id);

    const zhName = sanitizeSpeakerText(pickLang(speaker.name));
    const enName = sanitizeSpeakerText(speaker.name && speaker.name.en);
    const hasDistinctEn = Boolean(enName && enName !== zhName && !zhName.toLowerCase().includes(enName.toLowerCase()));

    entries.push({
      speaker,
      speakerIndex,
      session,
      track,
      group,
      zhName,
      enName,
      hasDistinctEn,
      affiliation: formatAffiliation(speaker),
      sessionTitle: sanitizeSpeakerText(pickLang(session && session.title)),
      timeRange: formatTimeRange(session),
      trackOrder: track && typeof track.order === 'number' ? track.order : 99,
      startMinutes: parseMinutes(session && session.start),
      startCompact:
        session && typeof session.start === 'string' && session.start.length >= 16
          ? session.start.slice(11, 16).replace(':', '')
          : '0000',
      shareUrl: `${baseUrl}share/speakers/${speaker.id}/`,
      photoAllowed,
      videoAllowed,
      ownConsent,
      isStrictMerged:
        coSpeakerIds.length > 1 && (photoAllowed !== ownConsent.photo || videoAllowed !== ownConsent.video),
    });
  });

  // 依「會場順序 (track.order) -> 開始時間 -> 講者原順序」排列
  entries.sort((a, b) => {
    if (a.trackOrder !== b.trackOrder) {
      return a.trackOrder - b.trackOrder;
    }
    if (a.startMinutes !== b.startMinutes) {
      return a.startMinutes - b.startMinutes;
    }
    return a.speakerIndex - b.speakerIndex;
  });

  return entries;
}

function layoutRightContent(ctx, entry, maxWidth, zoneHeight) {
  const badgeW = 260;
  const badgeH = 76;
  const gap = 30;
  const maxTextW = maxWidth - badgeW - gap;

  // 1. 講者姓名（中文 + 英文）與職稱組織計算
  const zhFontSize = 60;
  const enFontSize = 46;
  const zhFont = `900 ${zhFontSize}px ${FONT_FAMILY}`;
  const sepFont = `400 ${enFontSize}px ${FONT_FAMILY}`;
  const enFont = `700 ${enFontSize}px ${FONT_FAMILY}`;
  const nameLineH = 76;

  const nameMidOffset = measureVisualMidOffset(ctx, zhFont);
  const nameDesc = measureGlyphDescent(ctx, zhFont);
  const pipeMidOffset = measureVisualMidOffset(ctx, sepFont, '|');
  const pipeDy = -(nameMidOffset - pipeMidOffset);

  let nameLines = [];
  if (!entry.hasDistinctEn) {
    ctx.font = zhFont;
    const wrapped = wrapHeadline(ctx, entry.zhName, maxTextW);
    nameLines = wrapped.map((line) => [{ text: line, font: zhFont, color: COLORS.ink, dy: 0 }]);
  } else {
    ctx.font = zhFont;
    const zhW = ctx.measureText(entry.zhName).width;
    const sep = '  |  ';
    ctx.font = sepFont;
    const sepW = ctx.measureText(sep).width;
    ctx.font = enFont;
    const enW = ctx.measureText(entry.enName).width;

    if (zhW + sepW + enW <= maxTextW) {
      nameLines = [
        [
          { text: entry.zhName, font: zhFont, color: COLORS.ink, dy: 0 },
          { text: sep, font: sepFont, color: COLORS.muted, dy: pipeDy },
          { text: entry.enName, font: enFont, color: COLORS.subText, dy: 0 },
        ],
      ];
    } else {
      ctx.font = zhFont;
      const zhWrapped = wrapHeadline(ctx, entry.zhName, maxTextW);
      ctx.font = enFont;
      const enWrapped = wrapHeadline(ctx, entry.enName, maxTextW);
      nameLines = [
        ...zhWrapped.map((l) => [{ text: l, font: zhFont, color: COLORS.ink, dy: 0 }]),
        ...enWrapped.map((l) => [{ text: l, font: enFont, color: COLORS.subText, dy: 0 }]),
      ];
    }
  }

  let affLines = [];
  const affFontSize = 38;
  const affFont = `700 ${affFontSize}px ${FONT_FAMILY}`;
  const affLineH = 52;
  const affFirstGapStep = 54;
  if (entry.affiliation) {
    ctx.font = affFont;
    affLines = wrapHeadline(ctx, entry.affiliation, maxTextW);
  }

  const nameBlockW = Math.max(
    ...nameLines.map((segs) =>
      segs.reduce((sum, s) => {
        ctx.font = s.font;
        return sum + ctx.measureText(s.text).width;
      }, 0)
    )
  );
  const affBlockW = affLines.length
    ? Math.max(
        ...affLines.map((l) => {
          ctx.font = affFont;
          return ctx.measureText(l).width;
        })
      )
    : 0;

  // 以第 1 行視覺中心對齊 badgeH / 2 為準，算出整體文字區最底緣距離 row1Y 的高度
  const firstBaseRel = badgeH / 2 + nameMidOffset;
  const lastNameBaseRel = firstBaseRel + (nameLines.length - 1) * nameLineH;
  const speakerBottomRel =
    affLines.length > 0
      ? lastNameBaseRel + affFirstGapStep + (affLines.length - 1) * affLineH + measureGlyphDescent(ctx, affFont)
      : lastNameBaseRel + nameDesc;
  const speakerBlockH = Math.max(badgeH, Math.ceil(speakerBottomRel));
  const speakerBlockW = badgeW + gap + Math.max(nameBlockW, affBlockW);

  // 2. 完整議程標題計算（動態調降字級直至完全無截斷放進安全高度）
  const rowGap = 52;
  const availSessionH = Math.max(180, zoneHeight - speakerBlockH - rowGap);

  let sesFontSize = 60;
  let sesLineH = 82;
  let sesLines = [];

  if (entry.sessionTitle) {
    while (sesFontSize >= 34) {
      ctx.font = `900 ${sesFontSize}px ${FONT_FAMILY}`;
      sesLineH = Math.round(sesFontSize * 1.38);
      sesLines = wrapHeadline(ctx, entry.sessionTitle, maxTextW);
      const sesFontTmp = `900 ${sesFontSize}px ${FONT_FAMILY}`;
      const sesMidTmp = measureVisualMidOffset(ctx, sesFontTmp);
      const sesDescTmp = measureGlyphDescent(ctx, sesFontTmp, '活動中Ag');
      const totalSesH = Math.max(badgeH, badgeH / 2 + sesMidTmp + (sesLines.length - 1) * sesLineH + sesDescTmp);
      if (totalSesH <= availSessionH) {
        break;
      }
      sesFontSize -= 2;
    }
  }

  const sesFont = `900 ${sesFontSize}px ${FONT_FAMILY}`;
  const sesMidOffset = measureVisualMidOffset(ctx, sesFont);
  const sesDesc = measureGlyphDescent(ctx, sesFont, '活動中Ag');

  const sesTextW = sesLines.length
    ? Math.max(
        ...sesLines.map((l) => {
          ctx.font = sesFont;
          return ctx.measureText(l).width;
        })
      )
    : 0;
  const sessionBlockH =
    sesLines.length > 0
      ? Math.max(badgeH, Math.ceil(badgeH / 2 + sesMidOffset + (sesLines.length - 1) * sesLineH + sesDesc))
      : 0;
  const sessionBlockW = sesLines.length > 0 ? badgeW + gap + sesTextW : 0;

  return {
    badgeW,
    badgeH,
    gap,
    rowGap,
    nameLines,
    nameLineH,
    nameMidOffset,
    affLines,
    affFontSize,
    affLineH,
    affFirstGapStep,
    speakerBlockH,
    speakerBlockW,
    sesFontSize,
    sesLineH,
    sesMidOffset,
    sesLines,
    sessionBlockH,
    sessionBlockW,
  };
}

function drawPosterPage(ctx, entry, { speakerPhoto, assets }) {
  // 1. 畫布底色
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  const frameX = 52;
  const frameY = 52;
  const frameW = BASE_W - 104;
  const frameH = BASE_H - 104;
  const footerTopY = 1528;

  // 2. 右上角淡紅色大水印（裁切在主灰區內）
  ctx.save();
  roundRectPath(ctx, frameX, frameY, frameW, footerTopY - frameY, 10);
  ctx.clip();
  const wmSize = 1140;
  ctx.drawImage(assets.goImg, BASE_W - wmSize * 0.68, -wmSize * 0.24, wmSize, wmSize);
  ctx.restore();

  // 3. 手繪外框、白底頁尾區與水平分隔線
  drawHandDrawnFrame(ctx, frameX, frameY, frameW, frameH, footerTopY);

  // 4. 底部白底頁尾列（活動主辦 GDG Kaohsiung · 活動場地 KO-IN 智高點）
  const footerCy = (footerTopY + frameY + frameH) / 2;
  const dotX = 1480;

  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 42px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  drawTrackedText(ctx, '活動主辦', 260, footerCy + 2, 230);

  drawImageContain(ctx, assets.gdgImg, 440, footerTopY + 18, 920, 138);

  // 5 顆垂直虛線圓點分隔
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.arc(dotX, footerCy + i * 24, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTrackedText(ctx, '活動場地', 1700, footerCy + 2, 230);
  drawImageContain(ctx, assets.koinImg, 1875, footerTopY + 20, 440, 134);
  ctx.restore();

  // 5. 左欄：講者方形頭像
  const leftColX = 116;
  const leftColW = 660;
  const photoY = 110;
  const photoSize = leftColW;

  if (speakerPhoto) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(leftColX, photoY, photoSize, photoSize);
    ctx.clip();
    const scale = Math.max(photoSize / speakerPhoto.width, photoSize / speakerPhoto.height);
    const drawW = speakerPhoto.width * scale;
    const drawH = speakerPhoto.height * scale;
    const drawX = leftColX + (photoSize - drawW) / 2;
    const drawY = photoY + (photoSize - drawH) / 2;
    ctx.drawImage(speakerPhoto, drawX, drawY, drawW, drawH);
    ctx.restore();
  } else {
    ctx.fillStyle = COLORS.avatarFallback;
    ctx.fillRect(leftColX, photoY, photoSize, photoSize);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `900 180px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initialCharacter(entry.zhName), leftColX + photoSize / 2, photoY + photoSize / 2);
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(leftColX, photoY, photoSize, photoSize);

  // 6. 左欄下方：QR Code 白底手繪卡片
  const qrCardY = 804;
  const qrCardH = 382;
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  roundRectPath(ctx, leftColX + 8, qrCardY + 8, leftColW, qrCardH, 16);
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  roundRectPath(ctx, leftColX, qrCardY, leftColW, qrCardH, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 5;
  ctx.stroke();

  const qrSize = 308;
  const qrX = leftColX + 30;
  const qrY = qrCardY + (qrCardH - qrSize) / 2;
  drawVectorQr(ctx, entry.shareUrl, qrX, qrY, qrSize);

  // QR Code 右側說明文字
  const qrTextX = qrX + qrSize + 24;
  const qrTextMaxW = leftColX + leftColW - qrTextX - 24;

  ctx.fillStyle = COLORS.ink;
  roundRectPath(ctx, qrTextX, qrY + 14, 176, 48, 8);
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.font = `900 28px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  drawTrackedText(ctx, '官網簡介', qrTextX + 88, qrY + 39, 136);

  ctx.fillStyle = COLORS.ink;
  ctx.font = `900 34px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('掃描 QR Code', qrTextX, qrY + 84);
  ctx.fillText('看講者與議程', qrTextX, qrY + 132);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 19px ${FONT_FAMILY}`;
  const shortDisplayUrl = entry.shareUrl.replace(/^https?:\/\//, '');
  const urlLines = wrapUrlLines(ctx, shortDisplayUrl, qrTextMaxW);
  urlLines.slice(0, 3).forEach((line, idx) => {
    ctx.fillText(line, qrTextX, qrY + 200 + idx * 28);
  });
  ctx.restore();

  // 7. 右欄頂部：DevFest 向量頭標
  const rightColX = 840;
  const rightColW = 1524;
  const rightCenterX = rightColX + rightColW / 2;

  const dfW = 920;
  const dfH = (dfW * assets.dfImg.height) / assets.dfImg.width;
  ctx.drawImage(assets.dfImg, rightCenterX - dfW / 2, 102, dfW, dfH);

  // 8. 右欄中上方：會場／時間／分類膠囊標籤列（整組水平置中）
  const pills = [];
  if (entry.track) {
    pills.push({
      text: pickLang(entry.track.name),
      bg: entry.track.color || COLORS.red,
      fg: COLORS.white,
    });
  }
  if (entry.timeRange) {
    pills.push({
      text: entry.timeRange,
      bg: COLORS.white,
      fg: COLORS.ink,
    });
  }
  if (entry.group) {
    pills.push({
      text: pickLang(entry.group.name),
      bg: entry.group.color || COLORS.paper,
      fg: COLORS.ink,
    });
  }

  const pillFont = `700 28px ${FONT_FAMILY}`;
  const pillPadX = 28;
  const pillGap = 20;
  ctx.font = pillFont;
  const pillWidths = pills.map((p) => Math.ceil(ctx.measureText(p.text).width + pillPadX * 2));
  const totalPillsW = pillWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, pills.length - 1) * pillGap;

  let curPillX = rightCenterX - totalPillsW / 2;
  const pillY = 434;
  pills.forEach((p, idx) => {
    drawPill(ctx, curPillX, pillY, p.text, {
      bg: p.bg,
      fg: p.fg,
      font: pillFont,
      padX: pillPadX,
      height: 56,
      borderWidth: 3.5,
      shadow: 4,
    });
    curPillX += pillWidths[idx] + pillGap;
  });

  // 9. 右欄核心文字區：講者姓名＋職稱組織＋完整議程標題
  const contentZoneTop = 518;
  const contentZoneH = 694;
  const lo = layoutRightContent(ctx, entry, rightColW, contentZoneH);

  const blockW = Math.max(lo.speakerBlockW, lo.sessionBlockW);
  const blockLeftX = Math.max(rightColX, Math.round(rightCenterX - blockW / 2));
  const textX = blockLeftX + lo.badgeW + lo.gap;

  const totalContentH = lo.speakerBlockH + (lo.sesLines.length > 0 ? lo.rowGap + lo.sessionBlockH : 0);
  const row1Y = Math.round(contentZoneTop + (contentZoneH - totalContentH) / 2);

  // [活動講者] 徽章（標籤中心與右側第一行字身中心完全對齊）
  drawSectionBadge(ctx, blockLeftX, row1Y, lo.badgeW, lo.badgeH, '活動講者');

  // 姓名各行繪製（共用 alphabetic 基準線讓中英高度齊平）
  let baseY = row1Y + lo.badgeH / 2 + lo.nameMidOffset;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  lo.nameLines.forEach((segs, idx) => {
    const lineBaseY = baseY + idx * lo.nameLineH;
    let segX = textX;
    for (const seg of segs) {
      ctx.font = seg.font;
      ctx.fillStyle = seg.color;
      ctx.fillText(seg.text, segX, lineBaseY + (seg.dy || 0));
      segX += ctx.measureText(seg.text).width;
    }
  });
  baseY += (lo.nameLines.length - 1) * lo.nameLineH;

  // 職稱組織各行繪製
  if (lo.affLines.length > 0) {
    baseY += lo.affFirstGapStep;
    ctx.font = `700 ${lo.affFontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.subText;
    lo.affLines.forEach((line, idx) => {
      ctx.fillText(line, textX, baseY + idx * lo.affLineH);
    });
  }

  // [議程主題] 徽章與完整標題
  if (lo.sesLines.length > 0) {
    const row2Y = row1Y + lo.speakerBlockH + lo.rowGap;
    drawSectionBadge(ctx, blockLeftX, row2Y, lo.badgeW, lo.badgeH, '議程主題');

    ctx.fillStyle = COLORS.ink;
    ctx.font = `900 ${lo.sesFontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const sesStartBaseY = row2Y + lo.badgeH / 2 + lo.sesMidOffset;
    lo.sesLines.forEach((line, idx) => {
      ctx.fillText(line, textX, sesStartBaseY + idx * lo.sesLineH);
    });
  }

  // 10. 主框下方獨立醒目大橫幅：拍照：✅ / ❌   錄影：✅ / ❌
  const bannerY = 1244;
  const cardW = 1100;
  const cardH = 224;
  const cardGap = 48;

  drawConsentCard(ctx, leftColX, bannerY, cardW, cardH, '拍照：', entry.photoAllowed);
  drawConsentCard(ctx, leftColX + cardW + cardGap, bannerY, cardW, cardH, '錄影：', entry.videoAllowed);
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlyId = onlyArg ? onlyArg.slice('--only='.length).trim() : null;
  const skipPdf = args.includes('--png-only');
  const skipPng = args.includes('--pdf-only');

  registerFontsOnce();

  const [configRaw, contentRaw, consentRaw, assets] = await Promise.all([
    fs.readFile(CONFIG_PATH, 'utf8'),
    fs.readFile(CONTENT_PATH, 'utf8'),
    fs.readFile(CONSENT_PATH, 'utf8'),
    loadBrandAssets(),
  ]);

  const config = JSON.parse(configRaw);
  const content = JSON.parse(contentRaw);
  const consentJson = JSON.parse(consentRaw);

  let entries = buildPosterEntries(content, consentJson, config);
  if (onlyId) {
    entries = entries.filter((e) => e.speaker.id === onlyId);
    if (entries.length === 0) {
      throw new Error(`找不到指定的講者 id：${onlyId}`);
    }
  }

  await fs.mkdir(POSTERS_DIR, { recursive: true });

  // 預先載入所有講者頭像
  const photos = new Map();
  for (const entry of entries) {
    photos.set(entry.speaker.id, await tryLoadSpeakerPhoto(entry.speaker.id));
  }

  // 1. 產出獨立 300 DPI A3 PNG
  if (!skipPng) {
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const seq = String(i + 1).padStart(2, '0');
      const trackSlug = entry.track ? entry.track.id : 'track';
      const fileName = `${seq}-${trackSlug}-${entry.startCompact}-${entry.speaker.id}.png`;
      const outPath = path.join(POSTERS_DIR, fileName);

      const canvas = createCanvas(PNG_W, PNG_H);
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(PNG_W / BASE_W, PNG_H / BASE_H);
      drawPosterPage(ctx, entry, {
        speakerPhoto: photos.get(entry.speaker.id),
        assets,
      });
      ctx.restore();

      const rawBuf = canvas.toBuffer('image/png');
      const optBuf = await sharp(rawBuf)
        .png({ compressionLevel: 6, palette: false })
        .withMetadata({ density: 300 })
        .toBuffer();
      await fs.writeFile(outPath, optBuf);
      console.warn(
        `[render-poster] PNG (${seq}/${entries.length}) ${fileName} | ` +
          `拍照:${entry.photoAllowed ? 'O' : 'X'} 錄影:${entry.videoAllowed ? 'O' : 'X'}` +
          `${entry.isStrictMerged ? ' (同場座談從嚴)' : ''}`
      );
    }
  }

  // 2. 產出合併多頁向量 A3 PDF
  if (!skipPdf) {
    const pdfCanvas = createCanvas(PDF_W_PT, PDF_H_PT, 'pdf');
    const pdfCtx = pdfCanvas.getContext('2d');
    const scaleX = PDF_W_PT / BASE_W;
    const scaleY = PDF_H_PT / BASE_H;

    entries.forEach((entry, idx) => {
      if (idx > 0) {
        pdfCtx.addPage();
      }
      pdfCtx.save();
      pdfCtx.scale(scaleX, scaleY);
      drawPosterPage(pdfCtx, entry, {
        speakerPhoto: photos.get(entry.speaker.id),
        assets,
      });
      pdfCtx.restore();
    });

    const pdfPath = path.join(POSTERS_DIR, PDF_FILENAME);
    const pdfBuf = pdfCanvas.toBuffer();
    await fs.writeFile(pdfPath, pdfBuf);
    console.warn(`[render-poster] PDF 合併完成（共 ${entries.length} 頁）：${pdfPath}`);
  }
}

main().catch((err) => {
  console.error('[render-poster] 發生錯誤：', err);
  process.exit(1);
});
