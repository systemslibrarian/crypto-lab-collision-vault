// IDENTICAL-vs-CHOSEN explainer. Uses the SELECTED pair's real, measured bytes
// (shared-prefix length, first-difference offset, crafted-block region) to show
// the structural difference to scale, plus why chosen-prefix is the more
// dangerous result (Flame, rogue CA). Also renders the source citation.

import type { PairProof } from '../pairs/proof';
import { el, fmt, statusChip } from './common';
import { renderCitation } from './citation';

// Both MD5 and SHA-1 attacks append a pair of 64-byte near-collision blocks
// after the prefix. We mark that region from the measured first-difference
// offset; it is an approximation and labelled as such.
const CRAFTED_BLOCK_BYTES = 128;

function evidenceDiagram(proof: PairProof): HTMLElement {
  const total = Math.max(proof.a.length, proof.b.length);
  const prefix = proof.shared;
  const craftedStart = proof.firstDiff < 0 ? prefix : proof.firstDiff;
  const craftedEnd = Math.min(total, craftedStart + CRAFTED_BLOCK_BYTES);
  const segs: Array<{ cls: string; bytes: number; label: string }> = [];

  if (proof.entry.type === 'chosen-prefix') {
    // Two attacker-chosen prefixes (shared = 0): show divergence from byte 0.
    segs.push({ cls: 'sch-chosenA', bytes: Math.max(craftedStart, 1), label: 'chosen prefixes (differ from byte 0)' });
  } else if (prefix > 0) {
    segs.push({ cls: 'sch-shared', bytes: prefix, label: `shared prefix · ${prefix.toLocaleString()} B` });
  }
  segs.push({ cls: 'sch-blocks', bytes: Math.max(craftedEnd - craftedStart, 1), label: `crafted blocks · ~${(craftedEnd - craftedStart).toLocaleString()} B @ 0x${craftedStart.toString(16)}` });
  if (total > craftedEnd) {
    segs.push({ cls: 'sch-tail', bytes: total - craftedEnd, label: `suffix · ${(total - craftedEnd).toLocaleString()} B` });
  }

  const sum = segs.reduce((n, s) => n + s.bytes, 0);
  const bar = el('div', {
    class: 'evbar',
    role: 'img',
    'aria-label':
      `Byte-scale map: ${prefix.toLocaleString()} byte shared prefix, ` +
      `first difference at byte ${proof.firstDiff.toLocaleString()}, crafted block region ~${CRAFTED_BLOCK_BYTES} bytes, total ${total.toLocaleString()} bytes.`
  });
  for (const s of segs) {
    const pct = Math.max((s.bytes / sum) * 100, 2);
    bar.append(el('span', { class: `evseg ${s.cls}`, style: `flex:${pct} 1 0`, title: s.label }, [
      el('span', { class: 'evseg-label', text: s.label })
    ]));
  }

  return el('div', { class: 'evbar-wrap' }, [
    bar,
    el('p', { class: 'sch-caption dim', text: `Measured live from the bundled files: total ${total.toLocaleString()} bytes · first difference at byte ${proof.firstDiff.toLocaleString()} · shared prefix ${prefix.toLocaleString()} bytes. Crafted-block span is approximate.` })
  ]);
}

export function renderExplainer(proof: PairProof): HTMLElement {
  const entry = proof.entry;
  const isChosen = entry.type === 'chosen-prefix';
  const panel = el('section', {
    class: 'panel explainer-panel',
    'aria-labelledby': 'explainer-panel-title'
  });

  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'explainer-panel-title', text: '4 · Identical-prefix vs chosen-prefix' }),
      statusChip(isChosen ? 'alarm' : 'neutral', isChosen ? '⚠' : '◆', `this pair: ${entry.type}`)
    ])
  );

  panel.append(
    el('p', { class: 'note' }, fmt(`Selected pair **“${entry.label}”** is a **${entry.type}** collision. The byte-scale map below is drawn from the real bundled bytes:`)),
    evidenceDiagram(proof)
  );

  const grid = el('div', { class: 'explainer-grid' });
  grid.append(
    el('div', { class: 'explainer-card' }, [
      el('h3', { text: 'Identical-prefix' }),
      el('p', { text: 'Both files must share a common prefix chosen up front; the attacker controls both files from the start. Crafted “near-collision” blocks then drive the internal state back together.' }),
      el('p', { class: 'dim', text: 'Weaker: the attacker can’t target two pre-existing, meaningfully-different documents.' })
    ]),
    el('div', { class: 'explainer-card explainer-card-danger' }, [
      el('h3', {}, [document.createTextNode('Chosen-prefix '), el('span', { class: 'tag-danger', text: 'more dangerous' })]),
      el('p', { text: 'The attacker picks two completely different prefixes — e.g. two distinct certificate identities — and computes blocks that still collide. No shared start required (shared prefix = 0 bytes).' }),
      el('p', {}, fmt('**Real impact:** a rogue CA certificate (2008) and the **Flame** malware (2012), which forged a Microsoft code-signing certificate via a chosen-prefix MD5 collision to spread through Windows Update.'))
    ])
  );
  panel.append(grid);

  panel.append(
    el('p', { class: 'note' }, fmt(`**This pair’s history:** ${entry.history}`)),
    el('p', { class: 'note' }, fmt(`**Why it matters:** ${entry.realWorldImpact}`)),
    renderCitation(entry.source)
  );

  return panel;
}
