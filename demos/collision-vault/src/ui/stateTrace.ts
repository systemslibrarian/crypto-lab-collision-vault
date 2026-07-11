// INSIDE THE HASH — the mechanism of the attack, made visible. A Merkle–Damgård
// hash processes a file in 64-byte blocks, threading a small internal state
// (the chaining value) from block to block. This panel traces that state for
// BOTH files: watch the two states split apart where the bytes differ, then get
// forced back into the exact same value by the crafted near-collision blocks.
// From that block on the computation is identical, so the digests must match.
//
// The trace comes from an independent re-implementation (hashing/trace.ts) and
// is only displayed if its final digests agree with the validated providers.

import type { PairProof } from '../pairs/proof';
import { ALGORITHMS } from '../hashing/index';
import { compareTraces, type TraceComparison, type TraceableAlgorithm } from '../hashing/trace';
import { el, fmt, statusChip } from './common';

/** How many blocks of context to show around the diverge→converge window. */
const CONTEXT_BLOCKS = 1;

export function renderStateTrace(proof: PairProof): HTMLElement {
  const broken = proof.entry.brokenHash;
  const panel = el('section', {
    class: 'panel trace-panel',
    'aria-labelledby': 'trace-title'
  });
  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'trace-title', text: '5 · Inside the hash: states forced to converge' })
    ])
  );

  if (broken !== 'md5' && broken !== 'sha-1') {
    panel.append(el('p', { class: 'note', text: 'State tracing is available for MD5 and SHA-1 pairs only.' }));
    return panel;
  }
  const algo: TraceableAlgorithm = broken;
  const label = ALGORITHMS[algo].label;

  const cmp = compareTraces(algo, proof.a, proof.b);

  // Cross-check invariant: the traced digests must equal the digests computed
  // by the validated (self-tested) providers, or the trace is not shown.
  const expectA = proof.resA[algo];
  const expectB = proof.resB[algo];
  if (cmp.a.digest !== expectA || cmp.b.digest !== expectB) {
    panel.append(
      el('p', { class: 'note' }, [
        statusChip('alarm', '⚠', 'trace withheld'),
        document.createTextNode(
          ` The independent ${label} trace implementation disagreed with the validated digest, so its output is not shown.`
        )
      ])
    );
    return panel;
  }

  panel.append(
    el(
      'p',
      { class: 'note' },
      fmt(
        `${label} reads a file **64 bytes at a time**, carrying a small internal state (the ` +
          `*chaining value*) from block to block. Below, that state is traced for both files by an ` +
          `independent ${label} implementation, cross-checked against the validated digests above. ` +
          `The crafted near-collision blocks steer the two different states **back into exactly the ` +
          `same value** — from that block on, both computations are identical, so the final digests ` +
          `cannot differ.`
      )
    ),
    summaryLine(proof, cmp),
    buildTable(proof, cmp)
  );
  return panel;
}

function summaryLine(proof: PairProof, cmp: TraceComparison): HTMLElement {
  const { divergesAt, convergesAt } = cmp;
  if (divergesAt === -1 || convergesAt === -1) {
    // Cannot happen for a verified pair (files differ, digests equal) — but
    // never assert what the data doesn't show.
    return el('p', { class: 'note', text: 'The states never diverge and re-converge for this input.' });
  }
  const divergeWhere =
    proof.entry.type === 'chosen-prefix'
      ? `from the very first block — the attacker-chosen prefixes differ from byte 0`
      : `after block ${divergesAt} (${blockRange(divergesAt, proof.a.length)})`;
  return el('p', { class: 'trace-summary' }, [
    statusChip('alarm', '⚠', `states re-converge after block ${convergesAt}`),
    document.createTextNode(' '),
    ...fmt(
      `Measured live: the internal states diverge ${divergeWhere}, then the crafted blocks force ` +
        `them back together after block ${convergesAt}. Every remaining block is processed from an ` +
        `**identical state over identical bytes** — the collision is locked in long before the end of the file.`
    )
  ]);
}

