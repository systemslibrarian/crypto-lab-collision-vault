// SUFFIX EXTENSION — the step that turns a published collision into a forgery.
//
// A collision pair is usually presented as two fixed files, which invites the
// reading "those two files are broken, mine are fine". Merkle–Damgård says
// otherwise: once two messages drive the compression function into the same
// chaining value and then run over identical bytes, EVERYTHING appended to both
// is absorbed identically. So the pair is not two files — it is a reusable seed
// that anyone can grow into a brand-new colliding pair carrying content of their
// choosing, at zero cryptographic cost. That is exactly how the SHAttered PDFs
// and the Flame certificate were assembled from raw near-collision blocks.
//
// Everything here is pure so the verdict logic is unit-testable away from the
// DOM and away from the hash workers. The panel measures; this decides.

/** Which halves receive which bytes. */
export type ExtendMode = 'same' | 'differ' | 'a-only';

export interface ExtendPlan {
  suffixA: Uint8Array;
  suffixB: Uint8Array;
  /** Byte-for-byte equality of the two suffixes (an empty pair counts as equal). */
  suffixesIdentical: boolean;
}

const enc = new TextEncoder();

export function bytesEqual(x: Uint8Array, y: Uint8Array): boolean {
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

export function concatBytes(head: Uint8Array, tail: Uint8Array): Uint8Array {
  const out = new Uint8Array(head.length + tail.length);
  out.set(head, 0);
  out.set(tail, head.length);
  return out;
}

/** Turn the learner's text and chosen mode into the two suffixes actually appended. */
export function planExtension(mode: ExtendMode, textA: string, textB: string): ExtendPlan {
  const a = enc.encode(textA);
  const b = mode === 'same' ? a : mode === 'a-only' ? new Uint8Array(0) : enc.encode(textB);
  return { suffixA: a, suffixB: b, suffixesIdentical: bytesEqual(a, b) };
}

export type ExtendOutcome = 'survives' | 'broken' | 'contradiction';

export interface ExtendVerdict {
  outcome: ExtendOutcome;
  /** What the structural argument says should happen, before hashing. */
  predictedEqual: boolean;
  /** What the digests actually did. */
  measuredEqual: boolean;
  headline: string;
}

/**
 * The verdict is a function of three measurements and nothing else: whether the
 * pair is suffix-closed (decided from the un-padded chaining values), whether
 * the learner appended the same bytes to both halves, and whether the freshly
 * computed digests came out equal.
 *
 * `contradiction` is the case where the prediction and the measurement disagree.
 * It should be unreachable — but a demo that could only ever print the answer it
 * predicted would not be evidence of anything, so the disagreement is a real
 * branch with its own loud rendering rather than an assumption baked into the
 * other two.
 */
export function extensionVerdict(
  preconditionHolds: boolean,
  suffixesIdentical: boolean,
  measuredEqual: boolean
): ExtendVerdict {
  const predictedEqual = preconditionHolds && suffixesIdentical;
  if (measuredEqual !== predictedEqual) {
    return {
      outcome: 'contradiction',
      predictedEqual,
      measuredEqual,
      headline: predictedEqual
        ? 'PREDICTION MISMATCH — the structural argument said the digests would stay equal, and they did not'
        : 'PREDICTION MISMATCH — the digests came out equal where the structural argument said they could not'
    };
  }
  if (measuredEqual) {
    return {
      outcome: 'survives',
      predictedEqual,
      measuredEqual,
      headline: 'STILL COLLIDES — you just minted a new colliding pair'
    };
  }
  return {
    outcome: 'broken',
    predictedEqual,
    measuredEqual,
    headline: suffixesIdentical
      ? 'COLLISION BROKEN — this pair is not suffix-closed'
      : 'COLLISION BROKEN — the appended bytes were not identical'
  };
}

/** One-line reason the prediction came out the way it did, for display. */
export function predictionReason(
  preconditionHolds: boolean,
  suffixesIdentical: boolean
): string {
  if (!preconditionHolds && !suffixesIdentical) {
    return 'the pair is not suffix-closed AND the appended bytes differ';
  }
  if (!preconditionHolds) return 'the pair is not suffix-closed (see the three checks above)';
  if (!suffixesIdentical) return 'the two halves received different bytes, so they stop agreeing at the first appended block';
  return 'the states already agree and both halves receive identical bytes';
}
