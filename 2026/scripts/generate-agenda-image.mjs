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
  line: '#d0d0d0',
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

function wrapTextLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const tokens = tokenizeForWrap(para);
    let current = '';
    for (const tk of tokens) {
      if (current === '' && /^\s+$/.test(tk)) continue;
      const test = current + tk;
      if (ctx.measureText(test).width > maxWidth && current.trim().length > 0) {
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

function drawSpanRow(ctx, x, y, w, h, session) {
  ctx.save();

  // .gk-agenda-span: background var(--gk-paper), border: 2px dashed var(--gk-ink) (直角無圓角)
  ctx.fillStyle = TOKENS.paper;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = TOKENS.ink;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  const padX = 18;
  const timeText = `${formatTime(session.start)} - ${formatTime(session.end)}`;
  const durMin = Math.max(0, parseTimeMinutes(session.end) - parseTimeMinutes(session.start));
  const durLabel = durMin > 0 ? `${durMin}m` : '';
  const durPct = Math.min(100, Math.round((durMin / 90) * 100));

  const timeY = y + h / 2 - 5;
  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const timeW = ctx.measureText(timeText).width;
  ctx.fillText(timeText, x + padX, timeY);

  let timeRowW = timeW;
  if (durLabel) {
    ctx.font = `700 14px ${FONT_MONO}`;
    const tagTextW = ctx.measureText(durLabel).width;
    const tagW = tagTextW + 12;
    const tagH = 22;
    const tagX = x + padX + timeW + 8;
    const tagY = timeY - tagH / 2;

    ctx.fillStyle = 'rgba(30, 30, 30, 0.08)';
    roundRectPath(ctx, tagX, tagY, tagW, tagH, 4);
    ctx.fill();

    ctx.fillStyle = TOKENS.ink;
    ctx.textAlign = 'center';
    ctx.fillText(durLabel, tagX + tagW / 2, tagY + tagH / 2 + 0.5);
    ctx.textAlign = 'left';
    timeRowW = timeW + 8 + tagW;
  }

  const meterW = Math.max(timeRowW, 150);
  if (durMin > 0) {
    const meterY = timeY + 14;
    ctx.fillStyle = 'rgba(30, 30, 30, 0.12)';
    roundRectPath(ctx, x + padX, meterY, meterW, 3, 1.5);
    ctx.fill();

    const barW = Math.max(4, Math.round((meterW * durPct) / 100));
    ctx.fillStyle = TOKENS.ink;
    roundRectPath(ctx, x + padX, meterY, barW, 3, 1.5);
    ctx.fill();
  }

  // .gk-agenda-span-title
  ctx.font = `700 21px ${FONT_SANS}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(zh(session.title), x + padX + meterW + 18, y + h / 2);

  ctx.restore();
}

function drawSessionCard(ctx, x, y, w, h, session, {
  speakerMap,
  groupMap,
}) {
  ctx.save();
  const radius = 8;

  // .gk-card box-shadow: 4px 4px 0 var(--gk-ink)
  ctx.fillStyle = TOKENS.ink;
  roundRectPath(ctx, x + 4, y + 4, w, h, radius);
  ctx.fill();

  // .gk-card background: var(--gk-paper)
  ctx.fillStyle = TOKENS.paper;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  // .gk-card border: 2px solid var(--gk-ink)
  ctx.strokeStyle = TOKENS.ink;
  ctx.lineWidth = 2;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.stroke();

  const padX = 16;
  const padY = 11;
  const innerX = x + padX;
  const innerW = w - padX * 2;
  let curY = y + padY;

  // 1. .gk-session-header (time + duration tag + duration meter on left, group pill on right)
  const timeText = `${formatTime(session.start)} - ${formatTime(session.end)}`;
  const durMin = Math.max(0, parseTimeMinutes(session.end) - parseTimeMinutes(session.start));
  const durLabel = durMin > 0 ? `${durMin}m` : '';
  const durPct = Math.min(100, Math.round((durMin / 90) * 100));

  ctx.font = `700 18px ${FONT_MONO}`;
  ctx.fillStyle = TOKENS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const timeW = ctx.measureText(timeText).width;
  ctx.fillText(timeText, innerX, curY + 11);

  let timeRowW = timeW;
  if (durLabel) {
    ctx.font = `700 14px ${FONT_MONO}`;
    const tagTextW = ctx.measureText(durLabel).width;
    const tagW = tagTextW + 12;
    const tagH = 22;
    const tagX = innerX + timeW + 8;
    const tagY = curY;

    ctx.fillStyle = 'rgba(30, 30, 30, 0.08)';
    roundRectPath(ctx, tagX, tagY, tagW, tagH, 4);
    ctx.fill();

    ctx.fillStyle = TOKENS.ink;
    ctx.textAlign = 'center';
    ctx.fillText(durLabel, tagX + tagW / 2, tagY + tagH / 2 + 0.5);
    ctx.textAlign = 'left';
    timeRowW = timeW + 8 + tagW;
  }

  // .gk-session-duration-meter (height 3px)
  if (durMin > 0) {
    const meterY = curY + 26;
    const meterW = Math.max(timeRowW, 150);
    ctx.fillStyle = 'rgba(30, 30, 30, 0.12)';
    roundRectPath(ctx, innerX, meterY, meterW, 3, 1.5);
    ctx.fill();

    const barW = Math.max(4, Math.round((meterW * durPct) / 100));
    ctx.fillStyle = TOKENS.ink;
    roundRectPath(ctx, innerX, meterY, barW, 3, 1.5);
    ctx.fill();
  }

  // Resolve group from session.groupId or first speaker's groupId
  const speakers = (session.speakerIds || [])
    .map((id) => speakerMap.get(id))
    .filter(Boolean);
  const groupId = session.groupId || speakers[0]?.groupId;
  const group = groupId ? groupMap.get(groupId) : null;

  if (group) {
    const gTitle = zh(group.name || group.title);
    const pillFont = `600 14.5px ${FONT_SANS}`;
    ctx.font = pillFont;
    const gW = Math.ceil(ctx.measureText(gTitle).width + 24);
    drawPill(ctx, x + w - padX - gW, curY - 1, gTitle, {
      bg: group.color || TOKENS.yellowPastel,
      fg: TOKENS.ink,
      borderColor: TOKENS.ink,
      borderWidth: 1.2,
      font: pillFont,
      padX: 12,
      height: 26,
    });
  }

  curY += 34;

  // 2. .gk-session-title (預設 21px；若僅差一點點就能塞進單行則微調至 19.5~20px 避免孤字換行；若超過 2 行亦自適應微調)
  const titleText = zh(session.title);
  const hasSpeakers = speakers.length > 0;
  let titleFontSize = hasSpeakers ? 21 : 22;
  ctx.font = `700 ${titleFontSize}px ${FONT_SANS}`;
  let lines = wrapTextLines(ctx, titleText, innerW);

  if (hasSpeakers && !titleText.includes('\n')) {
    const singleLineW = ctx.measureText(titleText).width;
    if (lines.length === 2 && singleLineW <= innerW * 1.08) {
      // 僅超出不到 8%，微調字級讓整句標題乾淨排在一行內，消除第二行只有 1~2 字的孤字
      titleFontSize = Math.max(19, Math.floor((21 * (innerW / singleLineW)) * 2) / 2);
      ctx.font = `700 ${titleFontSize}px ${FONT_SANS}`;
      lines = wrapTextLines(ctx, titleText, innerW);
    }
  }
  if (lines.length > 2 && hasSpeakers) {
    titleFontSize = 19.5;
    ctx.font = `700 ${titleFontSize}px ${FONT_SANS}`;
    lines = wrapTextLines(ctx, titleText, innerW);
  }

  ctx.fillStyle = TOKENS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const lineHeight = titleFontSize >= 20.5 ? 26 : 24.5;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], innerX, curY + i * lineHeight);
  }

  // 3. .gk-session-speakers (無頭圖，放大講者名稱與職稱／單位，過長自動換行並適應內寬，置底對齊)
  if (hasSpeakers) {
    const isMulti = speakers.length > 1;
    const nameSize = isMulti ? 17.5 : 18.5;
    const affSize = isMulti ? 15.5 : 16;
    const nameFont = `700 ${nameSize}px ${FONT_SANS}`;
    const affFont = `500 ${affSize}px ${FONT_SANS}`;

    // 預先計算每位講者需要 1 行還是 2 行（若名稱+職稱超過 innerW 則自動拆成 2 行）
    const spkRenderItems = [];
    for (const spk of speakers) {
      const spkName = zh(spk.name);
      const aff = formatAffiliation(spk);
      ctx.font = nameFont;
      const nameW = ctx.measureText(spkName).width;
      ctx.font = affFont;
      const affW = aff ? ctx.measureText(aff).width : 0;

      if (aff && nameW + 10 + affW > innerW) {
        spkRenderItems.push({ type: 'name-only', text: spkName, lineH: 22 });
        spkRenderItems.push({ type: 'aff-only', text: aff, lineH: 20 });
      } else {
        spkRenderItems.push({
          type: 'inline',
          spkName,
          aff,
          nameW,
          lineH: isMulti ? 24 : 25,
        });
      }
    }

    const totalSpkH = spkRenderItems.reduce((sum, item) => sum + item.lineH, 0);
    let spkTopY = y + h - padY - totalSpkH;

    for (const item of spkRenderItems) {
      const midY = spkTopY + item.lineH / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      if (item.type === 'inline') {
        ctx.font = nameFont;
        ctx.fillStyle = TOKENS.ink;
        ctx.fillText(item.spkName, innerX, midY);

        if (item.aff) {
          ctx.font = affFont;
          ctx.fillStyle = TOKENS.inkMuted;
          ctx.fillText(item.aff, innerX + item.nameW + 10, midY + 0.5);
        }
      } else if (item.type === 'name-only') {
        ctx.font = nameFont;
        ctx.fillStyle = TOKENS.ink;
        ctx.fillText(item.text, innerX, midY);
      } else if (item.type === 'aff-only') {
        let fitAffSize = affSize;
        ctx.font = `500 ${fitAffSize}px ${FONT_SANS}`;
        const rawAffW = ctx.measureText(item.text).width;
        if (rawAffW > innerW) {
          fitAffSize = Math.max(13, Math.floor((affSize * (innerW / rawAffW)) * 2) / 2);
          ctx.font = `500 ${fitAffSize}px ${FONT_SANS}`;
        }
        ctx.fillStyle = TOKENS.inkMuted;
        ctx.fillText(item.text, innerX, midY);
      }

      spkTopY += item.lineH;
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

  // Exact timeline grid row mapping from agenda.js renderTimelineGrid()
  const timePoints = Array.from(new Set(sessions.map((s) => s.start))).sort();
  const startToRowIdx = new Map();
  for (let i = 0; i < timePoints.length; i++) {
    startToRowIdx.set(timePoints[i], i);
  }

  // Row heights tailored to each timePoint
  const rowHeights = timePoints.map((tp) => {
    const rowSessions = sessions.filter((s) => s.start === tp);
    if (rowSessions.every((s) => isSpanSession(s))) return 56; // Pizza Time
    const maxSpeakers = Math.max(0, ...rowSessions.map((s) => (s.speakerIds || []).length));
    if (maxSpeakers === 0) return 72; // 開幕 / 閉幕
    if (maxSpeakers > 1) return 166; // 16:00 多位講者場次
    return 138;
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

  const padX = 36;

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
      font: `600 14px ${FONT_SANS}`,
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
    ctx.font = `600 13.5px ${FONT_SANS}`;
    const gw = Math.ceil(ctx.measureText(gLabel).width + 24);
    legX -= gw;
    drawPill(ctx, legX, 62, gLabel, {
      bg: g.color,
      fg: TOKENS.ink,
      borderColor: TOKENS.ink,
      borderWidth: 1.5,
      font: `600 13.5px ${FONT_SANS}`,
      padX: 12,
      height: 26,
    });
    legX -= 10;
  }

  // 3. Multi-Venue Grid Header (.gk-agenda-grid-header-cell: border-top 4px solid track.color, background var(--gk-paper))
  const gridTop = 120;
  const colGap = 16;
  const rowGap = 10;
  const totalGridW = W - padX * 2;
  const colW = (totalGridW - colGap * (tracks.length - 1)) / tracks.length;
  const headerCellH = 38;

  for (let idx = 0; idx < tracks.length; idx++) {
    const trk = tracks[idx];
    const cx = padX + idx * (colW + colGap);
    const cy = gridTop;
    const accent = trk.color || TOKENS.red;

    ctx.fillStyle = TOKENS.paper;
    ctx.fillRect(cx, cy, colW, headerCellH);

    // 4px solid top border in track color
    ctx.fillStyle = accent;
    ctx.fillRect(cx, cy, colW, 4);

    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillStyle = TOKENS.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zh(trk.name || trk.title), cx + colW / 2, cy + headerCellH / 2 + 2);
  }

  // 4. Calculate Row Y positions
  const rowY = [];
  let curY = gridTop + headerCellH + 8;
  for (let i = 0; i < timePoints.length; i++) {
    rowY.push(curY);
    curY += rowHeights[i] + rowGap;
  }

  // 5. Render Sessions exactly like agenda.js renderTimelineGrid()
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
    let cardH = 0;
    for (let k = 0; k < rowSpan; k++) {
      cardH += rowHeights[rowIdx + k] || 0;
      if (k > 0) cardH += rowGap;
    }

    if (isSpanSession(session)) {
      drawSpanRow(ctx, padX, y, totalGridW, cardH, session);
    } else {
      const tIdx = tracks.findIndex((t) => t.id === session.trackId);
      const cx = tIdx >= 0 ? padX + tIdx * (colW + colGap) : padX;
      const cw = tIdx >= 0 ? colW : totalGridW;
      drawSessionCard(ctx, cx, y, cw, cardH, session, {
        speakerMap,
        groupMap,
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
