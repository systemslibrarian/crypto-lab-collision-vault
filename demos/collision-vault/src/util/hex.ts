// Byte / hex helpers shared by the diff viewer and the hashing layer.
// Everything here is pure and synchronous so it is trivial to unit-test and
// safe to run inside a Web Worker.

const HEX = '0123456789abcdef';

/** Lower-case hex for a single byte (always two chars). */
export function byteToHex(b: number): string {
  return HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
}

/** Lower-case hex string for a byte array (no separators). */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += byteToHex(bytes[i]);
  return out;
}

/** Group a hex digest into space-separated quads for readable display. */
export function groupHex(hex: string, group = 8): string {
  const parts: string[] = [];
  for (let i = 0; i < hex.length; i += group) parts.push(hex.slice(i, i + group));
  return parts.join(' ');
}

/** True only if the two byte arrays are identical in length and content. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Number of leading bytes the two arrays share before the first difference. */
export function sharedPrefixLength(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/** Offset of the first differing byte, or -1 if A and B are byte-identical. */
export function firstDifferenceOffset(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

export interface DiffRegion {
  start: number;
  end: number; // exclusive
}

/**
 * Runs of differing bytes between A and B. Adjacent differences separated by
 * fewer than `mergeGap` equal bytes are merged into one region so the UI can
 * offer a short, navigable list of "where these files diverge" rather than
 * thousands of single-byte hits.
 */
export function diffRegions(a: Uint8Array, b: Uint8Array, mergeGap = 8): DiffRegion[] {
  const n = Math.max(a.length, b.length);
  const regions: DiffRegion[] = [];
  let runStart = -1;
  let lastDiff = -1;
  for (let i = 0; i < n; i++) {
    const differs = a[i] !== b[i]; // out-of-range reads are undefined → differ
    if (differs) {
      if (runStart === -1) runStart = i;
      lastDiff = i;
    } else if (runStart !== -1 && i - lastDiff > mergeGap) {
      regions.push({ start: runStart, end: lastDiff + 1 });
      runStart = -1;
    }
  }
  if (runStart !== -1) regions.push({ start: runStart, end: lastDiff + 1 });
  return regions;
}

/** ASCII printable range (used to render the text gutter in the hex viewer). */
export function isPrintable(b: number): boolean {
  return b >= 0x20 && b <= 0x7e;
}
