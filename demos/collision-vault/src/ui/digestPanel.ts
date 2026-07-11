// DIGEST PANEL — the headline moment. Computes the BROKEN hash for both files
// and shows them EQUAL with alarm styling: "⚠ SAME DIGEST, DIFFERENT FILES."
// The collision succeeding means the hash FAILED, not a neat trick.

import { ALGORITHMS, type HashAlgorithm } from '../hashing/index';
import type { PairManifestEntry } from '../pairs/manifest';
import { el, fmt, digestRow, statusChip } from './common';

export function renderDigestPanel(
  entry: PairManifestEntry,
  digestA: string,
  digestB: string
): HTMLElement {
  const algo = entry.brokenHash;
  const info = ALGORITHMS[algo];
  const equal = digestA === digestB;

  const panel = el('section', {
    class: `panel digest-panel ${equal ? 'is-alarm' : 'is-ok'}`,
    'aria-labelledby': 'digest-panel-title'
  });

  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'digest-panel-title', text: `3 · Broken hash: ${info.label}` }),
      equal
        ? statusChip('alarm', '⚠', 'SAME DIGEST, DIFFERENT FILES')
        : statusChip('neutral', '?', 'digests differ — unexpected')
    ])
  );

  panel.append(
    digestRow(`${info.label}(File A)`, digestA),
    digestRow(`${info.label}(File B)`, digestB)
  );

  // The verdict line, conveyed by icon + text + colour (WCAG 1.4.1).
  const verdict = el('p', { class: 'verdict' });
  if (equal) {
    verdict.append(
      el('span', { class: 'verdict-icon', 'aria-hidden': 'true', text: '⚠' }),
      document.createTextNode(' '),
      ...fmt(
        `**Collision confirmed.** Two genuinely different files produce the ` +
          `*identical* ${info.label} digest. For a sound hash this must be infeasible — ` +
          `here it is computed live in your browser. The hash function has failed.`
      )
    );
  } else {
    verdict.append(
      el('span', { class: 'verdict-icon', 'aria-hidden': 'true', text: '?' }),
      document.createTextNode(
        ' Digests differ — this would mean the bundled asset is not the expected collision pair.'
      )
    );
  }
  panel.append(verdict);

  panel.append(
    el('p', { class: 'note' }, fmt(`**Why this is real:** ${info.note} Implementation: ${info.provider}.`))
  );

  return panel;
}

/** Algorithms the demo hashes for every file (broken + resistant contrast). */
export const ALL_DEMO_ALGOS: HashAlgorithm[] = [
  'md5',
  'sha-1',
  'sha-256',
  'sha-512',
  'sha3-256'
];
