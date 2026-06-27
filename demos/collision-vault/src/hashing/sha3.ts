// SHA-3 (Keccak, FIPS 202) is also absent from WebCrypto, so we use the
// `@noble/hashes` Keccak implementation. We expose SHA3-256 — the modern,
// collision-resistant contrast hash for the resistance panel.
import { sha3_256 as nobleSha3_256 } from '@noble/hashes/sha3.js';

export const SHA3_LIBRARY = '@noble/hashes (sha3.js)';

/** Raw 32-byte SHA3-256 digest of the given bytes. */
export function sha3_256(bytes: Uint8Array): Uint8Array {
  return nobleSha3_256(bytes);
}

// Known-answer vectors from the NIST FIPS 202 / CAVP test sets.
export const SHA3_256_VECTORS: Array<{ input: string; hex: string }> = [
  { input: '', hex: 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a' },
  { input: 'abc', hex: '3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532' }
];
