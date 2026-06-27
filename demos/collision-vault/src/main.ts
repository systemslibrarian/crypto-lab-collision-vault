import './styles.css';

import { HashClient } from './hashing/client';
import type { HashAlgorithm } from './hashing/index';
import { PAIRS, loadPair, type LoadedPair } from './pairs/loader';
import type { PairManifestEntry } from './pairs/manifest';
import { buildProof, type PairProof } from './pairs/proof';
import { el } from './ui/common';
import { renderPairSelector } from './ui/pairSelector';
import { createByteDiff } from './ui/byteDiff';
import { renderDigestPanel, ALL_DEMO_ALGOS } from './ui/digestPanel';
import { renderResistancePanel } from './ui/resistancePanel';
import { renderExplainer } from './ui/explainer';
import { renderLedger } from './ui/ledger';
import { renderTamper } from './ui/tamper';
import { renderProofActions } from './ui/proofActions';
import { renderMinimap } from './ui/byteMap';
import { renderPdfPreview } from './ui/pdfPreview';
import { mountPresenter } from './ui/presenter';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing');

const client = new HashClient();
let selectedId = PAIRS[0].id;
let renderToken = 0; // guards against out-of-order async renders
let vectorsPassed = false; // set once the hash self-test succeeds

// ── static scaffold ────────────────────────────────────────────────────────
app.append(buildIntro());

const selectorHost = el('div', { class: 'selector-host' });
app.append(selectorHost);

const statusBanner = el('div', { class: 'status-banner', role: 'status', 'aria-live': 'polite' });
app.append(statusBanner);

const results = el('div', { id: 'results', class: 'results' });
app.append(results);

app.append(buildNonGoals());

function mountSelector(): void {
  selectorHost.replaceChildren(
    renderPairSelector(PAIRS, selectedId, (id) => {
      selectedId = id;
      mountSelector();
      void showPair(id);
    })
  );
}

// ── self-test gate: never display digests from an unvalidated implementation ──
async function start(): Promise<void> {
  mountSelector();
  setStatus('neutral', '…', `Validating hash implementations${client.offMainThread ? ' (worker)' : ''}…`);
  let ok = false;
  let failures: string[] = [];
  try {
    const r = await client.selfTest();
    ok = r.ok;
    failures = r.failures;
  } catch (err) {
    failures = [(err as Error).message];
  }
  if (!ok) {
    setStatus('alarm', '⚠', 'Hash self-test FAILED — digests are not trustworthy and are not shown.');
    results.replaceChildren(
      errorPanel(
        'Hashing library failed its known-answer self-test',
        'A bundled hash produced a wrong digest for a standard test vector, so nothing is displayed (invariant 4). This usually means a corrupted dependency.',
        failures
      )
    );
    return;
  }
  vectorsPassed = true;
  setStatus('calm', '✓', `Hash implementations validated against known test vectors${client.offMainThread ? ' · hashing off the main thread' : ''}.`);
  await showPair(selectedId);
}

// ── per-pair render ─────────────────────────────────────────────────────────
async function showPair(id: string): Promise<void> {
  const token = ++renderToken;
  const entry = PAIRS.find((p) => p.id === id);
  if (!entry) return;

  results.replaceChildren(loadingPanel(entry));
  const progress = results.querySelector<HTMLElement>('.hash-progress-text');

  let loaded: LoadedPair;
  try {
    loaded = await loadPair(entry);
  } catch (err) {
    if (token !== renderToken) return;
    results.replaceChildren(
      errorPanel(
        `Could not verify pair “${entry.label}”`,
        'The bundled bytes did not pass the live integrity check, so this pair is not shown as a collision (invariants 1–2 & 5).',
        [(err as Error).message]
      )
    );
    return;
  }
  if (token !== renderToken) return;

  // Hash both files under every algorithm, off the main thread, with progress.
  const totalSteps = ALL_DEMO_ALGOS.length * 2;
  let step = 0;
  const tick = (which: 'A' | 'B') => (algo: HashAlgorithm) => {
    step++;
    if (progress && token === renderToken) {
      progress.textContent = `Hashing file ${which}: ${algo.toUpperCase()} … (${step}/${totalSteps})`;
    }
  };

  let resA: Partial<Record<HashAlgorithm, string>>;
  let resB: Partial<Record<HashAlgorithm, string>>;
  try {
    resA = await client.hashFile(loaded.a, ALL_DEMO_ALGOS, (a) => tick('A')(a));
    resB = await client.hashFile(loaded.b, ALL_DEMO_ALGOS, (a) => tick('B')(a));
  } catch (err) {
    if (token !== renderToken) return;
    results.replaceChildren(
      errorPanel('Hashing failed', 'The hashing worker reported an error; no digests are shown.', [
        (err as Error).message
      ])
    );
    return;
  }
  if (token !== renderToken) return;

  const broken = entry.brokenHash;
  const digestA = resA[broken];
  const digestB = resB[broken];
  if (!digestA || !digestB) {
    results.replaceChildren(errorPanel('Hashing incomplete', 'A required digest was missing.', []));
    return;
  }

  const proof = buildProof(entry, loaded.a, loaded.b, digestA, resA, resB);
  renderNormal(proof);
}

