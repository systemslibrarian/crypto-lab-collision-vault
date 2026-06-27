// Manifest of bundled, REAL, published collision pairs.
//
// Every entry points at byte-for-byte artifacts shipped in `public/pairs/`. The
// digests recorded here are used only as a load-time integrity check (invariant
// 1 / 5): the loader recomputes the broken hash over the bytes it actually
// fetched and refuses to display a pair whose digest does not match — so a
// corrupted asset surfaces as an explicit error instead of a fake "collision".
//
// Adding a pair is a DATA-ONLY change: drop the two byte files into
// public/pairs/, then append an entry below. No UI or hashing code changes.
//   ── add-collision-pair extension point ──

import type { HashAlgorithm } from '../hashing/index';

export type CollisionType = 'identical-prefix' | 'chosen-prefix';

export interface Source {
  title: string;
  authors: string;
  year: number;
  url: string;
}

export interface PairManifestEntry {
  id: string;
  label: string;
  /** Structural family of the attack — drives the explainer panel. */
  type: CollisionType;
  /** The broken hash under which fileA and fileB collide. */
  brokenHash: HashAlgorithm;
  /** Bare filenames under public/pairs/. */
  fileA: string;
  fileB: string;
  /** Lower-case hex of the broken-hash digest both files share (integrity check). */
  expectedBrokenDigest: string;
  /** One-line caption shown under the pair in the selector. */
  caption: string;
  /** Longer real-history note. */
  history: string;
  /** Real-world consequence of this attack class (esp. chosen-prefix). */
  realWorldImpact: string;
  source: Source;
  /** True for PDF artifacts that also render as visibly different documents. */
  isPdf: boolean;
  /** Human-readable description of what each side "is". */
  describesA: string;
  describesB: string;
}

export const PAIRS: PairManifestEntry[] = [
  {
    id: 'shattered',
    label: 'SHAttered — SHA-1 PDF pair',
    type: 'identical-prefix',
    brokenHash: 'sha-1',
    fileA: 'shattered-1.pdf',
    fileB: 'shattered-2.pdf',
    expectedBrokenDigest: '38762cf7f55934b34d179ae6a4c80cadccbb7f0a',
    caption: 'Two different PDFs, one SHA-1 digest — the first public SHA-1 collision (2017).',
    history:
      'In February 2017 the CWI Amsterdam / Google "SHAttered" team produced the first ' +
      'public SHA-1 collision: two valid PDF documents that display different content yet ' +
      'share an identical SHA-1 hash. It took roughly 2^63 SHA-1 computations (~6,500 CPU-' +
      'years, accelerated with GPUs) — far cheaper than the 2^80 a brute-force birthday ' +
      'attack would need. It is an identical-prefix collision: both files share a common ' +
      'prefix, then diverge into specially crafted near-collision blocks.',
    realWorldImpact:
      'SHA-1 was still used by TLS certificates, Git object IDs, and signature systems. ' +
      'SHAttered forced browsers and CAs to finish retiring SHA-1.',
    source: {
      title: 'The first collision for full SHA-1 (shattered.io)',
      authors: 'Stevens, Bursztein, Karpman, Albertini, Markov',
      year: 2017,
      url: 'https://shattered.io/'
    },
    isPdf: true,
    describesA: 'PDF document A (renders with one background)',
    describesB: 'PDF document B (renders with a different background)'
  },
  {
    id: 'md5-ipc',
    label: 'MD5 identical-prefix (Wang)',
    type: 'identical-prefix',
    brokenHash: 'md5',
    fileA: 'md5-ipc-1.bin',
    fileB: 'md5-ipc-2.bin',
    expectedBrokenDigest: '79054025255fb1a26e4bc422aef54eb4',
    caption: 'The classic 128-byte MD5 collision blocks that broke MD5 in 2004.',
    history:
      'Xiaoyun Wang and Hongbo Yu announced the first practical MD5 collision in 2004, ' +
      'overturning the assumption that MD5 was collision-resistant. This is the canonical ' +
      'pair of two 128-byte messages: a shared prefix followed by a pair of near-collision ' +
      'blocks that differ in only a handful of bytes, yet yield the identical MD5 digest ' +
      '79054025255fb1a26e4bc422aef54eb4. Marc Stevens later turned this into the ' +
      'seconds-fast "fastcoll" tool.',
    realWorldImpact:
      'Identical-prefix collisions let an attacker build two files with the same hash only ' +
      'when they control BOTH files from the start — dangerous, but weaker than chosen-prefix.',
    source: {
      title: 'How to Break MD5 and Other Hash Functions',
      authors: 'Wang & Yu',
      year: 2005,
      url: 'https://link.springer.com/chapter/10.1007/11426639_2'
    },
    isPdf: false,
    describesA: '128-byte message A',
    describesB: '128-byte message B (differs in a few bytes)'
  },
  {
    id: 'md5-cpc',
    label: 'MD5 chosen-prefix',
    type: 'chosen-prefix',
    brokenHash: 'md5',
    fileA: 'md5-cpc-1.bin',
    fileB: 'md5-cpc-2.bin',
    expectedBrokenDigest: 'eee3c5912df242d08b0662563f34819d',
    caption: 'Two ATTACKER-CHOSEN different starts collided under MD5 — the dangerous kind.',
    history:
      'A chosen-prefix MD5 collision (Stevens, Lenstra & de Weger, 2007): the attacker picks ' +
      'two arbitrary, different prefixes and then computes "birthday" + near-collision blocks ' +
      'that drive both to the same MD5 digest. These two 640-byte files share NO common ' +
      'prefix — they begin differently from byte 0 — yet collide. This is strictly stronger ' +
      'than an identical-prefix collision.',
    realWorldImpact:
      'Chosen-prefix MD5 collisions enabled a rogue CA certificate (2008) and were used by ' +
      'the Flame espionage malware (2012) to forge a Microsoft code-signing certificate and ' +
      'distribute itself via Windows Update.',
    source: {
      title: 'Chosen-prefix collisions for MD5 and colliding X.509 certificates',
      authors: 'Stevens, Lenstra & de Weger',
      year: 2007,
      url: 'https://www.win.tue.nl/hashclash/ChosenPrefixCollisions/'
    },
    isPdf: false,
    describesA: '640-byte file A (attacker-chosen prefix #1)',
    describesB: '640-byte file B (attacker-chosen prefix #2)'
  }
  // ── add-collision-pair extension point: append new PairManifestEntry items here.
  //    e.g. a documented Git SHA-1 scenario, or a TLS/cert chosen-prefix illustration.
];

export function getPair(id: string): PairManifestEntry | undefined {
  return PAIRS.find((p) => p.id === id);
}
