/** Neulaser, a first-round candidate in China's NGCC hash competition.
 *
 * Version implemented: Neulaser v2, specification dated 30 June 2026, as
 * shipped in the round-one package (Neulaser.zip, SHA-256
 * ffa76faaf6ae1c939ef6b1a726d6bcef19f0f0df63daddfe74a82e2831c4c6b3).
 *
 * Written from two documents, and from no submitter code:
 *   - Yuan, Wu, Wei, Shen, Liu, Zhang, "Structural Analysis of Seven Hash
 *     Functions Submitted to the NGCC", Section 4 and Appendix A (cited below
 *     as "the analysis");
 *   - the Neulaser v2 specification, Sections 2 to 4 (cited as "the spec").
 *
 * The spec leaves one thing open: how V || K becomes state words. Both v2
 * implementations load it directly as big-endian 32-bit words with no
 * reduction modulo p (the analysis, Section 4, opening paragraph). That is the
 * rule used here, and the official known-answer tests confirm it.
 *
 * This is a teaching implementation for verifying published values. It is not
 * constant-time and it is not a hashing library.
 */

/** p = 2^32 - 5, the word modulus (spec Section 3; the analysis, Section 4.1). */
export const NEULASER_P = 4294967291;

export type NeulaserVariant = 512 | 768 | 1024;

export interface VariantParams {
  /** Digest length n in bits. */
  readonly digestBits: NeulaserVariant;
  /** Number of 16-word modules (k in the analysis, mu in the spec). */
  readonly modules: number;
  /** Message block length in bytes (B_n / 8). */
  readonly blockBytes: number;
  /** Chaining value length in bytes ((n + 64) / 8). */
  readonly chainBytes: number;
  /** Byte offset, inside a message block, of the last module's first word (d_n). */
  readonly lastModuleOffset: number;
}

function params(digestBits: NeulaserVariant, modules: number): VariantParams {
  const chainBytes = (digestBits + 64) / 8;
  return {
    digestBits,
    modules,
    blockBytes: 64 * modules - chainBytes,
    chainBytes,
    lastModuleOffset: 64 * (modules - 1) - chainBytes
  };
}

/** (n, k, B_n/8, d_n) = (512, 3, 120, 56), (768, 4, 152, 88), (1024, 5, 184, 120):
 *  the table in Section 4.3 of the analysis, derived here from n and k. */
export const NEULASER_VARIANTS: Readonly<Record<NeulaserVariant, VariantParams>> = {
  512: params(512, 3),
  768: params(768, 4),
  1024: params(1024, 5)
};

export const NEULASER_VARIANT_LIST: readonly NeulaserVariant[] = [512, 768, 1024];

// ── S-box: inversion in F2[z]/(z^8 + z^5 + z^3 + z^2 + 1), then an affine map ──

/** Multiply in GF(2^8) modulo z^8 + z^5 + z^3 + z^2 + 1 (0x12d). */
function gfMul(a: number, b: number): number {
  let r = 0;
  while (b) {
    if (b & 1) r ^= a;
    a <<= 1;
    if (a & 0x100) a ^= 0x12d;
    b >>= 1;
  }
  return r;
}

const rotr8 = (v: number, k: number): number => ((v >>> k) | (v << (8 - k))) & 0xff;

function buildSbox(): Uint8Array {
  const inverse = new Uint8Array(256);
  for (let a = 1; a < 256; a++) {
    for (let b = 1; b < 256; b++) {
      if (gfMul(a, b) === 1) {
        inverse[a] = b;
        break;
      }
    }
  }
  const box = new Uint8Array(256);
  for (let x = 0; x < 256; x++) {
    const v = inverse[x];
    // Equation (11) of the analysis; spec Section 4.1.4.
    box[x] = v ^ rotr8(v, 1) ^ rotr8(v, 3) ^ rotr8(v, 4) ^ rotr8(v, 6) ^ 0xa7;
  }
  return box;
}

