// Loads bundled pair bytes and ENFORCES the core integrity invariants before
// anything is shown. If an asset is missing, corrupted, or fails to collide,
// we throw — the UI then shows an explicit error rather than pretending.

import { bytesEqual } from '../util/hex';
import { hashHex } from '../hashing/index';
import { PAIRS, type PairManifestEntry } from './manifest';

export interface LoadedPair {
  entry: PairManifestEntry;
  a: Uint8Array;
  b: Uint8Array;
  brokenDigest: string;
}

/** Base URL for bundled pair assets (respects the Vite/Pages base path). */
export function assetUrl(filename: string): string {
  return `${import.meta.env.BASE_URL}pairs/${filename}`;
}

async function fetchBytes(filename: string): Promise<Uint8Array> {
  const res = await fetch(assetUrl(filename));
  if (!res.ok) {
    throw new Error(`Could not load pair asset "${filename}" (HTTP ${res.status}).`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Pure integrity check, shared by the browser loader and the test suite.
 * Returns the verified shared broken-hash digest, or throws on any violation.
 */
export async function verifyPairBytes(
  entry: PairManifestEntry,
  a: Uint8Array,
  b: Uint8Array
): Promise<string> {
  // Invariant 2: the inputs must genuinely differ.
  if (bytesEqual(a, b)) {
    throw new Error(`Pair "${entry.id}" integrity failure: the two files are byte-identical.`);
  }
  // Invariant 1: recompute the broken hash live — never trust a stored digest.
  const [da, db] = await Promise.all([
    hashHex(entry.brokenHash, a),
    hashHex(entry.brokenHash, b)
  ]);
  if (da !== db) {
    throw new Error(
      `Pair "${entry.id}" integrity failure: ${entry.brokenHash} digests differ ` +
        `(${da} vs ${db}) — these bytes do NOT collide.`
    );
  }
  if (da !== entry.expectedBrokenDigest) {
    throw new Error(
      `Pair "${entry.id}" integrity failure: ${entry.brokenHash} digest ${da} ` +
        `does not match the recorded ${entry.expectedBrokenDigest} (corrupted asset?).`
    );
  }
  return da;
}

/**
 * Hint the browser to fetch not-yet-viewed pair assets during idle time so
 * switching pairs feels instant (the SHAttered PDFs are ~400 KB each).
 * Low-priority `<link rel="prefetch">` hints, so nothing competes with the
 * initial render or the currently loading pair.
 */
export function prefetchPairAssets(excludeId?: string): void {
  const idle: (cb: () => void) => void =
    typeof requestIdleCallback === 'function'
      ? (cb) => requestIdleCallback(cb)
      : (cb) => setTimeout(cb, 1500);
  idle(() => {
    for (const p of PAIRS) {
      if (p.id === excludeId) continue;
      for (const f of [p.fileA, p.fileB]) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'fetch';
        link.href = assetUrl(f);
        document.head.append(link);
      }
    }
  });
}

/** Fetch + verify a single pair. Throws on any integrity violation. */
export async function loadPair(entry: PairManifestEntry): Promise<LoadedPair> {
  const [a, b] = await Promise.all([fetchBytes(entry.fileA), fetchBytes(entry.fileB)]);
  const brokenDigest = await verifyPairBytes(entry, a, b);
  return { entry, a, b, brokenDigest };
}

export { PAIRS };
