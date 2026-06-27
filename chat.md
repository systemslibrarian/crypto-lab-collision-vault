# Collision Vault: suggestions to make the demo a 10/10

## Quick read

The demo already has a strong technical spine: real published collision pairs, live hash recomputation, self-tests before display, asset integrity checks, byte-level differences, and modern-hash contrast. To make it feel like a 10/10, the next gains are mostly experiential: make the proof more visual, make the learning path more guided, and make the evidence easier to export, cite, and trust.

## Highest-impact improvements

### 1. Add an in-page visual preview of the colliding files

The SHAttered pair currently offers links to open the PDFs, but the proof would land harder if the page itself showed File A and File B as visibly different artifacts next to the byte evidence. Add PDF thumbnails or embedded previews for PDF pairs, and a compact semantic preview for binary pairs.

For binary pairs, show a tiny annotated byte map: shared prefix, differing block regions, suffix, and first-difference offset. This would let users understand the structure before reading the full hex dump.

Why it matters: the current hex view proves the files differ, but a visual preview makes the collision emotionally obvious in one glance.

### 2. Turn the five panels into a guided proof path

The current sequence is already numbered, but it still reads like a set of panels. Make the demo feel like an interactive proof:

1. Choose a pair.
2. Verify the bytes are different.
3. Verify the broken hash collides.
4. Explain the attack family.
5. Verify modern hashes resist.

Add a sticky or compact progress rail that marks each proof step as it becomes true. Each step should use measured values from the selected pair, not static claims.

Why it matters: users should come away thinking, "I personally verified this," not just "I read that this happened."

### 3. Add a "tamper with one byte" experiment

Add a small safe experiment that lets the user flip one byte in File A or File B and immediately recompute the digests. Show that the collision breaks and all hashes differ again.

This could be a controlled UI, not arbitrary upload support:

- Choose File A or File B.
- Pick one of a few highlighted differing offsets or a harmless offset near the first difference.
- Flip a bit.
- Recompute the broken hash and modern hashes.
- Offer a reset button.

Why it matters: it teaches that collision files are carefully crafted structures, not a general ability to make any edit while keeping the same digest.

### 4. Surface source citations in the UI

The manifest already includes source title, authors, year, and URL for each pair. Render that information in the explainer or selector as a compact citation block.

Suggested format:

`Source: Stevens, Bursztein, Karpman, Albertini, Markov (2017), The first collision for full SHA-1`

Include an outbound link with `rel="noopener noreferrer"`.

Why it matters: the demo's trust story is excellent internally, but users should also see where the artifacts and history come from without inspecting source code.

### 5. Add shareable proof summaries

Add a "Copy proof" button that exports a concise plain-text or markdown summary for the selected pair:

- Pair label and source.
- File sizes.
- First differing byte / shared prefix length.
- Broken hash digest shown equal for A and B.
- SHA-256 / SHA3-256 digests shown different.
- Timestamp and note that all values were recomputed locally in-browser.

Why it matters: this makes the demo useful for teaching, reports, workshops, and screenshots. The user leaves with portable evidence.

### 6. Add a teacher/presenter mode

Add a mode optimized for live explanation:

- Larger type.
- One proof step visible at a time.
- Keyboard navigation between steps.
- A final "collision confirmed" slide with the two equal broken digests and one modern-hash contrast.

Why it matters: this demo is naturally classroom-friendly. Presenter mode would make it feel polished in talks and labs without changing the core implementation.

### 7. Add a compare-algorithm selector

The resistance panel currently shows SHA-256, SHA3-256, and SHA-512. Keep that default, but add an optional selector that lets users include or hide algorithms such as SHA-1, SHA-256, SHA-512, and SHA3-256 depending on the selected pair.

For MD5 pairs, showing SHA-1 as "not broken by this pair" can be useful. For SHAttered, showing MD5 as unrelated might be confusing, so the UI should explain that each collision is function-specific.

Why it matters: it reinforces that collisions are properties of specific hash functions, not all hashing.

### 8. Make the attack-family diagram more concrete

The identical-prefix vs chosen-prefix schematic is valuable. Make it richer by tying it to the actual selected bytes:

- Show measured shared prefix length in the diagram scale.
- Mark first differing offset.
- Mark the approximate crafted block region.
- For chosen-prefix pairs, emphasize that the shared prefix is zero bytes.

Why it matters: the current explanation is accurate, but an evidence-linked diagram would make the abstract attack families click faster.

### 9. Add validation badges for every invariant

The code enforces several invariants, but the UI only exposes some of them indirectly. Add a compact "verification ledger" panel:

- Hash implementation passed known-answer vectors.
- Pair assets loaded from bundled files.
- Files are byte-different.
- Broken-hash digest matches the recorded manifest digest.
- Broken-hash digest is equal for A and B.
- Modern hashes differ.
- Nothing uploaded or stored.

Why it matters: the project already earns trust technically. A ledger lets users see the trust model without reading the implementation.

### 10. Improve mobile ergonomics of the byte diff

The byte diff already has a mobile A/B toggle. The next improvement is making navigation feel effortless on small screens:

- Add jump chips for first difference, previous region, next region, and end.
- Keep the offset label sticky inside the diff area.
- Use a compact mini-map so users know where they are in the file.
- Add a "copy current window" action.

Why it matters: hex dumps are intrinsically dense. Mobile users need orientation more than desktop users do.

## Polish that would make it feel premium

### Add a light/dark theme toggle

The CSS already defines a light theme, but no visible control appears to set it. Add a small theme toggle with `prefers-color-scheme` initialization and local persistence.

### Add a small landing state for first-time users

Keep the app as the first screen, but add a concise "What you are about to prove" strip above the selector. It should be specific, not marketing copy: two different files, same broken digest, different modern digests.

### Add downloadable artifacts and manifests

For each pair, offer direct downloads for File A, File B, and a small JSON proof manifest. This supports offline labs and reproducibility.

### Add screenshots or visual regression checks

The unit tests cover hashing and byte utilities. Add Playwright checks for the browser proof path:

- App loads and passes self-test.
- Each pair can be selected.
- Broken digest rows are equal for the selected broken hash.
- Modern digest rows differ.
- PDF links exist for PDF pairs.
- Mobile byte-diff toggle switches between A and B.

### Add accessibility checks

The app already uses native controls and aria-live regions. A 10/10 version should add automated axe or Playwright accessibility checks for focus order, contrast, labels, and status announcements.

## Suggested implementation order

1. Render source citations from the existing manifest.
2. Add the verification ledger.
3. Add shareable proof summaries.
4. Add in-page PDF previews and binary byte maps.
5. Add the one-byte tamper experiment.
6. Add presenter mode.
7. Add visual and accessibility regression checks.

That order keeps early work low-risk and immediately improves trust, then moves into the more interactive features once the evidence model is visible.