export const NEULASER_SBOX: Uint8Array = buildSbox();

// ── word functions ──────────────────────────────────────────────────────────

export function rotl32(x: number, k: number): number {
  const s = k & 31;
  return s === 0 ? x >>> 0 : ((x << s) | (x >>> (32 - s))) >>> 0;
}

/** Apply the S-box to each of the four bytes of a word. */
export function sboxWord(w: number): number {
  return (
    ((NEULASER_SBOX[w >>> 24] << 24) |
      (NEULASER_SBOX[(w >>> 16) & 0xff] << 16) |
      (NEULASER_SBOX[(w >>> 8) & 0xff] << 8) |
      NEULASER_SBOX[w & 0xff]) >>>
    0
  );
}

export function L1(x: number): number {
  return (x ^ rotl32(x, 2) ^ rotl32(x, 10) ^ rotl32(x, 18) ^ rotl32(x, 24)) >>> 0;
}

export function L2(x: number): number {
  return (x ^ rotl32(x, 8) ^ rotl32(x, 14) ^ rotl32(x, 22) ^ rotl32(x, 30)) >>> 0;
}

/** Every intermediate word of one evaluation of F, in the order of the table
 *  in Section 4.1 of the analysis. */
export interface FTrace {
  readonly uF: number;
  readonly vF: number;
  readonly l1: number;
  readonly l2: number;
  readonly sL1: number;
  readonly sL2: number;
  readonly f: number;
}

/** The nonlinear word function F(R0, R1, R2, R3), with its intermediates. */
export function traceF(r0: number, r1: number, r2: number, r3: number): FTrace {
  const a = (r0 + r1) >>> 0;
  const b = (r2 ^ r3) >>> 0;
  // U_F || V_F = rotl64(A || B, 16)
  const uF = ((a << 16) | (b >>> 16)) >>> 0;
  const vF = ((b << 16) | (a >>> 16)) >>> 0;
  const l1 = L1(uF);
  const l2 = L2(vF);
  const sL1 = sboxWord(l1);
  const sL2 = sboxWord(l2);
  // The arithmetic in the nonlinear layer is modulo 2^32.
  const f = (((sL1 ^ rotl32(r1, 8)) >>> 0) + sL2) >>> 0;
  return { uF, vF, l1, l2, sL1, sL2, f };
}

export function F(r0: number, r1: number, r2: number, r3: number): number {
  return traceF(r0, r1, r2, r3).f;
}

/** (c * s) mod p for c < 2^25 and s < 2^32, without leaving the exactly
 *  representable integers: c * s can reach 2^57, which a double cannot hold. */
function mulMod(c: number, s: number): number {
  const high = s >>> 16;
  const low = s & 0xffff;
  return (((c * high) % NEULASER_P) * 65536 + c * low) % NEULASER_P;
}

/** Equation (9): the linear part of the local feedback, reduced modulo p. */
export function linearFeedback(module: ArrayLike<number>): number {
  return (
    (mulMod(8193, module[0]) +
      mulMod(16777217, module[4]) +
      mulMod(4194304, module[9]) +
      mulMod(9, module[13]) +
      mulMod(524288, module[15])) %
    NEULASER_P
  );
}

/** Equation (10): Phi(L) = (red_p(l_lin(L)) + F(s15, s10, s5, s0)) mod p.
 *
 *  The final reduction is modulo p. Reading the sum modulo 2^32, or leaving it
 *  unreduced, gives a different function: the published pair still collides,
 *  but neither the published digests nor any official known-answer test
 *  reproduces. The known-answer tests in `neulaser.test.ts` pin this reading. */
export function localFeedback(module: ArrayLike<number>): number {
  return (linearFeedback(module) + F(module[15], module[10], module[5], module[0])) % NEULASER_P;
}

/** The feedback of the module (x, 0, ..., 0): f(x) in Section 4.1. */
export function oneWordFeedback(x: number): number {
  return (mulMod(8193, x) + F(0, 0, 0, x)) % NEULASER_P;
}

