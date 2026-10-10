import { el, clear, mount, pickContrastColor } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getContent, getConfig, getGroupedList, assetPath } from '../core/store.js';
import { personCard } from '../ui/card.js';
import { openModal } from '../ui/detail-modal.js';
import { buildBoothPayload, buildThanksPayload } from '../ui/detail-payload.js';
import { track } from '../core/analytics.js';

function renderEmptyState(container, className) {
  const config = getConfig();
  const ui = config && config.ui;
  const message = t(ui && ui.emptyStateText);
  const empty = el('p', {
    class: className,
    text: message,
  });
  mount(container, empty);
}

function makeGroupHeader(group, headerClass) {
  const header = el('header', { class: headerClass });
  if (group && typeof group.color === 'string' && group.color.length > 0) {
    header.style.backgroundColor = group.color;
    header.style.color = pickContrastColor(group.color);
  }
  const title = el('h3', {
    class: `${headerClass}-title`,
    text: t(group && group.name),
  });
  mount(header, title);
  return header;
}

function openLogoModal(type, item) {
  const eventName = type === 'thanks' ? 'select_thanks' : 'select_booth';
  const idKey = type === 'thanks' ? 'thanks_id' : 'booth_id';
  track(eventName, { [idKey]: item.id });
  const payload = type === 'thanks' ? buildThanksPayload(item) : buildBoothPayload(item);
  openModal(payload);
}

function renderItemCard(type, item) {
  return personCard({
    image: assetPath(type, item.id),
    name: item.name,
    description: item.description,
    onClick: () => openLogoModal(type, item),
  });
}

function renderLogoSection(container, groups, type) {
  for (const entry of groups) {
    if (!entry || !Array.isArray(entry.items) || entry.items.length === 0) {
      continue;
    }
    const block = el('div', { class: 'gk-logo-group' });
    if (entry.group) {
      mount(block, makeGroupHeader(entry.group, 'gk-logo-group-header'));
    }

    const subgroups = entry.group && Array.isArray(entry.group.subgroups) ? entry.group.subgroups : null;
    if (subgroups && subgroups.length > 0) {
      const sortedSubgroups = subgroups.slice().sort((a, b) => {
        const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
        const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });

      const matchedIds = new Set();
      for (const subgroup of sortedSubgroups) {
        const subItems = entry.items.filter((item) => item && item.subgroupId === subgroup.id);
        if (subItems.length === 0) {
          // 自動隱藏無贊助夥伴的空子方案
          continue;
        }
        for (const it of subItems) {
          matchedIds.add(it.id);
        }

        const subgroupBlock = el('div', { class: 'gk-logo-subgroup' });
        const subHeader = el('h4', {
          class: 'gk-logo-subgroup-title',
          text: t(subgroup.name),
        });
        const grid = el('div', { class: 'gk-logo-grid' });
        for (const item of subItems) {
          mount(grid, renderItemCard(type, item));
        }
        mount(subgroupBlock, subHeader, grid);
        mount(block, subgroupBlock);
      }

      // 未指定或未匹配到任何已知子方案的項目
      const remainingItems = entry.items.filter((item) => !matchedIds.has(item.id));
      if (remainingItems.length > 0) {
        const remainingGrid = el('div', { class: 'gk-logo-grid' });
        for (const item of remainingItems) {
          mount(remainingGrid, renderItemCard(type, item));
        }
        mount(block, remainingGrid);
      }
    } else {
      const grid = el('div', { class: 'gk-logo-grid' });
      for (const item of entry.items) {
        mount(grid, renderItemCard(type, item));
      }
      mount(block, grid);
    }

    mount(container, block);
  }
}

export function renderThanks(container) {
  if (!container) {
    return;
  }
  clear(container);
  container.classList.add('gk-thanks-section');
  const content = getContent();
  const list = Array.isArray(content && content.thanks) ? content.thanks : [];
  if (list.length === 0) {
    renderEmptyState(container, 'gk-thanks-empty');
    return;
  }
  const groups = getGroupedList('thanks', 'thanksGroups');
  if (groups.length === 0) {
    renderEmptyState(container, 'gk-thanks-empty');
    return;
  }
  renderLogoSection(container, groups, 'thanks');
}

export function renderBooths(container) {
  if (!container) {
    return;
  }
  clear(container);
  container.classList.add('gk-booths-section');
  const content = getContent();
  const list = Array.isArray(content && content.booths) ? content.booths : [];
  if (list.length === 0) {
    renderEmptyState(container, 'gk-booths-empty');
    return;
  }
  const groups = getGroupedList('booths', 'boothGroups');
  if (groups.length === 0) {
    renderEmptyState(container, 'gk-booths-empty');
    return;
  }
  renderLogoSection(container, groups, 'booths');
}
