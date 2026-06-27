// SHA-1, SHA-256 and SHA-512 come straight from the platform's WebCrypto
// (SubtleCrypto) implementation — no third-party code on the trusted path for
// these. SHA-1 is included because it is the *broken* function behind the
// SHAttered collision; SHA-256/512 are the modern contrast hashes.
//
// SubtleCrypto.digest is async (it may run on a background thread inside the
// engine), which is exactly what we want for the ~400 KB SHAttered PDFs.

export type SubtleAlgo = 'SHA-1' | 'SHA-256' | 'SHA-512';

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle) {
    throw new Error('WebCrypto SubtleCrypto is unavailable in this environment.');
  }
  return c.subtle;
}

/** Raw digest bytes for a WebCrypto hash over the given input. */
export async function webcryptoDigest(algo: SubtleAlgo, bytes: Uint8Array): Promise<Uint8Array> {
  // Defensive copy into a fresh, standalone ArrayBuffer so we never hand
  // SubtleCrypto a view into a larger or shared buffer (some engines reject it).
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await subtle().digest(algo, copy);
  return new Uint8Array(digest);
}

export const SHA1_VECTORS: Array<{ input: string; hex: string }> = [
  { input: '', hex: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' },
  { input: 'abc', hex: 'a9993e364706816aba3e25717850c26c9cd0d89d' }
];

export const SHA256_VECTORS: Array<{ input: string; hex: string }> = [
  { input: '', hex: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { input: 'abc', hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }
];

export const SHA512_VECTORS: Array<{ input: string; hex: string }> = [
  {
    input: 'abc',
    hex:
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
      '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'
  }
];
