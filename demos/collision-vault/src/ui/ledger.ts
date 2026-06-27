// VERIFICATION LEDGER — exposes every correctness invariant the demo enforces,
// evaluated live for the selected pair, so users can see the trust model without
// reading the source. Each row is icon + text + colour (never colour alone).

import { ledgerChecks, type PairProof } from '../pairs/proof';
import { el } from './common';

export function renderLedger(proof: PairProof, vectorsPassed: boolean): HTMLElement {
  const items = ledgerChecks(proof, vectorsPassed);
  const allPass = items.every((i) => i.pass);

  const panel = el('section', {
    class: `panel ledger-panel ${allPass ? 'is-ok' : 'is-alarm'}`,
    'aria-labelledby': 'ledger-title'
  });

  panel.append(
    el('div', { class: 'panel-head' }, [
      el('h2', { id: 'ledger-title', text: '6 · Verification ledger' }),
      el('span', {
        class: `chip ${allPass ? 'chip-calm' : 'chip-alarm'}`
      }, [
        el('span', { class: 'chip-icon', 'aria-hidden': 'true', text: allPass ? '✓' : '⚠' }),
        el('span', { class: 'chip-text', text: `${items.filter((i) => i.pass).length}/${items.length} checks pass` })
      ])
    ]),
    el('p', { class: 'note', text: 'Every claim below is computed from the live bytes and digests for this pair — not asserted.' })
  );

  const ul = el('ul', { class: 'ledger-list' });
  for (const item of items) {
    const li = el('li', { class: `ledger-item ${item.pass ? 'pass' : 'fail'}` }, [
      el('span', { class: 'ledger-mark', 'aria-hidden': 'true', text: item.pass ? '✓' : '✗' }),
      el('span', { class: 'ledger-sr', text: item.pass ? 'Pass: ' : 'Fail: ' }),
      el('div', { class: 'ledger-body' }, [
        el('span', { class: 'ledger-label', text: item.label }),
        el('code', { class: 'ledger-detail', text: item.detail })
      ])
    ]);
    ul.append(li);
  }
  panel.append(ul);
  return panel;
}
