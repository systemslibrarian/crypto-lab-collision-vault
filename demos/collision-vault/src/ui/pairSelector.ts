// PAIR SELECTOR — choose a bundled collision pair. Uses native radio inputs
// (fully keyboard-operable, arrow-key navigable, screen-reader friendly) styled
// as cards. Each card shows a type badge and a one-line real-history caption.

import type { PairManifestEntry } from '../pairs/manifest';
import { el } from './common';

export function renderPairSelector(
  pairs: PairManifestEntry[],
  selectedId: string,
  onSelect: (id: string) => void
): HTMLElement {
  const fieldset = el('fieldset', { class: 'pair-selector', 'aria-describedby': 'pair-selector-hint' });
  fieldset.append(
    el('legend', { text: '1 · Choose a collision pair' }),
    el('p', { id: 'pair-selector-hint', class: 'note', text: 'Each is a real, published pair of different files that share one digest under a broken hash.' })
  );

  const list = el('div', { class: 'pair-list', role: 'radiogroup', 'aria-label': 'Bundled collision pairs' });

  for (const p of pairs) {
    const id = `pair-${p.id}`;
    const input = el('input', {
      type: 'radio',
      name: 'collision-pair',
      id,
      value: p.id,
      class: 'pair-radio'
    }) as HTMLInputElement;
    input.checked = p.id === selectedId;
    input.addEventListener('change', () => {
      if (input.checked) onSelect(p.id);
    });

    const badgeKind = p.type === 'chosen-prefix' ? 'badge-danger' : 'badge-neutral';
    const label = el('label', { class: 'pair-card', for: id }, [
      input,
      el('div', { class: 'pair-card-body' }, [
        el('div', { class: 'pair-card-top' }, [
          el('span', { class: 'pair-name', text: p.label }),
          el('span', { class: `pair-badge ${badgeKind}`, text: p.type })
        ]),
        el('span', { class: `pair-broken broken-${p.brokenHash}`, text: `broken hash: ${p.brokenHash.toUpperCase()}` }),
        el('p', { class: 'pair-caption', text: p.caption })
      ])
    ]);
    list.append(label);
  }

  fieldset.append(list);
  return fieldset;
}
