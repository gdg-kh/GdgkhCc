import { el, clear, mount } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getConfig, getSortedList, getGroupById, assetPath } from '../core/store.js';
import { ballotCard } from '../ui/ballot-card.js';
import { openModal } from '../ui/detail-modal.js';
import { buildThanksPayload } from '../ui/detail-payload.js';
import { track } from '../core/analytics.js';

const MOBILE_BREAKPOINT = 768;
const MOBILE_SPEED_RATIO = 0.75;

function uiLabel(key) {
  const config = getConfig();
  const ui = config && config.ui;
  return t(ui && ui[key]);
}

function getMarqueeConfig() {
  const config = getConfig();
  const marquee = config && config.sponsorMarquee;
  if (!marquee || marquee.enabled !== true) {
    return null;
  }
  return marquee;
}

function collectItems() {
  const list = getSortedList('thanks');
  return list.filter((item) => item && item.marquee !== false);
}

function openSponsorModal(item) {
  track('select_sponsor', { sponsor_id: item.id, entry: 'marquee' });
  openModal(buildThanksPayload(item));
}

function createBallot(item, decorative) {
  const group = item.groupId ? getGroupById(item.groupId) : null;
  return ballotCard({
    image: assetPath('thanks', item.id),
    name: item.name,
    groupName: group ? group.name : null,
    groupColor: group && typeof group.color === 'string' ? group.color : undefined,
    description: item.description,
    decorative,
    onClick: decorative ? undefined : () => openSponsorModal(item),
  });
}

function buildBallotFragment(items, decorative) {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const card = createBallot(item, decorative);
    if (decorative) {
      card.setAttribute('aria-hidden', 'true');
    }
    fragment.appendChild(card);
  }
  return fragment;
}

function calcSpeed(config) {
  const base =
    typeof config.speedPxPerSecond === 'number' && config.speedPxPerSecond > 0 ? config.speedPxPerSecond : 60;
  if (window.innerWidth < MOBILE_BREAKPOINT) {
    return base * MOBILE_SPEED_RATIO;
  }
  return base;
}

function measureFirstCopyWidth(track) {
  const firstCopy = track.querySelector('.gk-marquee-copy');
  if (!firstCopy) {
    return 0;
  }
  return firstCopy.getBoundingClientRect().width;
}

function makeCopy(items, decorative) {
  const copy = el('div', { class: 'gk-marquee-copy' });
  copy.appendChild(buildBallotFragment(items, decorative));
  if (decorative) {
    copy.setAttribute('aria-hidden', 'true');
  }
  return copy;
}

function layoutTrack(container, track, items, config) {
  const containerWidth = container.getBoundingClientRect().width;
  if (containerWidth <= 0) {
    return;
  }

  clear(track);
  track.appendChild(makeCopy(items, false));
  let copies = 1;
  const singleWidth = measureFirstCopyWidth(track);
  if (singleWidth <= 0) {
    return;
  }
  const target = containerWidth * 2;
  while (copies * singleWidth < target) {
    track.appendChild(makeCopy(items, true));
    copies += 1;
    if (copies > 20) {
      break;
    }
  }
  if (copies < 2) {
    track.appendChild(makeCopy(items, true));
    copies = 2;
  }

  const totalWidth = singleWidth * copies;
  const speed = calcSpeed(config);
  const duration = totalWidth / 2 / speed;
  track.style.setProperty('--gk-marquee-duration', `${duration.toFixed(3)}s`);
  track.style.setProperty('--gk-marquee-direction', config.direction === 'right' ? 'reverse' : 'normal');
}

function attachResizeObserver(container, doLayout) {
  let frame = 0;
  const schedule = () => {
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      doLayout();
    });
  };
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
  } else {
    window.addEventListener('resize', schedule);
  }
}

export function renderSponsorMarquee(container) {
  if (!container) {
    return;
  }
  clear(container);
  const config = getMarqueeConfig();
  if (!config) {
    return;
  }
  const items = collectItems();
  if (items.length === 0) {
    return;
  }
  container.classList.add('gk-sponsor-marquee-section');
  const rootConfig = getConfig();
  const showShadow = Boolean(rootConfig && rootConfig.thanks && rootConfig.thanks.showCardShadow);
  container.classList.toggle('is-shadow-off', !showShadow);

  const titleText = uiLabel('sponsorMarqueeTitle');
  if (titleText) {
    mount(container, el('h2', { class: 'gk-marquee-title', text: titleText }));
  }

  const marquee = el('div', {
    class: 'gk-marquee',
    attrs: { 'aria-label': titleText || '' },
  });
  const track = el('div', { class: 'gk-marquee-track' });
  mount(marquee, track);
  mount(container, marquee);

  if (config.pauseOnHover === true) {
    marquee.classList.add('gk-marquee-pause-on-hover');
  }

  const doLayout = () => layoutTrack(marquee, track, items, config);
  doLayout();
  attachResizeObserver(marquee, doLayout);
}
