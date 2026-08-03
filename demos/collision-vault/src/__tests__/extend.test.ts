import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extensionPrecondition, traceRawBlocks } from '../hashing/trace';
import { hashHex } from '../hashing/index';
import { PAIRS } from '../pairs/manifest';
import {
  bytesEqual,
  concatBytes,
  extensionVerdict,
  planExtension,
  predictionReason
} from '../pairs/extend';

const here = dirname(fileURLToPath(import.meta.url));
const pairsDir = resolve(here, '../../public/pairs');

function load(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(pairsDir, name)));
}

const enc = new TextEncoder();

describe('traceRawBlocks', () => {
  it('processes only complete 64-byte blocks and applies no padding', () => {
    expect(traceRawBlocks('md5', enc.encode('short')).length).toBe(0);
    expect(traceRawBlocks('md5', new Uint8Array(64)).length).toBe(1);
    expect(traceRawBlocks('md5', new Uint8Array(200)).length).toBe(3);
  });

  it('is a prefix-stable function: extending a message never changes earlier states', () => {
    const base = new Uint8Array(128).map((_, i) => (i * 37) & 0xff);
    const grown = concatBytes(base, enc.encode('anything at all, of any length'));
    const a = traceRawBlocks('sha-1', base);
    const b = traceRawBlocks('sha-1', grown);
    expect(b.slice(0, a.length)).toEqual(a);
  });

  it('differs from the padded digest, so it cannot be confused with it', async () => {
    const msg = new Uint8Array(64).fill(7);
    const raw = traceRawBlocks('md5', msg);
    expect(raw).toHaveLength(1);
    expect(raw[0]).not.toBe(await hashHex('md5', msg));
  });

  it('reads a subarray view correctly (non-zero byteOffset)', () => {
    const backing = new Uint8Array(200).map((_, i) => (i * 11) & 0xff);
    const view = backing.subarray(8, 200);
    expect(traceRawBlocks('md5', view)).toEqual(traceRawBlocks('md5', backing.slice(8)));
  });
});

describe('extensionPrecondition on the real bundled pairs', () => {
  for (const entry of PAIRS) {
    const algo = entry.brokenHash;
    if (algo !== 'md5' && algo !== 'sha-1') continue;

    it(`${entry.id}: is measured suffix-closed, and the digests agree with the prediction`, async () => {
      const a = load(entry.fileA);
      const b = load(entry.fileB);
      const pre = extensionPrecondition(algo, a, b);

      // All three conditions are separately measured, not inferred from `holds`.
      expect(pre.sameLength).toBe(true);
      expect(pre.stateEqualAfterFullBlocks).toBe(true);
      expect(pre.tailEqual).toBe(true);
      expect(pre.holds).toBe(true);

      // The un-padded states really do converge strictly before the end, which
      // is what makes the tail identical rather than merely equal-looking.
      expect(pre.rawConvergesAt).toBeGreaterThanOrEqual(0);
      expect(pre.rawConvergesAt).toBeLessThan(pre.fullBlocks);

      // And the property itself: a suffix nobody has ever appended before still
      // collides, at a digest different from the published one.
      const suffix = enc.encode(`\nminted by the test suite for ${entry.id}\n`);
      const dA = await hashHex(algo, concatBytes(a, suffix));
      const dB = await hashHex(algo, concatBytes(b, suffix));
      expect(dA).toBe(dB);
      expect(dA).not.toBe(entry.expectedBrokenDigest);
    });

    it(`${entry.id}: different suffixes break the collision`, async () => {
      const a = load(entry.fileA);
      const b = load(entry.fileB);
      const dA = await hashHex(algo, concatBytes(a, enc.encode('pay Eve')));
      const dB = await hashHex(algo, concatBytes(b, enc.encode('pay Bob')));
      expect(dA).not.toBe(dB);
    });

    it(`${entry.id}: appending to only one half breaks the collision`, async () => {
      const a = load(entry.fileA);
      const b = load(entry.fileB);
      const dA = await hashHex(algo, concatBytes(a, enc.encode('x')));
      const dB = await hashHex(algo, b);
      expect(dA).not.toBe(dB);
    });
  }

  it('reports a non-suffix-closed pair as such: two unrelated files never qualify', () => {
    const a = new Uint8Array(128).fill(1);
    const b = new Uint8Array(128).fill(2);
    const pre = extensionPrecondition('md5', a, b);
    expect(pre.stateEqualAfterFullBlocks).toBe(false);
    expect(pre.holds).toBe(false);
  });

  it('reports unequal lengths as such', () => {
    const a = new Uint8Array(128).fill(1);
    const pre = extensionPrecondition('md5', a, a.slice(0, 64));
    expect(pre.sameLength).toBe(false);
    expect(pre.holds).toBe(false);
  });

  it('a pair whose tails differ is not suffix-closed even with equal states', () => {
    // 64 identical bytes (states agree after block 0) plus a differing 5-byte tail.
    const a = concatBytes(new Uint8Array(64).fill(9), enc.encode('aaaaa'));
    const b = concatBytes(new Uint8Array(64).fill(9), enc.encode('bbbbb'));
    const pre = extensionPrecondition('md5', a, b);
    expect(pre.stateEqualAfterFullBlocks).toBe(true);
    expect(pre.tailEqual).toBe(false);
    expect(pre.holds).toBe(false);
  });
});

