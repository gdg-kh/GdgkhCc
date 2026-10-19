import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTENT_PATH = path.join(ROOT, 'data/content.json');
const CONFIG_PATH = path.join(ROOT, 'data/config.json');
const OUT_PNG_PATH = path.join(ROOT, 'images/facebook-agenda-square.png');

// 網站 tokens.css 真實色票
const TOKENS = {
  paper: '#f0f0f0',
  ink: '#1e1e1e',
  inkMuted: '#4a4a4a',
  speakerMuted: '#5a5a5a',
  line: '#d6d6d6',
  red: '#ea4335',
  blue: '#4285f4',
  yellow: '#f9ab00',
  green: '#34a853',
  bluePastel: '#c3ecf6',
  greenPastel: '#ccf6c5',
  yellowPastel: '#ffe7a5',
  redPastel: '#f8d8d8',
  white: '#ffffff',
};

const SPAN_TYPES = new Set(['break', 'lunch']);
const FONT_SANS = '"PingFang TC", "Heiti TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const FONT_MONO = '"SF Mono", "Menlo", "Monaco", "Consolas", monospace';

function zh(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj['zh-Hant'] || obj.en || '';
}

function formatTime(iso) {
  if (typeof iso !== 'string' || iso.length < 16) return '';
  return iso.slice(11, 16);
}

function parseTimeMinutes(iso) {
  const hhmm = formatTime(iso);
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isSpanSession(session) {
  if (!session) return false;
  if (session.trackId === 'all') return true;
  return SPAN_TYPES.has(session.type);
}

function formatAffiliation(speaker) {
  if (!speaker) return '';
  const title = zh(speaker.title).trim();
  const org = zh(speaker.org).trim();
  if (title && org) {
    if (title.toLowerCase().includes(org.toLowerCase())) return title;
    if (org.toLowerCase().includes(title.toLowerCase())) return org;
    return `${org} · ${title}`;
  }
  return title || org || '';
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function tokenizeForWrap(text) {
  // 將連續英數字連字號視為單一 token，並將避頭點標點附著於前一個 token
  const rawTokens = String(text || '').match(/[A-Za-z0-9_.,/+:-]+|\s+|[\u4e00-\u9fa5]|[^\s]/g) || [];
  const noStartPunct = /^[」』）)】？！。，、：；?!.,:;)\]]$/;
  const merged = [];
  for (const tk of rawTokens) {
    if (merged.length > 0 && noStartPunct.test(tk)) {
      merged[merged.length - 1] += tk;
    } else {
      merged.push(tk);
    }
  }
  return merged;
}

function wrapTextLines(ctx, text, maxWidth, firstLineMaxWidth = maxWidth) {
  const paragraphs = String(text || '').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const tokens = tokenizeForWrap(para);
    let current = '';
    for (const tk of tokens) {
      if (current === '' && /^\s+$/.test(tk)) continue;
      const test = current + tk;
      const limitW = lines.length === 0 ? firstLineMaxWidth : maxWidth;
      if (ctx.measureText(test).width > limitW && current.trim().length > 0) {
        lines.push(current.trimEnd());
        current = tk.trimStart();
      } else {
        current = test;
      }
    }
    if (current.trim().length > 0) lines.push(current.trimEnd());
  }
  return lines;
}

