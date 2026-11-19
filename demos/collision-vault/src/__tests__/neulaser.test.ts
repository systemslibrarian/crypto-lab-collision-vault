/* Neulaser v2 (NGCC round one): the implementation, and the published collision.
 *
 * Three independent sources of truth are used, and none of them is this code:
 *   - the analysis (Yuan et al., Section 4 and Appendix A): the feedback table,
 *     the search count and the three common digests;
 *   - the v2 specification: the IV words and two S-box rows;
 *   - the official known-answer tests shipped in the round-one package.
 */
import { describe, expect, it } from 'vitest';
import published from '../research/neulaser-vectors.json';
import kat from './fixtures/neulaser-official-kat.json';
import {
  COLLIDING_WORDS,
  NEULASER_P,
  NEULASER_SBOX,
  NEULASER_VARIANTS,
  NEULASER_VARIANT_LIST,
  corollary3Message,
  firstFeedbackRepeat,
  hashPaddedBlocks,
  hexWord,
  initialVector,
  localFeedback,
  neulaserHash,
  oneWordFeedback,
  oneWordLinearTerm,
  padMessage,
  traceF,
  traceMerge,
  type NeulaserVariant
} from '../research/neulaser';

/* The two slowest tests hash about 1 MiB twice, or one block 1,472 times.
 * Measured on an idle machine (load average 0.11) on 2026-11-18: at most
 * 2,200 ms and 535 ms. There is no CI timing for a new test, so the largest
 * CI-to-local ratio recorded for this fleet (2.72) gives an estimate of about
 * 6 s, which is over Vitest's 5 s default. 30 s is five times that estimate. */
const HEAVY_TEST_TIMEOUT_MS = 30_000;

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (text: string): Uint8Array =>
  Uint8Array.from(text.match(/../g) ?? [], (pair) => parseInt(pair, 16));

/** A small deterministic generator, so "random" messages are the same on every run. */
function pseudoRandomBytes(length: number, seed: number): Uint8Array {
  let state = seed >>> 0 || 1;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out[i] = state & 0xff;
  }
  return out;
}

describe('parameters and specified constants', () => {
  it('derives (n, k, B_n/8, d_n) as tabulated in Section 4.3 of the analysis', () => {
    const rows = NEULASER_VARIANT_LIST.map((n) => {
      const v = NEULASER_VARIANTS[n];
      return [v.digestBits, v.modules, v.blockBytes, v.lastModuleOffset];
    });
    expect(rows).toEqual([
      [512, 3, 120, 56],
      [768, 4, 152, 88],
      [1024, 5, 184, 120]
    ]);
    expect(NEULASER_P).toBe(2 ** 32 - 5);
  });

  it('generates the 34 IV words printed in Section 2.3 of the specification', () => {
    const words = published.specVectors.ivWordsHex;
    expect(words).toHaveLength(34);
    expect(hex(initialVector(1024))).toBe(words.join(''));
    expect(hex(initialVector(768))).toBe(words.slice(0, 26).join(''));
    expect(hex(initialVector(512))).toBe(words.slice(0, 18).join(''));
  });

  it('builds the S-box rows printed in Table 2 of the specification', () => {
    expect(hex(NEULASER_SBOX.subarray(0x00, 0x10))).toBe(published.specVectors.sboxRow0Hex);
    expect(hex(NEULASER_SBOX.subarray(0xf0, 0x100))).toBe(published.specVectors.sboxRowFHex);
    expect(new Set(NEULASER_SBOX).size).toBe(256);
  });

  it('pads a one-block message with P_n = 80 || 00^(B_n/8 - 9) || BE64(B_n)', () => {
    for (const n of NEULASER_VARIANT_LIST) {
      const { blockBytes } = NEULASER_VARIANTS[n];
      const blocks = padMessage(n, new Uint8Array(blockBytes));
      expect(blocks).toHaveLength(2);
      const expected = new Uint8Array(blockBytes);
      expected[0] = 0x80;
      new DataView(expected.buffer).setUint32(blockBytes - 4, blockBytes * 8, false);
      expect(hex(blocks[1])).toBe(hex(expected));
    }
    expect(() => padMessage(512, new Uint8Array(1), 9)).toThrow(/bit length/);
  });
});

describe('the local feedback collision (analysis, Section 4.1)', () => {
  it('reproduces every intermediate word of the published table', () => {
    for (const row of published.feedback.inputs) {
      const x = parseInt(row.xHex, 16);
      const t = traceF(0, 0, 0, x);
      expect({
        uF: hexWord(t.uF),
        vF: hexWord(t.vF),
        l1: hexWord(t.l1),
        l2: hexWord(t.l2),
        sL1: hexWord(t.sL1),
        sL2: hexWord(t.sL2),
        linearTerm: hexWord(oneWordLinearTerm(x)),
        f: hexWord(t.f)
      }).toEqual({
        uF: row.uF,
        vF: row.vF,
        l1: row.l1,
        l2: row.l2,
        sL1: row.sL1,
        sL2: row.sL2,
        linearTerm: row.linearTerm,
        f: row.f
      });
    }
  });

  it('gives both inputs the feedback 8c41db68', () => {
    expect(hexWord(oneWordFeedback(COLLIDING_WORDS.a))).toBe(published.feedback.valueHex);
    expect(hexWord(oneWordFeedback(COLLIDING_WORDS.b))).toBe(published.feedback.valueHex);
    expect(COLLIDING_WORDS.a).not.toBe(COLLIDING_WORDS.b);
    // The same value through the general module feedback, not the one-word shortcut.
    for (const x of [COLLIDING_WORDS.a, COLLIDING_WORDS.b]) {
      const module = new Uint32Array(16);
      module[0] = x;
      expect(localFeedback(module)).toBe(oneWordFeedback(x));
    }
  });

  it('finds that pair first, after 175,493 evaluations', () => {
    const repeat = firstFeedbackRepeat(1 << 20);
    expect(repeat).toEqual({
      earlier: COLLIDING_WORDS.a,
      later: COLLIDING_WORDS.b,
      feedback: parseInt(published.feedback.valueHex, 16),
      evaluations: published.feedback.evaluations
    });
    // One evaluation fewer finds nothing: 175,493 is the first repeat, not just a repeat.
    expect(firstFeedbackRepeat(published.feedback.evaluations - 1)).toBeNull();
  });

  it('does not make neighbouring inputs collide', () => {
    const target = oneWordFeedback(COLLIDING_WORDS.a);
    for (const delta of [-2, -1, 1, 2]) {
      expect(oneWordFeedback(COLLIDING_WORDS.b + delta)).not.toBe(target);
    }
  });
});

