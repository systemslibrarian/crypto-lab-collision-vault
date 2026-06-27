// Compact source-citation block, rendered from the manifest's Source data so
// users can see where each artifact and its history come from.

import type { Source } from '../pairs/manifest';
import { el } from './common';

export function renderCitation(source: Source): HTMLElement {
  return el('p', { class: 'citation' }, [
    el('span', { class: 'citation-label', text: 'Source: ' }),
    document.createTextNode(`${source.authors} (${source.year}), `),
    el('em', { text: source.title }),
    document.createTextNode(' — '),
    el('a', {
      href: source.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      text: new URL(source.url).hostname.replace(/^www\./, '') + ' ↗'
    })
  ]);
}
