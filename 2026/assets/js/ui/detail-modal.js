import {
  el,
  clear,
  mount,
  pickContrastColor,
  attachImageFallback,
  PERSON_PLACEHOLDER,
  LOGO_PLACEHOLDER,
} from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getConfig, getShareUrl } from '../core/store.js';
import { track } from '../core/analytics.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let overlayEl = null;
let modalEl = null;
let headerEl = null;
let headerToolbarEl = null;
let bodyEl = null;
let closeBtn = null;
let previousFocus = null;
let isOpen = false;
let copyResetTimer = null;

function ensureRoot() {
  if (overlayEl) {
    return;
  }
  overlayEl = el('div', {
    class: 'gk-modal-overlay',
    attrs: { hidden: '' },
    on: {
      click: (event) => {
        if (event.target === overlayEl) {
          closeModal();
        }
      },
    },
  });

  modalEl = el('div', {
    class: 'gk-modal',
    attrs: {
      role: 'dialog',
      'aria-modal': 'true',
      tabindex: '-1',
    },
  });

  headerEl = el('div', { class: 'gk-modal-header' });
  headerToolbarEl = el('div', { class: 'gk-modal-toolbar' });
  closeBtn = el(
    'button',
    {
      class: 'gk-modal-close',
      attrs: { type: 'button', 'aria-label': 'Close' },
      on: { click: () => closeModal() },
    },
    '\u00d7'
  );
  mount(headerEl, headerToolbarEl, closeBtn);

  bodyEl = el('div', { class: 'gk-modal-body' });

  mount(modalEl, headerEl, bodyEl);
  mount(overlayEl, modalEl);
  document.body.appendChild(overlayEl);
}

function labelFromUi(key) {
  const config = getConfig();
  const ui = config && config.ui;
  if (!ui || typeof ui !== 'object') {
    return '';
  }
  return t(ui[key]);
}

function hasI18nText(value) {
  if (!value) {
    return false;
  }
  return typeof t(value) === 'string' && t(value).length > 0;
}

function renderMedia(payload) {
  if (!payload.image) {
    return null;
  }
  const fallback = payload.type === 'thanks' || payload.type === 'booths' ? LOGO_PLACEHOLDER : PERSON_PLACEHOLDER;
  let src = payload.image;
  let srcset = '';
  const match =
    typeof payload.image === 'string' && payload.image.match(/^images\/([^/]+)\/([^/.]+)\.(jpg|jpeg|png)$/i);
  if (match) {
    const [, type, id] = match;
    src = `images/${type}/${id}-640.webp`;
    srcset = `images/${type}/${id}-320.webp 320w, images/${type}/${id}-640.webp 640w`;
  }
  const attrs = {
    src,
    alt: t(payload.name),
    loading: 'lazy',
    decoding: 'async',
    width: '512',
    height: '512',
  };
  if (srcset) {
    attrs.srcset = srcset;
    attrs.sizes = '(max-width: 640px) 320px, 512px';
  }
  const img = el('img', {
    class: 'gk-modal-image',
    attrs,
  });
  img.dataset.gkOriginalSrc = payload.image;
  attachImageFallback(img, fallback);
  return el('div', { class: 'gk-modal-media' }, img);
}

function joinAffiliation(titleText, orgText) {
  if (titleText && orgText) {
    return `${titleText} · ${orgText}`;
  }
  return titleText || orgText || '';
}

function renderHeading(payload) {
  const parts = [];
  parts.push(el('h2', { class: 'gk-modal-title', text: t(payload.name) }));
  const affiliation = joinAffiliation(t(payload.title), t(payload.org));
  if (affiliation) {
    parts.push(el('p', { class: 'gk-modal-affiliation', text: affiliation }));
  }
  if (hasI18nText(payload.subtitle)) {
    parts.push(el('p', { class: 'gk-modal-subtitle', text: t(payload.subtitle) }));
  }
  return el('div', { class: 'gk-modal-heading' }, parts);
}

function renderGroupChip(payload) {
  if (!hasI18nText(payload.groupName)) {
    return null;
  }
  const text = t(payload.groupName);
  const chip = el('span', {
    class: 'gk-modal-group-chip',
    attrs: {
      title: text,
    },
    text,
  });
  if (typeof payload.groupColor === 'string' && payload.groupColor.length > 0) {
    chip.style.backgroundColor = payload.groupColor;
    chip.style.color = pickContrastColor(payload.groupColor);
  }
  return chip;
}

function renderBio(payload) {
  if (!hasI18nText(payload.bio)) {
    return null;
  }
  return el('div', { class: 'gk-modal-section' }, [
    el('p', { class: 'gk-multiline gk-modal-bio', text: t(payload.bio) }),
  ]);
}

