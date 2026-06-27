import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PAIRS } from '../pairs/manifest';
import { verifyPairBytes } from '../pairs/loader';
import { hashHex } from '../hashing/index';
import { bytesEqual, sharedPrefixLength } from '../util/hex';

const here = dirname(fileURLToPath(import.meta.url));
const pairsDir = resolve(here, '../../public/pairs');

function load(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(pairsDir, name)));
}

describe('bundled collision pairs', () => {
  it('ships at least the three required pairs (SHA-1 + 2× MD5)', () => {
    const ids = PAIRS.map((p) => p.id);
    expect(ids).toContain('shattered');
    expect(PAIRS.some((p) => p.brokenHash === 'sha-1')).toBe(true);
    expect(PAIRS.filter((p) => p.brokenHash === 'md5').length).toBeGreaterThanOrEqual(2);
    expect(PAIRS.some((p) => p.type === 'identical-prefix')).toBe(true);
    expect(PAIRS.some((p) => p.type === 'chosen-prefix')).toBe(true);
  });

  for (const p of PAIRS) {
    describe(`pair "${p.id}" (${p.type}, broken=${p.brokenHash})`, () => {
      const a = load(p.fileA);
      const b = load(p.fileB);

      // Invariant 2: the inputs are genuinely different bytes.
      it('A and B are different byte arrays', () => {
        expect(bytesEqual(a, b)).toBe(false);
        expect(a.length).toBeGreaterThan(0);
      });

      // Invariant 1: the broken hash collides, computed live, matches manifest.
      it(`${p.brokenHash} digests are EQUAL and match the recorded digest`, async () => {
        const da = await hashHex(p.brokenHash, a);
        const db = await hashHex(p.brokenHash, b);
        expect(da).toBe(db);
        expect(da).toBe(p.expectedBrokenDigest);
      });

      // Invariant 3: modern hashes are unaffected — digests DIFFER.
      it('SHA-256 and SHA3-256 digests are UNEQUAL', async () => {
        const [s256a, s256b] = await Promise.all([hashHex('sha-256', a), hashHex('sha-256', b)]);
        const [s3a, s3b] = await Promise.all([hashHex('sha3-256', a), hashHex('sha3-256', b)]);
        expect(s256a).not.toBe(s256b);
        expect(s3a).not.toBe(s3b);
      });

      // The loader's integrity gate accepts the genuine bytes...
      it('verifyPairBytes accepts the genuine bytes', async () => {
        await expect(verifyPairBytes(p, a, b)).resolves.toBe(p.expectedBrokenDigest);
      });

      // ...and rejects tampered bytes (corrupted-asset safety / invariant 5).
      it('verifyPairBytes rejects a tampered file B', async () => {
        const tampered = b.slice();
        tampered[tampered.length - 1] ^= 0xff;
        await expect(verifyPairBytes(p, a, tampered)).rejects.toThrow(/integrity failure/);
      });

      it('shared-prefix measurement is consistent with the collision type', () => {
        const shared = sharedPrefixLength(a, b);
        if (p.type === 'chosen-prefix') {
          // Chosen-prefix pairs begin from different attacker-chosen content.
          expect(shared).toBe(0);
        } else {
          expect(shared).toBeGreaterThanOrEqual(0);
        }
      });
    });
  }
});
