const JPG_TYPES = ['speakers', 'staff'];
const PNG_TYPES = ['thanks', 'booths'];
const GROUP_KEYS = ['sessionGroups', 'thanksGroups', 'boothGroups'];

let configData = null;
let contentData = null;

const speakerIndex = new Map();
const sessionIndex = new Map();
const groupIndex = new Map();
const trackIndex = new Map();

function buildIndex(map, list) {
  map.clear();
  if (!Array.isArray(list)) {
    return;
  }
  for (const item of list) {
    if (item && typeof item.id === 'string') {
      map.set(item.id, item);
    }
  }
}

function buildIndexes(content) {
  buildIndex(speakerIndex, content && content.speakers);
  buildIndex(sessionIndex, content && content.sessions);
  buildIndex(trackIndex, content && content.tracks);
  groupIndex.clear();
  if (content && typeof content === 'object') {
    for (const key of GROUP_KEYS) {
      const list = content[key];
      if (!Array.isArray(list)) {
        continue;
      }
      for (const item of list) {
        if (item && typeof item.id === 'string') {
          groupIndex.set(item.id, item);
        }
      }
    }
  }
}

async function fetchJson(path) {
  const url = `${path}?v=${Date.now()}`;
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`載入 ${path} 失敗：${err.message}`);
  }
  if (!response.ok) {
    throw new Error(`載入 ${path} 失敗：HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (err) {
    throw new Error(`解析 ${path} 失敗：${err.message}`);
  }
}

export async function loadData() {
  const [config, content] = await Promise.all([fetchJson('data/config.json'), fetchJson('data/content.json')]);
  configData = config;
  contentData = content;
  buildIndexes(content);
  return { config, content };
}

export function getConfig() {
  return configData;
}

export function getContent() {
  return contentData;
}

export function getSpeakerById(id) {
  if (typeof id !== 'string') {
    return null;
  }
  return speakerIndex.get(id) || null;
}

export function getSessionById(id) {
  if (typeof id !== 'string') {
    return null;
  }
  return sessionIndex.get(id) || null;
}

export function getGroupById(id) {
  if (typeof id !== 'string') {
    return null;
  }
  return groupIndex.get(id) || null;
}

export function getTrackById(id) {
  if (typeof id !== 'string') {
    return null;
  }
  return trackIndex.get(id) || null;
}

export function getSessionsBySpeakerId(speakerId) {
  const speaker = getSpeakerById(speakerId);
  if (!speaker || !Array.isArray(speaker.sessionIds)) {
    return [];
  }
  const sessions = [];
  for (const sid of speaker.sessionIds) {
    const session = getSessionById(sid);
    if (session) {
      sessions.push(session);
    }
  }
  sessions.sort((a, b) => {
    const aStart = typeof a.start === 'string' ? a.start : '';
    const bStart = typeof b.start === 'string' ? b.start : '';
    if (aStart < bStart) {
      return -1;
    }
    if (aStart > bStart) {
      return 1;
    }
    return 0;
  });
  return sessions;
}

export function getSpeakersBySessionId(sessionId) {
  const session = getSessionById(sessionId);
  if (!session || !Array.isArray(session.speakerIds)) {
    return [];
  }
  const speakers = [];
  for (const sid of session.speakerIds) {
    const speaker = getSpeakerById(sid);
    if (speaker) {
      speakers.push(speaker);
    }
  }
  return speakers;
}

export function getSortedList(arrayName) {
  if (!contentData || typeof arrayName !== 'string') {
    return [];
  }
  const list = contentData[arrayName];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.slice().sort((a, b) => {
    const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

export function assetPath(type, id) {
  const ext = JPG_TYPES.includes(type) ? '.jpg' : PNG_TYPES.includes(type) ? '.png' : '';
  return `images/${type}/${id}${ext}`;
}

export function responsiveAssetPath(type, id, size = 320, format = 'webp') {
  return `images/${type}/${id}-${size}.${format}`;
}

export function ogPath(type, id) {
  return `images/og/${type}/${id}.png`;
}

export function getGroupedList(arrayName, groupArrayName) {
  const items = getSortedList(arrayName);
  const groups = getSortedList(groupArrayName);
  const result = [];
  const bucket = new Map();
  const orphans = [];
  for (const group of groups) {
    bucket.set(group.id, []);
  }
  for (const item of items) {
    const gid = item && item.groupId;
    if (typeof gid === 'string' && bucket.has(gid)) {
      bucket.get(gid).push(item);
    } else {
      orphans.push(item);
    }
  }
  for (const group of groups) {
    result.push({ group, items: bucket.get(group.id) });
  }
  if (orphans.length > 0) {
    result.push({ group: null, items: orphans });
  }
  return result;
}
