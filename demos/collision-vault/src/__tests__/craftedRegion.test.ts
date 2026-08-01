import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PAIRS } from '../pairs/manifest';
import { buildProof, type DigestMap } from '../pairs/proof';
import { hashHex, type HashAlgorithm } from '../hashing/index';
import { compareTraces, type TraceableAlgorithm } from '../hashing/trace';
import { craftedRegion } from '../ui/explainer';

// The byte map's crafted-block region must be the MEASURED diverge→converge
// window from the state trace — and must degrade to the labelled estimate under
// exactly the same integrity gate the state-trace panel enforces, so the panel
// can never present an untrusted trace as a measurement.

const ALGOS: HashAlgorithm[] = ['md5', 'sha-1', 'sha-256', 'sha-512', 'sha3-256'];
const here = dirname(fileURLToPath(import.meta.url));
const pairsDir = resolve(here, '../../public/pairs');
const load = (n: string) => new Uint8Array(readFileSync(resolve(pairsDir, n)));

async function digestsFor(bytes: Uint8Array): Promise<DigestMap> {
  const out: DigestMap = {};
  for (const algo of ALGOS) out[algo] = await hashHex(algo, bytes);
  return out;
}

describe('crafted-block region', () => {
  for (const entry of PAIRS) {
    const algo = entry.brokenHash as TraceableAlgorithm;

    it(`is measured from the state trace for "${entry.id}"`, async () => {
      const a = load(entry.fileA);
      const b = load(entry.fileB);
      const resA = await digestsFor(a);
      const resB = await digestsFor(b);
      const proof = buildProof(entry, a, b, resA[entry.brokenHash]!, resA, resB);
      const total = Math.max(a.length, b.length);

      const cmp = compareTraces(algo, a, b);
      const region = craftedRegion(proof, total);

      expect(region.blocks).toEqual({ from: cmp.divergesAt, to: cmp.convergesAt });
      expect(region.start).toBe(cmp.divergesAt * 64);
      expect(region.end).toBe(Math.min(total, (cmp.convergesAt + 1) * 64));
      // The window must contain the first differing byte, or it is not the
      // region where the files were crafted apart.
      expect(proof.firstDiff).toBeGreaterThanOrEqual(region.start);
      expect(proof.firstDiff).toBeLessThan(region.end);
    });

    it(`falls back to the labelled estimate when the trace disagrees for "${entry.id}"`, async () => {
      const a = load(entry.fileA);
      const b = load(entry.fileB);
      const resA = await digestsFor(a);
      const resB = await digestsFor(b);
      const total = Math.max(a.length, b.length);

      // Same gate as stateTrace.ts: if the independent trace does not reproduce
      // the validated provider's digest, its output must not be used.
      const tampered: DigestMap = { ...resA, [entry.brokenHash]: 'de'.repeat(20) };
      const proof = buildProof(entry, a, b, resA[entry.brokenHash]!, tampered, resB);
      const region = craftedRegion(proof, total);

      expect(region.blocks).toBeNull();
      expect(region.start).toBe(proof.firstDiff);
      expect(region.end).toBe(Math.min(total, proof.firstDiff + 128));
    });

    it(`falls back when the validated digest is missing for "${entry.id}"`, async () => {
      const a = load(entry.fileA);
      const b = load(entry.fileB);
      const resA = await digestsFor(a);
      const resB = await digestsFor(b);
      const total = Math.max(a.length, b.length);

      const missing: DigestMap = { ...resB };
      delete missing[entry.brokenHash];
      const proof = buildProof(entry, a, b, resA[entry.brokenHash]!, resA, missing);

      expect(craftedRegion(proof, total).blocks).toBeNull();
    });
  }

  it('falls back for a broken hash the trace module cannot follow', async () => {
    const entry = { ...PAIRS[0], brokenHash: 'sha-256' as HashAlgorithm };
    const a = load(PAIRS[0].fileA);
    const b = load(PAIRS[0].fileB);
    const resA = await digestsFor(a);
    const resB = await digestsFor(b);
    const proof = buildProof(entry, a, b, resA['sha-256']!, resA, resB);

    expect(craftedRegion(proof, Math.max(a.length, b.length)).blocks).toBeNull();
  });
});
