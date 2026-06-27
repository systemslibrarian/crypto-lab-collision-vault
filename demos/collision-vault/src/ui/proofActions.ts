// Proof-actions bar: copy a portable proof summary, and download File A, File B,
// or a JSON proof manifest for offline labs / reproducibility.

import {
  proofSummaryMarkdown,
  proofManifestJson,
  type PairProof
} from '../pairs/proof';
import { assetUrl } from '../pairs/loader';
import { el, copyText, flashLabel } from './common';

function nowIso(): string {
  // Browser Date is fine here (this is app code, not a workflow script).
  return new Date().toISOString();
}

function downloadBlob(filename: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function renderProofActions(proof: PairProof): HTMLElement {
  const bar = el('div', { class: 'proof-actions', role: 'group', 'aria-label': 'Proof actions' });

  const copyBtn = el('button', {
    type: 'button',
    class: 'btn-sm',
    'aria-label': 'Copy a markdown proof summary to the clipboard'
  });
  copyBtn.textContent = '⧉ Copy proof';
  copyBtn.addEventListener('click', async () => {
    await copyText(proofSummaryMarkdown(proof, nowIso()));
    flashLabel(copyBtn);
  });

  const dlA = el('a', {
    class: 'btn-sm',
    href: assetUrl(proof.entry.fileA),
    download: proof.entry.fileA,
    text: '↓ File A'
  });
  const dlB = el('a', {
    class: 'btn-sm',
    href: assetUrl(proof.entry.fileB),
    download: proof.entry.fileB,
    text: '↓ File B'
  });

  const dlJson = el('button', {
    type: 'button',
    class: 'btn-sm',
    'aria-label': 'Download a JSON proof manifest'
  });
  dlJson.textContent = '↓ Proof JSON';
  dlJson.addEventListener('click', () => {
    downloadBlob(
      `collision-proof-${proof.entry.id}.json`,
      proofManifestJson(proof, nowIso()),
      'application/json'
    );
  });

  bar.append(copyBtn, dlA, dlB, dlJson);
  return bar;
}
