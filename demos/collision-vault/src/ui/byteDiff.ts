// Byte-diff viewer: makes "these two files really are different bytes" concrete.
// Renders a windowed hex dump of A and B with differing bytes highlighted and
// the shared-prefix region marked. Large files (the ~400 KB PDFs) are shown a
// window at a time with region navigation, so the DOM never tries to paint
// hundreds of thousands of cells.

import { byteToHex, isPrintable, sharedPrefixLength, diffRegions, firstDifferenceOffset } from '../util/hex';
import { el } from './common';

const BYTES_PER_ROW = 16;
const WINDOW_ROWS = 24;
const WINDOW_BYTES = BYTES_PER_ROW * WINDOW_ROWS;

export interface ByteDiffHandle {
  element: HTMLElement;
}

export function createByteDiff(a: Uint8Array, b: Uint8Array): ByteDiffHandle {
  const total = Math.max(a.length, b.length);
  const shared = sharedPrefixLength(a, b);
  const firstDiff = firstDifferenceOffset(a, b);
  const regions = diffRegions(a, b);

  const root = document.createElement('div');
  root.className = 'bytediff';

  // ── summary line ───────────────────────────────────────────────────────
  const summary = document.createElement('p');
  summary.className = 'bytediff-summary';
  summary.append(
    el('strong', { text: a.length.toLocaleString() }),
    ' vs ',
    el('strong', { text: b.length.toLocaleString() }),
    ' bytes · shared prefix ',
    el('strong', { text: shared.toLocaleString() }),
    ' bytes · ',
    el('strong', { text: String(regions.length) }),
    ` differing region${regions.length === 1 ? '' : 's'}`
  );
  root.appendChild(summary);

  // ── controls ───────────────────────────────────────────────────────────
  const controls = document.createElement('div');
  controls.className = 'bytediff-controls';

  const mkBtn = (label: string, title: string) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-sm';
    btn.textContent = label;
    btn.title = title;
    return btn;
  };

  const toPrefix = mkBtn('⟦ Shared prefix', 'Jump to the start of the files (shared prefix region)');
  const toDiff = mkBtn('First difference ⮕', 'Jump to the first byte where A and B differ');
  const prevRegion = mkBtn('◀ Prev region', 'Previous differing region');
  const nextRegion = mkBtn('Next region ▶', 'Next differing region');
  const posLabel = document.createElement('span');
  posLabel.className = 'bytediff-pos';
  posLabel.setAttribute('aria-live', 'polite');

  controls.append(toPrefix, toDiff, prevRegion, nextRegion, posLabel);
  root.appendChild(controls);

  // ── mobile A|B toggle (hidden on wide screens via CSS) ──────────────────
  // Toggle buttons (aria-pressed), not a tablist: a full tab pattern would also
  // need roving focus + arrow keys, and the panels are plain hex dumps. A polite
  // live region announces the switch, since the swap happens out of focus order.
  const toggle = document.createElement('div');
  toggle.className = 'bytediff-toggle';
  toggle.setAttribute('role', 'group');
  toggle.setAttribute('aria-label', 'Choose which file to view');
  const showA = mkBtn('File A', 'Show file A');
  const showB = mkBtn('File B', 'Show file B');
  const toggleAnnounce = el('span', { class: 'sr-only', 'aria-live': 'polite' });
  toggle.append(showA, showB, toggleAnnounce);
  root.appendChild(toggle);

  // ── hex panels ──────────────────────────────────────────────────────────
  const panels = document.createElement('div');
  panels.className = 'bytediff-panels';
  panels.dataset.active = 'A';

  const panelA = makePanel('A', 'File A');
  const panelB = makePanel('B', 'File B');
  panels.append(panelA.wrap, panelB.wrap);
  root.appendChild(panels);

  const legend = document.createElement('p');
  legend.className = 'bytediff-legend';
  legend.append(
    el('span', { class: 'swatch swatch-shared', 'aria-hidden': 'true' }),
    ' shared prefix   ',
    el('span', { class: 'swatch swatch-diff', 'aria-hidden': 'true' }),
    ' differing byte   ',
    el('span', { class: 'dim', text: '·· = beyond end of file · non-printable shown as “.”' })
  );
  root.appendChild(legend);

  // ── state ────────────────────────────────────────────────────────────────
  let winStart = 0;
  let regionIdx = -1;

  function clampStart(s: number): number {
    const maxStart = Math.max(0, total - WINDOW_BYTES);
    return Math.min(Math.max(0, Math.floor(s / BYTES_PER_ROW) * BYTES_PER_ROW), maxStart);
  }

  function render(): void {
    const start = winStart;
    const end = Math.min(total, start + WINDOW_BYTES);
    renderRows(panelA.body, a, b, start, end, 'A');
    renderRows(panelB.body, a, b, start, end, 'B');
    const endShown = end.toLocaleString();
    posLabel.textContent = `offset 0x${start.toString(16)} – showing bytes ${start.toLocaleString()}–${endShown} of ${total.toLocaleString()}`;
    prevRegion.disabled = regions.length === 0;
    nextRegion.disabled = regions.length === 0;
    toDiff.disabled = firstDiff < 0;
  }

  toPrefix.addEventListener('click', () => {
    winStart = 0;
    regionIdx = -1;
    render();
  });
  toDiff.addEventListener('click', () => {
    if (firstDiff < 0) return;
    winStart = clampStart(firstDiff - BYTES_PER_ROW * 2);
    render();
  });
  nextRegion.addEventListener('click', () => {
    if (!regions.length) return;
    regionIdx = (regionIdx + 1) % regions.length;
    winStart = clampStart(regions[regionIdx].start - BYTES_PER_ROW);
    render();
  });
  prevRegion.addEventListener('click', () => {
    if (!regions.length) return;
    regionIdx = (regionIdx - 1 + regions.length) % regions.length;
    winStart = clampStart(regions[regionIdx].start - BYTES_PER_ROW);
    render();
  });

  function selectFile(which: 'A' | 'B', announce = false): void {
    panels.dataset.active = which;
    showA.setAttribute('aria-pressed', String(which === 'A'));
    showB.setAttribute('aria-pressed', String(which === 'B'));
    if (announce) toggleAnnounce.textContent = `Showing hex dump of File ${which}`;
  }
  showA.addEventListener('click', () => selectFile('A', true));
  showB.addEventListener('click', () => selectFile('B', true));
  selectFile('A');

  // Start focused on the first difference when there is one.
  if (firstDiff >= 0) winStart = clampStart(firstDiff - BYTES_PER_ROW * 2);
  render();

  return { element: root };
}

