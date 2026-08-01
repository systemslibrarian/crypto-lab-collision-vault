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

// Known-answer vectors from RFC 1321, Appendix A.5 ("MD5 test suite"). The
// runtime self-check (and the test suite) recompute these so a corrupted or
// incorrect library can never silently produce a wrong digest — invariant 4.
//
// Every entry below is quoted verbatim from that appendix. An earlier version
// listed "The quick brown fox jumps over the lazy dog" under the same heading:
// its digest is correct, but that string does not appear anywhere in RFC 1321,
// so citing it as an RFC vector was a false provenance claim. It is replaced
// here by vectors the RFC actually specifies.
export const MD5_VECTORS: Array<{ input: string; hex: string }> = [
  { input: '', hex: 'd41d8cd98f00b204e9800998ecf8427e' },
  { input: 'a', hex: '0cc175b9c0f1b6a831c399e269772661' },
  { input: 'abc', hex: '900150983cd24fb0d6963f7d28e17f72' },
  { input: 'message digest', hex: 'f96b697d7cb7938d525a2f31aaf161d0' },
  { input: 'abcdefghijklmnopqrstuvwxyz', hex: 'c3fcd3d76192e4007dfb496cca67e13b' }
];