describe.each(NEULASER_VARIANT_LIST)('Neulaser-%i', (n: NeulaserVariant) => {
  const { modules, blockBytes, lastModuleOffset } = NEULASER_VARIANTS[n];
  const messageA = corollary3Message(n, COLLIDING_WORDS.a);
  const messageB = corollary3Message(n, COLLIDING_WORDS.b);

  it('builds the Corollary 3 messages: one word at offset d_n in a zero block', () => {
    expect(messageA).toHaveLength(blockBytes);
    expect(hex(messageA)).toBe(
      '00'.repeat(lastModuleOffset) + '00002743' + '00'.repeat(60)
    );
    expect(hex(messageB)).toBe(
      '00'.repeat(lastModuleOffset) + '0002ad84' + '00'.repeat(60)
    );
    expect(hex(messageA)).not.toBe(hex(messageB));
  });

  it('merges the two states after one update (Proposition 2)', () => {
    const trace = traceMerge(n, messageA, messageB);
    // Before: one differing word, at position 0 of the last module.
    expect(trace.differBefore).toEqual([(modules - 1) * 16]);
    expect(trace.beforeA[(modules - 1) * 16]).toBe(COLLIDING_WORDS.a);
    expect(trace.beforeB[(modules - 1) * 16]).toBe(COLLIDING_WORDS.b);
    // After: no differing word at all.
    expect(trace.differAfter).toEqual([]);
    expect(Array.from(trace.afterA)).toEqual(Array.from(trace.afterB));
  });

  it('hashes both messages to the digest published in Appendix A.2', () => {
    const digestA = hex(neulaserHash(n, messageA));
    const digestB = hex(neulaserHash(n, messageB));
    expect(digestA).toBe(published.publishedDigests[n]);
    expect(digestB).toBe(published.publishedDigests[n]);
    expect(digestA).toHaveLength(n / 4);
  });

  it('agrees with the explicit two-block form used in the proof of Corollary 3', () => {
    const padding = padMessage(n, messageA)[1];
    expect(hex(hashPaddedBlocks(n, [messageA, padding]))).toBe(published.publishedDigests[n]);
  });

  it('separates the two messages after any one-bit change to message B', () => {
    const target = published.publishedDigests[n];
    for (let bit = 0; bit < blockBytes * 8; bit++) {
      const altered = messageB.slice();
      altered[bit >>> 3] ^= 0x80 >>> (bit & 7);
      expect(hex(neulaserHash(n, altered)), `bit ${bit}`).not.toBe(target);
    }
  }, HEAVY_TEST_TIMEOUT_MS);

  it('does not collide on pseudo-random one-block messages', () => {
    const digests = new Set<string>();
    for (let seed = 1; seed <= 64; seed++) {
      digests.add(hex(neulaserHash(n, pseudoRandomBytes(blockBytes, seed * 2654435761))));
    }
    expect(digests.size).toBe(64);
    expect(digests.has(published.publishedDigests[n])).toBe(false);
  });

  it('does not collide when the word is placed anywhere other than offset d_n', () => {
    // The merge needs the differing word at position 0 of a module. Moving the
    // same two words four bytes later puts them at position 1, which the
    // shift copies into the next state.
    const shift = (x: number): Uint8Array => {
      const message = new Uint8Array(blockBytes);
      new DataView(message.buffer).setUint32(lastModuleOffset + 4, x, false);
      return message;
    };
    expect(hex(neulaserHash(n, shift(COLLIDING_WORDS.a)))).not.toBe(
      hex(neulaserHash(n, shift(COLLIDING_WORDS.b)))
    );
  });

  it('matches the official known-answer tests of the round-one package', () => {
    const variant = kat.variants[n];
    expect(variant.short.length).toBeGreaterThanOrEqual(11);
    for (const record of variant.short) {
      const digest = hex(neulaserHash(n, fromHex(record.messageHex), record.bitLength));
      expect(digest, `${variant.shortFile}, Msg_Len = ${record.bitLength}`).toBe(record.digestHex);
    }
  });

  it('matches the official 2^23-bit known-answer tests (all-00 and all-ff messages)', () => {
    const variant = kat.variants[n];
    expect(variant.long).toHaveLength(2);
    for (const record of variant.long) {
      const message = new Uint8Array(record.bitLength / 8).fill(parseInt(record.repeatedByteHex, 16));
      expect(hex(neulaserHash(n, message)), `${variant.longFile}, ${record.repeatedByteHex}`).toBe(
        record.digestHex
      );
    }
  }, HEAVY_TEST_TIMEOUT_MS);
});
