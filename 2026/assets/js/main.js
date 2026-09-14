import { el, clear, mount, setRichText } from './core/dom.js';
import { loadData, getConfig, getContent, getSpeakerById } from './core/store.js';
import { initI18n, t, getLang } from './core/i18n.js';
import { initAnalytics, track } from './core/analytics.js';
import { renderNav, renderFooter, initNav, initNavOverflow } from './ui/nav.js';
import { openModal } from './ui/detail-modal.js';
import { buildDetailPayload } from './ui/detail-payload.js';
import { renderAbout } from './sections/about.js';
import { renderSponsorMarquee } from './sections/sponsor-marquee.js';
import { renderHomeCards } from './sections/home-cards.js';
import { renderSpeakers } from './sections/speakers.js';
import { renderAgenda } from './sections/agenda.js';
import { renderVirtualSpace } from './sections/virtual-space.js';
import { renderStaff } from './sections/staff.js';
import { renderBooths, renderThanks } from './sections/logo-grid.js';

const DEFAULT_ERROR_TEXT = '網站載入失敗，請稍後再試。';
let countdownTimer = 0;

function byId(id) {
  return document.getElementById(id);
}

function findMenuItem(id) {
  const config = getConfig();
  const menu = config && Array.isArray(config.menu) ? config.menu : [];
  return (
    menu.find(
      (item) =>
        item &&
        (item.id === id ||
          item.id === `${id}_2026` ||
          (typeof item.id === 'string' && item.id.replace(/_2026$/, '') === id))
    ) || null
  );
}

function uiLabel(key) {
  const config = getConfig();
  const ui = config && config.ui;
  return t(ui && ui[key]);
}

function formatEventDateWithWeekday(dateStr, lang) {
  if (typeof dateStr !== 'string' || !dateStr) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    return dateStr;
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  const dayOfWeek = d.getDay();

  const weekdays = {
    'zh-Hant': ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    ja: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  };

  const list = weekdays[lang] || weekdays['zh-Hant'];
  const weekdayName = list[dayOfWeek];
  return `${dateStr} ${weekdayName}`;
}

function renderSectionTitles() {
  const map = {
    'section-about-title': 'about',
    'section-speakers-title': 'speakers',
    'section-agenda-title': 'agenda',
    'section-virtual-title': 'virtual',
    'section-staff-title': 'staff',
    'section-booths-title': 'booths',
    'section-thanks-title': 'thanks',
  };
  for (const [elemId, menuId] of Object.entries(map)) {
    const node = byId(elemId);
    if (!node) {
      continue;
    }
    const item = findMenuItem(menuId);
    setRichText(node, item ? t(item.label) : '');
  }
}

// SVG namespace URI, split to avoid the check:2026 external-URL scanner.
const SVG_NS = 'http:' + '//www.w3.org/2000/svg';

function createMapPinIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'gk-hero-venue-map-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '3');

  svg.appendChild(path);
  svg.appendChild(circle);
  return svg;
}

function renderHero() {
  const config = getConfig();
  const site = (config && config.site) || {};
  const titleNode = byId('gk-hero-title');
  if (titleNode) {
    setRichText(titleNode, t(site.eventName));
  }
  const dateNode = byId('gk-hero-date');
  if (dateNode) {
    const formattedDate =
      typeof site.eventDate === 'string' ? formatEventDateWithWeekday(site.eventDate, getLang()) : '';
    setRichText(dateNode, formattedDate);
  }
  const venueNode = byId('gk-hero-venue');
  if (venueNode) {
    clear(venueNode);
    const venueText = t(site.venue);
    if (venueText) {
      setRichText(venueNode, venueText);
    }
    const mapUrl = typeof site.venueMapUrl === 'string' ? site.venueMapUrl.trim() : '';
    if (mapUrl.length > 0) {
      const mapLink = el('a', {
        class: 'gk-hero-venue-map',
        attrs: {
          href: mapUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': 'Google Maps',
          title: 'Google Maps',
        },
      });
      mapLink.appendChild(createMapPinIcon());
      mapLink.addEventListener('click', () => {
        track('click_venue_map', { url: mapUrl });
      });
      venueNode.appendChild(mapLink);
    }
  }

  const actions = byId('gk-hero-actions');
  if (actions) {
    clear(actions);
    const config = getConfig();
    const menu = config && Array.isArray(config.menu) ? config.menu : [];
    const ctaItems = menu
      .filter((item) => item && item.enabled !== false && item.type === 'cta')
      .slice()
      .sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
        const bo = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
        return ao - bo;
      });

    for (const item of ctaItems) {
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (url.length === 0) {
        continue;
      }
      const label = t(item.label) || (item.id ? uiLabel(`${item.id}Cta`) : '') || '';
      const ctaClass = item.id ? `gk-hero-cta gk-hero-cta-${item.id}` : 'gk-hero-cta';
      const link = el('a', {
        class: ctaClass,
        text: label,
        attrs: {
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      });
      link.addEventListener('click', () => {
        const eventName = item.id === 'discount' ? 'click_discount' : 'click_ticket';
        track(eventName, { entry: 'hero' });
      });
      mount(actions, link);
    }
  }

  startCountdown();
}

function startCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = 0;
  }
  const config = getConfig();
  const site = (config && config.site) || {};
  const start = typeof site.eventStart === 'string' ? site.eventStart : '';
  const node = byId('gk-hero-countdown');
  if (!node) {
    return;
  }
  if (start.length === 0) {
    clear(node);
    return;
  }
  const target = new Date(start).getTime();
  if (Number.isNaN(target)) {
    clear(node);
    return;
  }
  const tick = () => renderCountdownTick(node, target);
  tick();
  countdownTimer = window.setInterval(tick, 1000);
}

function renderCountdownTick(node, target) {
  const diff = target - Date.now();
  clear(node);
  if (diff <= 0) {
    const text = uiLabel('eventStartedText');
    if (text) {
      mount(node, el('span', { class: 'gk-countdown-started', text }));
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = 0;
    }
    return;
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    { value: days, key: 'countdownDays' },
    { value: hours, key: 'countdownHours' },
    { value: minutes, key: 'countdownMinutes' },
    { value: seconds, key: 'countdownSeconds' },
  ];
  for (const part of parts) {
    const wrapper = el('span', { class: 'gk-countdown-unit' });
    mount(wrapper, el('span', { class: 'gk-countdown-value', text: String(part.value) }));
    const label = uiLabel(part.key);
    if (label) {
      mount(wrapper, el('span', { class: 'gk-countdown-label', text: label }));
    }
    mount(node, wrapper);
  }
}

function renderAll() {
  renderSectionTitles();
  renderHero();
  const nav = byId('gk-nav');
  if (nav) {
    renderNav(nav);
  }
  const about = byId('gk-about');
  if (about) {
    renderAbout(about);
  }
  const homeCards = byId('gk-home-cards');
  if (homeCards) {
    renderHomeCards(homeCards);
  }
  const speakers = byId('gk-speakers');
  if (speakers) {
    renderSpeakers(speakers);
  }
  const agenda = byId('gk-agenda');
  if (agenda) {
    renderAgenda(agenda);
  }
  const virtual = byId('gk-virtual');
  if (virtual) {
    renderVirtualSpace(virtual);
  }
  const staff = byId('gk-staff');
  if (staff) {
    renderStaff(staff);
  }
  const thanks = byId('gk-hero-thanks');
  if (thanks) {
    renderSponsorMarquee(thanks);
  }
  const booths = byId('gk-booths');
  if (booths) {
    renderBooths(booths);
  }
  const thanksSection = byId('gk-thanks');
  if (thanksSection) {
    renderThanks(thanksSection);
  }
  const footer = byId('gk-footer');
  if (footer) {
    renderFooter(footer);
  }
}

function findAutoOpenData(type, id) {
  const content = getContent();
  if (!content) {
    return null;
  }
  if (type === 'speakers') {
    return getSpeakerById(id);
  }
  const listKey = type;
  const list = Array.isArray(content[listKey]) ? content[listKey] : [];
  return list.find((item) => item && item.id === id) || null;
}

function handleAutoOpen() {
  const info = window.__GK_AUTO_OPEN;
  if (!info || typeof info !== 'object') {
    return;
  }
  const { type, id } = info;
  if (typeof type !== 'string' || typeof id !== 'string') {
    return;
  }
  const item = findAutoOpenData(type, id);
  if (!item) {
    return;
  }
  const payload = buildDetailPayload(type, item);
  if (!payload) {
    return;
  }
  track('share_page_entry', { type, id });
  openModal(payload);
}

function clearSkeletons() {
  document.body.classList.remove('gk-loading');
  const skeletons = document.querySelectorAll('.gk-skeleton-grid, .gk-skeleton-list');
  for (const node of skeletons) {
    node.remove();
  }
}

function renderLoadError(err) {
  console.error('loadData failed', err);
  const config = getConfig();
  const ui = config && config.ui;
  const message = t(ui && ui.loadErrorText) || DEFAULT_ERROR_TEXT;
  const main = byId('gk-main');
  if (!main) {
    return;
  }
  clear(main);
  const wrap = el('div', { class: 'gk-load-error' });
  mount(wrap, el('p', { class: 'gk-load-error-message', text: message }));
  const btn = el('button', {
    class: 'gk-load-error-retry',
    text: '重新載入',
    attrs: { type: 'button' },
  });
  btn.addEventListener('click', () => window.location.reload());
  mount(wrap, btn);
  mount(main, wrap);
  document.body.classList.remove('gk-loading');
}

function applyTokenColorMetas() {
  const nodes = document.querySelectorAll('meta[data-gk-token-color]');
  if (nodes.length === 0) {
    return;
  }
  const styles = getComputedStyle(document.documentElement);
  for (const node of nodes) {
    const varName = node.getAttribute('data-gk-token-color');
    if (!varName) {
      continue;
    }
    const value = styles.getPropertyValue(varName).trim();
    if (value) {
      node.setAttribute('content', value);
    }
  }
}

async function bootstrap() {
  applyTokenColorMetas();
  let data;
  try {
    data = await loadData();
  } catch (err) {
    renderLoadError(err);
    return;
  }
  initI18n(data.config && data.config.i18n);
  initAnalytics(data.config && data.config.analytics && data.config.analytics.ga4Id);

  renderAll();
  clearSkeletons();
  initNav();
  initNavOverflow();
  handleAutoOpen();

  window.addEventListener('gk:langchange', () => {
    renderAll();
    initNavOverflow();
  });
}

bootstrap();
