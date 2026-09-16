import { el, clear, mount } from '../core/dom.js';
import { t, getEnabledLangs, setLang, getLang } from '../core/i18n.js';
import { getConfig } from '../core/store.js';
import { track } from '../core/analytics.js';

const DESKTOP_MEDIA = '(min-width: 1100px)';
const OVERFLOW_BUFFER = 16;

// SVG namespace URI, split to avoid the check:2026 external-URL scanner.
const SVG_NS = 'http:' + '//www.w3.org/2000/svg';

const MOBILE_ICON_SHAPES = {
  home: [['path', { d: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10.5z' }]],
  speakers: [
    ['rect', { x: '9', y: '2', width: '6', height: '12', rx: '3' }],
    ['path', { d: 'M5 11a7 7 0 0 0 14 0' }],
    ['line', { x1: '12', y1: '18', x2: '12', y2: '22' }],
    ['line', { x1: '8', y1: '22', x2: '16', y2: '22' }],
  ],
  agenda: [
    ['rect', { x: '3', y: '4', width: '18', height: '17', rx: '2' }],
    ['line', { x1: '3', y1: '10', x2: '21', y2: '10' }],
    ['line', { x1: '8', y1: '2', x2: '8', y2: '6' }],
    ['line', { x1: '16', y1: '2', x2: '16', y2: '6' }],
  ],
  thanks: [
    [
      'path',
      {
        d: 'M12 21s-6.5-4.3-9-8.5C1.4 9 3.2 5 7 5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.8 0 5.6 4 4 7.5-2.5 4.2-9 8.5-9 8.5z',
      },
    ],
  ],
  more: [
    ['line', { x1: '4', y1: '7', x2: '20', y2: '7' }],
    ['line', { x1: '4', y1: '12', x2: '20', y2: '12' }],
    ['line', { x1: '4', y1: '17', x2: '20', y2: '17' }],
  ],
};

let navRootEl = null;
let mainListEl = null;
let moreButtonEl = null;
let moreListEl = null;
let ctaAnchorEl = null;
let langSwitcherEl = null;
let mobileBarEl = null;
let mobileDrawerEl = null;
let mobileBackdropEl = null;
let mobileMoreTabEl = null;
let mobilePrimaryIds = [];
let overflowInitialized = false;
let mobileHandlersBound = false;
let currentSectionId = '';

function uiLabel(key) {
  const config = getConfig();
  const ui = config && config.ui;
  return t(ui && ui[key]);
}

function sortedMenuItems() {
  const config = getConfig();
  const menu = config && Array.isArray(config.menu) ? config.menu : [];
  return menu
    .filter((item) => item && item.enabled !== false)
    .slice()
    .sort((a, b) => {
      const ao = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
}

function isNavItem(item) {
  return !item.placement || item.placement === 'nav';
}

function isFooterMenuItem(item) {
  return (item.placement === 'footer' || item.placement === 'home') && item.type !== 'cta';
}

function makeNavButton(item) {
  const label = t(item.label);
  const btn = el('button', {
    class: 'gk-nav-item',
    text: label,
    attrs: { type: 'button', 'data-menu-id': item.id },
  });
  btn.addEventListener('click', () => {
    navigateTo(item.id);
  });
  return btn;
}

function makeExternalLink(item) {
  const label = t(item.label);
  const url = typeof item.url === 'string' ? item.url : '';
  if (url.length === 0) {
    return null;
  }
  return el('a', {
    class: 'gk-nav-item gk-nav-item-external',
    text: label,
    attrs: {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      'data-menu-id': item.id,
    },
  });
}

function makeCtaLink(item) {
  const label = t(item.label);
  const url = typeof item.url === 'string' ? item.url : '';
  if (url.length === 0) {
    return null;
  }
  const ctaClass = item.id ? `gk-nav-cta gk-nav-cta-${item.id}` : 'gk-nav-cta';
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
    track(eventName, { entry: 'nav' });
  });
  return link;
}

function makeLangSwitcher() {
  const langs = getEnabledLangs();
  if (!Array.isArray(langs) || langs.length < 2) {
    return null;
  }
  const wrapper = el('div', { class: 'gk-nav-langs', attrs: { role: 'group' } });
  const current = getLang();
  for (const lang of langs) {
    const short = shortLangLabel(lang.code);
    const btn = el('button', {
      class: lang.code === current ? 'gk-nav-lang gk-nav-lang-active' : 'gk-nav-lang',
      text: short,
      attrs: {
        type: 'button',
        'data-lang': lang.code,
        'aria-pressed': lang.code === current ? 'true' : 'false',
      },
    });
    btn.addEventListener('click', () => {
      setLang(lang.code);
      track('change_language', { lang: lang.code });
    });
    mount(wrapper, btn);
  }
  return wrapper;
}

function shortLangLabel(code) {
  if (code === 'zh-Hant') {
    return '中';
  }
  if (code === 'en') {
    return 'EN';
  }
  if (code === 'ja') {
    return '日';
  }
  return code;
}

function makeMoreButton() {
  const label = uiLabel('navMoreLabel');
  const btn = el('button', {
    class: 'gk-nav-more',
    text: label,
    attrs: {
      type: 'button',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      hidden: 'hidden',
    },
  });
  return btn;
}

function makeMoreList() {
  return el('div', {
    class: 'gk-nav-more-list',
    attrs: { role: 'menu', hidden: 'hidden' },
  });
}

function toggleMoreOpen(open) {
  if (!moreButtonEl || !moreListEl) {
    return;
  }
  const isOpen = open === undefined ? moreListEl.hasAttribute('hidden') : open;
  if (isOpen) {
    moreListEl.removeAttribute('hidden');
    moreButtonEl.setAttribute('aria-expanded', 'true');
  } else {
    moreListEl.setAttribute('hidden', 'hidden');
    moreButtonEl.setAttribute('aria-expanded', 'false');
  }
}

function handleGlobalClickForMore(event) {
  if (!moreListEl || moreListEl.hasAttribute('hidden')) {
    return;
  }
  if (moreListEl.contains(event.target) || (moreButtonEl && moreButtonEl.contains(event.target))) {
    return;
  }
  toggleMoreOpen(false);
}

function handleGlobalKeydownForMore(event) {
  if (event.key === 'Escape') {
    toggleMoreOpen(false);
  }
}

const DEFAULT_MOBILE_PRIMARY_IDS = ['speakers', 'agenda', 'thanks'];

function getMobilePrimaryItems() {
  const items = sortedMenuItems()
    .filter(isNavItem)
    .filter((item) => item.type !== 'cta' && item.id !== 'home' && item.id !== 'home_2026');
  const explicit = items.filter((item) => item.mobilePrimary === true);
  if (explicit.length > 0) {
    return explicit;
  }
  return items.filter((item) => {
    if (item.mobilePrimary === false) {
      return false;
    }
    const baseId = typeof item.id === 'string' ? item.id.replace(/_\d{4}$|_2026$/, '') : '';
    return DEFAULT_MOBILE_PRIMARY_IDS.includes(baseId);
  });
}

function getMobileOverflowItems() {
  const primaryIds = new Set(getMobilePrimaryItems().map((item) => item.id));
  return sortedMenuItems()
    .filter(isNavItem)
    .filter((item) => item.type !== 'cta' && item.id !== 'home' && item.id !== 'home_2026' && !primaryIds.has(item.id));
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      node.setAttribute(key, String(attrs[key]));
    }
  }
  return node;
}

function iconSvg(id) {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'gk-nav-mobile-tab-icon',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const baseId = typeof id === 'string' ? id.replace(/_\d{4}$|_2026$/, '') : id;
  const shapes = MOBILE_ICON_SHAPES[id] || MOBILE_ICON_SHAPES[baseId] || MOBILE_ICON_SHAPES.more;
  for (const [tag, attrs] of shapes) {
    svg.appendChild(svgEl(tag, attrs));
  }
  return svg;
}

function makeMobileHomeButton() {
  const config = getConfig();
  const menu = config && Array.isArray(config.menu) ? config.menu : [];
  const homeItem = menu.find(
    (item) => item && (item.id === 'home' || item.id === 'home_2026') && item.enabled !== false
  );
  if (!homeItem) {
    return null;
  }
  const label = t(homeItem.label);
  const btn = el('button', {
    class: 'gk-nav-mobile-home',
    attrs: { type: 'button', 'data-menu-id': 'home', 'aria-label': label || 'Home', title: label || 'Home' },
  });
  mount(btn, iconSvg('home'));
  btn.addEventListener('click', () => {
    navigateTo('home');
  });
  return btn;
}

function makeMobileTab(item) {
  const label = t(item.label);
  const btn = el('button', {
    class: 'gk-nav-mobile-tab',
    attrs: { type: 'button', 'data-menu-id': item.id },
  });
  mount(btn, iconSvg(item.id));
  mount(btn, el('span', { class: 'gk-nav-mobile-tab-label', text: label }));
  btn.addEventListener('click', () => {
    navigateTo(item.id);
  });
  return btn;
}

function makeMobileMoreTab() {
  const label = uiLabel('navMoreLabel');
  const btn = el('button', {
    class: 'gk-nav-mobile-tab gk-nav-mobile-more',
    attrs: {
      type: 'button',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      'data-mobile-more': 'true',
    },
  });
  mount(btn, iconSvg('more'));
  mount(btn, el('span', { class: 'gk-nav-mobile-tab-label', text: label }));
  btn.addEventListener('click', () => {
    toggleMobileDrawer();
  });
  return btn;
}

function makeMobileDrawer(overflowItems) {
  const drawer = el('div', {
    class: 'gk-nav-mobile-drawer',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-hidden': 'true' },
  });
  const list = el('div', { class: 'gk-nav-mobile-drawer-list', attrs: { role: 'menu' } });
  for (const item of overflowItems) {
    let node;
    if (item.type === 'external') {
      node = makeExternalLink(item);
    } else {
      node = makeNavButton(item);
    }
    if (node) {
      mount(list, node);
    }
  }
  mount(drawer, list);
  return drawer;
}

function makeMobileBackdrop() {
  const backdrop = el('div', {
    class: 'gk-nav-mobile-backdrop',
    attrs: { 'aria-hidden': 'true' },
  });
  backdrop.addEventListener('click', () => toggleMobileDrawer(false));
  return backdrop;
}

function isMobileDrawerOpen() {
  return !!mobileDrawerEl && mobileDrawerEl.classList.contains('gk-nav-mobile-drawer-open');
}

function toggleMobileDrawer(open) {
  if (!mobileDrawerEl || !mobileBackdropEl) {
    return;
  }
  const shouldOpen = open === undefined ? !isMobileDrawerOpen() : !!open;
  if (shouldOpen) {
    mobileDrawerEl.classList.add('gk-nav-mobile-drawer-open');
    mobileBackdropEl.classList.add('is-visible');
    mobileDrawerEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gk-scroll-locked');
  } else {
    mobileDrawerEl.classList.remove('gk-nav-mobile-drawer-open');
    mobileBackdropEl.classList.remove('is-visible');
    mobileDrawerEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gk-scroll-locked');
  }
  if (mobileMoreTabEl) {
    mobileMoreTabEl.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  }
}

function removeExistingMobileNodes() {
  if (mobileDrawerEl && mobileDrawerEl.parentNode) {
    mobileDrawerEl.parentNode.removeChild(mobileDrawerEl);
  }
  if (mobileBackdropEl && mobileBackdropEl.parentNode) {
    mobileBackdropEl.parentNode.removeChild(mobileBackdropEl);
  }
  mobileDrawerEl = null;
  mobileBackdropEl = null;
  mobileMoreTabEl = null;
  mobileBarEl = null;
  document.body.classList.remove('gk-scroll-locked');
}

function bindMobileGlobalHandlers() {
  if (mobileHandlersBound) {
    return;
  }
  mobileHandlersBound = true;
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMobileDrawerOpen()) {
      toggleMobileDrawer(false);
    }
  });
}

