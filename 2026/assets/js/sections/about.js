import { el, clear, mount, attachImageFallback, LOGO_PLACEHOLDER } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { getContent } from '../core/store.js';

const DEFAULT_COLUMNS = 2;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 4;

function clampColumns(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return DEFAULT_COLUMNS;
  }
  const int = Math.floor(num);
  if (int < MIN_COLUMNS) {
    return MIN_COLUMNS;
  }
  if (int > MAX_COLUMNS) {
    return MAX_COLUMNS;
  }
  return int;
}

function clampSpan(value, columns) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return columns;
  }
  const int = Math.floor(num);
  if (int < 1) {
    return 1;
  }
  if (int > columns) {
    return columns;
  }
  return int;
}

function makeImageBlock(image, altText) {
  if (typeof image !== 'string' || image.length === 0) {
    return null;
  }
  const wrapper = el('div', { class: 'gk-about-media' });
  let src = image;
  let srcset = '';
  const match = image.match(/^images\/([^/]+)\/([^/.]+)\.(jpg|jpeg|png)$/i);
  if (match) {
    const [, type, id] = match;
    src = `images/${type}/${id}-640.webp`;
    srcset = `images/${type}/${id}-320.webp 320w, images/${type}/${id}-640.webp 640w, images/${type}/${id}-1024.webp 1024w`;
  }
  const attrs = {
    src,
    alt: altText || '',
    loading: 'lazy',
    decoding: 'async',
    width: '640',
    height: '360',
  };
  if (srcset) {
    attrs.srcset = srcset;
    attrs.sizes = '(max-width: 768px) 100vw, 640px';
  }
  const img = el('img', {
    class: 'gk-about-image',
    attrs,
  });
  img.dataset.gkOriginalSrc = image;
  attachImageFallback(img, LOGO_PLACEHOLDER);
  mount(wrapper, img);
  return wrapper;
}

function makeLinksBlock(links) {
  if (!Array.isArray(links) || links.length === 0) {
    return null;
  }
  const wrapper = el('div', { class: 'gk-about-links' });
  let count = 0;
  for (const link of links) {
    const url = link && typeof link.url === 'string' ? link.url.trim() : '';
    if (url.length === 0) {
      continue;
    }
    const label = t(link && link.label) || (link && link.platform) || url;
    const anchor = el('a', {
      class: 'gk-about-link',
      text: label,
      attrs: {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    });
    mount(wrapper, anchor);
    count += 1;
  }
  if (count === 0) {
    return null;
  }
  return wrapper;
}

function makeTextBlock(titleText, bodyText, imageBlock, links) {
  const wrapper = el('div', { class: 'gk-about-text' });
  if (titleText) {
    mount(wrapper, el('h3', { class: 'gk-about-title', text: titleText }));
  }
  if (bodyText) {
    mount(wrapper, el('p', { class: 'gk-about-body gk-multiline', text: bodyText }));
  }
  if (imageBlock) {
    mount(wrapper, imageBlock);
  }
  const linksBlock = makeLinksBlock(links);
  if (linksBlock) {
    mount(wrapper, linksBlock);
  }
  return wrapper;
}

function makeSection(section, index, columns) {
  const titleText = t(section && section.title);
  const bodyText = t(section && section.body);
  const image = section && typeof section.image === 'string' ? section.image : '';
  const hasImage = image.length > 0;
  const span = clampSpan(section && section.span, columns);
  const isFull = span === columns;

  const classes = ['gk-about-section'];
  if (isFull) {
    classes.push('gk-about-full');
  }
  if (hasImage) {
    classes.push('gk-about-has-image');
  }
  const rawValign = section && (section.valign || section.align);
  const valign = typeof rawValign === 'string' ? rawValign.trim().toLowerCase() : '';
  if (valign === 'top' || valign === 'center' || valign === 'bottom') {
    classes.push(`gk-about-valign-${valign}`);
  }
  const article = el('article', { class: classes.join(' ') });
  article.style.setProperty('--gk-about-span', String(span));

  const imageBlock = hasImage ? makeImageBlock(image, titleText) : null;
  const textBlock = makeTextBlock(titleText, bodyText, imageBlock, section && section.links);
  mount(article, textBlock);
  return article;
}

export function renderAbout(container) {
  if (!container) {
    return;
  }
  clear(container);
  const content = getContent();
  const about = content && content.about;
  const sections = about && Array.isArray(about.sections) ? about.sections : [];
  if (sections.length === 0) {
    return;
  }
  const columns = clampColumns(about && about.columns);
  container.classList.add('gk-about-section-wrapper');
  container.style.setProperty('--gk-about-columns', String(columns));
  sections.forEach((section, index) => {
    mount(container, makeSection(section, index, columns));
  });
}
