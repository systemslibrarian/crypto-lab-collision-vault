import { describe, it, expect } from 'vitest';
import {
  bytesEqual,
  sharedPrefixLength,
  firstDifferenceOffset,
  diffRegions,
  bytesToHex,
  byteToHex,
  groupHex,
  isPrintable
} from '../util/hex';

describe('hex/diff utilities', () => {
  it('byteToHex / bytesToHex produce lower-case fixed-width hex', () => {
    expect(byteToHex(0)).toBe('00');
    expect(byteToHex(255)).toBe('ff');
    expect(byteToHex(10)).toBe('0a');
    expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef');
  });

  it('groupHex splits into spaced groups', () => {
    expect(groupHex('deadbeefcafe', 4)).toBe('dead beef cafe');
  });

  it('bytesEqual is content + length sensitive', () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('sharedPrefixLength counts leading equal bytes', () => {
    expect(sharedPrefixLength(new Uint8Array([1, 2, 3, 9]), new Uint8Array([1, 2, 3, 8]))).toBe(3);
    expect(sharedPrefixLength(new Uint8Array([9]), new Uint8Array([8]))).toBe(0);
    expect(sharedPrefixLength(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(2);
  });

  it('firstDifferenceOffset returns -1 only for identical arrays', () => {
    expect(firstDifferenceOffset(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(-1);
    expect(firstDifferenceOffset(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]))).toBe(1);
    // Differing length but common prefix → first diff at the shorter length.
    expect(firstDifferenceOffset(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(2);
  });

  it('diffRegions merges nearby differences and reports runs', () => {
    const a = new Uint8Array([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    const b = new Uint8Array([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
    // Two isolated differences far apart (> mergeGap) → two regions.
    const regions = diffRegions(a, b, 4);
    expect(regions.length).toBe(2);
    expect(regions[0]).toEqual({ start: 2, end: 3 });
    expect(regions[1]).toEqual({ start: 13, end: 14 });
  });

  it('diffRegions merges differences within the gap threshold', () => {
    const a = new Uint8Array([1, 0, 1]);
    const b = new Uint8Array([2, 0, 2]);
    const regions = diffRegions(a, b, 4);
    expect(regions).toEqual([{ start: 0, end: 3 }]);
  });

  it('isPrintable matches the ASCII printable range', () => {
    expect(isPrintable(0x41)).toBe(true); // 'A'
    expect(isPrintable(0x20)).toBe(true); // space
    expect(isPrintable(0x7e)).toBe(true); // '~'
    expect(isPrintable(0x1f)).toBe(false);
    expect(isPrintable(0x7f)).toBe(false);
  });
});
