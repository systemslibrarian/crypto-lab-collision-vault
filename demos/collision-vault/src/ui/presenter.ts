// PRESENTER MODE — a classroom/talk view: one proof step at a time, large type,
// keyboard navigation (← → / Space / Esc), ending on a "collision confirmed"
// slide. Reuses the same measured data as the normal view; nothing is faked.

import { ALGORITHMS } from '../hashing/index';
import type { PairProof } from '../pairs/proof';
import { el, digestRow, statusChip } from './common';
import { renderDigestPanel } from './digestPanel';
import { renderExplainer } from './explainer';
import { renderResistancePanel } from './resistancePanel';
import { renderMinimap } from './byteMap';
import { renderPdfPreview } from './pdfPreview';

interface Step {
  title: string;
  build: () => HTMLElement;
}

function buildSteps(proof: PairProof): Step[] {
  const entry = proof.entry;
  const broken = ALGORITHMS[entry.brokenHash].label;
  const da = proof.resA[entry.brokenHash] ?? '';
  const db = proof.resB[entry.brokenHash] ?? '';

  return [
    {
      title: 'The claim',
      build: () =>
        el('div', {}, [
          el('p', { class: 'present-lead', text: entry.label }),
          el('p', {}, [statusChip('alarm', '⚠', `${entry.type} collision under ${broken}`)]),
          el('p', { class: 'present-sub', text: entry.caption })
        ])
    },
    {
      title: 'Two different files',
      build: () => {
        const box = el('div', {});
        if (entry.isPdf) box.append(renderPdfPreview(entry));
        box.append(renderMinimap(proof));
        box.append(
          el('p', { class: 'present-sub', text: `${proof.a.length.toLocaleString()} vs ${proof.b.length.toLocaleString()} bytes · they first differ at byte ${proof.firstDiff.toLocaleString()}.` })
        );
        return box;
      }
    },
    {
      title: `${broken} collides`,
      build: () => renderDigestPanel(entry, da, db)
    },
    {
      title: 'Why — the attack family',
      build: () => renderExplainer(proof)
    },
    {
      title: 'Modern hashes resist',
      build: () => renderResistancePanel(proof.resA, proof.resB)
    },
    {
      title: 'Collision confirmed',
      build: () =>
        el('div', { class: 'present-final' }, [
          statusChip('alarm', '⚠', 'SAME DIGEST, DIFFERENT FILES'),
          digestRow(`${broken}(A)`, da),
          digestRow(`${broken}(B)`, db),
          el('p', { class: 'present-sub' }, [
            statusChip('calm', '✓', 'but SHA-256 differs'),
          ]),
          digestRow('SHA-256(A)', proof.resA['sha-256'] ?? ''),
          digestRow('SHA-256(B)', proof.resB['sha-256'] ?? '')
        ])
    }
  ];
}

export function mountPresenter(host: HTMLElement, proof: PairProof, onExit: () => void): void {
  const steps = buildSteps(proof);
  let idx = 0;

  const root = el('section', { class: 'presenter', 'aria-label': 'Presenter mode', tabindex: '-1' });

  const bar = el('div', { class: 'presenter-bar' });
  const counter = el('span', { class: 'presenter-counter', 'aria-live': 'polite' });
  const prev = el('button', { type: 'button', class: 'btn-sm', text: '← Prev' });
  const next = el('button', { type: 'button', class: 'btn-sm', text: 'Next →' });
  const exit = el('button', { type: 'button', class: 'btn-sm', text: '✕ Exit presenter' });
  bar.append(counter, prev, next, exit);

  const stage = el('div', { class: 'presenter-stage', role: 'group', 'aria-live': 'polite' });
  const hint = el('p', { class: 'presenter-hint dim', text: 'Use ← → or Space to move between steps · Esc to exit' });

  root.append(bar, stage, hint);

  function render(): void {
    const step = steps[idx];
    counter.textContent = `Step ${idx + 1} / ${steps.length}: ${step.title}`;
    prev.disabled = idx === 0;
    next.disabled = idx === steps.length - 1;
    stage.replaceChildren(
      el('h2', { class: 'presenter-title', text: step.title }),
      step.build()
    );
    root.focus();
  }

  const go = (d: number) => {
    idx = Math.min(steps.length - 1, Math.max(0, idx + d));
    render();
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  function teardown(): void {
    document.removeEventListener('keydown', onKey);
    onExit();
  }
  exit.addEventListener('click', teardown);

  function onKey(ev: KeyboardEvent): void {
    if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') {
      ev.preventDefault();
      go(1);
    } else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') {
      ev.preventDefault();
      go(-1);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      teardown();
    }
  }
  document.addEventListener('keydown', onKey);

  host.replaceChildren(root);
  render();
}