function buildTable(proof: PairProof, cmp: TraceComparison): HTMLElement {
  const { a, b, divergesAt, convergesAt } = cmp;
  const n = Math.max(a.cvs.length, b.cvs.length);
  const last = n - 1;

  // Rows: block 0, the diverge→converge window (± context), and the final
  // block; runs in between collapse into a single "identical states" row.
  const show = new Set<number>([0, last]);
  if (divergesAt !== -1) {
    const from = Math.max(0, divergesAt - CONTEXT_BLOCKS);
    const to = Math.min(last, (convergesAt === -1 ? divergesAt : convergesAt) + CONTEXT_BLOCKS);
    for (let i = from; i <= to; i++) show.add(i);
  }

  // The table scrolls horizontally on narrow screens, so the wrapper must be
  // keyboard-reachable (WCAG 2.1.1 — axe scrollable-region-focusable).
  const wrap = el('div', {
    class: 'trace-wrap',
    role: 'region',
    'aria-label': 'Chaining-value trace table',
    tabindex: '0'
  });
  const table = el('table', { class: 'trace-table' });
  table.append(
    el('caption', { class: 'sr-only', text: 'Chaining value after each processed block, for file A and file B' }),
    el('thead', {}, [
      el('tr', {}, [
        el('th', { scope: 'col', text: 'Block' }),
        el('th', { scope: 'col', text: 'State after block — A' }),
        el('th', { scope: 'col', text: 'State after block — B' }),
        el('th', { scope: 'col', text: 'A vs B' })
      ])
    ])
  );

  const tbody = el('tbody');
  const sorted = [...show].sort((x, y) => x - y);
  let prevShown = -1;
  for (const i of sorted) {
    if (prevShown !== -1 && i > prevShown + 1) {
      const same = a.cvs[prevShown + 1] === b.cvs[prevShown + 1];
      tbody.append(
        el('tr', { class: 'trace-gap' }, [
          el('td', { colspan: '4', text: `⋯ blocks ${prevShown + 1}–${i - 1}: states ${same ? 'identical' : 'differ'} ⋯` })
        ])
      );
    }
    tbody.append(traceRow(i, proof, cmp, last));
    prevShown = i;
  }
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

function traceRow(i: number, proof: PairProof, cmp: TraceComparison, last: number): HTMLElement {
  const { a, b, divergesAt, convergesAt } = cmp;
  const cvA = a.cvs[i] ?? '';
  const cvB = b.cvs[i] ?? '';
  const same = cvA === cvB && cvA !== '';
  const isConvergeRow = i === convergesAt && divergesAt !== -1;

  let chip: HTMLElement;
  if (isConvergeRow) chip = statusChip('alarm', '⚠', 'RE-CONVERGED');
  else if (i === last && same) chip = statusChip('alarm', '=', 'same digest');
  else if (same) chip = statusChip('neutral', '=', 'same');
  else chip = statusChip('neutral', '≠', 'differ');

  const blockCell = el('th', { scope: 'row' }, [
    el('span', { class: 'trace-block', text: i === last ? `${i} (final)` : String(i) }),
    el('span', { class: 'trace-range dim', text: blockRange(i, Math.max(proof.a.length, proof.b.length)) })
  ]);

  return el('tr', { class: isConvergeRow ? 'trace-converge' : undefined }, [
    blockCell,
    cvCell(cvA, same),
    cvCell(cvB, same),
    el('td', {}, [chip])
  ]);
}

function cvCell(cv: string, same: boolean): HTMLElement {
  const shortened = cv.length > 16 ? `${cv.slice(0, 16)}…` : cv;
  return el('td', {}, [
    el('code', {
      class: `trace-cv ${same ? '' : 'trace-cv-diff'}`,
      title: cv,
      'aria-label': cv,
      text: shortened
    })
  ]);
}

function blockRange(i: number, fileLen: number): string {
  const start = i * 64;
  if (start >= fileLen) return 'padding';
  return `bytes ${start.toLocaleString()}–${Math.min(start + 63, fileLen - 1).toLocaleString()}`;
}
