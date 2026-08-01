// IDENTICAL-vs-CHOSEN explainer. Uses the SELECTED pair's real, measured bytes
// (shared-prefix length, first-difference offset, crafted-block region) to show
// the structural difference to scale, plus why chosen-prefix is the more
// dangerous result (Flame, rogue CA). Also renders the source citation.
//
// The crafted-block region is not guessed: it is the diverge→converge window
// reported by the independent state trace (hashing/trace.ts), expressed in the
// same 64-byte block numbering the trace table in panel 5 uses. That trace is
// only trusted under the same integrity gate panel 5 applies — its digests must
// reproduce the validated providers' digests. If it cannot be trusted (or the
// broken hash is not one we can trace), the map falls back to the old estimate
// and says so, rather than presenting a guess as a measurement.

import type { PairProof } from '../pairs/proof';
import { compareTraces, type TraceableAlgorithm } from '../hashing/trace';
import { el, fmt, statusChip } from './common';
import { renderCitation } from './citation';

/** Merkle–Damgård block size for MD5 and SHA-1, in bytes. */
const BLOCK_BYTES = 64;

// FALLBACK ONLY. Both MD5 and SHA-1 identical-prefix attacks append a pair of
// 64-byte near-collision blocks, so 128 bytes from the first difference is the
// best guess available when the state trace cannot be trusted. Anything drawn
// from this constant is labelled approximate.
const ESTIMATED_CRAFTED_BYTES = 128;

export interface CraftedRegion {
  /** Byte offset where the crafted-block region starts. */
  start: number;
  /** Byte offset just past the end of the region. */
  end: number;
  /**
   * Block indices from the state trace when the region is measured; null when
   * it is the estimate, which is what drives the "approximate" wording.
   */
  blocks: { from: number; to: number } | null;
}

/**
 * The crafted-block region for this pair, measured where possible.
 *
 * `compareTraces` already computes the exact blocks at which the two internal
 * chaining values split (`divergesAt`) and are forced back together
 * (`convergesAt`) — that window IS the crafted-block region, so there is no
 * reason to estimate it. The trace is only believed under the same cross-check
 * the state-trace panel enforces; every rejection path returns the estimate.
 *
 * Exported (DOM-free) so the measurement and its integrity gate are unit-tested
 * directly rather than through the rendered panel.
 */
export function craftedRegion(proof: PairProof, total: number): CraftedRegion {
  const fallbackStart = proof.firstDiff < 0 ? proof.shared : proof.firstDiff;
  const estimate: CraftedRegion = {
    start: fallbackStart,
    end: Math.min(total, fallbackStart + ESTIMATED_CRAFTED_BYTES),
    blocks: null
  };

  const broken = proof.entry.brokenHash;
  if (broken !== 'md5' && broken !== 'sha-1') return estimate;
  const algo: TraceableAlgorithm = broken;

  try {
    const cmp = compareTraces(algo, proof.a, proof.b);
    // Same integrity gate as panel 5: an independent implementation that cannot
    // reproduce the validated digests is not evidence of anything.
    if (cmp.a.digest !== proof.resA[algo] || cmp.b.digest !== proof.resB[algo]) return estimate;
    if (cmp.divergesAt === -1 || cmp.convergesAt === -1) return estimate;

    const start = cmp.divergesAt * BLOCK_BYTES;
    const end = Math.min(total, (cmp.convergesAt + 1) * BLOCK_BYTES);
    if (end <= start) return estimate;

    return { start, end, blocks: { from: cmp.divergesAt, to: cmp.convergesAt } };
  } catch {
    // A trace that throws is a trace we cannot use; never let it take the panel
    // down with it.
    return estimate;
  }
}