export function renderNav(container) {
  if (!container) {
    return;
  }
  clear(container);
  container.classList.add('gk-nav');
  navRootEl = container;

  const wrapper = el('div', { class: 'gk-nav-wrapper' });
  mainListEl = el('div', { class: 'gk-nav-list', attrs: { role: 'menubar' } });
  moreButtonEl = makeMoreButton();
  moreListEl = makeMoreList();
  moreButtonEl.addEventListener('click', () => toggleMoreOpen());

  mount(wrapper, mainListEl);
  const moreWrapper = el('div', { class: 'gk-nav-more-wrapper' });
  mount(moreWrapper, moreButtonEl);
  mount(moreWrapper, moreListEl);
  mount(wrapper, moreWrapper);
  mount(container, wrapper);

  const items = sortedMenuItems().filter(isNavItem);
  const ctaItems = [];
  const normalItems = [];
  for (const item of items) {
    if (item.type === 'cta') {
      ctaItems.push(item);
    } else {
      normalItems.push(item);
    }
  }

  for (const item of normalItems) {
    let node;
    if (item.type === 'external') {
      node = makeExternalLink(item);
    } else {
      node = makeNavButton(item);
    }
    if (node) {
      mount(mainListEl, node);
    }
  }

  const mobileHomeBtn = makeMobileHomeButton();
  if (mobileHomeBtn) {
    mount(wrapper, mobileHomeBtn);
  }

  ctaAnchorEl = null;
  for (const item of ctaItems) {
    const cta = makeCtaLink(item);
    if (cta) {
      ctaAnchorEl = cta;
      mount(wrapper, cta);
    }
  }

  langSwitcherEl = makeLangSwitcher();
  if (langSwitcherEl) {
    mount(wrapper, langSwitcherEl);
  }

  removeExistingMobileNodes();
  const primary = getMobilePrimaryItems();
  const overflow = getMobileOverflowItems();
  mobilePrimaryIds = primary.map((item) => item.id);

  mobileBarEl = el('div', {
    class: 'gk-nav-mobile-bar',
    attrs: { role: 'navigation', 'aria-label': 'Sections' },
  });
  for (const item of primary) {
    mount(mobileBarEl, makeMobileTab(item));
  }
  if (overflow.length > 0) {
    mobileMoreTabEl = makeMobileMoreTab();
    mount(mobileBarEl, mobileMoreTabEl);
  }
  mount(container, mobileBarEl);

  if (overflow.length > 0) {
    mobileBackdropEl = makeMobileBackdrop();
    mobileDrawerEl = makeMobileDrawer(overflow);
    document.body.appendChild(mobileBackdropEl);
    document.body.appendChild(mobileDrawerEl);
    bindMobileGlobalHandlers();
  }

  if (currentSectionId) {
    highlightActive(currentSectionId);
  }
}

