import { el, clear, mount } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getConfig, getContent } from '../core/store.js';
import { track } from '../core/analytics.js';

function getVirtualConfig() {
  const config = getConfig();
  const vs = config && config.virtualSpace;
  if (!vs || vs.enabled !== true) {
    return null;
  }
  if (typeof vs.url !== 'string' || vs.url.length === 0) {
    return null;
  }
  return vs;
}

function getVirtualContent() {
  const content = getContent();
  return (content && content.virtualSpace) || {};
}

function uiLabel(key) {
  const config = getConfig();
  const ui = config && config.ui;
  return t(ui && ui[key]);
}

function makeEnterButton(url, entryName, labelText) {
  const link = el('a', {
    class: 'gk-virtual-enter',
    text: labelText,
    attrs: {
      href: url,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  });
  link.addEventListener('click', () => {
    track('enter_virtual_space', { entry: entryName });
  });
  return link;
}

function makeIframe(url, titleText) {
  const attrs = {
    src: url,
    title: titleText || '',
    allow: 'camera; microphone; fullscreen; display-capture',
    loading: 'lazy',
  };
  return el('iframe', {
    class: 'gk-virtual-iframe',
    attrs,
  });
}

function makeNotesList(notes) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return null;
  }
  const items = [];
  for (const note of notes) {
    const noteText = t(note);
    if (noteText) {
      items.push(el('li', { class: 'gk-virtual-note', text: noteText }));
    }
  }
  if (items.length === 0) {
    return null;
  }
  const list = el('ul', { class: 'gk-virtual-notes' });
  for (const item of items) {
    mount(list, item);
  }
  return list;
}

export function renderVirtualSpace(container) {
  if (!container) {
    return;
  }
  clear(container);
  const vs = getVirtualConfig();
  const parentSection = container.closest ? container.closest('section') : document.getElementById('section-virtual');
  if (!vs) {
    if (parentSection) {
      parentSection.hidden = true;
      parentSection.style.display = 'none';
    }
    return;
  }
  if (parentSection) {
    parentSection.hidden = false;
    parentSection.style.display = '';
  }
  container.classList.add('gk-virtual-section');

  const vc = getVirtualContent();
  const titleText = t(vc.title);
  const descriptionText = t(vc.description);
  const buttonText = uiLabel('virtualEnterButton');

  if (titleText) {
    mount(container, el('h2', { class: 'gk-virtual-title', text: titleText }));
  }
  if (descriptionText) {
    mount(
      container,
      el('p', {
        class: 'gk-virtual-description gk-multiline',
        text: descriptionText,
      })
    );
  }

  mount(container, makeEnterButton(vs.url, 'section', buttonText));

  if (vs.embed === true) {
    mount(container, makeIframe(vs.url, titleText));
  }

  const notes = makeNotesList(vc.notes);
  if (notes) {
    mount(container, notes);
  }
}
