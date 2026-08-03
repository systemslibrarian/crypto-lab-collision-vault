// 9 · MINT YOUR OWN COLLIDING PAIR — the learner-driven forgery.
//
// Section 8 flips one bit and the collision dies, which is easy to over-read as
// "collisions are fragile, so a published pair is a museum piece". This panel is
// the correction. Because the two files reach the same chaining value and then
// run over identical bytes (measured in section 5), ANY bytes appended to both
// halves are absorbed identically, so the digests stay equal. The learner types
// whatever they like, presses the button, and gets two files that have never
// existed before sharing one digest — for free, using someone else's 2^63 work.
//
// Nothing here is asserted. The three structural preconditions are measured from
// the bytes, a prediction is derived from them, the digests are then computed by
// the same validated hashing client the rest of the page uses, and the verdict
// is a pure function of the prediction and the measurement — including the case
// where they disagree.

import { ALGORITHMS, type HashAlgorithm } from '../hashing/index';
import type { HashClient } from '../hashing/client';
import { extensionPrecondition, type ExtensionPrecondition } from '../hashing/trace';
import type { PairProof } from '../pairs/proof';
import {
  concatBytes,
  extensionVerdict,
  planExtension,
  predictionReason,
  type ExtendMode
} from '../pairs/extend';
import { el, fmt, statusChip, digestRow } from './common';

const DEFAULT_SUFFIX =
  '\n%% appended in your browser — no collision search required\n' +
  'I hereby authorise the transfer of $1,000,000 to Eve.\n';

const MODES: Array<{ value: ExtendMode; label: string }> = [
  { value: 'same', label: 'Same bytes on both halves (the attacker’s move)' },
  { value: 'differ', label: 'Different bytes on File B' },
  { value: 'a-only', label: 'Append to File A only' }
];

export function renderExtend(proof: PairProof, client: HashClient): HTMLElement {
  const broken = proof.entry.brokenHash;
  const brokenLabel = ALGORITHMS[broken].label;

  const panel = el('section', { class: 'panel extend-panel', 'aria-labelledby': 'extend-title' });
  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'extend-title', text: '9 · Mint your own colliding pair' }),
      statusChip('neutral', '🧪', 'interactive')
    ]),
    el('p', { class: 'note' }, fmt(
      `Section 8 shows a collision dying from one flipped bit, which makes it easy to conclude that a ` +
        `published pair is a museum piece. It is not. Whatever you append to **both** halves is absorbed ` +
        `from the same internal state over the same bytes, so the digests stay equal — you get a ` +
        `**brand-new colliding pair carrying your content**, with none of the compute that found the ` +
        `original. This is the assembly step behind the SHAttered PDFs and the Flame certificate.`
    ))
  );

  if (broken !== 'md5' && broken !== 'sha-1') {
    panel.append(el('p', { class: 'note', text: 'Extension analysis is available for MD5 and SHA-1 pairs only.' }));
    return panel;
  }

  const pre = extensionPrecondition(broken, proof.a, proof.b);
  panel.append(preconditionBlock(pre, brokenLabel));

  // ── controls ──────────────────────────────────────────────────────────────
  const modeSel = el('select', { class: 'tamper-select', 'aria-label': 'What to append' }) as HTMLSelectElement;
  for (const m of MODES) modeSel.append(new Option(m.label, m.value));

  const taA = el('textarea', {
    class: 'extend-text',
    id: 'extend-suffix-a',
    rows: '3',
    spellcheck: 'false'
  }) as HTMLTextAreaElement;
  taA.value = DEFAULT_SUFFIX;

  const taB = el('textarea', {
    class: 'extend-text',
    id: 'extend-suffix-b',
    rows: '3',
    spellcheck: 'false'
  }) as HTMLTextAreaElement;
  taB.value = DEFAULT_SUFFIX.replace('Eve', 'Bob');

  const fieldB = el('label', { class: 'extend-field', hidden: true }, [
    el('span', { class: 'tamper-field-label', text: 'Bytes appended to File B' }),
    taB
  ]);

  const labelA = el('span', { class: 'tamper-field-label', text: 'Bytes appended to BOTH files' });
  const fieldA = el('label', { class: 'extend-field' }, [labelA, taA]);

  modeSel.addEventListener('change', () => {
    const mode = modeSel.value as ExtendMode;
    fieldB.hidden = mode !== 'differ';
    labelA.textContent = mode === 'same' ? 'Bytes appended to BOTH files' : 'Bytes appended to File A';
  });

  const runBtn = el('button', { type: 'button', class: 'btn-sm extend-run' });
  runBtn.textContent = 'Append & recompute';

  panel.append(
    el('div', { class: 'tamper-controls extend-controls' }, [
      el('label', { class: 'tamper-field' }, [
        el('span', { class: 'tamper-field-label', text: 'Mode' }),
        modeSel
      ]),
      runBtn
    ]),
    fieldA,
    fieldB
  );

  const out = el('div', { class: 'tamper-out extend-out', 'aria-live': 'polite' });
  out.append(
    el('p', { class: 'dim', text: 'Nothing appended yet — the pair below is still the published one.' })
  );
  panel.append(out);

  runBtn.addEventListener('click', async () => {
    const mode = modeSel.value as ExtendMode;
    const plan = planExtension(mode, taA.value, taB.value);
    const newA = concatBytes(proof.a, plan.suffixA);
    const newB = concatBytes(proof.b, plan.suffixB);

    out.replaceChildren(el('p', { class: 'dim', text: 'Hashing the two extended files…' }));
    runBtn.disabled = true;

    let dA: string | undefined;
    let dB: string | undefined;
    try {
      const [rA, rB] = await Promise.all([
        client.hashFile(newA, [broken] as HashAlgorithm[]),
        client.hashFile(newB, [broken] as HashAlgorithm[])
      ]);
      dA = rA[broken];
      dB = rB[broken];
    } catch (err) {
      out.replaceChildren(el('p', { class: 'dim', text: `Recompute failed: ${(err as Error).message}` }));
      runBtn.disabled = false;
      return;
    }
    runBtn.disabled = false;

    if (!dA || !dB) {
      out.replaceChildren(el('p', { class: 'dim', text: 'Recompute returned no digest; nothing is shown.' }));
      return;
    }

    const measuredEqual = dA === dB;
    const verdict = extensionVerdict(pre.holds, plan.suffixesIdentical, measuredEqual);
    const isNewPair = dA !== proof.brokenDigest;

    const kind =
      verdict.outcome === 'survives' ? 'is-alarm' : verdict.outcome === 'broken' ? 'is-ok' : 'is-alarm';
    const block = el('div', { class: `tamper-result extend-result ${kind}` });

    block.append(
      el('p', { class: 'extend-sizes' }, fmt(
        `Appended **${plan.suffixA.length}** bytes to File A and **${plan.suffixB.length}** to File B. ` +
          `New sizes: ${newA.length.toLocaleString()} B and ${newB.length.toLocaleString()} B.`
      )),
      el('p', { class: 'extend-prediction' }, fmt(
        `Predicted before hashing: digests **${verdict.predictedEqual ? 'equal' : 'differ'}**, because ` +
          `${predictionReason(pre.holds, plan.suffixesIdentical)}.`
      )),
      verdict.outcome === 'survives'
        ? statusChip('alarm', '⚠', verdict.headline)
        : verdict.outcome === 'broken'
          ? statusChip('calm', '✓', verdict.headline)
          : statusChip('alarm', '⚠', verdict.headline),
      digestRow(`${brokenLabel}(A ‖ suffix)`, dA),
      digestRow(`${brokenLabel}(B ‖ suffix)`, dB)
    );

    if (verdict.outcome === 'survives') {
      block.append(
        el('p', { class: 'note extend-newness' }, fmt(
          isNewPair
            ? `And it is a **different digest from the published pair** (\`${proof.brokenDigest.slice(0, 16)}…\`), ` +
                `so this is a collision that did not exist before you pressed the button — not a replay of the ` +
                `bundled one. The cost to you was one ${brokenLabel} pass over ${newA.length.toLocaleString()} bytes.`
            : `The digest is unchanged from the published pair (\`${proof.brokenDigest.slice(0, 16)}…\`), which ` +
                `means nothing was actually appended.`
        ))
      );
    } else if (verdict.outcome === 'broken') {
      block.append(
        el('p', { class: 'note', text: !plan.suffixesIdentical
          ? 'The two halves stopped receiving identical bytes, so from the first appended block they are compressing different inputs from the same state — and the digests part. The suffix has to be shared; that is the whole constraint on the attacker.'
          : 'The measured digests differ, matching the failed precondition above: this pair is not suffix-closed, so nothing can be appended to it safely.' })
      );
    } else {
      block.append(
        el('p', { class: 'note', text: 'The structural argument and the measured digests disagree. That is a defect in this page, not a lesson — the digests shown above are what was actually computed; trust those.' })
      );
    }

    out.replaceChildren(block);
  });

  panel.append(
    el('p', { class: 'note dim' }, fmt(
      `Not to be confused with the *length-extension* attack, which forges \`H(secret‖m‖pad‖ext)\` from ` +
        `\`H(secret‖m)\` without knowing the secret (see Babel Hash / MAC Race). Here nothing is secret and ` +
        `the full messages are in hand — the Merkle–Damgård structure is simply being used to grow a ` +
        `collision that already exists.`
    ))
  );

  return panel;
}