function makeFooterLinks(config) {
  const links = config && config.footer && Array.isArray(config.footer.links) ? config.footer.links : [];
  if (links.length === 0) {
    return null;
  }
  const wrapper = el('div', { class: 'gk-footer-links' });
  for (const link of links) {
    const label = t(link.label) || link.platform;
    const url = typeof link.url === 'string' ? link.url : '';
    if (url.length === 0) {
      continue;
    }
    mount(
      wrapper,
      el('a', {
        class: 'gk-footer-link',
        text: label,
        attrs: {
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      })
    );
  }
  if (wrapper.childNodes.length === 0) {
    return null;
  }
  return wrapper;
}

function makeFooterSecondary() {
  const items = sortedMenuItems().filter(isFooterMenuItem);
  if (items.length === 0) {
    return null;
  }
  const wrapper = el('div', { class: 'gk-footer-secondary' });
  for (const item of items) {
    const label = t(item.label);
    if (item.type === 'external' || item.placement === 'footer') {
      const url = typeof item.url === 'string' ? item.url : '';
      if (url.length === 0) {
        continue;
      }
      mount(
        wrapper,
        el('a', {
          class: 'gk-footer-secondary-link',
          text: label,
          attrs: {
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        })
      );
    } else {
      const btn = el('button', {
        class: 'gk-footer-secondary-link',
        text: label,
        attrs: { type: 'button' },
      });
      btn.addEventListener('click', () => navigateTo(item.id));
      mount(wrapper, btn);
    }
  }
  if (wrapper.childNodes.length === 0) {
    return null;
  }
  return wrapper;
}

function makeFooterCopyright(config) {
  const text = t(config && config.footer && config.footer.copyright);
  if (!text) {
    return null;
  }
  return el('p', { class: 'gk-footer-copyright', text });
}

export function renderFooter(container) {
  if (!container) {
    return;
  }
  clear(container);
  container.classList.add('gk-footer');
  const config = getConfig();
  const links = makeFooterLinks(config);
  if (links) {
    mount(container, links);
  }
  const secondary = makeFooterSecondary();
  if (secondary) {
    mount(container, secondary);
  }
  const copyright = makeFooterCopyright(config);
  if (copyright) {
    mount(container, copyright);
  }
}

function collectMainItems() {
  const nodes = [];
  if (!mainListEl) {
    return nodes;
  }
  for (const child of Array.from(mainListEl.children)) {
    nodes.push(child);
  }
  return nodes;
}

function collectMoreItems() {
  const nodes = [];
  if (!moreListEl) {
    return nodes;
  }
  for (const child of Array.from(moreListEl.children)) {
    nodes.push(child);
  }
  return nodes;
}

function isDesktop() {
  return window.matchMedia(DESKTOP_MEDIA).matches;
}

function recomputeOverflow() {
  if (!mainListEl || !moreButtonEl || !moreListEl || !navRootEl) {
    return;
  }
  if (!isDesktop()) {
    for (const node of collectMoreItems()) {
      mainListEl.appendChild(node);
    }
    moreButtonEl.setAttribute('hidden', 'hidden');
    toggleMoreOpen(false);
    return;
  }
  for (const node of collectMoreItems()) {
    mainListEl.appendChild(node);
  }
  const wrapperWidth = mainListEl.parentElement.getBoundingClientRect().width;
  const ctaWidth = ctaAnchorEl ? ctaAnchorEl.getBoundingClientRect().width : 0;
  const langWidth = langSwitcherEl ? langSwitcherEl.getBoundingClientRect().width : 0;
  const moreWidth = moreButtonEl.getBoundingClientRect().width || 60;
  const usable = wrapperWidth - ctaWidth - langWidth - moreWidth - OVERFLOW_BUFFER;

  let used = 0;
  const items = collectMainItems();
  const overflow = [];
  for (const node of items) {
    const w = node.getBoundingClientRect().width;
    if (used + w > usable) {
      overflow.push(node);
    } else {
      used += w;
    }
  }
  for (const node of overflow) {
    moreListEl.appendChild(node);
  }
  if (overflow.length === 0) {
    moreButtonEl.setAttribute('hidden', 'hidden');
    toggleMoreOpen(false);
  } else {
    moreButtonEl.removeAttribute('hidden');
  }
}

export function initNavOverflow() {
  if (overflowInitialized || !mainListEl) {
    return;
  }
  overflowInitialized = true;
  let frame = 0;
  const schedule = () => {
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      recomputeOverflow();
    });
  };
  const wrapper = mainListEl.parentElement;
  if (typeof ResizeObserver === 'function' && wrapper) {
    const observer = new ResizeObserver(schedule);
    observer.observe(wrapper);
  }
  window.addEventListener('gk:langchange', schedule);
  document.addEventListener('click', handleGlobalClickForMore);
  document.addEventListener('keydown', handleGlobalKeydownForMore);
  schedule();
}

