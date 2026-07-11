// TRACED MD5 / SHA-1 — independent, from-scratch implementations that expose
// the chaining value after EVERY 64-byte block, so the UI can show the two
// files' internal states splitting apart and being forced back together by the
// crafted near-collision blocks. That re-convergence IS the collision attack.
//
// These run alongside (never instead of) the validated hashing providers: the
// UI cross-checks each trace's final digest against the digest computed by the
// self-tested implementation and refuses to display a trace that disagrees.
// Pure and synchronous, so it is trivially unit-testable.

import { bytesToHex } from '../util/hex';

export type TraceableAlgorithm = 'md5' | 'sha-1';

export interface HashTrace {
  algo: TraceableAlgorithm;
  /** Lower-case hex chaining value AFTER each processed 64-byte block,
   *  including the final padding block(s). The last entry IS the digest. */
  cvs: string[];
  /** How many blocks contain original message bytes (rest is pure padding). */
  messageBlocks: number;
  /** Final digest hex — always equal to cvs[cvs.length - 1]. */
  digest: string;
}

const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;

/** Merkle–Damgård padding shared by MD5 and SHA-1: 0x80, zeros, 64-bit length.
 *  Only the byte order of the length field differs. */
function pad(bytes: Uint8Array, littleEndianLength: boolean): Uint8Array {
  const bitLen = bytes.length * 8; // fine as a double: inputs are ≪ 2^53 bits
  const total = (Math.floor((bytes.length + 8) / 64) + 1) * 64;
  const out = new Uint8Array(total);
  out.set(bytes);
  out[bytes.length] = 0x80;
  const view = new DataView(out.buffer);
  const lo = bitLen >>> 0;
  const hi = Math.floor(bitLen / 2 ** 32);
  if (littleEndianLength) {
    view.setUint32(total - 8, lo, true);
    view.setUint32(total - 4, hi, true);
  } else {
    view.setUint32(total - 8, hi, false);
    view.setUint32(total - 4, lo, false);
  }
  return out;
}

// ── MD5 (RFC 1321) ───────────────────────────────────────────────────────────

// Per-round left-rotate amounts.
const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

// K[i] = floor(|sin(i + 1)| · 2^32), the RFC 1321 constant table.
const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);

function md5Compress(state: Uint32Array, view: DataView, offset: number): void {
  const m = new Uint32Array(16);
  for (let j = 0; j < 16; j++) m[j] = view.getUint32(offset + j * 4, true);

  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];

  for (let i = 0; i < 64; i++) {
    let f: number;
    let g: number;
    if (i < 16) {
      f = (b & c) | (~b & d);
      g = i;
    } else if (i < 32) {
      f = (d & b) | (~d & c);
      g = (5 * i + 1) % 16;
    } else if (i < 48) {
      f = b ^ c ^ d;
      g = (3 * i + 5) % 16;
    } else {
      f = c ^ (b | ~d);
      g = (7 * i) % 16;
    }
    const tmp = d;
    d = c;
    c = b;
    b = (b + rotl((a + f + MD5_K[i] + m[g]) >>> 0, MD5_S[i])) >>> 0;
    a = tmp;
  }

  state[0] = (state[0] + a) >>> 0;
  state[1] = (state[1] + b) >>> 0;
  state[2] = (state[2] + c) >>> 0;
  state[3] = (state[3] + d) >>> 0;
}

/** MD5 chaining values render in digest byte order (little-endian words). */
function md5StateHex(state: Uint32Array): string {
  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) view.setUint32(i * 4, state[i], true);
  return bytesToHex(out);
}

// ── SHA-1 (FIPS 180-4) ───────────────────────────────────────────────────────

function sha1Compress(state: Uint32Array, view: DataView, offset: number): void {
  const w = new Uint32Array(80);
  for (let j = 0; j < 16; j++) w[j] = view.getUint32(offset + j * 4, false);
  for (let j = 16; j < 80; j++) w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);

  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];

  for (let i = 0; i < 80; i++) {
    let f: number;
    let k: number;
    if (i < 20) {
      f = (b & c) | (~b & d);
      k = 0x5a827999;
    } else if (i < 40) {
      f = b ^ c ^ d;
      k = 0x6ed9eba1;
    } else if (i < 60) {
      f = (b & c) | (b & d) | (c & d);
      k = 0x8f1bbcdc;
    } else {
      f = b ^ c ^ d;
      k = 0xca62c1d6;
    }
    const tmp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
    e = d;
    d = c;
    c = rotl(b, 30);
    b = a;
    a = tmp;
  }

  state[0] = (state[0] + a) >>> 0;
  state[1] = (state[1] + b) >>> 0;
  state[2] = (state[2] + c) >>> 0;
  state[3] = (state[3] + d) >>> 0;
  state[4] = (state[4] + e) >>> 0;
}

/** SHA-1 chaining values render in digest byte order (big-endian words). */
function sha1StateHex(state: Uint32Array): string {
  const out = new Uint8Array(20);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 5; i++) view.setUint32(i * 4, state[i], false);
  return bytesToHex(out);
}

// ── public API ───────────────────────────────────────────────────────────────

/** Hash `bytes` and record the chaining value after every 64-byte block. */
export function traceHash(algo: TraceableAlgorithm, bytes: Uint8Array): HashTrace {
  const littleEndian = algo === 'md5';
  const padded = pad(bytes, littleEndian);
  const view = new DataView(padded.buffer);

  const state =
    algo === 'md5'
      ? new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476])
      : new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
  const compress = algo === 'md5' ? md5Compress : sha1Compress;
  const stateHex = algo === 'md5' ? md5StateHex : sha1StateHex;

  const cvs: string[] = [];
  for (let off = 0; off < padded.length; off += 64) {
    compress(state, view, off);
    cvs.push(stateHex(state));
  }

  return {
    algo,
    cvs,
    messageBlocks: Math.ceil(bytes.length / 64),
    digest: cvs[cvs.length - 1]
  };
}

export interface TraceComparison {
  a: HashTrace;
  b: HashTrace;
  /** Index of the first block whose chaining values differ (-1: never). */
  divergesAt: number;
  /** Index of the first block, at or after divergesAt, from which the chaining
   *  values are equal for every remaining block (-1: never re-converge). */
  convergesAt: number;
}

/** Trace both files and locate where their internal states split and re-join. */
export function compareTraces(
  algo: TraceableAlgorithm,
  bytesA: Uint8Array,
  bytesB: Uint8Array
): TraceComparison {
  const a = traceHash(algo, bytesA);
  const b = traceHash(algo, bytesB);
  const n = Math.max(a.cvs.length, b.cvs.length);

  let divergesAt = -1;
  for (let i = 0; i < n; i++) {
    if (a.cvs[i] !== b.cvs[i]) {
      divergesAt = i;
      break;
    }
  }

  let convergesAt = -1;
  if (divergesAt !== -1 && a.cvs.length === b.cvs.length) {
    for (let i = n - 1; i >= divergesAt; i--) {
      if (a.cvs[i] !== b.cvs[i]) break;
      convergesAt = i;
    }
  }

  return { a, b, divergesAt, convergesAt };
}
