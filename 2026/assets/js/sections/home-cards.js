import { el, clear, mount } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getConfig } from '../core/store.js';
import { track } from '../core/analytics.js';

function uiLabel(key) {
  const config = getConfig();
  const ui = config && config.ui;
  return t(ui && ui[key]);
}

function getHomeMenuItems() {
  const config = getConfig();
  const menu = config && Array.isArray(config.menu) ? config.menu : [];
  return menu
    .filter((item) => item && item.placement === 'home' && item.enabled !== false)
    .slice()
    .sort((a, b) => {
      const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
}

function makeLastYearCard(menuItem) {
  const url = typeof menuItem.url === 'string' ? menuItem.url : '';
  if (url.length === 0) {
    return null;
  }
  const labelText = t(menuItem.label);
  const hintText = uiLabel('lastYearCardText');
  const card = el('a', {
    class: 'gk-card gk-home-external-card',
    attrs: {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  });
  card.addEventListener('click', () => {
    track('click_last_year');
  });
  const body = el('div', { class: 'gk-card-body gk-card-body-center' });
  if (hintText) {
    mount(body, el('p', { class: 'gk-home-card-hint', text: hintText }));
  }
  if (labelText) {
    mount(body, el('h3', { class: 'gk-card-name', text: labelText }));
  }
  mount(card, body);
  return card;
}

export function renderHomeCards(container) {
  if (!container) {
    return;
  }
  clear(container);

  const items = getHomeMenuItems();
  const cards = [];
  for (const item of items) {
    if (item.id !== 'lastyear' && item.id !== 'lastyear_2026' && item.id !== 'last_year_2026') {
      continue;
    }
    const card = makeLastYearCard(item);
    if (card) {
      cards.push(card);
    }
  }

  if (cards.length === 0) {
    return;
  }

  container.classList.add('gk-home-cards-section');
  const grid = el('div', { class: 'gk-home-cards-grid' });
  for (const card of cards) {
    mount(grid, card);
  }
  mount(container, grid);
}
