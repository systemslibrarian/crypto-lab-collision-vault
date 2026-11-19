#!/usr/bin/env python3
"""Independent Python check of the Neulaser fixtures used by the TypeScript exhibit.

Neulaser is a first-round NGCC hash candidate (v2, specification dated 30 June 2026).
This file is a second implementation, written from the equations in "Structural
Analysis of Seven Hash Functions Submitted to the NGCC", Section 4 and Appendix A,
and from the padding rule in Section 2.1 of the v2 specification. It is not derived
from the submitters' code and shares no code with src/research/neulaser.ts.

It reads the same two fixture files the TypeScript tests read and fails (non-zero
exit) if any published value or official known-answer test does not reproduce.
"""
import json
import sys
from pathlib import Path

M32 = 0xFFFFFFFF
P = 4294967291  # 2^32 - 5


def _gmul(a, b):  # GF(2^8) modulo z^8 + z^5 + z^3 + z^2 + 1
    r = 0
    while b:
        if b & 1:
            r ^= a
        a <<= 1
        if a & 0x100:
            a ^= 0x12D
        b >>= 1
    return r


def _rotr8(v, k):
    return ((v >> k) | (v << (8 - k))) & 0xFF


_INV = [0] * 256
for _a in range(1, 256):
    for _b in range(1, 256):
        if _gmul(_a, _b) == 1:
            _INV[_a] = _b
            break
SBOX = [_INV[x] ^ _rotr8(_INV[x], 1) ^ _rotr8(_INV[x], 3) ^ _rotr8(_INV[x], 4) ^ _rotr8(_INV[x], 6) ^ 0xA7
        for x in range(256)]


def rotl32(x, k):
    k %= 32
    return ((x << k) | (x >> (32 - k))) & M32 if k else x


def S(w):
    return (SBOX[w >> 24] << 24) | (SBOX[(w >> 16) & 255] << 16) | (SBOX[(w >> 8) & 255] << 8) | SBOX[w & 255]


def L1(x):
    return x ^ rotl32(x, 2) ^ rotl32(x, 10) ^ rotl32(x, 18) ^ rotl32(x, 24)


def L2(x):
    return x ^ rotl32(x, 8) ^ rotl32(x, 14) ^ rotl32(x, 22) ^ rotl32(x, 30)


def F_parts(r0, r1, r2, r3):
    a = (r0 + r1) & M32
    b = r2 ^ r3
    ab = (a << 32) | b
    ab = ((ab << 16) | (ab >> 48)) & ((1 << 64) - 1)
    u, v = ab >> 32, ab & M32
    l1, l2 = L1(u), L2(v)
    s1, s2 = S(l1), S(l2)
    return u, v, l1, l2, s1, s2, ((s1 ^ rotl32(r1, 8)) + s2) & M32


def F(r0, r1, r2, r3):
    return F_parts(r0, r1, r2, r3)[6]


def phi(L):
    lin = (8193 * L[0] + 16777217 * L[4] + 4194304 * L[9] + 9 * L[13] + 524288 * L[15]) % P
    return (lin + F(L[15], L[10], L[5], L[0])) % P


OFFSETS = {3: [(0, 1), (1, 2), (2, 0), (1, 0)], 4: [(0, 1), (2, 0), (1, 3), (3, 2)], 5: [(0, 1), (2, 4), (3, 1), (4, 3)]}


def gamma(s, k, r, i):
    (a0, b0), (a1, b1), (a2, b2), (a3, b3) = OFFSETS[k]

    def w(m, j):
        return s[(i + r + m) % k][j]

    x = w(a0, 14) ^ rotl32(w(b0, 9), 7)
    y = (w(a1, 9) + w(b1, 6)) & M32
    z = w(a2, 6) ^ rotl32(w(b2, 1), 11)
    q = (w(a3, 1) + w(b3, 14)) & M32
    return F(x, y, z, q) ^ rotl32((0x9E3779B9 ^ r ^ i) & M32, (r + i) % 32)


def update(s, k, r):
    g = [gamma(s, k, r, i) for i in range(k)]
    taps = {3: (1, 5), 7: (2, 13), 11: ((1, 21) if k == 3 else (3, 21))}
    out = []
    for i in range(k):
        L = s[i]
        n = [0] * 16
        for j in range(15):
            if j in taps:
                d, t = taps[j]
                n[j] = (L[j + 1] ^ rotl32(g[(i + d) % k], t)) % P
            else:
                n[j] = L[j + 1]
        n[15] = (phi(L) ^ g[i]) % P
        out.append(n)
    return out


