// Compact whole-file minimap: orients the user in a large file by showing where
// the shared prefix ends and where the differing regions sit across the entire
// byte range — complementing the windowed hex dump (which only shows a slice).

import type { PairProof } from '../pairs/proof';
import { el } from './common';

export function renderMinimap(proof: PairProof): HTMLElement {
  const total = Math.max(proof.a.length, proof.b.length, 1);

  const wrap = el('div', { class: 'minimap-wrap' });
  const bar = el('div', {
    class: 'minimap',
    role: 'img',
    'aria-label':
      `File map of ${total.toLocaleString()} bytes: shared prefix ${proof.shared.toLocaleString()} bytes, ` +
      `then ${proof.regions.length} differing region${proof.regions.length === 1 ? '' : 's'} ` +
      `starting at byte ${proof.firstDiff.toLocaleString()}.`
  });

  // Shared-prefix shading from 0 → shared.
  if (proof.shared > 0) {
    const w = (proof.shared / total) * 100;
    bar.append(el('span', { class: 'minimap-shared', style: `left:0;width:${w}%`, title: `shared prefix: ${proof.shared.toLocaleString()} B` }));
  }
  // Differing regions as ticks.
  for (const r of proof.regions) {
    const left = (r.start / total) * 100;
    const w = Math.max(((r.end - r.start) / total) * 100, 0.6);
    bar.append(el('span', { class: 'minimap-diff', style: `left:${left}%;width:${w}%`, title: `differs: bytes ${r.start.toLocaleString()}–${r.end.toLocaleString()}` }));
  }

  wrap.append(bar);
  wrap.append(
    el('p', { class: 'minimap-legend dim' }, [
      el('span', { class: 'swatch swatch-shared' }),
      document.createTextNode(' shared prefix · '),
      el('span', { class: 'swatch swatch-diff' }),
      document.createTextNode(` differing regions · ${total.toLocaleString()} bytes total`)
    ])
  );
  return wrap;
}
