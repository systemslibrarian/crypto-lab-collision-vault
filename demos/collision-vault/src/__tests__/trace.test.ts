import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { traceHash, compareTraces, type TraceableAlgorithm } from '../hashing/trace';
import { hashHex } from '../hashing/index';
import { MD5_VECTORS } from '../hashing/md5';
import { SHA1_VECTORS } from '../hashing/webcrypto';
import { PAIRS } from '../pairs/manifest';
import { sharedPrefixLength } from '../util/hex';

const here = dirname(fileURLToPath(import.meta.url));
const pairsDir = resolve(here, '../../public/pairs');

function load(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(pairsDir, name)));
}

const encoder = new TextEncoder();

describe('traced hash implementations (state-trace module)', () => {
  // The traced implementations are independent of the validated providers, so
  // they get their own known-answer gate before anything else trusts them.
  for (const [algo, vectors] of [
    ['md5', MD5_VECTORS],
    ['sha-1', SHA1_VECTORS]
  ] as Array<[TraceableAlgorithm, typeof MD5_VECTORS]>) {
    describe(algo, () => {
      for (const { input, hex } of vectors) {
        it(`matches the known-answer vector for ${JSON.stringify(input.slice(0, 24))}`, () => {
          const trace = traceHash(algo, encoder.encode(input));
          expect(trace.digest).toBe(hex);
          expect(trace.cvs[trace.cvs.length - 1]).toBe(trace.digest);
        });
      }

      it('agrees with the validated provider on multi-block input', async () => {
        // 200 bytes → 3 message blocks + padding; exercises block chaining.
        const bytes = encoder.encode('a'.repeat(200));
        const trace = traceHash(algo, bytes);
        expect(trace.digest).toBe(await hashHex(algo, bytes));
        expect(trace.messageBlocks).toBe(4); // ceil(200 / 64)
        expect(trace.cvs.length).toBeGreaterThanOrEqual(trace.messageBlocks);
      });

      it('handles an exact block-multiple length (padding adds a whole block)', async () => {
        const bytes = encoder.encode('x'.repeat(128));
        const trace = traceHash(algo, bytes);
        expect(trace.digest).toBe(await hashHex(algo, bytes));
        expect(trace.messageBlocks).toBe(2);
        expect(trace.cvs.length).toBe(3); // 2 message blocks + 1 padding block
      });

      it('handles the empty input', async () => {
        const trace = traceHash(algo, new Uint8Array(0));
        expect(trace.digest).toBe(await hashHex(algo, new Uint8Array(0)));
        expect(trace.cvs.length).toBe(1);
      });
    });
  }
});

describe('state convergence on the bundled collision pairs', () => {
  for (const p of PAIRS.filter((p) => p.brokenHash === 'md5' || p.brokenHash === 'sha-1')) {
    describe(`pair "${p.id}" (${p.type})`, () => {
      const algo = p.brokenHash as TraceableAlgorithm;
      const a = load(p.fileA);
      const b = load(p.fileB);
      const cmp = compareTraces(algo, a, b);

      it('traced digests equal the recorded collision digest', () => {
        expect(cmp.a.digest).toBe(p.expectedBrokenDigest);
        expect(cmp.b.digest).toBe(p.expectedBrokenDigest);
      });

      it('states diverge, then re-converge, then stay equal to the end', () => {
        expect(cmp.divergesAt).toBeGreaterThanOrEqual(0);
        expect(cmp.convergesAt).toBeGreaterThan(cmp.divergesAt);
        for (let i = cmp.convergesAt; i < cmp.a.cvs.length; i++) {
          expect(cmp.a.cvs[i]).toBe(cmp.b.cvs[i]);
        }
      });

      it('divergence block matches the measured byte-level divergence', () => {
        const expectedBlock = Math.floor(sharedPrefixLength(a, b) / 64);
        expect(cmp.divergesAt).toBe(expectedBlock);
      });

      if (p.type === 'chosen-prefix') {
        it('chosen-prefix: states differ from the very first block', () => {
          expect(cmp.divergesAt).toBe(0);
        });
      }
    });
  }
});