def load(v, block, k):
    data = v + block
    words = [int.from_bytes(data[4 * t:4 * t + 4], 'big') for t in range(len(data) // 4)]
    assert len(words) == 16 * k
    return [words[16 * i:16 * i + 16] for i in range(k)]  # direct load, no reduction


def prng(v, block, k, nbits):
    s = load(v, block, k)
    for r in range(32):
        s = update(s, k, r)
    out = b''
    for r in range(32, 32 + -(-nbits // (32 * k))):
        s = update(s, k, r)
        for i in range(k):
            o = ((s[i][13] ^ s[(i + 1) % k][8]) + (s[(i + 2) % k][4] ^ s[(i + 3) % k][2])) & M32
            out += o.to_bytes(4, 'big')
    return out[:nbits // 8]


def iv(n):
    words = []
    for i in range((n + 64) // 32):
        t = (0x9E3779B9 * (i + 1)) & M32
        words.append(rotl32(t, i % 32) ^ rotl32(0x6A09E667 ^ 1024, (7 * i) % 32))
    return b''.join(w.to_bytes(4, 'big') for w in words)


MODULES = {512: 3, 768: 4, 1024: 5}


def block_bytes(n):
    return 64 * MODULES[n] - (n + 64) // 8


def pad(n, message, bit_length):
    """Specification Section 2.1: M || 1 || 0^z || len64(M), bits taken MSB first."""
    bits = block_bytes(n) * 8
    whole, spare = divmod(bit_length, 8)
    buf = bytearray(message[:whole + (1 if spare else 0)])
    if spare:
        buf[-1] = (buf[-1] & ((0xFF << (8 - spare)) & 0xFF)) | (0x80 >> spare)
    else:
        buf.append(0x80)
    total = bit_length + 1 + 64
    total += (-total) % bits
    buf += bytes(total // 8 - 8 - len(buf))
    buf += bit_length.to_bytes(8, 'big')
    size = bits // 8
    return [bytes(buf[i:i + size]) for i in range(0, len(buf), size)]


def neulaser(n, message, bit_length=None):
    if bit_length is None:
        bit_length = len(message) * 8
    k = MODULES[n]
    vb = (n + 64) // 8
    blocks = pad(n, message, bit_length)

    def constant(j):
        return bytes(vb - 8) + j.to_bytes(8, 'big')

    v = bytes(x ^ y for x, y in zip(iv(n), constant(0)))
    for j, block in enumerate(blocks):
        last = j == len(blocks) - 1
        z = prng(v, block, k, (n + 64) + (n if last else 0))
        if last:
            return z[vb:vb + n // 8]
        v = bytes(x ^ y for x, y in zip(z[:vb], constant(j + 1)))


def corollary3_message(n, x):
    offset = 64 * (MODULES[n] - 1) - (n + 64) // 8
    return bytes(offset) + x.to_bytes(4, 'big') + bytes(block_bytes(n) - offset - 4)


def main():
    root = Path(__file__).resolve().parents[1]
    published = json.loads((root / 'src/research/neulaser-vectors.json').read_text())
    kat = json.loads((root / 'src/__tests__/fixtures/neulaser-official-kat.json').read_text())
    checks = 0

    # Specification vectors: IV words and two S-box rows.
    assert iv(1024).hex() == ''.join(published['specVectors']['ivWordsHex'])
    assert bytes(SBOX[0x00:0x10]).hex() == published['specVectors']['sboxRow0Hex']
    assert bytes(SBOX[0xF0:0x100]).hex() == published['specVectors']['sboxRowFHex']
    checks += 3

    # Section 4.1: the intermediate table and the common feedback value.
    for row in published['feedback']['inputs']:
        x = int(row['xHex'], 16)
        u, v, l1, l2, s1, s2, f = F_parts(0, 0, 0, x)
        got = {'uF': u, 'vF': v, 'l1': l1, 'l2': l2, 'sL1': s1, 'sL2': s2, 'linearTerm': (8193 * x) % P, 'f': f}
        for key, value in got.items():
            assert f'{value:08x}' == row[key], (row['xHex'], key)
        assert f'{phi([x] + [0] * 15):08x}' == published['feedback']['valueHex']
        checks += 1

    # Section 4.1: the first repeat, and where it occurs.
    seen = {}
    first = None
    for x in range(1 << 20):
        value = phi([x] + [0] * 15)
        if value in seen:
            first = (seen[value], x, x + 1)
            break
        seen[value] = x
    a, b = (int(r['xHex'], 16) for r in published['feedback']['inputs'])
    assert first == (a, b, published['feedback']['evaluations']), first
    checks += 1

    # Corollary 3 and Appendix A.2: the three common digests, and a negative control.
    for n in (512, 768, 1024):
        ma, mb = corollary3_message(n, a), corollary3_message(n, b)
        assert ma != mb
        assert neulaser(n, ma).hex() == neulaser(n, mb).hex() == published['publishedDigests'][str(n)]
        altered = bytearray(mb)
        altered[0] ^= 1
        assert neulaser(n, bytes(altered)).hex() != published['publishedDigests'][str(n)]
        checks += 1

    # Official known-answer tests from the round-one package.
    records = 0
    for n in (512, 768, 1024):
        variant = kat['variants'][str(n)]
        for record in variant['short']:
            digest = neulaser(n, bytes.fromhex(record['messageHex']), record['bitLength']).hex()
            assert digest == record['digestHex'], (n, record['bitLength'])
            records += 1
    print(f'Independent Python verification: {checks} published-value checks and {records} official '
          f'known-answer records reproduced; first feedback repeat after {first[2]} evaluations.')


if __name__ == '__main__':
    try:
        main()
    except AssertionError as error:
        print(f'Neulaser verification FAILED: {error!r}', file=sys.stderr)
        sys.exit(1)
