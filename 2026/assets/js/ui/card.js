import {
  el,
  mount,
  pickContrastColor,
  attachImageFallback,
  PERSON_PLACEHOLDER,
  LOGO_PLACEHOLDER,
} from '../core/dom.js';
import { t } from '../core/i18n.js';

function attachActivation(node, onClick) {
  if (typeof onClick !== 'function') {
    return;
  }
  node.addEventListener('click', (event) => {
    onClick(event);
  });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      onClick(event);
    }
  });
}

function makeCard(className, onClick, ariaLabel) {
  const attrs = {
    role: 'button',
    tabindex: '0',
  };
  if (typeof ariaLabel === 'string' && ariaLabel.length > 0) {
    attrs['aria-label'] = ariaLabel;
  }
  const card = el('article', {
    class: className,
    attrs,
  });
  attachActivation(card, onClick);
  return card;
}

function makePersonImage(image, name, fallback = PERSON_PLACEHOLDER) {
  const wrapper = el('div', { class: 'gk-card-media gk-card-media-person' });
  if (typeof image === 'string' && image.length > 0) {
    let src = image;
    let srcset = '';
    const match = image.match(/^images\/([^/]+)\/([^/?#.]+)\.(jpg|jpeg|png)(?:(\?[^#]*)?(#.*)?)?$/i);
    if (match) {
      const [, type, id, , query = ''] = match;
      src = `images/${type}/${id}-320.webp${query}`;
      srcset = `images/${type}/${id}-160.webp${query} 160w, images/${type}/${id}-320.webp${query} 320w, images/${type}/${id}-640.webp${query} 640w`;
    }
    const attrs = {
      src,
      alt: name || '',
      loading: 'lazy',
      decoding: 'async',
      width: '320',
      height: '320',
    };
    if (srcset) {
      attrs.srcset = srcset;
      attrs.sizes = '(max-width: 768px) 160px, 320px';
    }
    const img = el('img', {
      class: 'gk-card-image gk-card-image-person',
      attrs,
    });
    img.dataset.gkOriginalSrc = image;
    attachImageFallback(img, fallback);
    mount(wrapper, img);
  }
  return wrapper;
}

function joinAffiliation(titleText, orgText) {
  if (titleText && orgText) {
    return `${titleText} · ${orgText}`;
  }
  return titleText || orgText || '';
}

function appendTextBlock(card, name, subtitle, description, affiliationText) {
  const body = el('div', { class: 'gk-card-body' });
  const nameText = t(name);
  if (nameText) {
    mount(body, el('h3', { class: 'gk-card-name', text: nameText }));
  }
  if (affiliationText) {
    mount(body, el('p', { class: 'gk-card-affiliation', text: affiliationText }));
  }
  const subtitleText = t(subtitle);
  if (subtitleText) {
    mount(body, el('p', { class: 'gk-card-subtitle', text: subtitleText }));
  }
  const descriptionText = t(description);
  if (descriptionText) {
    mount(body, el('p', { class: 'gk-card-description', text: descriptionText }));
  }
  mount(card, body);
}

export function personCard(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const nameText = t(options.name);
  const card = makeCard('gk-card gk-person-card', options.onClick, nameText);
  const isLogo =
    typeof options.image === 'string' &&
    (options.image.includes('images/booths') || options.image.includes('images/thanks'));
  const fallback = isLogo ? LOGO_PLACEHOLDER : PERSON_PLACEHOLDER;
  const media = makePersonImage(options.image, nameText, fallback);
  mount(card, media);
  const affiliationText = joinAffiliation(t(options.title), t(options.org));
  appendTextBlock(card, options.name, options.subtitle, options.description, affiliationText);
  return card;
}

export function sessionCard(opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const titleText = t(options.title);
  const card = makeCard('gk-card gk-session-card', options.onClick, titleText);

  const header = el('div', { class: 'gk-session-header' });
  if (typeof options.time === 'string' && options.time.length > 0) {
    const timeBox = el('div', { class: 'gk-session-time-box' });
    const timeText = el('span', { class: 'gk-session-time', text: options.time });
    mount(timeBox, timeText);

    if (typeof options.durationMinutes === 'number' && options.durationMinutes > 0) {
      const durTag = el('span', {
        class: 'gk-session-duration-tag',
        text: `${options.durationMinutes}m`,
      });
      mount(timeBox, durTag);

      const percent = Math.min(100, Math.round((options.durationMinutes / 90) * 100));
      const meter = el('div', { class: 'gk-session-duration-meter' });
      const bar = el('div', { class: 'gk-session-duration-bar' });
      bar.style.width = `${percent}%`;
      mount(meter, bar);
      mount(timeBox, meter);
    }
    mount(header, timeBox);
  }
  const groupText = t(options.groupName);
  if (groupText) {
    const chip = el('span', { class: 'gk-session-group', text: groupText });
    if (typeof options.groupColor === 'string' && options.groupColor.length > 0) {
      chip.style.backgroundColor = options.groupColor;
      chip.style.color = pickContrastColor(options.groupColor);
    }
    mount(header, chip);
  }
  if (header.childNodes.length > 0) {
    mount(card, header);
  }

  if (titleText) {
    mount(card, el('h3', { class: 'gk-session-title', text: titleText }));
  }

  const speakers = Array.isArray(options.speakers) ? options.speakers : [];
  if (speakers.length > 0) {
    const row = el('div', { class: 'gk-session-speakers' });
    for (const speaker of speakers) {
      if (!speaker) {
        continue;
      }
      const speakerName = t(speaker.name);
      const isClickable = typeof options.onSpeakerClick === 'function' || typeof speaker.onClick === 'function';
      const item = el('div', {
        class: `gk-session-speaker${isClickable ? ' gk-session-speaker-clickable' : ''}`,
        attrs: isClickable
          ? {
              role: 'button',
              tabindex: '0',
              'aria-label': speakerName || '',
            }
          : {},
      });
      if (isClickable) {
        const handleSpeakerActivation = (event) => {
          event.stopPropagation();
          if (typeof speaker.onClick === 'function') {
            speaker.onClick(speaker, event);
          } else if (typeof options.onSpeakerClick === 'function') {
            options.onSpeakerClick(speaker, event);
          }
        };
        attachActivation(item, handleSpeakerActivation);
      }
      if (typeof speaker.image === 'string' && speaker.image.length > 0) {
        let avatarSrc = speaker.image;
        const match = speaker.image.match(/^images\/([^/]+)\/([^/?#.]+)\.(jpg|jpeg|png)(?:(\?[^#]*)?(#.*)?)?$/i);
        if (match) {
          const [, type, id, , query = ''] = match;
          avatarSrc = `images/${type}/${id}-64.webp${query}`;
        }
        const avatarImg = el('img', {
          class: 'gk-session-speaker-avatar',
          attrs: {
            src: avatarSrc,
            alt: speakerName || '',
            loading: 'lazy',
            decoding: 'async',
            width: '32',
            height: '32',
          },
        });
        avatarImg.dataset.gkOriginalSrc = speaker.image;
        attachImageFallback(avatarImg, PERSON_PLACEHOLDER);
        mount(item, avatarImg);
      }
      if (speakerName) {
        mount(item, el('span', { class: 'gk-session-speaker-name', text: speakerName }));
      }
      mount(row, item);
    }
    mount(card, row);
  }

  return card;
}
