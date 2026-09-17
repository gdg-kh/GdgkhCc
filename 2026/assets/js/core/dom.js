const LINE_BREAK_PATTERN = /<br\s*\/?>|\r\n|\r|\n/gi;

function stripNewlineChars(text) {
  return text.replace(/\r?\n|\r/g, '');
}

function appendTextWithBreaks(parent, text) {
  if (typeof text !== 'string' || text.length === 0) {
    return;
  }
  let lastIndex = 0;
  LINE_BREAK_PATTERN.lastIndex = 0;
  let match = LINE_BREAK_PATTERN.exec(text);
  while (match !== null) {
    const segment = stripNewlineChars(text.slice(lastIndex, match.index));
    parent.appendChild(document.createTextNode(segment));
    parent.appendChild(document.createElement('br'));
    lastIndex = match.index + match[0].length;
    match = LINE_BREAK_PATTERN.exec(text);
  }
  const tail = stripNewlineChars(text.slice(lastIndex));
  if (tail.length > 0) {
    parent.appendChild(document.createTextNode(tail));
  }
}

function appendChildValue(parent, value) {
  if (value === null || value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      appendChildValue(parent, item);
    }
    return;
  }
  if (typeof value === 'string') {
    appendTextWithBreaks(parent, value);
    return;
  }
  if (value instanceof Node) {
    parent.appendChild(value);
  }
}

export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  const options = opts && typeof opts === 'object' ? opts : {};

  if (options.class !== undefined && options.class !== null) {
    if (Array.isArray(options.class)) {
      node.className = options.class.filter((c) => typeof c === 'string' && c.length > 0).join(' ');
    } else if (typeof options.class === 'string') {
      node.className = options.class;
    }
  }

  if (typeof options.text === 'string') {
    appendTextWithBreaks(node, options.text);
  }

  if (options.attrs && typeof options.attrs === 'object') {
    for (const key of Object.keys(options.attrs)) {
      const value = options.attrs[key];
      if (value === null || value === undefined) {
        continue;
      }
      node.setAttribute(key, String(value));
    }
  }

  if (options.on && typeof options.on === 'object') {
    for (const eventName of Object.keys(options.on)) {
      const handler = options.on[eventName];
      if (typeof handler === 'function') {
        node.addEventListener(eventName, handler);
      }
    }
  }

  appendChildValue(node, children);
  return node;
}

export function clear(node) {
  if (!node) {
    return;
  }
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function setRichText(node, text) {
  if (!node) {
    return;
  }
  clear(node);
  appendTextWithBreaks(node, typeof text === 'string' ? text : '');
}

export function mount(parent, ...children) {
  if (!parent) {
    return parent;
  }
  appendChildValue(parent, children);
  return parent;
}

function parseHex(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? [r, g, b] : null;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? [r, g, b] : null;
  }
  return null;
}

export function pickContrastColor(hex) {
  const rgb = parseHex(hex);
  if (!rgb) {
    return 'var(--gk-ink)';
  }
  const [r, g, b] = rgb.map((c) => c / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? 'var(--gk-ink)' : 'var(--gk-paper)';
}

// Data URI placeholders for network fallback and image loading errors
export const PERSON_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="' +
  'http:' +
  '//www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="rgb(240,240,240)"/><circle cx="50" cy="38" r="18" fill="rgb(208,208,208)"/><path d="M22 86c0-15.4 12.6-28 28-28s28 12.6 28 28z" fill="rgb(208,208,208)"/></svg>';

export const LOGO_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="' +
  'http:' +
  '//www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="rgb(240,240,240)"/><circle cx="50" cy="50" r="22" fill="none" stroke="rgb(208,208,208)" stroke-width="4"/><path d="M38 50h24M50 38v24" stroke="rgb(208,208,208)" stroke-width="4" stroke-linecap="round"/></svg>';

export function attachImageFallback(imgNode, fallbackSrc = PERSON_PLACEHOLDER) {
  if (!imgNode) {
    return;
  }
  imgNode.addEventListener('error', () => {
    // 若有母圖且尚未嘗試退回母圖，先嘗試母圖
    if (imgNode.dataset.gkOriginalSrc && !imgNode.dataset.gkTriedOriginal) {
      imgNode.dataset.gkTriedOriginal = 'true';
      imgNode.removeAttribute('srcset');
      imgNode.removeAttribute('sizes');
      imgNode.src = imgNode.dataset.gkOriginalSrc;
      return;
    }
    if (imgNode.dataset.gkFallbackApplied === 'true') {
      return;
    }
    imgNode.dataset.gkFallbackApplied = 'true';
    imgNode.removeAttribute('srcset');
    imgNode.removeAttribute('sizes');
    imgNode.classList.add('gk-image-fallback');
    imgNode.src = fallbackSrc;
  });
}