/** The three measured conditions, each with the number it was decided from. */
function preconditionBlock(pre: ExtensionPrecondition, brokenLabel: string): HTMLElement {
  const rows: Array<[boolean, string]> = [
    [pre.sameLength, `Both files are the same length (${pre.fullBlocks} complete 64-byte blocks + ${pre.tailBytes} tail bytes)`],
    [
      pre.stateEqualAfterFullBlocks,
      pre.fullBlocks === 0
        ? 'No complete blocks absorbed yet, so both files are still at the initialisation vector'
        : `Un-padded ${brokenLabel} chaining values agree after block ${pre.fullBlocks - 1}` +
          (pre.rawConvergesAt >= 0 ? ` (they first agree for good at block ${pre.rawConvergesAt})` : '')
    ],
    [pre.tailEqual, `The ${pre.tailBytes} bytes past the last complete block are identical in A and B`]
  ];

  const list = el('ul', { class: 'extend-checks' });
  for (const [ok, text] of rows) {
    list.append(
      el('li', { class: ok ? 'extend-check pass' : 'extend-check fail' }, [
        statusChip(ok ? 'calm' : 'neutral', ok ? '✓' : '✕', ok ? 'holds' : 'fails'),
        document.createTextNode(' '),
        document.createTextNode(text)
      ])
    );
  }

  return el('div', { class: 'extend-precondition' }, [
    el('p', { class: 'note' }, fmt(
      `Measured from the bytes, before anything is appended — the three conditions that make this pair ` +
        `*suffix-closed*, i.e. safe for an attacker to build on:`
    )),
    list,
    el('p', { class: 'extend-verdict-pre' }, [
      pre.holds
        ? statusChip('alarm', '⚠', 'suffix-closed — anything appended to both halves keeps colliding')
        : statusChip('calm', '✓', 'not suffix-closed — this pair cannot be extended')
    ])
  ]);
}
