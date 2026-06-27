// RESISTANCE CONTRAST — run modern hashes over the SAME pair and show the
// digests DIFFER (calm/green). The collision is specific to the broken function;
// collision-resistant hashes are unaffected.

import { ALGORITHMS, type HashAlgorithm } from '../hashing/index';
import { el, digestRow, statusChip } from './common';

const CONTRAST_ALGOS: HashAlgorithm[] = ['sha-256', 'sha3-256', 'sha-512'];

export function renderResistancePanel(
  resultsA: Partial<Record<HashAlgorithm, string>>,
  resultsB: Partial<Record<HashAlgorithm, string>>
): HTMLElement {
  const panel = el('section', {
    class: 'panel resistance-panel is-ok',
    'aria-labelledby': 'resistance-panel-title'
  });

  const allDiffer = CONTRAST_ALGOS.every(
    (a) => resultsA[a] && resultsB[a] && resultsA[a] !== resultsB[a]
  );

  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'resistance-panel-title', text: '5 · Modern hashes resist' }),
      allDiffer
        ? statusChip('calm', '✓', 'DIFFERENT DIGESTS — RESISTANCE HOLDS')
        : statusChip('neutral', '…', 'computing')
    ])
  );

  panel.append(
    el('p', {
      class: 'note',
      html:
        'The exact same two files, hashed with collision-resistant functions. Each pair of ' +
        'digests is <strong>different</strong> — exactly what a sound hash must do.'
    })
  );

  for (const algo of CONTRAST_ALGOS) {
    const info = ALGORITHMS[algo];
    const da = resultsA[algo] ?? null;
    const db = resultsB[algo] ?? null;
    const differ = !!da && !!db && da !== db;
    const block = el('div', { class: 'resist-block' }, [
      el('div', { class: 'resist-head' }, [
        el('span', { class: 'resist-name', text: info.label }),
        differ
          ? statusChip('calm', '✓', 'differ')
          : statusChip('neutral', '…', '…')
      ]),
      digestRow(`${info.label}(A)`, da),
      digestRow(`${info.label}(B)`, db),
      el('p', { class: 'resist-note dim', text: info.note })
    ]);
    panel.append(block);
  }

  panel.append(
    el('p', {
      class: 'security-margin',
      html:
        '<strong>Security-margin context:</strong> the best generic collision attack needs about ' +
        '2<sup>n/2</sup> work for an <em>n</em>-bit digest — ~2<sup>128</sup> for SHA-256/SHA3-256. ' +
        'No collision attack beating that is publicly known for SHA-2 or SHA-3. Collisions are a ' +
        'property of the <em>function</em>, not of hashing in general.'
    })
  );

  return panel;
}