describe('planExtension', () => {
  it('same mode gives both halves identical bytes', () => {
    const p = planExtension('same', 'hello', 'ignored');
    expect(p.suffixesIdentical).toBe(true);
    expect(bytesEqual(p.suffixA, p.suffixB)).toBe(true);
  });

  it('differ mode gives the halves different bytes', () => {
    const p = planExtension('differ', 'hello', 'hellp');
    expect(p.suffixesIdentical).toBe(false);
  });

  it('differ mode with coincidentally equal text is still identical', () => {
    expect(planExtension('differ', 'same', 'same').suffixesIdentical).toBe(true);
  });

  it('a-only mode leaves File B untouched', () => {
    const p = planExtension('a-only', 'hello', 'hello');
    expect(p.suffixB).toHaveLength(0);
    expect(p.suffixesIdentical).toBe(false);
  });
});

describe('extensionVerdict', () => {
  it('survives when the pair is suffix-closed, the bytes match, and the digests came out equal', () => {
    const v = extensionVerdict(true, true, true);
    expect(v.outcome).toBe('survives');
    expect(v.predictedEqual).toBe(true);
    expect(v.headline).toContain('STILL COLLIDES');
  });

  it('breaks when the suffixes differ', () => {
    const v = extensionVerdict(true, false, false);
    expect(v.outcome).toBe('broken');
    expect(v.headline).toContain('appended bytes were not identical');
  });

  it('breaks when the pair was never suffix-closed', () => {
    const v = extensionVerdict(false, true, false);
    expect(v.outcome).toBe('broken');
    expect(v.headline).toContain('not suffix-closed');
  });

  it('flags a contradiction when the prediction said equal and the digests differed', () => {
    const v = extensionVerdict(true, true, false);
    expect(v.outcome).toBe('contradiction');
    expect(v.headline).toContain('PREDICTION MISMATCH');
  });

  it('flags a contradiction when the prediction said differ and the digests matched', () => {
    const v = extensionVerdict(false, true, true);
    expect(v.outcome).toBe('contradiction');
  });

  it('never reports survival off a prediction alone — the measurement decides', () => {
    // Same prediction, opposite measurement: the outcomes must differ.
    expect(extensionVerdict(true, true, true).outcome).not.toBe(
      extensionVerdict(true, true, false).outcome
    );
  });
});

describe('predictionReason', () => {
  it('names both failures when both fail', () => {
    expect(predictionReason(false, false)).toContain('AND');
  });
  it('names the suffix when only the suffix differs', () => {
    expect(predictionReason(true, false)).toContain('different bytes');
  });
  it('names the pair when only the pair fails', () => {
    expect(predictionReason(false, true)).toContain('not suffix-closed');
  });
  it('is affirmative when both hold', () => {
    expect(predictionReason(true, true)).toContain('already agree');
  });
});