function renderSession(payload) {
  if (!hasI18nText(payload.sessionTitle) && !hasI18nText(payload.sessionAbstract)) {
    return null;
  }
  const children = [];
  const label = labelFromUi('sessionLabel');
  if (label) {
    children.push(el('h3', { class: 'gk-modal-section-title', text: label }));
  }
  if (hasI18nText(payload.sessionTitle)) {
    children.push(el('p', { class: 'gk-modal-session-title', text: t(payload.sessionTitle) }));
  }
  if (hasI18nText(payload.sessionAbstract)) {
    children.push(
      el('p', {
        class: 'gk-multiline gk-modal-session-abstract',
        text: t(payload.sessionAbstract),
      })
    );
  }
  return el('div', { class: 'gk-modal-section' }, children);
}

function renderMeta(payload) {
  if (!Array.isArray(payload.meta) || payload.meta.length === 0) {
    return null;
  }
  const rows = [];
  for (const item of payload.meta) {
    if (!item || (!hasI18nText(item.label) && !hasI18nText(item.value))) {
      continue;
    }
    rows.push(
      el('div', { class: 'gk-modal-meta-row' }, [
        el('span', { class: 'gk-modal-meta-label', text: t(item.label) }),
        el('span', { class: 'gk-modal-meta-value', text: t(item.value) }),
      ])
    );
  }
  if (rows.length === 0) {
    return null;
  }
  return el('div', { class: 'gk-modal-section gk-modal-meta' }, rows);
}

function renderTags(payload) {
  if (!Array.isArray(payload.tags) || payload.tags.length === 0) {
    return null;
  }
  const chips = [];
  for (const tag of payload.tags) {
    const text = t(tag);
    if (!text) {
      continue;
    }
    chips.push(el('span', { class: 'gk-modal-tag', text }));
  }
  if (chips.length === 0) {
    return null;
  }
  return el('div', { class: 'gk-modal-section' }, [el('div', { class: 'gk-modal-tags' }, chips)]);
}

function fallbackCopyText(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

function makeShareButton(payload) {
  const shareUrl = payload.shareUrl || (payload.type && payload.id ? getShareUrl(payload.type, payload.id) : '');
  if (!shareUrl) {
    return null;
  }

  const shareLabelText = labelFromUi('shareLabel') || '分享';
  const copiedLabelText = labelFromUi('copiedLabel') || '已複製連結！';

  const textSpan = el('span', { class: 'gk-modal-share-label', text: shareLabelText });

  const button = el(
    'button',
    {
      class: 'gk-modal-share-btn',
      attrs: {
        type: 'button',
        'aria-label': shareLabelText,
        title: shareLabelText,
      },
      on: {
        click: async (event) => {
          event.stopPropagation();

          const config = getConfig();
          const eventName = t(config && config.site && config.site.eventName) || '';
          const name = t(payload.name) || '';
          const shareTitle = name && eventName ? `${name} - ${eventName}` : name || eventName;
          const shareText = name || '';

          if (typeof navigator !== 'undefined' && navigator.share) {
            try {
              await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl,
              });
              track('share', {
                type: payload.type || 'unknown',
                id: payload.id || 'unknown',
                method: 'native',
              });
              return;
            } catch (err) {
              if (err && err.name === 'AbortError') {
                return;
              }
            }
          }

          let copied = false;
          if (
            typeof navigator !== 'undefined' &&
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === 'function'
          ) {
            try {
              await navigator.clipboard.writeText(shareUrl);
              copied = true;
            } catch {
              copied = fallbackCopyText(shareUrl);
            }
          } else {
            copied = fallbackCopyText(shareUrl);
          }

          if (copied) {
            track('share', {
              type: payload.type || 'unknown',
              id: payload.id || 'unknown',
              method: 'clipboard',
            });

            button.classList.add('gk-modal-share-copied');
            button.setAttribute('aria-label', copiedLabelText);
            button.setAttribute('title', copiedLabelText);
            clear(button);
            mount(button, el('span', { class: 'gk-modal-share-label', text: copiedLabelText }));

            if (copyResetTimer) {
              clearTimeout(copyResetTimer);
            }
            copyResetTimer = setTimeout(() => {
              button.classList.remove('gk-modal-share-copied');
              button.setAttribute('aria-label', shareLabelText);
              button.setAttribute('title', shareLabelText);
              clear(button);
              mount(button, el('span', { class: 'gk-modal-share-label', text: shareLabelText }));
              copyResetTimer = null;
            }, 2000);
          }
        },
      },
    },
    [textSpan]
  );

  return button;
}

const DEFAULT_PLATFORM_LABELS = {
  website: { 'zh-Hant': '官網', en: 'Official Website', ja: '公式サイト' },
  facebook: { 'zh-Hant': 'Facebook', en: 'Facebook', ja: 'Facebook' },
  x: { 'zh-Hant': 'X (Twitter)', en: 'X (Twitter)', ja: 'X (Twitter)' },
  instagram: { 'zh-Hant': 'Instagram', en: 'Instagram', ja: 'Instagram' },
  linkedin: { 'zh-Hant': 'LinkedIn', en: 'LinkedIn', ja: 'LinkedIn' },
  github: { 'zh-Hant': 'GitHub', en: 'GitHub', ja: 'GitHub' },
};

