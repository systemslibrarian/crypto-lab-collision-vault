/* The Neulaser exhibit: a 2026 collision that comes from a state update that is
 * not injective, set beside the MD5 and SHA-1 pairs above.
 *
 * Every value shown is computed in the browser by `neulaser.ts`. The published
 * figures in `neulaser-vectors.json` are used only to compare against.
 */
import published from './neulaser-vectors.json';
import {
  COLLIDING_WORDS,
  NEULASER_VARIANTS,
  NEULASER_VARIANT_LIST,
  corollary3Message,
  firstFeedbackRepeat,
  hexWord,
  neulaserHash,
  oneWordFeedback,
  oneWordLinearTerm,
  traceF,
  traceMerge,
  type NeulaserVariant
} from './neulaser';
import { el } from '../ui/common';
import { bytesToHex } from '../util/hex';

/** The search stops at the first repeat; this bound only guards against a
 *  broken build looping for ever. It is six times the published count. */
const SEARCH_LIMIT = 1 << 20;

const link = (href: string, text: string): HTMLAnchorElement =>
  el('a', { href, target: '_blank', rel: 'noopener noreferrer', text });

function feedbackTable(): { table: HTMLTableElement; equal: boolean; value: string } {
  const inputs = [COLLIDING_WORDS.a, COLLIDING_WORDS.b];
  const traces = inputs.map((x) => traceF(0, 0, 0, x));
  const linear = inputs.map((x) => oneWordLinearTerm(x));
  const feedback = inputs.map((x) => oneWordFeedback(x));
  const rows: Array<[string, number[]]> = [
    ['U_F', traces.map((t) => t.uF)],
    ['V_F', traces.map((t) => t.vF)],
    ['L1(U_F)', traces.map((t) => t.l1)],
    ['L2(V_F)', traces.map((t) => t.l2)],
    ['S(L1(U_F))', traces.map((t) => t.sL1)],
    ['S(L2(V_F))', traces.map((t) => t.sL2)],
    ['F(0, 0, 0, x)', traces.map((t) => t.f)],
    ['8193·x mod p', linear],
    ['Feedback: (8193·x + F) mod p', feedback]
  ];
  const body = el('tbody');
  for (const [label, values] of rows) {
    body.append(
      el('tr', {}, [
        el('th', { scope: 'row', text: label }),
        ...values.map((v) => el('td', { text: hexWord(v) }))
      ])
    );
  }
  const table = el('table', { class: 'neulaser-table', id: 'neulaser-feedback-table' }, [
    el('caption', { text: 'Intermediate words (hexadecimal)' }),
    el('thead', {}, [
      el('tr', {}, [
        el('th', { scope: 'col', text: 'Quantity' }),
        ...inputs.map((x) => el('th', { scope: 'col', text: `x = ${hexWord(x)}` }))
      ])
    ]),
    body
  ]);
  return { table, equal: feedback[0] === feedback[1], value: hexWord(feedback[0]) };
}

function stateTable(
  modules: number,
  rows: Array<[string, Uint32Array, Uint32Array | null]>
): HTMLTableElement {
  const base = (modules - 1) * 16;
  const head = el('tr', {}, [el('th', { scope: 'col', text: 'Word' })]);
  for (const [label] of rows) head.append(el('th', { scope: 'col', text: label }));
  const body = el('tbody');
  for (let position = 0; position < 16; position++) {
    const tr = el('tr', {}, [el('th', { scope: 'row', text: `s${position}` })]);
    for (const [, state, other] of rows) {
      const differs = other !== null && state[base + position] !== other[base + position];
      // The marker is text, so the difference is not carried by colour alone.
      tr.append(
        el('td', { class: differs ? 'neulaser-differs' : undefined }, [
          hexWord(state[base + position]) + (differs ? ' ≠' : '')
        ])
      );
    }
    body.append(tr);
  }
  return el('table', { class: 'neulaser-table' }, [
    el('caption', { text: `Module ${modules - 1}, before and after` }),
    el('thead', {}, [head]),
    body
  ]);
}