function evidenceDiagram(proof: PairProof): HTMLElement {
  const total = Math.max(proof.a.length, proof.b.length);
  const prefix = proof.shared;
  const region = craftedRegion(proof, total);
  const { start: craftedStart, end: craftedEnd, blocks } = region;
  const span = craftedEnd - craftedStart;
  const segs: Array<{ cls: string; bytes: number; label: string }> = [];

  const chosen = proof.entry.type === 'chosen-prefix';

  if (chosen) {
    // Two attacker-chosen prefixes (shared = 0). Measured, the states differ
    // from block 0, so there is nothing to draw ahead of the window and the
    // chosen prefixes live *inside* it — the trace cannot separate them from
    // the near-collision blocks, and the label must not pretend otherwise.
    if (craftedStart > 0) {
      segs.push({ cls: 'sch-chosenA', bytes: craftedStart, label: `chosen prefixes · ${craftedStart.toLocaleString()} B` });
    } else if (!blocks) {
      segs.push({ cls: 'sch-chosenA', bytes: 1, label: 'chosen prefixes (differ from byte 0)' });
    }
  } else if (blocks ? craftedStart > 0 : prefix > 0) {
    segs.push({
      cls: 'sch-shared',
      bytes: blocks ? craftedStart : prefix,
      label: blocks
        ? `identical blocks 0–${blocks.from - 1} · ${craftedStart.toLocaleString()} B`
        : `shared prefix · ${prefix.toLocaleString()} B`
    });
  }
  segs.push({
    cls: chosen && blocks && craftedStart === 0 ? 'sch-chosenA' : 'sch-blocks',
    bytes: Math.max(span, 1),
    label: blocks
      ? `${chosen && craftedStart === 0 ? 'chosen prefixes + crafted' : 'crafted'} blocks ` +
        `${blocks.from}–${blocks.to} · ${span.toLocaleString()} B`
      : `crafted blocks · ~${span.toLocaleString()} B @ 0x${craftedStart.toString(16)}`
  });
  if (total > craftedEnd) {
    segs.push({ cls: 'sch-tail', bytes: total - craftedEnd, label: `suffix · ${(total - craftedEnd).toLocaleString()} B` });
  }

  const sum = segs.reduce((n, s) => n + s.bytes, 0);
  const bar = el('div', {
    class: 'evbar',
    role: 'img',
    'aria-label':
      `Byte-scale map: ${prefix.toLocaleString()} byte shared prefix, ` +
      `first difference at byte ${proof.firstDiff.toLocaleString()}, ` +
      (blocks
        ? `crafted block region blocks ${blocks.from} to ${blocks.to}, bytes ${craftedStart.toLocaleString()} to ${(craftedEnd - 1).toLocaleString()}, `
        : `crafted block region approximately ${span.toLocaleString()} bytes, `) +
      `total ${total.toLocaleString()} bytes.`
  });
  for (const s of segs) {
    const pct = Math.max((s.bytes / sum) * 100, 2);
    bar.append(el('span', { class: `evseg ${s.cls}`, style: `flex:${pct} 1 0`, title: s.label }, [
      el('span', { class: 'evseg-label', text: s.label })
    ]));
  }

  const measurement = blocks
    ? `Crafted-block span is measured, not estimated: the two internal states diverge at block ` +
      `${blocks.from} and are forced back together at block ${blocks.to} — bytes ` +
      `${craftedStart.toLocaleString()}–${(craftedEnd - 1).toLocaleString()}, the same block numbering as the ` +
      `state-trace table below.`
    : `Crafted-block span is approximate: the independent state trace is unavailable for this pair, ` +
      `so the region is estimated as ${ESTIMATED_CRAFTED_BYTES} bytes from the first difference.`;

  return el('div', { class: 'evbar-wrap' }, [
    bar,
    el('p', {
      class: 'sch-caption dim',
      text:
        `Measured live from the bundled files: total ${total.toLocaleString()} bytes · first difference at byte ` +
        `${proof.firstDiff.toLocaleString()} · shared prefix ${prefix.toLocaleString()} bytes. ${measurement}`
    })
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