/** Render the full, scrollable proof view for a computed pair. */
function renderNormal(proof: PairProof): void {
  const { entry, resA, resB, brokenDigest } = proof;
  const broken = entry.brokenHash;
  results.replaceChildren(
    renderProofToolbar(proof),
    fileEvidencePanel(proof),
    renderDigestPanel(entry, brokenDigest, resB[broken] ?? ''),
    renderExplainer(proof),
    renderResistancePanel(resA, resB),
    renderLedger(proof, vectorsPassed),
    renderTamper(proof, client, vectorsPassed)
  );
}

function renderProofToolbar(proof: PairProof): HTMLElement {
  const present = el('button', {
    type: 'button',
    class: 'btn-sm present-btn',
    text: '▶ Presenter mode'
  });
  present.addEventListener('click', () => {
    mountPresenter(results, proof, () => renderNormal(proof));
  });
  return el('div', { class: 'proof-toolbar' }, [renderProofActions(proof), present]);
}

// ── panels built here (intro / evidence / status / errors) ──────────────────
function buildIntro(): HTMLElement {
  const header = el('header', { class: 'intro' }, [
    el('h1', { text: 'Collision Vault' }),
    el('p', { class: 'tagline', text: 'Verifying real, published hash collisions (MD5 / SHA-1) — and why SHA-256 / SHA-3 resist them.' }),
    el('p', {
      class: 'intro-body',
      html:
        'This lab does <strong>not</strong> compute a fresh collision — finding one is a massive offline ' +
        'computation (SHAttered was ≈2<sup>63</sup> SHA-1 operations). Instead it <strong>verifies ' +
        'already-published, genuinely-different file pairs</strong> and recomputes their hashes live in ' +
        'your browser: watch two different files produce one digest under a broken hash, while modern ' +
        'hashes keep them apart. Everything runs offline; nothing is uploaded or stored.'
    })
  ]);
  return header;
}

function buildNonGoals(): HTMLElement {
  const items: Array<[string, string]> = [
    ['Not collision-finding', 'This verifies published pairs. Real collisions are found offline with enormous compute (e.g. GPU clusters running differential-path search like HashClash / the SHAttered attack).'],
    ['Not length-extension', 'That Merkle–Damgård weakness is a different demo — see Babel Hash / MAC Race.'],
    ['Not preimage attacks', 'Collision resistance (find any two colliding inputs) ≠ preimage (invert a digest) ≠ second-preimage (match a given input). This lab is about collisions only.'],
    ['Nothing persisted', 'No backend, no network at runtime, no telemetry, no storage.']
  ];
  const ul = el('ul', { class: 'nongoals' });
  for (const [t, d] of items) {
    ul.append(el('li', {}, [el('strong', { text: `${t}: ` }), document.createTextNode(d)]));
  }
  return el('section', { class: 'panel nongoals-panel', 'aria-label': 'What this lab is not' }, [
    el('h2', { text: 'What this lab is not' }),
    ul
  ]);
}

function fileEvidencePanel(proof: PairProof): HTMLElement {
  const entry = proof.entry;
  const panel = el('section', { class: 'panel evidence-panel', 'aria-labelledby': 'evidence-title' });
  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'evidence-title', text: '2 · Two genuinely different files' })
    ]),
    el('p', { class: 'note' }, [
      document.createTextNode(`File A is ${entry.describesA}; File B is ${entry.describesB}. `),
      document.createTextNode('The hex below shows they really differ — non-printable bytes render as “.”.')
    ])
  );

  if (entry.isPdf) {
    panel.append(renderPdfPreview(entry));
  }

  panel.append(renderMinimap(proof));
  panel.append(createByteDiff(proof.a, proof.b).element);
  return panel;
}

function loadingPanel(entry: PairManifestEntry): HTMLElement {
  return el('section', { class: 'panel loading-panel', role: 'status', 'aria-live': 'polite' }, [
    el('h2', { text: `Loading “${entry.label}”…` }),
    el('div', { class: 'spinner', 'aria-hidden': 'true' }),
    el('p', { class: 'hash-progress-text', text: 'Loading bundled bytes and validating the collision…' })
  ]);
}

function errorPanel(title: string, body: string, details: string[]): HTMLElement {
  const panel = el('section', { class: 'panel error-panel is-alarm', role: 'alert' }, [
    el('div', { class: 'panel-head' }, [
      el('h2', {}, [el('span', { 'aria-hidden': 'true', text: '⚠ ' }), document.createTextNode(title)])
    ]),
    el('p', { text: body })
  ]);
  if (details.length) {
    const pre = el('pre', { class: 'error-details' });
    pre.textContent = details.join('\n');
    panel.append(pre);
  }
  return panel;
}

function setStatus(kind: 'alarm' | 'calm' | 'neutral', icon: string, text: string): void {
  statusBanner.className = `status-banner status-${kind}`;
  statusBanner.replaceChildren(
    el('span', { class: 'status-icon', 'aria-hidden': 'true', text: icon }),
    el('span', { text })
  );
}

void start();
