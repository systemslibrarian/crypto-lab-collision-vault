// Small DOM helpers shared across the UI panels.

import { groupHex } from '../util/hex';

type Attrs = Record<string, string | number | boolean | undefined>;

/** Terse element factory. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

/**
 * Copy-to-clipboard button. Never relies on colour alone: it swaps the label
 * text ("Copy" → "Copied ✓") and announces via aria-live.
 */
export function copyButton(getText: () => string, label = 'Copy'): HTMLButtonElement {
  const btn = el('button', {
    type: 'button',
    class: 'btn-sm copy-btn',
    'aria-label': `${label} to clipboard`
  });
  btn.textContent = label;
  btn.addEventListener('click', async () => {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for environments without async clipboard.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* give up silently — the text is still selectable on screen */
      }
      ta.remove();
    }
    const prev = btn.textContent;
    btn.textContent = 'Copied ✓';
    btn.classList.add('copied');
    window.setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('copied');
    }, 1400);
  });
  return btn;
}

/**
 * A monospace digest row: label, the grouped hex (horizontally scrollable, never
 * wrapped — byte alignment matters), and a copy button.
 */
export function digestRow(label: string, hex: string | null): HTMLElement {
  const row = el('div', { class: 'digest-row' });
  const lab = el('span', { class: 'digest-label', text: label });
  const val = el('code', { class: 'digest-value' });
  if (hex) {
    val.textContent = groupHex(hex);
    row.append(lab, val, copyButton(() => hex, 'Copy'));
  } else {
    val.textContent = '…';
    val.classList.add('pending');
    row.append(lab, val);
  }
  return row;
}

/** Status chip with icon + text + colour class (icon/text carry meaning too). */
export function statusChip(
  kind: 'alarm' | 'calm' | 'neutral',
  icon: string,
  text: string
): HTMLElement {
  return el('span', { class: `chip chip-${kind}` }, [
    el('span', { class: 'chip-icon', 'aria-hidden': 'true', text: icon }),
    el('span', { class: 'chip-text', text })
  ]);
}