function makeLinkElements(payload) {
  if (!Array.isArray(payload.links) || payload.links.length === 0) {
    return [];
  }
  const anchors = [];
  for (const link of payload.links) {
    if (!link || typeof link.url !== 'string' || link.url.length === 0) {
      continue;
    }
    const fallbackLabel = link.platform ? DEFAULT_PLATFORM_LABELS[link.platform] : null;
    const text =
      (link && t(link.label)) ||
      (fallbackLabel ? t(fallbackLabel) : '') ||
      (link && link.platform) ||
      (link && link.url) ||
      '';
    anchors.push(
      el('a', {
        class: 'gk-modal-link',
        attrs: {
          href: link.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        text,
      })
    );
  }
  return anchors;
}

function renderShareAndLinks(payload) {
  const shareButton = makeShareButton(payload);
  const linkElements = makeLinkElements(payload);
  if (!shareButton && linkElements.length === 0) {
    return null;
  }
  const items = [];
  if (shareButton) {
    items.push(shareButton);
  }
  if (linkElements.length > 0) {
    items.push(...linkElements);
  }
  return el('div', { class: 'gk-modal-section gk-modal-links-section' }, [
    el('div', { class: 'gk-modal-links' }, items),
  ]);
}

function renderFooter(payload) {
  const action = payload.footerAction;
  if (!action || typeof action !== 'object') {
    return null;
  }
  const text = t(action.text);
  if (!text) {
    return null;
  }
  let button;
  if (action.disabled === true) {
    button = el('button', {
      class: 'gk-modal-action gk-modal-action-disabled',
      attrs: { type: 'button', disabled: 'disabled', 'aria-disabled': 'true' },
      text,
    });
  } else if (typeof action.url === 'string' && action.url.length > 0) {
    button = el('a', {
      class: 'gk-modal-action',
      attrs: {
        href: action.url,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      text,
    });
  } else if (typeof action.onClick === 'function') {
    button = el('button', {
      class: 'gk-modal-action',
      attrs: { type: 'button' },
      on: { click: action.onClick },
      text,
    });
  } else {
    return null;
  }
  return el('div', { class: 'gk-modal-footer' }, button);
}

function renderContent(payload) {
  clear(bodyEl);
  if (headerToolbarEl) {
    clear(headerToolbarEl);
  }

  const chip = renderGroupChip(payload);
  if (chip && headerToolbarEl) {
    mount(headerToolbarEl, chip);
  }

  const aside = el('aside', { class: 'gk-modal-aside' });
  const main = el('div', { class: 'gk-modal-main' });

  const media = renderMedia(payload);
  if (media) {
    mount(aside, media);
  }
  const tags = renderTags(payload);
  if (tags) {
    mount(aside, tags);
  }
  const shareAndLinks = renderShareAndLinks(payload);
  if (shareAndLinks) {
    mount(aside, shareAndLinks);
  }

  mount(main, renderHeading(payload));
  const bio = renderBio(payload);
  if (bio) {
    mount(main, bio);
  }
  const session = renderSession(payload);
  if (session) {
    mount(main, session);
  }
  const meta = renderMeta(payload);
  if (meta) {
    mount(main, meta);
  }
  if (payload.extraNode instanceof Node) {
    mount(main, payload.extraNode);
  }

  const columns = el('div', { class: 'gk-modal-columns' });
  if (aside.childNodes.length > 0) {
    mount(columns, aside);
  }
  mount(columns, main);
  mount(bodyEl, columns);

  const footer = renderFooter(payload);
  if (footer) {
    mount(bodyEl, footer);
  }
}

function getFocusable() {
  if (!modalEl) {
    return [];
  }
  const nodes = modalEl.querySelectorAll(FOCUSABLE_SELECTOR);
  const list = [];
  for (const node of nodes) {
    if (node instanceof HTMLElement && !node.hasAttribute('disabled')) {
      list.push(node);
    }
  }
  return list;
}

function handleKeydown(event) {
  if (!isOpen) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key !== 'Tab') {
    return;
  }
  const focusables = getFocusable();
  if (focusables.length === 0) {
    event.preventDefault();
    if (closeBtn) {
      closeBtn.focus();
    }
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !modalEl.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !modalEl.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

export function openModal(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  if (copyResetTimer) {
    clearTimeout(copyResetTimer);
    copyResetTimer = null;
  }
  ensureRoot();
  renderContent(data);

  if (!isOpen) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.addEventListener('keydown', handleKeydown, true);
  }

  overlayEl.removeAttribute('hidden');
  document.body.classList.add('gk-no-scroll');
  isOpen = true;

  if (closeBtn) {
    closeBtn.focus();
  }
}

export function closeModal() {
  if (!isOpen || !overlayEl) {
    return;
  }
  overlayEl.setAttribute('hidden', '');
  document.body.classList.remove('gk-no-scroll');
  document.removeEventListener('keydown', handleKeydown, true);
  isOpen = false;
  if (bodyEl) {
    clear(bodyEl);
  }
  if (headerToolbarEl) {
    clear(headerToolbarEl);
  }
  if (copyResetTimer) {
    clearTimeout(copyResetTimer);
    copyResetTimer = null;
  }
  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
  }
  previousFocus = null;
}
