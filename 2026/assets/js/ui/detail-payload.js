import { assetPath, getShareUrl, getSessionById, getGroupById } from '../core/store.js';

export function firstSessionOf(speaker) {
  if (!speaker || !Array.isArray(speaker.sessionIds) || speaker.sessionIds.length === 0) {
    return null;
  }
  for (const sid of speaker.sessionIds) {
    const session = getSessionById(sid);
    if (session) {
      return session;
    }
  }
  return null;
}

function groupColorOf(group) {
  if (group && typeof group.color === 'string' && group.color.length > 0) {
    return group.color;
  }
  return undefined;
}

function linksOf(item) {
  return Array.isArray(item && item.links) ? item.links : [];
}

export function buildSpeakerPayload(speaker) {
  if (!speaker) {
    return null;
  }
  const session = firstSessionOf(speaker);
  const group = session ? getGroupById(session.groupId) : null;
  return {
    type: 'speakers',
    id: speaker.id,
    shareUrl: getShareUrl('speakers', speaker.id),
    image: assetPath('speakers', speaker.id),
    name: speaker.name,
    title: speaker.title,
    org: speaker.org,
    bio: speaker.bio,
    sessionTitle: session ? session.title : undefined,
    sessionAbstract: session ? session.abstract : undefined,
    groupName: group ? group.name : undefined,
    groupColor: groupColorOf(group),
    tags: session && Array.isArray(session.tags) ? session.tags : [],
    links: linksOf(speaker),
  };
}

export function buildStaffPayload(staff) {
  if (!staff) {
    return null;
  }
  return {
    type: 'staff',
    id: staff.id,
    shareUrl: getShareUrl('staff', staff.id),
    image: assetPath('staff', staff.id),
    name: staff.name,
    subtitle: staff.role,
    bio: staff.bio,
    links: linksOf(staff),
  };
}

function buildLogoPayload(type, item) {
  if (!item) {
    return null;
  }
  const group = item.groupId ? getGroupById(item.groupId) : null;
  return {
    type,
    id: item.id,
    shareUrl: getShareUrl(type, item.id),
    image: assetPath(type, item.id),
    name: item.name,
    bio: item.description,
    groupName: group ? group.name : undefined,
    groupColor: groupColorOf(group),
    links: linksOf(item),
  };
}

export function buildBoothPayload(booth) {
  return buildLogoPayload('booths', booth);
}

export function buildThanksPayload(thanks) {
  return buildLogoPayload('thanks', thanks);
}

export function buildDetailPayload(type, item) {
  switch (type) {
    case 'speakers':
      return buildSpeakerPayload(item);
    case 'staff':
      return buildStaffPayload(item);
    case 'booths':
      return buildBoothPayload(item);
    case 'thanks':
      return buildThanksPayload(item);
    default:
      return null;
  }
}