export function mountNeulaser(host: HTMLElement): void {
  const feedback = feedbackTable();

  const searchButton = el('button', {
    type: 'button',
    class: 'btn-sm',
    id: 'neulaser-search',
    text: 'Search x = 0, 1, 2, … for the first repeated feedback'
  });
  const searchResult = el('p', {
    id: 'neulaser-search-result',
    role: 'status',
    'aria-live': 'polite',
    text: 'Not run yet.'
  });
  searchButton.addEventListener('click', () => {
    const repeat = firstFeedbackRepeat(SEARCH_LIMIT);
    searchResult.textContent = repeat
      ? `First repeat: x = ${hexWord(repeat.later)} gives feedback ${hexWord(repeat.feedback)}, the same as the earlier input x = ${hexWord(repeat.earlier)}. Found after ${repeat.evaluations.toLocaleString('en-US')} feedback evaluations.`
      : `No repeat in the first ${SEARCH_LIMIT.toLocaleString('en-US')} inputs. This build does not reproduce the published search.`;
  });

  const variantSelect = el('select', { id: 'neulaser-variant' });
  for (const n of NEULASER_VARIANT_LIST) {
    variantSelect.append(el('option', { value: String(n), text: `Neulaser-${n}` }));
  }
  const flip = el('input', { type: 'checkbox', id: 'neulaser-flip' });
  const flipByte = el('input', {
    type: 'number',
    id: 'neulaser-flip-byte',
    min: 0,
    step: 1,
    value: 0,
    inputmode: 'numeric'
  });

  const mergeBefore = el('p', { id: 'neulaser-merge-before' });
  const mergeAfter = el('p', { id: 'neulaser-merge-after' });
  const stateHost = el('div', {
    class: 'neulaser-scroll',
    id: 'neulaser-state',
    role: 'region',
    'aria-label': 'Last-module state words',
    tabindex: 0
  });
  const digestA = el('dd', { id: 'neulaser-digest-a' });
  const digestB = el('dd', { id: 'neulaser-digest-b' });
  const digestPublished = el('dd', { id: 'neulaser-digest-published' });
  const verdict = el('p', { id: 'neulaser-verdict', role: 'status', 'aria-live': 'polite' });
  const messageA = el('pre', { id: 'neulaser-message-a' });
  const messageB = el('pre', { id: 'neulaser-message-b' });
  const flipNote = el('p', { id: 'neulaser-flip-note', class: 'note' });

  const describe = (indices: number[], total: number): string => {
    if (indices.length === 0) return `0 of ${total} state words differ.`;
    const where = indices
      .slice(0, 4)
      .map((i) => `module ${Math.floor(i / 16)}, word s${i % 16}`)
      .join('; ');
    const more = indices.length > 4 ? '; …' : '';
    return `${indices.length} of ${total} state words differ (${where}${more}).`;
  };

  const update = (): void => {
    const n = Number(variantSelect.value) as NeulaserVariant;
    const { modules, blockBytes, lastModuleOffset } = NEULASER_VARIANTS[n];
    flipByte.max = String(blockBytes - 1);
    const requested = Number(flipByte.value);
    const byte = Number.isInteger(requested) ? Math.min(Math.max(requested, 0), blockBytes - 1) : 0;

    const a = corollary3Message(n, COLLIDING_WORDS.a);
    const b = corollary3Message(n, COLLIDING_WORDS.b);
    if (flip.checked) b[byte] ^= 0x01;

    const trace = traceMerge(n, a, b);
    mergeBefore.textContent = `Before the update: ${describe(trace.differBefore, 16 * modules)}`;
    mergeAfter.textContent = `After one update: ${describe(trace.differAfter, 16 * modules)}`;
    stateHost.replaceChildren(
      stateTable(modules, [
        ['A, before', trace.beforeA, trace.beforeB],
        ['B, before', trace.beforeB, trace.beforeA],
        ['A, after', trace.afterA, trace.afterB],
        ['B, after', trace.afterB, trace.afterA]
      ])
    );

    const hashA = bytesToHex(neulaserHash(n, a));
    const hashB = bytesToHex(neulaserHash(n, b));
    const expected = published.publishedDigests[n];
    digestA.textContent = hashA;
    digestB.textContent = hashB;
    digestPublished.textContent = expected;
    messageA.textContent = bytesToHex(a);
    messageB.textContent = bytesToHex(b);
    flipNote.textContent = flip.checked
      ? `Control active: bit 0 of byte ${byte} of message B is flipped. Message A is unchanged.`
      : `Control off: these are the published messages, a ${blockBytes}-byte zero block with one 32-bit word at byte offset ${lastModuleOffset}.`;

    if (!flip.checked && hashA === hashB && hashA === expected) {
      verdict.textContent = `Verified: two different ${blockBytes}-byte messages, one Neulaser-${n} digest, equal to the digest published in Appendix A.2 of the analysis.`;
    } else if (hashA !== hashB) {
      verdict.textContent = flip.checked
        ? 'Negative control: the digests differ. With one bit changed in one message the two states no longer merge.'
        : 'Verification failed: the published messages gave different digests in this build.';
    } else {
      verdict.textContent = 'Verification failed: this is not the published result.';
    }
  };
  for (const control of [variantSelect, flip, flipByte]) control.addEventListener('change', update);

  host.replaceChildren(
    el('h2', { id: 'neulaser-heading', text: 'A 2026 collision where two states merge: Neulaser' }),
    el('p', { class: 'neulaser-status', id: 'neulaser-status' }, [
      el('strong', { text: 'Status. ' }),
      'As of November 2026, NGCC is in its first round; the ICCS proposal pages list Round 1 candidates only (checked 18 November 2026). Neulaser is a first-round candidate. It is not a standard and nothing deployed relies on it. Candidates can be revised between rounds; this exhibit is about Neulaser v2, specification dated 30 June 2026.'
    ]),
    el('p', {}, [
      'Neulaser is one of the 35 hash functions published on 20 September 2026 as first-round candidates in NGCC, the open competition run by China’s Institute of Commercial Cryptography Standards (ICCS) on the same model as NIST’s. Two days later a collision was reported on the ICCS hash forum and written up in ',
      link(published.analysis.eprint, 'Yuan, Wu, Wei, Shen, Liu and Zhang, “Structural Analysis of Seven Hash Functions Submitted to the NGCC”'),
      ', Section 4 and Appendix A; the public tracker records it as ',
      link(published.analysis.tracker, 'finding hash-21-1'),
      '. Early findings are what an open first round is for. NIST’s rounds lost candidates the same way.'
    ]),
    el('p', {}, [
      el('strong', { text: 'A different mechanism from the pairs above. ' }),
      'In the MD5 and SHA-1 pairs the two files’ chaining values differ for a while, and carefully crafted blocks steer them back together along a differential path. Nothing is steered here. Neulaser’s state update is not injective: one word of the state reaches the next state only through a single feedback value, and two different words give the same feedback value. After one update the two states are the same state, so every later round and the digest are identical.'
    ]),

    el('h3', { text: 'Step 1 · Two inputs, one feedback value' }),
    el('p', {}, [
      'Each 16-word module computes a feedback word from its own state. For a module that is zero except for its first word x, that feedback is f(x) = (8193·x + F(0, 0, 0, x)) mod p, with p = 4294967291 = 2³² − 5. The search below evaluates f on x = 0, 1, 2, … and stops at the first value it has seen before.'
    ]),
    searchButton,
    searchResult,
    el('p', {
      class: 'note',
      text: 'The table recomputes, for the two inputs the search finds, every intermediate word of F and the two terms of the feedback.'
    }),
    el('div', { class: 'neulaser-scroll', role: 'region', 'aria-label': 'Feedback intermediate words', tabindex: 0 }, [
      feedback.table
    ]),
    el('p', {
      id: 'neulaser-feedback-verdict',
      text: feedback.equal
        ? `Both inputs give the feedback ${feedback.value}. The change in the linear term is cancelled by the change in F.`
        : 'The two inputs gave different feedback values in this build; the published table is not reproduced.'
    }),

    el('h3', { text: 'Step 2 · One update merges the two states' }),
    el('p', {}, [
      'The hash loads its chaining value and one message block straight into the state. The two messages below are a zero block with one 32-bit word, placed so that it lands in the first word of the last module. That word is not read by anything else in the update: the shift copies words 1 to 15, and the cross-module mixing reads only words 14, 9, 6 and 1.'
    ]),
    el('label', { for: 'neulaser-variant', text: 'Variant' }),
    variantSelect,
    mergeBefore,
    mergeAfter,
    el('p', {
      class: 'note',
      text: 'The table shows the last module of each state, before and after one update. A word marked ≠ differs between the two messages.'
    }),
    stateHost,

    el('h3', { text: 'Step 3 · The full hash, all rounds' }),
    el('p', {}, [
      'Both messages are now hashed completely: the prescribed IV, all 32 blank rounds, the output rounds, and the padding block.'
    ]),
    verdict,
    el('dl', { class: 'neulaser-values' }, [
      el('dt', { text: 'Digest of message A (computed)' }),
      digestA,
      el('dt', { text: 'Digest of message B (computed)' }),
      digestB,
      el('dt', { text: 'Published common digest (Appendix A.2)' }),
      digestPublished
    ]),

    el('h3', { text: 'Step 4 · Control: change one bit of one message' }),
    el('p', {}, [
      'The collision depends on exactly these two words in exactly this place. Flip any single bit of message B and leave message A alone: Steps 2 and 3 are recomputed, and the digests differ.'
    ]),
    el('label', { class: 'neulaser-control' }, [flip, ' Flip one bit in message B only (negative control)']),
    el('label', { for: 'neulaser-flip-byte', text: 'Byte of message B to change' }),
    flipByte,
    flipNote,

    el('details', {}, [
      el('summary', { text: 'Message bytes, version and provenance' }),
      el('p', { text: 'Message A (hex)' }),
      messageA,
      el('p', { text: 'Message B (hex, including the control if selected)' }),
      messageB,
      el('p', {}, [
        'Version: Neulaser v2, specification dated 30 June 2026, from the round-one package ',
        el('code', { text: published.package.file }),
        ' (SHA-256 ',
        el('code', { text: published.package.sha256 }),
        '). The implementation on this page was written from the analysis and the specification, not from the submitters’ code. It is checked against the official known-answer tests in that package, the IV words and S-box table printed in the specification, and the intermediate table, search count and digests printed in the analysis.'
      ]),
      el('p', {}, [
        'The specification does not say how the chaining value and block become state words. Both submitted implementations load them directly as big-endian 32-bit words, with no reduction modulo p, and the collision is stated for that rule (the analysis, Section 4). A second, unrelated state merger from the reduction modulo p was reported the same day (tracker finding hash-21-2); it is not shown here.'
      ])
    ]),
    el('p', {}, [
      'This panel verifies a published collision and recomputes the published search. It is separate from the pair selector and proof export above, which cover MD5 and SHA-1. Nothing here bears on SHA-256, SHA-3 or SM3.'
    ])
  );
  update();
}