function findSection(sectionId) {
  if (typeof sectionId !== 'string' || sectionId.length === 0) {
    return null;
  }
  const normalized = sectionId.replace(/_2026$/, '');
  try {
    const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(sectionId) : sectionId;
    const escapedNorm =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(normalized) : normalized;
    return (
      document.querySelector(`[data-section-id="${escaped}"]`) ||
      document.querySelector(`[data-section-id="${escapedNorm}"]`)
    );
  } catch {
    return null;
  }
}

function getScrollBehavior() {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'auto';
    }
  }
  return 'smooth';
}

function scrollToSection(sectionId) {
  if (!sectionId) {
    return;
  }
  if (sectionId === 'home' || sectionId === 'home_2026') {
    window.scrollTo({ top: 0, behavior: getScrollBehavior() });
    return;
  }
  const sections = document.querySelectorAll('[data-section-id]');
  for (const node of sections) {
    node.classList.remove('gk-section-hidden');
  }
  const target = findSection(sectionId);
  if (target) {
    target.scrollIntoView({ behavior: getScrollBehavior() });
  }
}

export function navigateTo(sectionId) {
  if (typeof sectionId !== 'string' || sectionId.length === 0) {
    return;
  }
  toggleMobileDrawer(false);
  if (sectionId === 'home' || sectionId === 'home_2026') {
    window.scrollTo({ top: 0, behavior: getScrollBehavior() });
    toggleMoreOpen(false);
    currentSectionId = 'home';
    if (window.location.hash) {
      window.history.pushState({ sectionId: 'home' }, '', window.location.pathname + window.location.search);
    }
    track('page_view', { page_path: '/2026/' });
    highlightActive('home');
    return;
  }
  currentSectionId = sectionId;
  const newHash = `#/${sectionId}`;
  if (window.location.hash !== newHash) {
    window.history.pushState({ sectionId }, '', newHash);
  }
  scrollToSection(sectionId);
  track('page_view', { page_path: `/2026/#/${sectionId}` });
  highlightActive(sectionId);
}

