# Collision Vault

> **[Live demo →](https://systemslibrarian.github.io/crypto-lab-collision-vault/)**

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

## Live Demo

**[https://systemslibrarian.github.io/crypto-lab-collision-vault/](https://systemslibrarian.github.io/crypto-lab-collision-vault/)**

Pick a real collision pair and watch a broken hash produce one digest for two different
files, computed live in your browser, while SHA-256 and SHA3-256 keep them distinct. This
demo is about **hashing only — there is no encryption or decryption.** Controls include the
collision-pair selector (SHAttered SHA-1 PDFs, MD5 identical-prefix, MD5 chosen-prefix), a
byte-diff viewer and whole-file minimap, the broken-hash digest panel, an
identical-vs-chosen-prefix explainer, the SHA-256/SHA-3 resistance contrast, a verification
ledger, a one-byte "tamper" experiment that breaks the collision, and a keyboard-driven
presenter mode.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-collision-vault
cd crypto-lab-collision-vault/demos/collision-vault
npm install
npm run dev
```

No environment variables are required. Everything runs client-side with no backend.

## Part of the Crypto-Lab Suite

> One of 100+ live browser demos at
> [systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/)
> — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

*"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31*