interface Panel {
  wrap: HTMLElement;
  body: HTMLElement;
}

function makePanel(side: 'A' | 'B', label: string): Panel {
  const wrap = document.createElement('div');
  wrap.className = 'hexpanel';
  wrap.dataset.side = side;

  const head = document.createElement('div');
  head.className = 'hexpanel-head';
  const name = document.createElement('span');
  name.className = 'hexpanel-name';
  name.textContent = label;
  head.appendChild(name);
  wrap.appendChild(head);

  const body = document.createElement('div');
  body.className = 'hexpanel-body';
  // A named region, NOT role="img": this element is focusable and scrollable,
  // so presenting it to AT as a static image would contradict its behaviour.
  body.setAttribute('role', 'region');
  body.setAttribute('aria-label', `Hex dump of ${label}`);
  body.tabIndex = 0;
  wrap.appendChild(body);

  return { wrap, body };
}

function renderRows(
  body: HTMLElement,
  a: Uint8Array,
  b: Uint8Array,
  start: number,
  end: number,
  side: 'A' | 'B'
): void {
  const data = side === 'A' ? a : b;
  const frag = document.createDocumentFragment();

  for (let off = start; off < end; off += BYTES_PER_ROW) {
    const row = document.createElement('div');
    row.className = 'hexrow';

    const offCell = document.createElement('span');
    offCell.className = 'hexoff';
    offCell.textContent = off.toString(16).padStart(8, '0');
    row.appendChild(offCell);

    const hex = document.createElement('span');
    hex.className = 'hexbytes';
    const ascii = document.createElement('span');
    ascii.className = 'hexascii';

    for (let j = 0; j < BYTES_PER_ROW; j++) {
      const k = off + j;
      const cell = document.createElement('span');
      cell.className = 'hb';
      if (k < data.length) {
        cell.textContent = byteToHex(data[k]);
        // Differs if the OTHER file disagrees at this index (length-aware).
        const differs = a[k] !== b[k];
        if (differs) cell.classList.add('diff');
        else if (k < sharedRegion(a, b)) cell.classList.add('shared');
      } else {
        cell.textContent = '··';
        cell.classList.add('void');
      }
      hex.appendChild(cell);

      const ch = document.createElement('span');
      ch.className = 'ac';
      if (k < data.length) {
        ch.textContent = isPrintable(data[k]) ? String.fromCharCode(data[k]) : '.';
        if (a[k] !== b[k]) ch.classList.add('diff');
      } else {
        ch.textContent = ' ';
      }
      ascii.appendChild(ch);
    }

    row.append(hex, ascii);
    frag.appendChild(row);
  }

  body.replaceChildren(frag);
}

// Memoised shared-prefix length so renderRows doesn't recompute per byte.
let _sharedCacheA: Uint8Array | null = null;
let _sharedCacheB: Uint8Array | null = null;
let _sharedCacheVal = 0;
function sharedRegion(a: Uint8Array, b: Uint8Array): number {
  if (a !== _sharedCacheA || b !== _sharedCacheB) {
    _sharedCacheA = a;
    _sharedCacheB = b;
    _sharedCacheVal = sharedPrefixLength(a, b);
  }
  return _sharedCacheVal;
}