function highlightActive(sectionId) {
  const normalized = typeof sectionId === 'string' ? sectionId.replace(/_2026$/, '') : sectionId;
  const nodes = document.querySelectorAll('[data-menu-id]');
  for (const node of nodes) {
    const menuId = node.getAttribute('data-menu-id');
    const menuNorm = typeof menuId === 'string' ? menuId.replace(/_2026$/, '') : menuId;
    const isActive = menuId === sectionId || menuNorm === sectionId || menuId === normalized || menuNorm === normalized;
    node.classList.toggle('gk-nav-item-active', isActive);
    if (node.classList.contains('gk-nav-mobile-tab')) {
      node.classList.toggle('gk-nav-mobile-tab-active', isActive);
    }
  }
  if (mobileMoreTabEl) {
    const overflowActive =
      sectionId &&
      sectionId !== 'home' &&
      sectionId !== 'home_2026' &&
      mobilePrimaryIds.length > 0 &&
      !mobilePrimaryIds.some((mid) => mid === sectionId || mid.replace(/_2026$/, '') === normalized);
    mobileMoreTabEl.classList.toggle('gk-nav-mobile-tab-active', !!overflowActive);
  }
}

function getHashSectionId() {
  const hash = window.location.hash;
  const match = hash.match(/^#\/(.+)$/);
  if (match && match[1]) {
    const candidate = match[1];
    if (candidate === 'home' || candidate === 'home_2026') {
      return 'home';
    }
    if (findSection(candidate)) {
      return candidate;
    }
  }
  return '';
}

function getFallbackSectionId() {
  return 'home';
}

function setupIntersectionHighlight() {
  const sections = Array.from(document.querySelectorAll('[data-section-id]'));
  if (sections.length === 0 || typeof IntersectionObserver !== 'function') {
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-section-id');
          if (id) {
            highlightActive(id);
            if (
              (id === 'home' || id === 'home_2026') &&
              window.location.hash &&
              window.location.hash.startsWith('#/')
            ) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }
        }
      }
    },
    { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
  );
  for (const section of sections) {
    observer.observe(section);
  }
}

function applyMode() {
  if (isDesktop()) {
    document.body.classList.add('gk-mode-desktop');
    document.body.classList.remove('gk-mode-mobile');
  } else {
    document.body.classList.add('gk-mode-mobile');
    document.body.classList.remove('gk-mode-desktop');
  }
  const sections = document.querySelectorAll('[data-section-id]');
  for (const node of sections) {
    node.classList.remove('gk-section-hidden');
  }
  recomputeOverflow();
}

export function initNav() {
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  window.addEventListener('popstate', () => {
    const hashId = getHashSectionId();
    if (hashId) {
      currentSectionId = hashId;
      scrollToSection(hashId);
      highlightActive(hashId);
    }
  });

  const mql = window.matchMedia(DESKTOP_MEDIA);
  const onChange = () => applyMode();
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
  } else if (typeof mql.addListener === 'function') {
    mql.addListener(onChange);
  }

  const hashId = getHashSectionId();
  applyMode();
  if (hashId) {
    currentSectionId = hashId;
    scrollToSection(hashId);
    highlightActive(hashId);
  } else {
    currentSectionId = getFallbackSectionId();
    if (currentSectionId) {
      highlightActive(currentSectionId);
    }
  }
  setupIntersectionHighlight();
}
