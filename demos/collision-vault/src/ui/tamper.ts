// ONE-BYTE TAMPER EXPERIMENT — flip a single bit in File A or File B and
// recompute the digests. The collision instantly breaks: the broken-hash digests
// no longer match, and the modern hashes change too. Teaches that collision
// files are carefully crafted structures, not a licence to edit freely while
// keeping a digest.

import { ALGORITHMS, type HashAlgorithm } from '../hashing/index';
import type { HashClient } from '../hashing/client';
import { byteToHex, groupHex } from '../util/hex';
import type { PairProof } from '../pairs/proof';
import { el, statusChip, digestRow } from './common';

const RECOMPUTE_ALGOS: HashAlgorithm[] = ['sha-256', 'sha3-256'];

interface OffsetChoice {
  offset: number;
  label: string;
}

function offsetChoices(proof: PairProof): OffsetChoice[] {
  const choices: OffsetChoice[] = [];
  const fd = proof.firstDiff < 0 ? 0 : proof.firstDiff;
  if (proof.shared > 0) {
    choices.push({ offset: Math.floor(proof.shared / 2), label: `byte ${Math.floor(proof.shared / 2)} (inside shared prefix)` });
  }
  choices.push({ offset: fd, label: `byte ${fd} (first difference)` });
  const mid = Math.min(fd + 32, Math.max(proof.a.length, proof.b.length) - 1);
  choices.push({ offset: mid, label: `byte ${mid} (inside crafted block)` });
  return choices;
}

export function renderTamper(proof: PairProof, client: HashClient, vectorsPassed: boolean): HTMLElement {
  const broken = proof.entry.brokenHash;
  const brokenLabel = ALGORITHMS[broken].label;
  const partnerDigest = proof.brokenDigest; // both files share this under the broken hash

  const panel = el('section', { class: 'panel tamper-panel', 'aria-labelledby': 'tamper-title' });
  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'tamper-title', text: '7 · Experiment: flip one bit' }),
      statusChip('neutral', '🧪', 'interactive')
    ]),
    el('p', { class: 'note', text: `The collision works only because every byte was crafted. Flip a single bit in one file and recompute: the ${brokenLabel} collision breaks and the digests diverge.` })
  );

  // ── controls ──────────────────────────────────────────────────────────────
  const controls = el('div', { class: 'tamper-controls' });

  const fileSel = el('select', { class: 'tamper-select', 'aria-label': 'File to tamper' }) as HTMLSelectElement;
  fileSel.append(new Option('File A', 'A'), new Option('File B', 'B'));

  const choices = offsetChoices(proof);
  const offSel = el('select', { class: 'tamper-select', 'aria-label': 'Byte offset to flip' }) as HTMLSelectElement;
  choices.forEach((c, i) => offSel.append(new Option(c.label, String(i))));

  const bitSel = el('select', { class: 'tamper-select', 'aria-label': 'Which bit to flip' }) as HTMLSelectElement;
  for (let i = 0; i < 8; i++) bitSel.append(new Option(`bit ${i}`, String(i)));

  const flipBtn = el('button', { type: 'button', class: 'btn-sm tamper-flip' });
  flipBtn.textContent = 'Flip bit & recompute';
  const resetBtn = el('button', { type: 'button', class: 'btn-sm' });
  resetBtn.textContent = 'Reset';
  resetBtn.disabled = true;

  controls.append(
    labeled('File', fileSel),
    labeled('Offset', offSel),
    labeled('Bit', bitSel),
    flipBtn,
    resetBtn
  );
  panel.append(controls);

  const out = el('div', { class: 'tamper-out', 'aria-live': 'polite' });
  panel.append(out);

  function showOriginal(): void {
    out.replaceChildren(
      el('div', { class: 'tamper-result is-ok' }, [
        statusChip('calm', '✓', 'pristine — collision intact'),
        digestRow(`${brokenLabel}(A) = ${brokenLabel}(B)`, partnerDigest)
      ])
    );
  }
  showOriginal();

  resetBtn.addEventListener('click', () => {
    resetBtn.disabled = true;
    showOriginal();
  });

  flipBtn.addEventListener('click', async () => {
    const which = fileSel.value as 'A' | 'B';
    const source = which === 'A' ? proof.a : proof.b;
    const choice = choices[Number(offSel.value)];
    const bit = Number(bitSel.value);
    const offset = Math.min(choice.offset, source.length - 1);
    const original = source[offset];
    const flipped = original ^ (1 << bit);

    out.replaceChildren(el('p', { class: 'dim', text: 'Recomputing…' }));
    flipBtn.disabled = true;

    const tampered = source.slice();
    tampered[offset] = flipped;

    let res: Partial<Record<HashAlgorithm, string>>;
    try {
      res = await client.hashFile(tampered, [broken, ...RECOMPUTE_ALGOS]);
    } catch (err) {
      out.replaceChildren(el('p', { class: 'dim', text: `Recompute failed: ${(err as Error).message}` }));
      flipBtn.disabled = false;
      return;
    }
    flipBtn.disabled = false;
    resetBtn.disabled = false;

    const newBroken = res[broken] ?? '(error)';
    const stillCollides = newBroken === partnerDigest;

    const partnerName = which === 'A' ? 'B' : 'A';
    const block = el('div', { class: `tamper-result ${stillCollides ? 'is-ok' : 'is-alarm'}` });
    block.append(
      el('p', { class: 'tamper-change' }, [
        document.createTextNode(`Flipped File ${which}, byte ${offset}, bit ${bit}: `),
        el('code', { text: `0x${byteToHex(original)} → 0x${byteToHex(flipped)}` })
      ]),
      stillCollides
        ? statusChip('alarm', '⚠', 'unexpectedly still equal')
        : statusChip('calm', '✓', `collision BROKEN — ${brokenLabel} digests now differ`),
      digestRow(`${brokenLabel}(tampered ${which})`, newBroken),
      digestRow(`${brokenLabel}(untouched ${partnerName})`, partnerDigest)
    );

    // Modern hashes also change vs the pristine file — show one for contrast.
    const s256 = res['sha-256'];
    if (s256) {
      block.append(
        el('p', { class: 'note dim', html: `Modern hashes also change with that single bit — e.g. <code>SHA-256(tampered ${which}) = ${groupHex(s256).slice(0, 36)}…</code>` })
      );
    }
    block.append(
      el('p', { class: 'note', text: vectorsPassed ? 'Takeaway: a collision is a fragile, hand-crafted structure. Change one bit and it’s gone — you cannot freely edit a file and keep its hash.' : '' })
    );

    out.replaceChildren(block);
  });

  return panel;
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'tamper-field' }, [
    el('span', { class: 'tamper-field-label', text: label }),
    control
  ]);
}