function drawPill(ctx, x, y, text, {
  bg = TOKENS.white,
  fg = TOKENS.ink,
  borderColor = TOKENS.ink,
  borderWidth = 1.5,
  font = `600 13px ${FONT_SANS}`,
  padX = 12,
  height = 26,
  shadow = 0,
} = {}) {
  ctx.save();
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const w = Math.ceil(textW + padX * 2);
  const r = height / 2;

  if (shadow > 0) {
    ctx.fillStyle = TOKENS.ink;
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
  ctx.fillText(text, x + w / 2, y + height / 2 + 0.5);
  ctx.restore();
  return w;
}

function resolveSessionSpeakers(session, speakerMap) {
  return (session.speakerIds || [])
    .map((id) => speakerMap.get(id))
    .filter(Boolean)
    .map((spk) => ({
      name: zh(spk.name),
      aff: formatAffiliation(spk),
      groupId: spk.groupId,
    }));
}

function drawSpanRow(ctx, x, y, w, h, session, trackColor) {
  ctx.save();

  // 左側垂直色線
  ctx.fillStyle = trackColor || TOKENS.yellow;
  roundRectPath(ctx, x, y + 2, 5, h - 4, 2.5);
  ctx.fill();

  // 柔和無外框底條
  ctx.fillStyle = 'rgba(249, 171, 0, 0.12)';
  roundRectPath(ctx, x + 14, y + 2, w - 14, h - 4, 6);
  ctx.fill();

  ctx.font = `700 25px ${FONT_SANS}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(zh(session.title), x + 28, y + h / 2);

  ctx.restore();
}

function drawBorderlessSession(ctx, x, y, w, h, session, {
  speakerMap,
  groupMap,
  trackColor,
}) {
  ctx.save();

  // 1. 左側會場垂直色線（無外框設計，對齊去年圖片風格）
  const lineW = 5;
  ctx.fillStyle = trackColor || TOKENS.red;
  roundRectPath(ctx, x, y + 2, lineW, h - 4, 2.5);
  ctx.fill();

  const innerX = x + lineW + 14;
  const innerW = w - (lineW + 14) - 4;
  let curY = y + 2;

  const speakerEntries = resolveSessionSpeakers(session, speakerMap);
  const groupId = session.groupId || speakerEntries[0]?.groupId;
  const group = groupId ? groupMap.get(groupId) : null;

  // 2. 議程標題（若右側有分類膠囊，僅第一行預留膠囊寬度，第二行以後使用完整欄寬）
  let pillW = 0;
  if (group) {
    const gTitle = zh(group.name || group.title);
    const pillFont = `600 14.5px ${FONT_SANS}`;
    ctx.font = pillFont;
    pillW = Math.ceil(ctx.measureText(gTitle).width + 22);
    drawPill(ctx, x + w - pillW - 2, curY + 1, gTitle, {
      bg: group.color || TOKENS.yellowPastel,
      fg: TOKENS.ink,
      borderColor: TOKENS.ink,
      borderWidth: 1.3,
      font: pillFont,
      padX: 11,
      height: 26,
    });
  }

  const titleText = zh(session.title);
  let titleFontSize = speakerEntries.length === 0 ? 25 : 24.5;
  ctx.font = `700 ${titleFontSize}px ${FONT_SANS}`;

  const firstLineMaxW = pillW > 0 ? innerW - pillW - 10 : innerW;
  let lines = wrapTextLines(ctx, titleText, innerW, firstLineMaxW);

  if (!titleText.includes('\n')) {
    const singleW = ctx.measureText(titleText).width;
    if (lines.length === 2 && singleW <= firstLineMaxW * 1.15) {
      titleFontSize = Math.max(21.5, Math.floor((titleFontSize * (firstLineMaxW / singleW) - 0.2) * 2) / 2);
      ctx.font = `700 ${titleFontSize}px ${FONT_SANS}`;
      lines = wrapTextLines(ctx, titleText, innerW, firstLineMaxW);
    }
  }
  while (lines.length > 2 && titleFontSize > 20.5) {
    titleFontSize -= 0.5;
    ctx.font = `700 ${titleFontSize}px ${FONT_SANS}`;
    lines = wrapTextLines(ctx, titleText, innerW, firstLineMaxW);
  }

  ctx.fillStyle = TOKENS.ink;
  ctx.textAlign = 'left';
  const titleLineH = titleFontSize >= 24 ? 31 : 29;
  if (speakerEntries.length === 0 && lines.length === 1) {
    ctx.textBaseline = 'middle';
    ctx.fillText(lines[0], innerX, y + h / 2);
  } else {
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], innerX, curY + i * titleLineH);
    }
  }

  curY += lines.length * titleLineH + 7;

  // 3. 講者與職稱（緊接在議程標題下方，採用「- 講者 / 職稱」格式，過長自動換行並對齊縮排）
  if (speakerEntries.length > 0) {
    const spkFontSize = speakerEntries.length > 1 ? 19 : 20;
    const spkLineH = speakerEntries.length > 1 ? 26 : 27;
    ctx.font = `500 ${spkFontSize}px ${FONT_SANS}`;
    ctx.fillStyle = TOKENS.speakerMuted;

    const prefix = '- ';
    const indentX = innerX + 6;
    const prefixW = ctx.measureText(prefix).width;
    const textWrapW = innerW - 6 - prefixW;

    for (const spk of speakerEntries) {
      const fullLine = spk.aff ? `${spk.name} / ${spk.aff}` : spk.name;
      const wrapped = wrapTextLines(ctx, fullLine, textWrapW);
      for (let i = 0; i < wrapped.length; i++) {
        if (i === 0) {
          ctx.fillText(prefix + wrapped[i], indentX, curY);
        } else {
          ctx.fillText(wrapped[i], indentX + prefixW, curY);
        }
        curY += spkLineH;
      }
      if (speakerEntries.length > 1) {
        curY += 2;
      }
    }
  }

  ctx.restore();
}

export async function generateSquareAgenda() {
  const [contentRaw, configRaw] = await Promise.all([
    fs.readFile(CONTENT_PATH, 'utf8'),
    fs.readFile(CONFIG_PATH, 'utf8'),
  ]);
  const content = JSON.parse(contentRaw);
  const config = JSON.parse(configRaw);

  const tracks = [...(content.tracks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sessions = [...(content.sessions || [])].sort((a, b) =>
    String(a.start || '').localeCompare(String(b.start || ''))
  );
  const speakerMap = new Map((content.speakers || []).map((s) => [s.id, s]));
  const groupMap = new Map((content.sessionGroups || []).map((g) => [g.id, g]));

  // 時間軸各時間點
  const timePoints = Array.from(new Set(sessions.map((s) => s.start))).sort();
  const startToRowIdx = new Map();
  for (let i = 0; i < timePoints.length; i++) {
    startToRowIdx.set(timePoints[i], i);
  }

  // 無外框設計下，每一列的高度配置（總高度剛好完美填滿 1800px 方形畫布）
  const rowHeights = timePoints.map((tp) => {
    const rowSessions = sessions.filter((s) => s.start === tp);
    if (rowSessions.every((s) => isSpanSession(s))) return 54; // 14:10 Pizza Time
    const maxSpeakers = Math.max(0, ...rowSessions.map((s) => (s.speakerIds || []).length));
    if (maxSpeakers === 0) return 52; // 09:00 開幕 / 17:30 閉幕
    if (maxSpeakers > 1) return 156; // 16:00 三位講者座談
    return 132;
  });

  // Canvas 1800 x 1800 (1:1 Square)
  const W = 1800;
  const H = 1800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 1. Page Background (--gk-paper: #f0f0f0)
  ctx.fillStyle = TOKENS.paper;
  ctx.fillRect(0, 0, W, H);

  // 2. Website Hero Banner (.gk-hero: linear-gradient(180deg, #c3ecf6 0%, #f0f0f0 100%), border-bottom: 2px solid #1e1e1e)
  const heroH = 108;
  const heroGrad = ctx.createLinearGradient(0, 0, 0, heroH);
  heroGrad.addColorStop(0, TOKENS.bluePastel);
  heroGrad.addColorStop(1, TOKENS.paper);
  ctx.fillStyle = heroGrad;
  ctx.fillRect(0, 0, W, heroH);

  ctx.beginPath();
  ctx.moveTo(0, heroH);
  ctx.lineTo(W, heroH);
  ctx.strokeStyle = TOKENS.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  const padX = 32;

  // Brand 4-color dots + GDG Kaohsiung label
  const dotColors = [TOKENS.red, TOKENS.blue, TOKENS.yellow, TOKENS.green];
  for (let i = 0; i < dotColors.length; i++) {
    ctx.beginPath();
    ctx.arc(padX + 6 + i * 16, 24, 5, 0, Math.PI * 2);
    ctx.fillStyle = dotColors[i];
    ctx.fill();
    ctx.strokeStyle = TOKENS.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.font = `700 14px ${FONT_SANS}`;
  ctx.fillStyle = TOKENS.inkMuted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('GDG Kaohsiung · Official Agenda', padX + 74, 24);

  // Hero Title (.gk-hero-title)
  const eventTitle = zh(config.site?.eventName) || 'DevFest 2026 高雄場';
  ctx.font = `700 38px ${FONT_SANS}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(eventTitle, padX, 74);

  const titleW = ctx.measureText(eventTitle).width;

  // Hero Meta Pills (.gk-hero-meta span)
  let metaX = padX + titleW + 24;
  const metaY = 44;
  const metaPills = [
    `${config.site?.eventDate || '2026-11-14'} (六)`,
    `${zh(config.site?.venue) || 'KO-IN 智高點'}（${zh(config.site?.venueAddress)}）`,
    `gdgkh.cc/2026/`,
  ];
  for (const pillText of metaPills) {
    const pw = drawPill(ctx, metaX, metaY, pillText, {
      bg: TOKENS.white,
      fg: TOKENS.ink,
      borderColor: TOKENS.ink,
      borderWidth: 1.5,
      font: `600 15px ${FONT_SANS}`,
      padX: 14,
      height: 32,
      shadow: 2,
    });
    metaX += pw + 12;
  }

  // Right side of Header: Section Title (.gk-section-title) & Session Group Legend
  const secTitle = '議程時間表';
  ctx.font = `700 26px ${FONT_SANS}`;
  const secTitleW = ctx.measureText(secTitle).width;
  const secTitleX = W - padX - secTitleW;
  ctx.fillStyle = TOKENS.ink;
  ctx.fillText(secTitle, secTitleX, 42);

  // 3px solid #1e1e1e underline (.gk-section-title border-bottom)
  ctx.fillStyle = TOKENS.ink;
  ctx.fillRect(secTitleX, 49, secTitleW, 3);

  // Track Group Legend Pills
  const groups = content.sessionGroups || [];
  let legX = W - padX;
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    const gLabel = zh(g.name || g.title);
    ctx.font = `600 15px ${FONT_SANS}`;
    const gw = Math.ceil(ctx.measureText(gLabel).width + 26);
    legX -= gw;
    drawPill(ctx, legX, 61, gLabel, {
      bg: g.color,
      fg: TOKENS.ink,
      borderColor: TOKENS.ink,
      borderWidth: 1.5,
      font: `600 15px ${FONT_SANS}`,
      padX: 13,
      height: 28,
    });
    legX -= 10;
  }

  // 3. 左側「時間」欄 + 右側三會場欄表頭
  const gridTop = 120;
  const timeColW = 92;
  const colGap = 18;
  const rowGap = 14;
  const tracksStartX = padX + timeColW + colGap;
  const totalTracksW = W - tracksStartX - padX;
  const colW = (totalTracksW - colGap * (tracks.length - 1)) / tracks.length;
  const headerCellH = 42;

  // 左側「時間」表頭
  ctx.fillStyle = TOKENS.ink;
  ctx.fillRect(padX, gridTop, timeColW, 4);
  ctx.font = `700 24px ${FONT_SANS}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('時間', padX + 2, gridTop + headerCellH / 2 + 2);

  // 三個會場表頭
  for (let idx = 0; idx < tracks.length; idx++) {
    const trk = tracks[idx];
    const cx = tracksStartX + idx * (colW + colGap);
    const cy = gridTop;
    const accent = trk.color || TOKENS.red;

    ctx.fillStyle = accent;
    ctx.fillRect(cx, cy, colW, 4);

    ctx.font = `700 24px ${FONT_SANS}`;
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(zh(trk.name || trk.title), cx + 18, cy + headerCellH / 2 + 2);
  }

  // 4. 計算每一列 Y 座標，並繪製左側時間軸與水平輔助淡線
  const rowY = [];
  let curY = gridTop + headerCellH + 10;
  for (let i = 0; i < timePoints.length; i++) {
    rowY.push(curY);
    curY += rowHeights[i] + rowGap;
  }

  for (let i = 0; i < timePoints.length; i++) {
    const y = rowY[i];
    const tp = timePoints[i];
    const tpMin = parseTimeMinutes(tp);
    const hhmm = formatTime(tp);

    // 水平柔和分隔線（避開跨時段進行中的議程欄位，不切斷垂直色線）
    if (i > 0) {
      const divY = y - rowGap / 2;
      ctx.save();
      ctx.strokeStyle = TOKENS.line;
      ctx.lineWidth = 1;

      // 時間欄分隔線
      ctx.beginPath();
      ctx.moveTo(padX, divY);
      ctx.lineTo(padX + timeColW, divY);
      ctx.stroke();

      // 各會場欄分隔線（若該會場在此時間點有跨列進行中的議程則不繪製）
      for (let tIdx = 0; tIdx < tracks.length; tIdx++) {
        const trkId = tracks[tIdx].id;
        const isSpanningHere = sessions.some((s) => {
          if (s.trackId !== trkId && s.trackId !== 'all') return false;
          const sMin = parseTimeMinutes(s.start);
          const eMin = parseTimeMinutes(s.end);
          return sMin < tpMin && eMin > tpMin;
        });
        if (!isSpanningHere) {
          const cx = tracksStartX + tIdx * (colW + colGap);
          ctx.beginPath();
          ctx.moveTo(cx, divY);
          ctx.lineTo(cx + colW, divY);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 左側時間軸文字（單行短列垂直置中，一般議程列對齊標題頂部）
    ctx.save();
    ctx.font = `700 25px ${FONT_MONO}`;
    ctx.fillStyle = TOKENS.ink;
    ctx.textAlign = 'left';
    if (rowHeights[i] <= 56) {
      ctx.textBaseline = 'middle';
      ctx.fillText(hhmm, padX + 2, y + rowHeights[i] / 2);
    } else {
      ctx.textBaseline = 'top';
      ctx.fillText(hhmm, padX + 2, y + 3);
    }
    ctx.restore();
  }

  // 5. 繪製所有無外框議程
  for (const session of sessions) {
    const rowIdx = startToRowIdx.get(session.start) ?? 0;
    const startMin = parseTimeMinutes(session.start);
    const endMin = parseTimeMinutes(session.end);

    const intermediate = timePoints.filter((tp) => {
      const m = parseTimeMinutes(tp);
      return m > startMin && m < endMin;
    });
    const rowSpan = 1 + intermediate.length;

    const y = rowY[rowIdx];
    let slotH = 0;
    for (let k = 0; k < rowSpan; k++) {
      slotH += rowHeights[rowIdx + k] || 0;
      if (k > 0) slotH += rowGap;
    }

    if (isSpanSession(session)) {
      drawSpanRow(ctx, tracksStartX, y, totalTracksW, slotH, session, TOKENS.red);
    } else {
      const tIdx = tracks.findIndex((t) => t.id === session.trackId);
      const trk = tIdx >= 0 ? tracks[tIdx] : tracks[0];
      const cx = tIdx >= 0 ? tracksStartX + tIdx * (colW + colGap) : tracksStartX;
      const cw = tIdx >= 0 ? colW : totalTracksW;
      drawBorderlessSession(ctx, cx, y, cw, slotH, session, {
        speakerMap,
        groupMap,
        trackColor: trk?.color || TOKENS.red,
      });
    }
  }

  // 6. Website Footer (.gk-footer: border-top: 2px solid #1e1e1e)
  const footerY = H - 44;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(W, footerY);
  ctx.strokeStyle = TOKENS.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `600 15px ${FONT_SANS}`;
  ctx.fillStyle = TOKENS.inkMuted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${zh(config.footer?.copyright) || '© 2026 GDG Kaohsiung'} ｜ 完整議程與報名資訊：https://gdgkh.cc/2026/`,
    padX,
    footerY + 22
  );

  ctx.textAlign = 'right';
  ctx.fillText(
    `${zh(config.site?.venue) || 'KO-IN 智高點'} · ${zh(config.site?.venueAddress)}`,
    W - padX,
    footerY + 22
  );

  const buffer = canvas.toBuffer('image/png');
  await fs.writeFile(OUT_PNG_PATH, buffer);
  console.log(`[Success] Generated ${OUT_PNG_PATH} (${buffer.length} bytes)`);
}

generateSquareAgenda().catch((err) => {
  console.error(err);
  process.exit(1);
});
