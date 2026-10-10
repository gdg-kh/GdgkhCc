import { el, clear, mount, setRichText, attachImageFallback, LOGO_PLACEHOLDER } from '../core/dom.js';
import { t } from '../core/i18n.js';
import {
  getContent,
  getConfig,
  getSortedList,
  getTrackById,
  getGroupById,
  getSpeakersBySessionId,
  assetPath,
  getShareUrl,
} from '../core/store.js';
import { sessionCard } from '../ui/card.js';
import { openModal } from '../ui/detail-modal.js';
import { openImageViewer } from '../ui/image-viewer.js';
import { allSessionsButton, calendarButtons } from '../ui/calendar.js';
import { track } from '../core/analytics.js';

const SPAN_TYPES = new Set(['break', 'lunch']);

function uiLabel(key) {
  const config = getConfig();
  const ui = config && config.ui;
  return t(ui && ui[key]);
}

function parseTimeMinutes(iso) {
  if (typeof iso !== 'string' || iso.length < 16) {
    return 0;
  }
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(iso) {
  if (typeof iso !== 'string' || iso.length < 16) {
    return '';
  }
  return iso.slice(11, 16);
}

function formatRange(start, end) {
  const s = formatTime(start);
  const e = formatTime(end);
  if (s && e) {
    return `${s} - ${e}`;
  }
  return s || e;
}

function attachActivation(node, handler) {
  node.addEventListener('click', handler);
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      handler(event);
    }
  });
}

