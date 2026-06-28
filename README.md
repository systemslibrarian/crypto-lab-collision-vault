# crypto-lab-collision-vault

## What It Is

Collision Vault verifies **real, already-published hash collisions** for the broken hash
functions **MD5** (RFC 1321) and **SHA-1** (FIPS 180), and contrasts them with the
collision-resistant **SHA-256** (FIPS 180-4) and **SHA3-256** (FIPS 202). These are
cryptographic hash functions: unkeyed, public functions that map arbitrary input to a
fixed-size digest, whose core promise is *collision resistance* — it should be infeasible
to find two different inputs with the same digest. MD5 (Wang & Yu, 2004) and SHA-1
(SHAttered, 2017) no longer hold that promise, and this demo recomputes digests live in the
browser over bundled, genuinely different file pairs to prove it. It does **not** find new
collisions — that is a massive offline computation — it verifies real ones and shows the
broken hash failing while the modern hashes keep the files apart.

## When to Use It

- **Protecting integrity, signatures, commitments, or content addresses today → use SHA-256
  or SHA-3.** They have no known practical collisions and roughly 2¹²⁸ collision security.
- **Adversarial deduplication or version control identity → SHA-256/SHA-3.** This is exactly
  why Git is migrating object IDs off SHA-1.
- **Legacy, non-security checksums → MD5 or CRC are acceptable only as error detection,**
  never as a defense against an attacker who can craft inputs.
- **Teaching, auditing, or convincing a stakeholder *why* hash choice matters → this demo,**
  which makes "two different files, one digest" concrete and verifiable.
- **When NOT to use MD5 or SHA-1:** never for any security purpose — certificates,
  signatures, integrity against an adversary, or deduplication. Chosen-prefix collisions
  enabled a rogue CA certificate (2008) and the Flame espionage malware (2012).
- **Do NOT** treat this as production code — it is a teaching demo that verifies known collisions, not a hardened hashing or file-integrity library.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-collision-vault](https://systemslibrarian.github.io/crypto-lab-collision-vault/)**

Pick a real collision pair and watch a broken hash produce one digest for two different
files, computed live in your browser, while SHA-256 and SHA3-256 keep them distinct. This
demo is about **hashing only — there is no encryption or decryption.** Controls include the
collision-pair selector (SHAttered SHA-1 PDFs, MD5 identical-prefix, MD5 chosen-prefix), a
byte-diff viewer and whole-file minimap, the broken-hash digest panel, an
identical-vs-chosen-prefix explainer, the SHA-256/SHA-3 resistance contrast, a verification
ledger, a one-byte "tamper" experiment that breaks the collision, and a keyboard-driven
presenter mode.

## What Can Go Wrong

- Using MD5 or SHA-1 for any adversarial integrity purpose: practical chosen-prefix collisions let an attacker craft two different files with the same digest, which is how a rogue CA certificate (2008) and the Flame malware (2012) were signed.
- Relying on a hash's collision strength for password storage: collision resistance is the wrong property, and a fast hash only speeds up brute force — use a password KDF instead.
- Length-extension on Merkle–Damgård hashes (MD5, SHA-1, SHA-256): building a MAC as `H(secret || message)` is forgeable; use HMAC.
- Confusing collision resistance with preimage resistance: MD5/SHA-1 collisions are practical while preimages are not, so "still fine for X" reasoning about broken hashes is error-prone.
- Truncating a strong digest too aggressively drops collision security below the birthday bound and can reopen collision risk.

## Real-World Usage

- Git is migrating its object identifiers from SHA-1 to SHA-256 specifically because adversarial SHA-1 collisions are now practical.
- X.509 certificates and Certificate Transparency logs use SHA-256; CAs and browsers deprecated MD5- and SHA-1-based certificate signatures.
- Content addressing and deduplication systems use SHA-256 to give files stable, collision-resistant identities.
- Software-distribution integrity (release checksums, package managers, signed updates) relies on SHA-256/SHA-3 digests.
- Code signing and TLS handshakes moved off MD5/SHA-1 to SHA-256-family hashes as the broken functions fell.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-collision-vault
cd crypto-lab-collision-vault/demos/collision-vault
npm install
npm run dev
```

No environment variables are required. Everything runs client-side with no backend.

## Related Demos
- [crypto-lab-hash-zoo](https://systemslibrarian.github.io/crypto-lab-hash-zoo/) — SHA-256, SHA3-256, and BLAKE3 with the Merkle–Damgård construction, the families compared here.
- [crypto-lab-babel-hash](https://systemslibrarian.github.io/crypto-lab-babel-hash/) — hands-on tour of SHA-256, SHA3-256, BLAKE3, and HMAC.
- [crypto-lab-merkle-vault](https://systemslibrarian.github.io/crypto-lab-merkle-vault/) — SHA-256 Merkle trees and inclusion proofs, a hash application that needs collision resistance.
- [crypto-lab-world-hashes](https://systemslibrarian.github.io/crypto-lab-world-hashes/) — national hash standards (SM3, Streebog, Kupyna) alongside SHA-256.
- [crypto-lab-mac-race](https://systemslibrarian.github.io/crypto-lab-mac-race/) — HMAC, CMAC, Poly1305, and GHASH, the keyed-hash counterpart to plain hashing.

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
