import { el, mount, pickContrastColor, attachImageFallback, LOGO_PLACEHOLDER } from '../core/dom.js';
import { t } from '../core/i18n.js';

export function ballotCard(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const decorative = options.decorative === true;
  const nameText = t(options.name);
  const groupText = t(options.groupName);
  const groupColor =
    typeof options.groupColor === 'string' && options.groupColor.length > 0 ? options.groupColor : null;
  const clickable = typeof options.onClick === 'function' && !decorative;

  const attrs = {};
  if (decorative) {
    attrs['aria-hidden'] = 'true';
    attrs.tabindex = '-1';
  } else if (clickable) {
    attrs.role = 'button';
    attrs.tabindex = '0';
    attrs['aria-label'] = nameText || '';
  }

  const card = el('article', {
    class: 'gk-ballot-card',
    attrs,
  });

  const header = el('div', { class: 'gk-ballot-header' });
  if (groupColor) {
    header.style.backgroundColor = groupColor;
    header.style.color = pickContrastColor(groupColor);
  }
  const headerTitle = el('span', {
    class: 'gk-ballot-header-title',
    text: nameText,
  });
  mount(header, headerTitle);
  if (groupText) {
    mount(header, el('span', { class: 'gk-ballot-header-group', text: groupText }));
  }
  mount(card, header);

  const body = el('div', { class: 'gk-ballot-body' });
  const logoWrapper = el('div', { class: 'gk-ballot-logo-wrapper' });
  if (typeof options.image === 'string' && options.image.length > 0) {
    let src = options.image;
    let srcset = '';
    const match = options.image.match(/^images\/([^/]+)\/([^/.]+)\.(jpg|jpeg|png)$/i);
    if (match) {
      const [, type, id] = match;
      src = `images/${type}/${id}-160.webp`;
      srcset = `images/${type}/${id}-160.webp 160w, images/${type}/${id}-320.webp 320w, images/${type}/${id}-640.webp 640w`;
    }
    const attrs = {
      src,
      alt: nameText || '',
      loading: 'lazy',
      decoding: 'async',
      width: '200',
      height: '200',
    };
    if (srcset) {
      attrs.srcset = srcset;
      attrs.sizes = '160px';
    }
    const img = el('img', {
      class: 'gk-ballot-logo',
      attrs,
    });
    img.dataset.gkOriginalSrc = options.image;
    attachImageFallback(img, LOGO_PLACEHOLDER);
    mount(logoWrapper, img);
  }
  mount(body, logoWrapper);
  mount(card, body);

  if (clickable) {
    card.addEventListener('click', (event) => {
      options.onClick(event);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        options.onClick(event);
      }
    });
  }

  return card;
}
