import { el, clear, mount, pickContrastColor } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getContent, getConfig, getSortedList, assetPath } from '../core/store.js';
import { personCard } from '../ui/card.js';
import { openModal } from '../ui/detail-modal.js';
import { firstSessionOf, buildSpeakerPayload } from '../ui/detail-payload.js';
import { track } from '../core/analytics.js';

function groupIdOf(speaker) {
  if (speaker && typeof speaker.groupId === 'string' && speaker.groupId.length > 0) {
    return speaker.groupId;
  }
  const session = firstSessionOf(speaker);
  return session && typeof session.groupId === 'string' ? session.groupId : null;
}

function buildGroups(speakers) {
  const sessionGroups = getSortedList('sessionGroups');
  const buckets = new Map();
  const order = [];
  for (const group of sessionGroups) {
    buckets.set(group.id, { group, items: [] });
    order.push(group.id);
  }
  const orphans = [];
  for (const speaker of speakers) {
    const gid = groupIdOf(speaker);
    if (gid && buckets.has(gid)) {
      buckets.get(gid).items.push(speaker);
    } else {
      orphans.push(speaker);
    }
  }
  const result = [];
  for (const gid of order) {
    const entry = buckets.get(gid);
    if (entry.items.length > 0) {
      result.push(entry);
    }
  }
  if (orphans.length > 0) {
    result.push({ group: null, items: orphans });
  }
  return result;
}

function makeGroupHeader(group) {
  const header = el('header', { class: 'gk-speakers-group-header' });
  if (group && typeof group.color === 'string' && group.color.length > 0) {
    header.style.backgroundColor = group.color;
    header.style.color = pickContrastColor(group.color);
  }
  const title = el('h3', {
    class: 'gk-speakers-group-title',
    text: t(group && group.name),
  });
  mount(header, title);
  return header;
}

function openSpeakerModal(speaker) {
  track('select_speaker', { speaker_id: speaker.id });
  openModal(buildSpeakerPayload(speaker));
}

function makeCardFor(speaker) {
  const opts = {
    image: assetPath('speakers', speaker.id),
    name: speaker.name,
    title: speaker.title,
    org: speaker.org,
    description: speaker.bio,
    onClick: () => openSpeakerModal(speaker),
  };
  return personCard(opts);
}

function renderEmptyState(container) {
  const config = getConfig();
  const ui = config && config.ui;
  const message = t(ui && ui.emptyStateText);
  const empty = el('p', {
    class: 'gk-speakers-empty',
    text: message,
  });
  mount(container, empty);
}

export function renderSpeakers(container) {
  if (!container) {
    return;
  }
  clear(container);
  container.classList.add('gk-speakers-section');

  const content = getContent();
  const speakers = Array.isArray(content && content.speakers) ? getSortedList('speakers') : [];

  if (speakers.length === 0) {
    renderEmptyState(container);
    return;
  }

  const groups = buildGroups(speakers);
  if (groups.length === 0) {
    renderEmptyState(container);
    return;
  }

  for (const entry of groups) {
    const groupBlock = el('div', { class: 'gk-speakers-group' });
    if (entry.group) {
      mount(groupBlock, makeGroupHeader(entry.group));
    }
    const grid = el('div', { class: 'gk-speakers-grid' });
    for (const speaker of entry.items) {
      mount(grid, makeCardFor(speaker));
    }
    mount(groupBlock, grid);
    mount(container, groupBlock);
  }
}
