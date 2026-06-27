import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PAIRS } from '../pairs/manifest';
import {
  buildProof,
  ledgerChecks,
  proofSummaryMarkdown,
  proofManifestJson,
  CONTRAST_ALGOS,
  type DigestMap
} from '../pairs/proof';
import { hashHex, type HashAlgorithm } from '../hashing/index';

const ALL_DEMO_ALGOS: HashAlgorithm[] = ['md5', 'sha-1', 'sha-256', 'sha-512', 'sha3-256'];

const here = dirname(fileURLToPath(import.meta.url));
const pairsDir = resolve(here, '../../public/pairs');
const load = (n: string) => new Uint8Array(readFileSync(resolve(pairsDir, n)));

async function digestsFor(bytes: Uint8Array): Promise<DigestMap> {
  const out: DigestMap = {};
  for (const algo of ALL_DEMO_ALGOS) out[algo] = await hashHex(algo, bytes);
  return out;
}

describe('PairProof + proof artifacts', () => {
  for (const entry of PAIRS) {
    it(`builds a consistent proof for "${entry.id}"`, async () => {
      const a = load(entry.fileA);
      const b = load(entry.fileB);
      const resA = await digestsFor(a);
      const resB = await digestsFor(b);
      const proof = buildProof(entry, a, b, resA[entry.brokenHash]!, resA, resB);

      // Every ledger invariant passes for a genuine pair.
      const ledger = ledgerChecks(proof, true);
      const failing = ledger.filter((i) => !i.pass).map((i) => i.key);
      expect(failing).toEqual([]);

      // If self-test had failed, the vectors row must report failure.
      const ledgerBadVectors = ledgerChecks(proof, false);
      expect(ledgerBadVectors.find((i) => i.key === 'vectors')!.pass).toBe(false);

      // Markdown summary mentions the equal broken digest and both sources.
      const md = proofSummaryMarkdown(proof, '2026-01-01T00:00:00.000Z');
      expect(md).toContain(entry.label);
      // The summary groups hex into 8-char blocks, so match the first group.
      expect(md).toContain(entry.expectedBrokenDigest.slice(0, 8));
      expect(md).toMatch(/same digest, different files/i);
      expect(md).toContain('2026-01-01T00:00:00.000Z');

      // JSON manifest is valid and records the collision.
      const json = JSON.parse(proofManifestJson(proof, '2026-01-01T00:00:00.000Z'));
      expect(json.pair).toBe(entry.id);
      expect(json.brokenDigestEqual).toBe(true);
      expect(json.digestsA[entry.brokenHash]).toBe(json.digestsB[entry.brokenHash]);
      for (const algo of CONTRAST_ALGOS) {
        if (json.digestsA[algo] && json.digestsB[algo]) {
          expect(json.digestsA[algo]).not.toBe(json.digestsB[algo]);
        }
      }
    });
  }
});
