// MD5 is NOT provided by WebCrypto (it is deliberately omitted as a broken
// primitive), so we use the audited, dependency-free `@noble/hashes`
// implementation. MD5 lives in the library's `legacy` entrypoint alongside the
// other broken/obsolete hashes (SHA-1, RIPEMD-160).
import { md5 as nobleMd5 } from '@noble/hashes/legacy.js';

export const MD5_LIBRARY = '@noble/hashes (legacy.js)';

/** Raw 16-byte MD5 digest of the given bytes. */
export function md5(bytes: Uint8Array): Uint8Array {
  return nobleMd5(bytes);
}

// Known-answer vectors from RFC 1321, Appendix A.5. The runtime self-check
// (and the test suite) recompute these so a corrupted/incorrect library can
// never silently produce a wrong digest — invariant 4.
export const MD5_VECTORS: Array<{ input: string; hex: string }> = [
  { input: '', hex: 'd41d8cd98f00b204e9800998ecf8427e' },
  { input: 'abc', hex: '900150983cd24fb0d6963f7d28e17f72' },
  {
    input: 'The quick brown fox jumps over the lazy dog',
    hex: '9e107d9d372bb6826bd81d3542a419d6'
  }
];
