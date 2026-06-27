// A PairProof bundles everything the UI panels need for one verified pair:
// the raw bytes, every digest, and the measured structural facts. Building it
// once keeps the citation, ledger, copy-proof, tamper and diagram panels in
// sync with a single source of truth.

import {
  firstDifferenceOffset,
  sharedPrefixLength,
  diffRegions,
  groupHex,
  type DiffRegion
} from '../util/hex';
import { ALGORITHMS, type HashAlgorithm } from '../hashing/index';
import type { PairManifestEntry } from './manifest';

export type DigestMap = Partial<Record<HashAlgorithm, string>>;

/** Modern hashes used for the resistance contrast + proof summary. */
export const CONTRAST_ALGOS: HashAlgorithm[] = ['sha-256', 'sha3-256', 'sha-512'];

export interface PairProof {
  entry: PairManifestEntry;
  a: Uint8Array;
  b: Uint8Array;
  brokenDigest: string;
  resA: DigestMap;
  resB: DigestMap;
  shared: number;
  firstDiff: number;
  regions: DiffRegion[];
}

export function buildProof(
  entry: PairManifestEntry,
  a: Uint8Array,
  b: Uint8Array,
  brokenDigest: string,
  resA: DigestMap,
  resB: DigestMap
): PairProof {
  return {
    entry,
    a,
    b,
    brokenDigest,
    resA,
    resB,
    shared: sharedPrefixLength(a, b),
    firstDiff: firstDifferenceOffset(a, b),
    regions: diffRegions(a, b)
  };
}

export interface LedgerItem {
  key: string;
  label: string;
  pass: boolean;
  /** Measured detail shown alongside the pass/fail mark. */
  detail: string;
}

/**
 * The verification ledger: each correctness invariant the demo enforces,
 * evaluated from the live data so the UI exposes the trust model directly
 * rather than asking the user to read the source.
 */
export function ledgerChecks(proof: PairProof, vectorsPassed: boolean): LedgerItem[] {
  const { entry, a, b, resA, resB } = proof;
  const broken = entry.brokenHash;
  const brokenLabel = ALGORITHMS[broken].label;
  const da = resA[broken];
  const db = resB[broken];
  const s256a = resA['sha-256'];
  const s256b = resB['sha-256'];
  const s3a = resA['sha3-256'];
  const s3b = resB['sha3-256'];

  return [
    {
      key: 'vectors',
      label: 'Hash implementations passed known-answer vectors',
      pass: vectorsPassed,
      detail: 'MD5, SHA-1, SHA-256, SHA-512, SHA3-256 each match standard test vectors.'
    },
    {
      key: 'loaded',
      label: 'Pair bytes loaded from bundled assets',
      pass: a.length > 0 && b.length > 0,
      detail: `${entry.fileA} (${a.length.toLocaleString()} B) · ${entry.fileB} (${b.length.toLocaleString()} B)`
    },
    {
      key: 'differ',
      label: 'The two files are genuinely different bytes',
      pass: proof.firstDiff !== -1,
      detail: `first difference at byte ${proof.firstDiff.toLocaleString()}; shared prefix ${proof.shared.toLocaleString()} B`
    },
    {
      key: 'manifest',
      label: `${brokenLabel} digest matches the recorded manifest digest`,
      pass: !!da && da === entry.expectedBrokenDigest,
      detail: entry.expectedBrokenDigest
    },
    {
      key: 'collide',
      label: `${brokenLabel} digests are EQUAL for A and B (collision)`,
      pass: !!da && !!db && da === db,
      detail: da && db ? `${da} == ${db}` : 'pending'
    },
    {
      key: 'resist',
      label: 'Modern hashes (SHA-256, SHA3-256) differ for A and B',
      pass: !!s256a && !!s256b && s256a !== s256b && !!s3a && !!s3b && s3a !== s3b,
      detail: 'collision is specific to the broken function'
    },
    {
      key: 'local',
      label: 'Nothing uploaded or stored',
      pass: true,
      detail: 'all hashing runs locally in your browser; no network at runtime, no storage'
    }
  ];
}

/**
 * Portable, plain-markdown proof summary for the selected pair. Pure: the caller
 * supplies the timestamp so this is deterministic under test.
 */
export function proofSummaryMarkdown(proof: PairProof, timestamp: string): string {
  const { entry, a, b, resA, resB } = proof;
  const broken = entry.brokenHash;
  const bl = ALGORITHMS[broken].label;
  const da = resA[broken] ?? '(pending)';
  const db = resB[broken] ?? '(pending)';
  const src = entry.source;

  const lines: string[] = [];
  lines.push(`# Hash-collision proof — ${entry.label}`);
  lines.push('');
  lines.push(`- Type: ${entry.type} collision under ${bl}`);
  lines.push(`- Source: ${src.authors} (${src.year}), ${src.title} — ${src.url}`);
  lines.push(`- File A: ${entry.fileA} (${a.length.toLocaleString()} bytes)`);
  lines.push(`- File B: ${entry.fileB} (${b.length.toLocaleString()} bytes)`);
  lines.push(`- Shared prefix: ${proof.shared.toLocaleString()} bytes · first difference at byte ${proof.firstDiff.toLocaleString()}`);
  lines.push('');
  lines.push(`## Broken hash (${bl}) — EQUAL ⇒ collision`);
  lines.push('```');
  lines.push(`${bl}(A) = ${groupHex(da)}`);
  lines.push(`${bl}(B) = ${groupHex(db)}`);
  lines.push(`equal: ${da === db ? 'YES — same digest, different files' : 'no'}`);
  lines.push('```');
  lines.push('');
  lines.push('## Modern hashes — DIFFERENT ⇒ resistance holds');
  lines.push('```');
  for (const algo of ['sha-256', 'sha3-256'] as HashAlgorithm[]) {
    const la = ALGORITHMS[algo].label;
    const xa = resA[algo] ?? '(pending)';
    const xb = resB[algo] ?? '(pending)';
    lines.push(`${la}(A) = ${xa}`);
    lines.push(`${la}(B) = ${xb}`);
    lines.push(`equal: ${xa === xb ? 'YES?!' : 'no — digests differ'}`);
  }
  lines.push('```');
  lines.push('');
  lines.push(`_All digests recomputed locally in-browser at ${timestamp}. Nothing was uploaded or stored._`);
  return lines.join('\n');
}

/** Machine-readable proof manifest (for offline labs / reproducibility). */
export function proofManifestJson(proof: PairProof, timestamp: string): string {
  const { entry, a, b, resA, resB } = proof;
  const digests = (m: DigestMap) => {
    const out: Record<string, string> = {};
    for (const algo of [entry.brokenHash, ...CONTRAST_ALGOS]) {
      const v = m[algo];
      if (v) out[algo] = v;
    }
    return out;
  };
  return JSON.stringify(
    {
      pair: entry.id,
      label: entry.label,
      type: entry.type,
      brokenHash: entry.brokenHash,
      source: entry.source,
      files: {
        A: { name: entry.fileA, bytes: a.length },
        B: { name: entry.fileB, bytes: b.length }
      },
      sharedPrefixBytes: proof.shared,
      firstDifferenceByte: proof.firstDiff,
      brokenDigestEqual: resA[entry.brokenHash] === resB[entry.brokenHash],
      digestsA: digests(resA),
      digestsB: digests(resB),
      recomputedLocallyAt: timestamp,
      note: 'All digests recomputed locally in-browser; nothing uploaded or stored.'
    },
    null,
    2
  );
}