/** 8193 * x mod p, the linear term shown beside F in the Section 4.1 table. */
export function oneWordLinearTerm(x: number): number {
  return mulMod(8193, x);
}

// ── the global update (equation (12) and Appendix A.1) ──────────────────────

/** The four (a, b) module-offset pairs for each module count. */
const OFFSETS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  3: [[0, 1], [1, 2], [2, 0], [1, 0]],
  4: [[0, 1], [2, 0], [1, 3], [3, 2]],
  5: [[0, 1], [2, 4], [3, 1], [4, 3]]
};

const GOLDEN = 0x9e3779b9;

const reduceWord = (w: number): number => (w >= NEULASER_P ? w - NEULASER_P : w);

/** The confusion vector Gamma_r: one word per module, read from the state
 *  before the update, and only from positions 14, 9, 6 and 1. */
export function confusionVector(state: Uint32Array, modules: number, round: number): Uint32Array {
  const table = OFFSETS[modules];
  if (!table) throw new Error('Neulaser has 3, 4 or 5 modules.');
  const word = (i: number, offset: number, position: number): number =>
    state[((i + round + offset) % modules) * 16 + position];
  const out = new Uint32Array(modules);
  for (let i = 0; i < modules; i++) {
    const x = (word(i, table[0][0], 14) ^ rotl32(word(i, table[0][1], 9), 7)) >>> 0;
    const y = (word(i, table[1][0], 9) + word(i, table[1][1], 6)) >>> 0;
    const z = (word(i, table[2][0], 6) ^ rotl32(word(i, table[2][1], 1), 11)) >>> 0;
    const w = (word(i, table[3][0], 1) + word(i, table[3][1], 14)) >>> 0;
    const constant = rotl32((GOLDEN ^ round ^ i) >>> 0, (round + i) % 32);
    out[i] = (F(x, y, z, w) ^ constant) >>> 0;
  }
  return out;
}

/** One simultaneous state update at round `round`. Returns a new state.
 *
 *  Positions 1 to 15 are copied down by the shift. The old position 0 of each
 *  module reaches the next state only through that module's local feedback,
 *  which is the fact the collision rests on. */
export function updateState(state: Uint32Array, modules: number, round: number): Uint32Array {
  const gamma = confusionVector(state, modules, round);
  const next = new Uint32Array(state.length);
  const lastInjection = modules === 3 ? 1 : 3;
  for (let i = 0; i < modules; i++) {
    const base = i * 16;
    const module = state.subarray(base, base + 16);
    for (let j = 0; j < 15; j++) next[base + j] = module[j + 1];
    next[base + 3] = reduceWord((module[4] ^ rotl32(gamma[(i + 1) % modules], 5)) >>> 0);
    next[base + 7] = reduceWord((module[8] ^ rotl32(gamma[(i + 2) % modules], 13)) >>> 0);
    next[base + 11] = reduceWord(
      (module[12] ^ rotl32(gamma[(i + lastInjection) % modules], 21)) >>> 0
    );
    next[base + 15] = reduceWord((localFeedback(module) ^ gamma[i]) >>> 0);
  }
  return next;
}

// ── the PRNG and the hash mode ──────────────────────────────────────────────

/** Number of updates run before any output is produced. */
export const BLANK_ROUNDS = 32;

/** Load V || K as consecutive big-endian 32-bit words, with no reduction. */
export function loadState(chain: Uint8Array, block: Uint8Array, modules: number): Uint32Array {
  if (chain.length + block.length !== 64 * modules) {
    throw new Error(`V || K must be exactly ${64 * modules} bytes for ${modules} modules.`);
  }
  const data = new Uint8Array(64 * modules);
  data.set(chain);
  data.set(block, chain.length);
  const view = new DataView(data.buffer);
  const state = new Uint32Array(16 * modules);
  for (let t = 0; t < state.length; t++) state[t] = view.getUint32(4 * t, false);
  return state;
}