function renderMapSection(container) {
  const content = getContent();
  const maps = Array.isArray(content && content.venueMaps) ? content.venueMaps : [];
  if (maps.length === 0) {
    return;
  }
  const section = el('div', { class: 'gk-agenda-map' });
  const hint = uiLabel('mapZoomHint');
  if (hint) {
    mount(section, el('p', { class: 'gk-agenda-map-hint', text: hint }));
  }

  const tabs = el('div', { class: 'gk-agenda-map-tabs' });
  const stage = el('div', { class: 'gk-agenda-map-stage' });
  const caption = el('p', { class: 'gk-agenda-map-caption' });

  let current = 0;
  const buttons = [];

  const image = el('img', {
    class: 'gk-agenda-map-image',
    attrs: {
      loading: 'lazy',
      decoding: 'async',
      width: '720',
      height: '480',
      role: 'button',
      tabindex: '0',
      alt: '',
    },
  });
  attachImageFallback(image, LOGO_PLACEHOLDER);

  function show(index) {
    const map = maps[index];
    if (!map) {
      return;
    }
    current = index;
    const rawFile = map.file || '';
    let src = `images/${rawFile}`;
    let srcset = '';
    const match = rawFile.match(/^([^/?#.]+)\.(jpg|jpeg|png)(?:(\?[^#]*)?(#.*)?)?$/i);
    if (match) {
      const [, base, , query = ''] = match;
      src = `images/${base}-720.webp${query}`;
      srcset = `images/${base}-720.webp${query} 720w, images/${base}-1200.webp${query} 1200w`;
    }
    const alt = t(map.caption);
    image.dataset.gkOriginalSrc = `images/${rawFile}`;
    image.setAttribute('src', src);
    if (srcset) {
      image.setAttribute('srcset', srcset);
      image.setAttribute('sizes', '(max-width: 768px) 100vw, 720px');
    } else {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
    }
    image.setAttribute('alt', alt);
    setRichText(caption, alt);
    for (const btn of buttons) {
      if (btn.dataset.index === String(index)) {
        btn.classList.add('gk-agenda-map-tab-active');
      } else {
        btn.classList.remove('gk-agenda-map-tab-active');
      }
    }
  }

  if (maps.length > 1) {
    for (let i = 0; i < maps.length; i += 1) {
      const map = maps[i];
      const btn = el('button', {
        class: 'gk-agenda-map-tab',
        attrs: { type: 'button' },
        text: t(map.caption),
      });
      btn.dataset.index = String(i);
      btn.addEventListener('click', () => show(i));
      buttons.push(btn);
      mount(tabs, btn);
    }
    mount(section, tabs);
  }

  const openViewer = () => {
    const map = maps[current];
    if (!map) {
      return;
    }
    const rawFile = map.file || '';
    let src = `images/${rawFile}`;
    const match = rawFile.match(/^([^/?#.]+)\.(jpg|jpeg|png)(?:(\?[^#]*)?(#.*)?)?$/i);
    if (match) {
      const [, base, , query = ''] = match;
      src = `images/${base}-1200.webp${query}`;
    }
    openImageViewer({ src, alt: t(map.caption) });
    track('view_venue_map', { map_file: rawFile });
  };
  attachActivation(image, openViewer);

  mount(stage, image);
  mount(section, stage, caption);

  show(0);
  mount(container, section);
}

function isSpan(session) {
  if (!session) {
    return false;
  }
  if (session.trackId === 'all') {
    return true;
  }
  return SPAN_TYPES.has(session.type);
}

function getDurationMinutes(start, end) {
  const s = parseTimeMinutes(start);
  const e = parseTimeMinutes(end);
  return Math.max(0, e - s);
}

function spanRow(session, tracks) {
  const row = el('div', {
    class: `gk-agenda-span gk-agenda-span-${session.type || 'all'}`,
  });
  const timeBox = el('div', { class: 'gk-agenda-span-time-box' });
  const time = el('span', {
    class: 'gk-agenda-span-time',
    text: formatRange(session.start, session.end),
  });
  mount(timeBox, time);

  const dur = getDurationMinutes(session.start, session.end);
  if (dur > 0) {
    const durTag = el('span', { class: 'gk-session-duration-tag', text: `${dur}m` });
    mount(timeBox, durTag);
    const percent = Math.min(100, Math.round((dur / 90) * 100));
    const meter = el('div', { class: 'gk-session-duration-meter' });
    const bar = el('div', { class: 'gk-session-duration-bar' });
    bar.style.width = `${percent}%`;
    mount(meter, bar);
    mount(timeBox, meter);
  }

  const title = el('span', {
    class: 'gk-agenda-span-title',
    text: t(session.title),
  });
  mount(row, timeBox, title);
  if (tracks.length >= 2) {
    row.style.gridColumn = '1 / -1';
  }
  return row;
}

function openSessionModal(session, targetSpeakerId = null) {
  const speakers = getSpeakersBySessionId(session.id);
  const firstSpeaker = speakers[0] || null;
  const group = getGroupById(session.groupId);
  const track2 = getTrackById(session.trackId);
  const trackName = t(track2 && track2.name);
  const venue = t(getConfig() && getConfig().site && getConfig().site.venue);
  const meta = [];
  if (!session.hideMeta) {
    const timeRange = formatRange(session.start, session.end);
    if (timeRange) {
      meta.push({ label: uiLabel('timeLabel') || '時間', value: timeRange });
    }
    if (trackName || venue) {
      const value = [trackName, venue].filter((v) => v && v.length > 0).join(' - ');
      meta.push({ label: uiLabel('venueLabel') || '會場', value });
    }
  }
  const subtitleParts = speakers.map((sp) => t(sp && sp.name)).filter((n) => n && n.length > 0);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join('、') : null;

  let initialSpeakerIndex = 0;
  if (targetSpeakerId && speakers.length > 0) {
    const foundIdx = speakers.findIndex((sp) => sp.id === targetSpeakerId);
    if (foundIdx >= 0) {
      initialSpeakerIndex = foundIdx;
    }
  }

  const speakerPayloads = speakers.map((sp) => ({
    id: sp.id,
    name: sp.name,
    title: sp.title,
    org: sp.org,
    bio: sp.bio,
    image: assetPath('speakers', sp.id),
    shareUrl: getShareUrl('speakers', sp.id),
    links: Array.isArray(sp.links) ? sp.links : [],
  }));

  track('select_session', { session_id: session.id, target_speaker_id: targetSpeakerId || undefined });
  openModal({
    type: 'session',
    id: session.id,
    shareUrl: firstSpeaker ? getShareUrl('speakers', firstSpeaker.id) : undefined,
    image: firstSpeaker ? assetPath('speakers', firstSpeaker.id) : undefined,
    name: session.title,
    subtitle,
    title: firstSpeaker ? firstSpeaker.title : undefined,
    org: firstSpeaker ? firstSpeaker.org : undefined,
    sessionTitle: session.title,
    sessionAbstract: session.abstract,
    speakers: speakerPayloads,
    initialSpeakerIndex,
    bio: firstSpeaker ? firstSpeaker.bio : null,
    groupName: group ? group.name : null,
    groupColor: group && typeof group.color === 'string' ? group.color : undefined,
    tags: Array.isArray(session.tags) ? session.tags : [],
    meta,
    links:
      Array.isArray(firstSpeaker && firstSpeaker.links) && firstSpeaker.links.length > 0
        ? firstSpeaker.links
        : Array.isArray(session.links)
          ? session.links
          : [],
    extraNode: calendarButtons(session, 'modal'),
  });
}

function sessionCardFor(session) {
  const speakers = getSpeakersBySessionId(session.id).map((sp) => ({
    id: sp.id,
    image: assetPath('speakers', sp.id),
    name: sp.name,
  }));
  const group = getGroupById(session.groupId);
  const durationMinutes = getDurationMinutes(session.start, session.end);
  return sessionCard({
    title: session.title,
    time: formatRange(session.start, session.end),
    durationMinutes,
    groupName: group ? group.name : null,
    groupColor: group && typeof group.color === 'string' ? group.color : undefined,
    speakers,
    onClick: () => openSessionModal(session),
    onSpeakerClick: (speaker) => openSessionModal(session, speaker.id),
  });
}

function trackIndex(tracks, trackId) {
  for (let i = 0; i < tracks.length; i += 1) {
    if (tracks[i].id === trackId) {
      return i;
    }
  }
  return -1;
}

function renderTimelineGrid(container, tracks, sessions) {
  const grid = el('div', { class: 'gk-agenda-grid' });
  if (tracks.length >= 3) {
    grid.classList.add('gk-agenda-grid-scroll');
  }

  if (tracks.length === 1) {
    grid.classList.add('gk-agenda-grid-single');
    for (const session of sessions) {
      if (isSpan(session)) {
        mount(grid, spanRow(session, tracks));
      } else {
        mount(grid, sessionCardFor(session));
      }
    }
    mount(container, grid);
    return;
  }

  grid.classList.add('gk-agenda-grid-multi');
  grid.style.setProperty('--gk-agenda-track-count', String(tracks.length));

  for (let i = 0; i < tracks.length; i += 1) {
    const trackData = tracks[i];
    const cell = el('span', {
      class: 'gk-agenda-grid-header-cell',
      text: t(trackData.name),
    });
    cell.style.gridRow = '1';
    cell.style.gridColumn = `${i + 1} / span 1`;
    if (typeof trackData.color === 'string' && trackData.color.length > 0) {
      cell.style.borderTopColor = trackData.color;
    }
    mount(grid, cell);
  }

  const timePoints = Array.from(new Set(sessions.map((s) => s.start))).sort();
  const startToRow = new Map();
  for (let i = 0; i < timePoints.length; i += 1) {
    startToRow.set(timePoints[i], i + 2);
  }

  for (const session of sessions) {
    const rowStart = startToRow.get(session.start) || 2;
    const startMin = parseTimeMinutes(session.start);
    const endMin = parseTimeMinutes(session.end);

    const intermediate = timePoints.filter((tp) => {
      const m = parseTimeMinutes(tp);
      return m > startMin && m < endMin;
    });
    const rowSpan = 1 + intermediate.length;

    if (isSpan(session)) {
      const row = spanRow(session, tracks);
      row.style.gridRow = `${rowStart} / span ${rowSpan}`;
      row.style.gridColumn = '1 / -1';
      mount(grid, row);
    } else {
      const idx = trackIndex(tracks, session.trackId);
      const card = sessionCardFor(session);
      card.style.gridRow = `${rowStart} / span ${rowSpan}`;
      if (idx >= 0) {
        card.style.gridColumn = `${idx + 1} / span 1`;
      } else {
        card.style.gridColumn = '1 / -1';
      }
      mount(grid, card);
    }
  }

  mount(container, grid);
}

function renderTimeline(container, tracks, sessions) {
  const timeline = el('div', { class: 'gk-agenda-timeline' });
  const header = el('div', { class: 'gk-agenda-timeline-header' });
  const title = el('h3', {
    class: 'gk-agenda-timeline-title',
    text: uiLabel('agendaTitle') || '議程',
  });
  mount(header, title);
  mount(header, allSessionsButton());
  mount(timeline, header);

  renderTimelineGrid(timeline, tracks, sessions);

  mount(container, timeline);
}

export function renderAgenda(container) {
  if (!container) {
    return;
  }
  clear(container);
  container.classList.add('gk-agenda-section');

  renderMapSection(container);

  const sessionsRaw = getSortedList('sessions');
  const sessions = sessionsRaw.slice().sort((a, b) => {
    const aStart = typeof a.start === 'string' ? a.start : '';
    const bStart = typeof b.start === 'string' ? b.start : '';
    if (aStart < bStart) {
      return -1;
    }
    if (aStart > bStart) {
      return 1;
    }
    return 0;
  });
  const tracks = getSortedList('tracks');

  if (sessions.length === 0) {
    const empty = el('p', {
      class: 'gk-agenda-empty',
      text: uiLabel('emptyStateText'),
    });
    mount(container, empty);
    return;
  }

  renderTimeline(container, tracks, sessions);
}
