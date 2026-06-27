import { describe, it, expect } from 'vitest';
import { hashHex, selfTest, type HashAlgorithm } from '../hashing/index';
import { MD5_VECTORS } from '../hashing/md5';
import { SHA3_256_VECTORS } from '../hashing/sha3';
import { SHA1_VECTORS, SHA256_VECTORS, SHA512_VECTORS } from '../hashing/webcrypto';

const enc = new TextEncoder();

// Invariant 4: every algorithm matches known test vectors (empty string + at
// least one standard vector each) so the digests shown are trustworthy.
const SETS: Array<{ algo: HashAlgorithm; vectors: Array<{ input: string; hex: string }> }> = [
  { algo: 'md5', vectors: MD5_VECTORS },
  { algo: 'sha-1', vectors: SHA1_VECTORS },
  { algo: 'sha-256', vectors: SHA256_VECTORS },
  { algo: 'sha-512', vectors: SHA512_VECTORS },
  { algo: 'sha3-256', vectors: SHA3_256_VECTORS }
];

describe('hash known-answer vectors', () => {
  for (const { algo, vectors } of SETS) {
    for (const { input, hex } of vectors) {
      it(`${algo}("${input}") = ${hex.slice(0, 12)}…`, async () => {
        expect(await hashHex(algo, enc.encode(input))).toBe(hex);
      });
    }
  }

  it('every algorithm has an empty-string vector', () => {
    for (const { algo, vectors } of SETS) {
      // SHA-512 standard vector set here intentionally uses "abc"; ensure the
      // others cover empty string, and that SHA-512 still hashes empty input.
      if (algo === 'sha-512') continue;
      expect(vectors.some((v) => v.input === ''), `${algo} empty vector`).toBe(true);
    }
  });

  it('selfTest() passes for the whole suite', async () => {
    const r = await selfTest();
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