/** Run the PRNG on (V, K) and return the first `bits` output bits. */
export function prng(chain: Uint8Array, block: Uint8Array, modules: number, bits: number): Uint8Array {
  let state = loadState(chain, block, modules);
  for (let round = 0; round < BLANK_ROUNDS; round++) state = updateState(state, modules, round);
  const outputRounds = Math.ceil(bits / (32 * modules));
  const out = new Uint8Array(outputRounds * 4 * modules);
  const view = new DataView(out.buffer);
  for (let step = 0; step < outputRounds; step++) {
    state = updateState(state, modules, BLANK_ROUNDS + step);
    for (let i = 0; i < modules; i++) {
      const word =
        (((state[i * 16 + 13] ^ state[((i + 1) % modules) * 16 + 8]) >>> 0) +
          ((state[((i + 2) % modules) * 16 + 4] ^ state[((i + 3) % modules) * 16 + 2]) >>> 0)) >>>
        0;
      view.setUint32((step * modules + i) * 4, word, false);
    }
  }
  return out.slice(0, bits / 8);
}

/** IV_n: a prefix of one word sequence (Appendix A.2; spec Section 4.2). */
export function initialVector(variant: NeulaserVariant): Uint8Array {
  const words = (variant + 64) / 32;
  const out = new Uint8Array(words * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < words; i++) {
    const t = Math.imul(GOLDEN, i + 1) >>> 0;
    const v = (rotl32(t, i % 32) ^ rotl32((0x6a09e667 ^ 1024) >>> 0, (7 * i) % 32)) >>> 0;
    view.setUint32(i * 4, v, false);
  }
  return out;
}

/** V XOR C_j in place, where C_j = 0^(v-64) || BE64(j). */
function xorBlockConstant(chain: Uint8Array, index: number): void {
  const view = new DataView(chain.buffer, chain.byteOffset, chain.byteLength);
  const at = chain.length - 8;
  view.setUint32(at, (view.getUint32(at, false) ^ Math.floor(index / 0x100000000)) >>> 0, false);
  view.setUint32(at + 4, (view.getUint32(at + 4, false) ^ (index >>> 0)) >>> 0, false);
}

/** The first chaining value V_0 = IV_n XOR C_0. C_0 is all zero, so this is IV_n. */
export function firstChainingValue(variant: NeulaserVariant): Uint8Array {
  const chain = initialVector(variant);
  xorBlockConstant(chain, 0);
  return chain;
}

/** Hash already-padded blocks: equation (13) of the analysis. */
export function hashPaddedBlocks(variant: NeulaserVariant, blocks: readonly Uint8Array[]): Uint8Array {
  const { modules, blockBytes, chainBytes } = NEULASER_VARIANTS[variant];
  if (blocks.length === 0) throw new Error('A padded message has at least one block.');
  let chain = firstChainingValue(variant);
  for (let j = 0; j < blocks.length; j++) {
    if (blocks[j].length !== blockBytes) {
      throw new Error(`Every Neulaser-${variant} block is ${blockBytes} bytes.`);
    }
    const last = j === blocks.length - 1;
    const stream = prng(chain, blocks[j], modules, 8 * chainBytes + (last ? variant : 0));
    if (last) return stream.slice(chainBytes, chainBytes + variant / 8);
    chain = stream.slice(0, chainBytes);
    xorBlockConstant(chain, j + 1);
  }
  throw new Error('unreachable');
}

/** Spec Section 2.1: M* = M || 1 || 0^z || len64(M), cut into B_n-bit blocks.
 *  Bits are taken most-significant first, as the official test vectors do. */
