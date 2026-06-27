// In-page preview of the two colliding PDFs, side by side. The SHAttered pair
// renders as visibly different documents — seeing them next to the equal SHA-1
// digest makes the collision land far harder than a hex dump alone.

import type { PairManifestEntry } from '../pairs/manifest';
import { assetUrl } from '../pairs/loader';
import { el } from './common';

function frame(side: 'A' | 'B', entry: PairManifestEntry): HTMLElement {
  const file = side === 'A' ? entry.fileA : entry.fileB;
  const url = assetUrl(file);
  // <object> renders the PDF inline where supported; the fallback link always
  // works (e.g. mobile browsers without an inline PDF viewer).
  const obj = el('object', {
    class: 'pdf-object',
    type: 'application/pdf',
    data: url + '#toolbar=0&navpanes=0&view=Fit',
    'aria-label': `Rendered preview of File ${side} (${file})`
  }, [
    el('div', { class: 'pdf-fallback' }, [
      document.createTextNode('Inline PDF preview unavailable. '),
      el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: `Open File ${side} ↗` })
    ])
  ]);
  return el('figure', { class: 'pdf-frame' }, [
    el('figcaption', { class: 'pdf-cap', text: `File ${side} — ${file}` }),
    obj
  ]);
}

export function renderPdfPreview(entry: PairManifestEntry): HTMLElement {
  return el('div', { class: 'pdf-preview' }, [
    el('p', { class: 'note', text: 'Both are valid PDFs that display as different documents — yet they share one SHA-1 digest:' }),
    el('div', { class: 'pdf-grid' }, [frame('A', entry), frame('B', entry)])
  ]);
}
