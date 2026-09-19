import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetPath, ogPath } from './entity-types.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.join(__dirname, 'share-template.html');

let templateCache = null;

function loadTemplate() {
  if (templateCache === null) {
    templateCache = readFileSync(TEMPLATE_PATH, 'utf8');
  }
  return templateCache;
}

function pickLang(field) {
  if (!field || typeof field !== 'object') {
    return '';
  }
  return field['zh-Hant'] || field.en || field.ja || '';
}

export function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimDescription(text, maxLen) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLen)}…`;
}

function bioParagraphs(text) {
  const bio = String(text || '').trim();
  if (!bio) {
    return '';
  }
  const parts = bio
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}

function linksList(links) {
  if (!Array.isArray(links) || links.length === 0) {
    return '';
  }
  const items = [];
  for (const link of links) {
    if (!link || typeof link.url !== 'string' || !link.url) {
      continue;
    }
    const label = pickLang(link.label) || link.platform || link.url;
    items.push(`<li><a href="${escapeHtml(link.url)}" rel="noopener nofollow">${escapeHtml(label)}</a></li>`);
  }
  if (items.length === 0) {
    return '';
  }
  return `<ul class="gk-share-links">${items.join('')}</ul>`;
}

function speakerSessions(item, store, ui) {
  if (!store || !store.sessionById || !Array.isArray(item.sessionIds)) {
    return '';
  }
  const chunks = [];
  const sessionLabel = pickLang(ui.sessionLabel) || '議程';
  for (const sid of item.sessionIds) {
    const session = store.sessionById.get(sid);
    if (!session) {
      continue;
    }
    const title = pickLang(session.title);
    if (!title) {
      continue;
    }
    const parts = [
      `<h2>${escapeHtml(sessionLabel)}：${escapeHtml(title)}</h2>`,
      bioParagraphs(pickLang(session.abstract)),
    ];
    chunks.push(`<section class="gk-share-session">${parts.join('')}</section>`);
  }
  return chunks.join('');
}

function getNormalizedBaseUrl(config) {
  let url = (config && config.site && config.site.baseUrl) || 'https://gdgkh.cc/2026/';
  if (!url.endsWith('/')) {
    url += '/';
  }
  return url;
}

function buildJsonLd({ type, item, typeConfig, config }) {
  const baseUrl = getNormalizedBaseUrl(config);
  const canonical = `${baseUrl}share/${type}/${item.id}/`;
  const image = `${baseUrl}${ogPath(type, item.id)}`;
  const name = pickLang(item.name);
  const description = trimDescription(pickLang(item.bio || item.description), 200);
  const eventName = pickLang(config && config.site && config.site.eventName);
  const data = {
    '@context': 'https://schema.org',
    '@type': typeConfig.schema,
    name,
    url: canonical,
    image,
  };
  if (description) {
    data.description = description;
  }
  if (eventName) {
    data.subjectOf = { '@type': 'Event', name: eventName };
  }
  return JSON.stringify(data);
}

function buildBody({ type, item, config, store, imageUrl, backHref, backLabel }) {
  const ui = (config && config.ui) || {};
  const name = pickLang(item.name);
  const bioText = pickLang(item.bio || item.description);
  const parts = [];
  parts.push(`<h1>${escapeHtml(name)}</h1>`);
  if (type === 'speakers') {
    const titleText = pickLang(item.title);
    const orgText = pickLang(item.org);
    const affiliation = titleText && orgText ? `${titleText} · ${orgText}` : titleText || orgText;
    if (affiliation) {
      parts.push(`<p class="gk-share-affiliation">${escapeHtml(affiliation)}</p>`);
    }
  }
  if (type === 'staff' && item.role) {
    const role = pickLang(item.role);
    if (role) {
      parts.push(`<p class="gk-share-role">${escapeHtml(role)}</p>`);
    }
  }
  parts.push(`<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" width="480" height="480" loading="lazy" />`);
  const bio = bioParagraphs(bioText);
  if (bio) {
    parts.push(`<div class="gk-share-bio">${bio}</div>`);
  }
  if (type === 'speakers') {
    parts.push(speakerSessions(item, store, ui));
  }
  const links = linksList(item.links);
  if (links) {
    parts.push(links);
  }
  parts.push(`<p><a href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a></p>`);
  return parts.filter(Boolean).join('');
}

function fillTemplate(template, replacements) {
  let out = template;
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value);
  }
  return out;
}

export function renderSharePage({ type, item, typeConfig, config, store }) {
  const template = loadTemplate();
  const baseUrl = getNormalizedBaseUrl(config);
  const eventName = pickLang(config && config.site && config.site.eventName) || 'DevFest 2026 高雄場';
  const ui = (config && config.ui) || {};
  const backLabel = pickLang(ui.backHomeLabel) || '回到首頁';

  const name = pickLang(item.name);
  const bioText = pickLang(item.bio || item.description);
  const description = trimDescription(bioText, 80);
  const canonical = `${baseUrl}share/${type}/${item.id}/`;
  const ogImage = `${baseUrl}${ogPath(type, item.id)}`;
  const imageUrl = `${baseUrl}${assetPath(type, item.id)}`;

  const title = name ? `${name} — ${eventName}` : eventName;
  const bodyContent = buildBody({
    type,
    item,
    config,
    store,
    imageUrl,
    backHref: baseUrl,
    backLabel,
  });
  const jsonLd = buildJsonLd({ type, item, typeConfig, config });

  const replacements = {
    '{{TITLE}}': escapeHtml(title),
    '{{DESCRIPTION}}': escapeHtml(description),
    '{{CANONICAL}}': escapeHtml(canonical),
    '{{OG_TYPE}}': escapeHtml(typeConfig.ogType),
    '{{OG_IMAGE}}': escapeHtml(ogImage),
    '{{SITE_NAME}}': escapeHtml(eventName),
    '{{JSON_LD}}': jsonLd,
    '{{BODY_CONTENT}}': bodyContent,
    '{{TYPE}}': escapeHtml(type),
    '{{ID}}': escapeHtml(item.id),
  };
  return fillTemplate(template, replacements);
}