export function padMessage(
  variant: NeulaserVariant,
  message: Uint8Array,
  bitLength: number = message.length * 8
): Uint8Array[] {
  const { blockBytes } = NEULASER_VARIANTS[variant];
  if (!Number.isInteger(bitLength) || bitLength < 0 || bitLength > message.length * 8) {
    throw new Error('The bit length must fit inside the supplied bytes.');
  }
  const blockBits = blockBytes * 8;
  const totalBits = Math.ceil((bitLength + 1 + 64) / blockBits) * blockBits;
  const padded = new Uint8Array(totalBits / 8);
  const wholeBytes = bitLength >>> 3;
  const spare = bitLength & 7;
  padded.set(message.subarray(0, wholeBytes));
  if (spare === 0) {
    padded[wholeBytes] = 0x80;
  } else {
    const kept = message[wholeBytes] & ((0xff << (8 - spare)) & 0xff);
    padded[wholeBytes] = kept | (0x80 >>> spare);
  }
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);
  const blocks: Uint8Array[] = [];
  for (let at = 0; at < padded.length; at += blockBytes) blocks.push(padded.subarray(at, at + blockBytes));
  return blocks;
}

/** Neulaser-n of a message given as bytes plus a bit length. */
export function neulaserHash(
  variant: NeulaserVariant,
  message: Uint8Array,
  bitLength: number = message.length * 8
): Uint8Array {
  return hashPaddedBlocks(variant, padMessage(variant, message, bitLength));
}

// ── the published collision (Section 4 of the analysis) ─────────────────────

/** The two one-word inputs with equal local feedback. */
export const COLLIDING_WORDS = { a: 0x00002743, b: 0x0002ad84 } as const;

/** Corollary 3: M_{n,x} = 00^{d_n} || BE32(x) || 00^60. Exactly one block. */
export function corollary3Message(variant: NeulaserVariant, x: number): Uint8Array {
  const { blockBytes, lastModuleOffset } = NEULASER_VARIANTS[variant];
  const message = new Uint8Array(blockBytes);
  new DataView(message.buffer).setUint32(lastModuleOffset, x >>> 0, false);
  return message;
}

export interface FeedbackRepeat {
  readonly earlier: number;
  readonly later: number;
  readonly feedback: number;
  /** Feedback evaluations performed, counting the one that produced the repeat. */
  readonly evaluations: number;
}

/** Enumerate x = 0, 1, 2, ... and stop at the first repeated value of f(x).
 *  Returns null if no repeat is seen within `limit` evaluations. */
export function firstFeedbackRepeat(limit: number): FeedbackRepeat | null {
  const seen = new Map<number, number>();
  for (let x = 0; x < limit; x++) {
    const feedback = oneWordFeedback(x);
    const earlier = seen.get(feedback);
    if (earlier !== undefined) return { earlier, later: x, feedback, evaluations: x + 1 };
    seen.set(feedback, x);
  }
  return null;
}

export interface MergeTrace {
  /** State after loading V_0 || M_{n,a}, before any update. */
  readonly beforeA: Uint32Array;
  readonly beforeB: Uint32Array;
  /** State after the single update at round 0. */
  readonly afterA: Uint32Array;
  readonly afterB: Uint32Array;
  /** Indices (module * 16 + position) where the two states differ. */
  readonly differBefore: number[];
  readonly differAfter: number[];
}

function differingIndices(a: Uint32Array, b: Uint32Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

/** Load two one-block messages under the prescribed IV and apply one update. */
export function traceMerge(variant: NeulaserVariant, messageA: Uint8Array, messageB: Uint8Array): MergeTrace {
  const { modules } = NEULASER_VARIANTS[variant];
  const chain = firstChainingValue(variant);
  const beforeA = loadState(chain, messageA, modules);
  const beforeB = loadState(chain, messageB, modules);
  const afterA = updateState(beforeA, modules, 0);
  const afterB = updateState(beforeB, modules, 0);
  return {
    beforeA,
    beforeB,
    afterA,
    afterB,
    differBefore: differingIndices(beforeA, beforeB),
    differAfter: differingIndices(afterA, afterB)
  };
}

export const hexWord = (w: number): string => (w >>> 0).toString(16).padStart(8, '0');
