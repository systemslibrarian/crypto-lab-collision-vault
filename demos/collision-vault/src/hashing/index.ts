// Unified hashing interface: one `hash(algo, bytes)` entry point over the three
// underlying providers (noble MD5, noble SHA-3, WebCrypto SHA-1/256/512).
//
// `family` tells the UI how to colour a result: a `broken` hash producing equal
// digests for different inputs is the CATASTROPHE (alarm); a `resistant` hash
// producing different digests is the function behaving CORRECTLY (calm).

import { byteToHex, bytesToHex } from '../util/hex';
import { md5, MD5_LIBRARY, MD5_VECTORS } from './md5';
import { sha3_256, SHA3_LIBRARY, SHA3_256_VECTORS } from './sha3';
import {
  webcryptoDigest,
  SHA1_VECTORS,
  SHA256_VECTORS,
  SHA512_VECTORS
} from './webcrypto';

export type HashAlgorithm = 'md5' | 'sha-1' | 'sha-256' | 'sha-512' | 'sha3-256';

export type HashFamily = 'broken' | 'resistant';

export interface AlgoInfo {
  id: HashAlgorithm;
  label: string;
  family: HashFamily;
  provider: string;
  /** Short note on the algorithm's collision status, shown in the UI. */
  note: string;
}

export const ALGORITHMS: Record<HashAlgorithm, AlgoInfo> = {
  md5: {
    id: 'md5',
    label: 'MD5',
    family: 'broken',
    provider: MD5_LIBRARY,
    note: 'Collisions are trivial (seconds on a laptop). Broken since Wang et al., 2004.'
  },
  'sha-1': {
    id: 'sha-1',
    label: 'SHA-1',
    family: 'broken',
    provider: 'WebCrypto (SubtleCrypto)',
    note: 'Broken by SHAttered (2017); chosen-prefix collisions practical since 2020.'
  },
  'sha-256': {
    id: 'sha-256',
    label: 'SHA-256',
    family: 'resistant',
    provider: 'WebCrypto (SubtleCrypto)',
    note: 'No known practical collisions. ~2^128 work for a generic collision.'
  },
  'sha-512': {
    id: 'sha-512',
    label: 'SHA-512',
    family: 'resistant',
    provider: 'WebCrypto (SubtleCrypto)',
    note: 'No known practical collisions. Larger 512-bit digest.'
  },
  'sha3-256': {
    id: 'sha3-256',
    label: 'SHA3-256',
    family: 'resistant',
    provider: SHA3_LIBRARY,
    note: 'Keccak sponge (FIPS 202, 2015). No known practical collisions.'
  }
};

/** Compute the raw digest bytes for an algorithm over `bytes`. */
export async function hashBytes(algo: HashAlgorithm, bytes: Uint8Array): Promise<Uint8Array> {
  switch (algo) {
    case 'md5':
      return md5(bytes);
    case 'sha3-256':
      return sha3_256(bytes);
    case 'sha-1':
      return webcryptoDigest('SHA-1', bytes);
    case 'sha-256':
      return webcryptoDigest('SHA-256', bytes);
    case 'sha-512':
      return webcryptoDigest('SHA-512', bytes);
    default: {
      const _exhaustive: never = algo;
      throw new Error(`Unknown algorithm: ${String(_exhaustive)}`);
    }
  }
}

/** Lower-case hex digest for an algorithm over `bytes`. */
export async function hashHex(algo: HashAlgorithm, bytes: Uint8Array): Promise<string> {
  return bytesToHex(await hashBytes(algo, bytes));
}

const encoder = new TextEncoder();

interface VectorSet {
  algo: HashAlgorithm;
  vectors: Array<{ input: string; hex: string }>;
}

const ALL_VECTORS: VectorSet[] = [
  { algo: 'md5', vectors: MD5_VECTORS },
  { algo: 'sha-1', vectors: SHA1_VECTORS },
  { algo: 'sha-256', vectors: SHA256_VECTORS },
  { algo: 'sha-512', vectors: SHA512_VECTORS },
  { algo: 'sha3-256', vectors: SHA3_256_VECTORS }
];

export interface SelfTestResult {
  ok: boolean;
  failures: string[];
}

/**
 * Recompute every bundled known-answer vector. Used at runtime (a worker calls
 * this on init and refuses to display digests if it fails) and asserted in the
 * test suite. This is invariant 4: never trust a hash we have not validated.
 */
export async function selfTest(): Promise<SelfTestResult> {
  const failures: string[] = [];
  for (const { algo, vectors } of ALL_VECTORS) {
    for (const { input, hex } of vectors) {
      let got: string;
      try {
        got = await hashHex(algo, encoder.encode(input));
      } catch (err) {
        failures.push(`${algo}("${input}") threw: ${(err as Error).message}`);
        continue;
      }
      if (got !== hex) {
        failures.push(`${algo}("${input}") = ${got}, expected ${hex}`);
      }
    }
  }
  return { ok: failures.length === 0, failures };
}

export { byteToHex, bytesToHex };
