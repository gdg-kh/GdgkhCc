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

const SPAN_TYPES = new Set(['break', 'lunch', 'opening', 'closing']);

function uiLabel(key) {
  const config = getConfig();
  const ui = config && config.ui;
  return t(ui && ui[key]);
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
    const src = `images/${map.file}`;
    const alt = t(map.caption);
    image.setAttribute('src', src);
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
    openImageViewer({ src: `images/${map.file}`, alt: t(map.caption) });
    track('view_venue_map', { map_file: map.file });
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

function spanRow(session, tracks) {
  const row = el('div', {
    class: `gk-agenda-span gk-agenda-span-${session.type || 'all'}`,
  });
  const time = el('span', {
    class: 'gk-agenda-span-time',
    text: formatRange(session.start, session.end),
  });
  const title = el('span', {
    class: 'gk-agenda-span-title',
    text: t(session.title),
  });
  mount(row, time, title);
  if (tracks.length >= 2) {
    row.style.gridColumn = '1 / -1';
  }
  return row;
}

function openSessionModal(session) {
  const speakers = getSpeakersBySessionId(session.id);
  const firstSpeaker = speakers[0] || null;
  const group = getGroupById(session.groupId);
  const track2 = getTrackById(session.trackId);
  const trackName = t(track2 && track2.name);
  const venue = t(getConfig() && getConfig().site && getConfig().site.venue);
  const meta = [];
  const timeRange = formatRange(session.start, session.end);
  if (timeRange) {
    meta.push({ label: uiLabel('timeLabel') || '時間', value: timeRange });
  }
  if (trackName || venue) {
    const value = [trackName, venue].filter((v) => v && v.length > 0).join(' - ');
    meta.push({ label: uiLabel('venueLabel') || '會場', value });
  }
  const subtitleParts = speakers.map((sp) => t(sp && sp.name)).filter((n) => n && n.length > 0);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join('、') : null;

  track('select_session', { session_id: session.id });
  openModal({
    type: firstSpeaker ? 'speakers' : undefined,
    id: firstSpeaker ? firstSpeaker.id : undefined,
    shareUrl: firstSpeaker ? getShareUrl('speakers', firstSpeaker.id) : undefined,
    image: firstSpeaker ? assetPath('speakers', firstSpeaker.id) : undefined,
    name: session.title,
    subtitle,
    sessionTitle: session.title,
    sessionAbstract: session.abstract,
    bio: firstSpeaker ? firstSpeaker.bio : null,
    groupName: group ? group.name : null,
    groupColor: group && typeof group.color === 'string' ? group.color : undefined,
    tags: Array.isArray(session.tags) ? session.tags : [],
    meta,
    links: Array.isArray(session.links) ? session.links : [],
    extraNode: calendarButtons(session, 'modal'),
  });
}

function sessionCardFor(session) {
  const speakers = getSpeakersBySessionId(session.id).map((sp) => ({
    image: assetPath('speakers', sp.id),
    name: sp.name,
  }));
  const group = getGroupById(session.groupId);
  return sessionCard({
    title: session.title,
    time: formatRange(session.start, session.end),
    groupName: group ? group.name : null,
    groupColor: group && typeof group.color === 'string' ? group.color : undefined,
    speakers,
    onClick: () => openSessionModal(session),
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
  if (tracks.length >= 4) {
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

  const timeGroups = new Map();
  const orderKeys = [];
  for (const session of sessions) {
    const key = typeof session.start === 'string' ? session.start : '';
    if (!timeGroups.has(key)) {
      timeGroups.set(key, []);
      orderKeys.push(key);
    }
    timeGroups.get(key).push(session);
  }

  let rowIdx = 2;
  for (const key of orderKeys) {
    const group = timeGroups.get(key);
    for (const session of group.filter(isSpan)) {
      const row = spanRow(session, tracks);
      row.style.gridRow = String(rowIdx);
      row.style.gridColumn = '1 / -1';
      mount(grid, row);
      rowIdx += 1;
    }
    const trackSessions = group.filter((s) => !isSpan(s));
    if (trackSessions.length === 0) {
      continue;
    }
    for (const session of trackSessions) {
      const idx = trackIndex(tracks, session.trackId);
      const card = sessionCardFor(session);
      card.style.gridRow = String(rowIdx);
      if (idx >= 0) {
        card.style.gridColumn = `${idx + 1} / span 1`;
      } else {
        card.style.gridColumn = '1 / -1';
      }
      mount(grid, card);
    }
    rowIdx += 1;
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
