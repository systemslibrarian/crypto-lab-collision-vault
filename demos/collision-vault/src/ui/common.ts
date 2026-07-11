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
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

/**
 * Build DOM nodes from a tiny markdown subset: `**strong**`, `*em*`, `` `code` ``.
 * The safe replacement for innerHTML — input is never parsed as HTML, only ever
 * turned into text nodes and strong/em/code elements.
 */
export function fmt(src: string): Node[] {
  const nodes: Node[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) nodes.push(document.createTextNode(src.slice(last, m.index)));
    if (m[1] !== undefined) nodes.push(el('strong', { text: m[1] }));
    else if (m[2] !== undefined) nodes.push(el('em', { text: m[2] }));
    else nodes.push(el('code', { text: m[3] }));
    last = m.index + m[0].length;
  }
  if (last < src.length) nodes.push(document.createTextNode(src.slice(last)));
  return nodes;
}

/** Copy text to the clipboard, with a fallback for non-secure contexts. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fallback for environments without the async clipboard API.
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
}

/** Briefly swap a button's label to confirm an action (text, not colour alone). */
export function flashLabel(btn: HTMLButtonElement, confirm = 'Copied ✓', ms = 1400): void {
  const prev = btn.textContent;
  btn.textContent = confirm;
  btn.classList.add('copied');
  window.setTimeout(() => {
    btn.textContent = prev;
    btn.classList.remove('copied');
  }, ms);
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
    await copyText(getText());
    flashLabel(btn);
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
  // tabindex 0: the value scrolls horizontally, so it must be keyboard-reachable
  // (WCAG 2.1.1 — axe scrollable-region-focusable).
  const val = el('code', { class: 'digest-value', tabindex: '0' });
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
