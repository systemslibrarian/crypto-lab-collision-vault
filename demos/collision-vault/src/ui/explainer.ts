// IDENTICAL-vs-CHOSEN explainer. Uses the SELECTED pair's real bytes (its actual
// shared-prefix length) to show the structural difference, and why chosen-prefix
// is the more dangerous result (Flame, rogue CA).

import type { PairManifestEntry } from '../pairs/manifest';
import { el, statusChip } from './common';

function schematic(kind: 'identical-prefix' | 'chosen-prefix', sharedBytes: number): HTMLElement {
  const wrap = el('div', { class: `schematic schematic-${kind}` });

  function track(fileLabel: string, prefixClass: string, prefixText: string): HTMLElement {
    return el('div', { class: 'sch-track' }, [
      el('span', { class: 'sch-file', text: fileLabel }),
      el('span', { class: `sch-seg ${prefixClass}`, text: prefixText }),
      el('span', { class: 'sch-seg sch-blocks', text: 'near-collision blocks' }),
      el('span', { class: 'sch-seg sch-tail', text: 'suffix' })
    ]);
  }

  if (kind === 'identical-prefix') {
    wrap.append(
      track('A', 'sch-shared', `shared prefix (${sharedBytes} B)`),
      track('B', 'sch-shared', `shared prefix (${sharedBytes} B)`),
      el('p', { class: 'sch-caption dim', text: 'Both files begin identically, then diverge into crafted blocks.' })
    );
  } else {
    wrap.append(
      track('A', 'sch-chosenA', 'chosen prefix #1'),
      track('B', 'sch-chosenB', 'chosen prefix #2'),
      el('p', { class: 'sch-caption dim', text: `Two different attacker-chosen prefixes (shared prefix here: ${sharedBytes} B) are forced to the same digest.` })
    );
  }
  return wrap;
}

export function renderExplainer(entry: PairManifestEntry, sharedBytes: number): HTMLElement {
  const isChosen = entry.type === 'chosen-prefix';
  const panel = el('section', {
    class: 'panel explainer-panel',
    'aria-labelledby': 'explainer-panel-title'
  });

  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'explainer-panel-title', text: '4 · Identical-prefix vs chosen-prefix' }),
      statusChip(
        isChosen ? 'alarm' : 'neutral',
        isChosen ? '⚠' : '◆',
        `this pair: ${entry.type}`
      )
    ])
  );

  // Show the schematic for the SELECTED pair's actual family, using real bytes.
  panel.append(
    el('p', { class: 'note', html: `Selected pair <strong>“${entry.label}”</strong> is a <strong>${entry.type}</strong> collision. Its real shared prefix is <strong>${sharedBytes.toLocaleString()}</strong> bytes (measured live from the bundled files above).` }),
    schematic(entry.type, sharedBytes)
  );

  // Side-by-side concept comparison so users grasp the distinction either way.
  const grid = el('div', { class: 'explainer-grid' });

  grid.append(
    el('div', { class: 'explainer-card' }, [
      el('h3', { text: 'Identical-prefix' }),
      el('p', { text: 'Both files must share a common prefix chosen up front; the attacker controls both files from the start. Crafted “near-collision” blocks then drive the internal state back together.' }),
      el('p', { class: 'dim', text: 'Weaker: the attacker can’t target two pre-existing, meaningfully-different documents.' })
    ]),
    el('div', { class: 'explainer-card explainer-card-danger' }, [
      el('h3', {}, [document.createTextNode('Chosen-prefix '), el('span', { class: 'tag-danger', text: 'more dangerous' })]),
      el('p', { text: 'The attacker picks two completely different prefixes — e.g. two distinct certificate identities — and computes blocks that still collide. No shared start required.' }),
      el('p', { html: '<strong>Real impact:</strong> a rogue CA certificate (2008) and the <strong>Flame</strong> malware (2012), which forged a Microsoft code-signing certificate via a chosen-prefix MD5 collision to spread through Windows Update.' })
    ])
  );
  panel.append(grid);

  panel.append(
    el('p', { class: 'note', html: `<strong>This pair’s history:</strong> ${entry.history}` }),
    el('p', { class: 'note', html: `<strong>Why it matters:</strong> ${entry.realWorldImpact}` })
  );

  return panel;
}
