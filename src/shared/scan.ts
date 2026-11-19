import type { ScanResult } from './types';

/**
 * Injected into the page with chrome.scripting.executeScript({ func: scanPage }).
 * MUST be fully self-contained: Chrome serialises the function source, so it cannot
 * reference anything outside its own body.
 *
 * Page content is untrusted. We only read structural text (labels, options, headings),
 * cap every string, and never read password, payment, file or hidden fields.
 */
export function scanPage(): ScanResult {
  const MAX_FIELDS = 120;
  const clip = (s: string | null | undefined, n = 300) =>
    (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const cleanLabel = (s: string) =>
    clip(s, 300).replace(/\s*(\*|\(required\)|\(optional\))\s*$/i, '').replace(/[:：]\s*$/, '').trim();

  const SENSITIVE = /(card ?number|cc-?num|credit ?card|cvv|cvc|security ?code|expir|iban|routing|sort ?code|account ?number|bank ?account|\bssn\b|social ?security|national ?insurance|\bnin\b|passport ?number|tax ?id|captcha|one.?time|otp|verification ?code|\bpin\b)/i;

  const isHidden = (el: Element): boolean => {
    const h = el as HTMLElement;
    if (h.hidden || h.closest('[hidden],[aria-hidden="true"],template')) return true;
    let node: Element | null = el;
    while (node && node !== document.body) {
      const st = getComputedStyle(node);
      if (st.display === 'none' || st.visibility === 'hidden') return true;
      node = node.parentElement;
    }
    // Layout check only where layout exists (skipped in non-rendering environments).
    if (document.body.getClientRects().length > 0 && el.getClientRects().length === 0) return true;
    return false;
  };

  const textOf = (el: Element | null): string => {
    if (!el) return '';
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll('input,select,textarea,button,script,style,svg').forEach((n) => n.remove());
    return clip(clone.textContent);
  };

  const byIds = (ids: string | null) =>
    (ids || '').split(/\s+/).filter(Boolean).map((id) => textOf(document.getElementById(id))).filter(Boolean).join(' ');

  const labelFor = (el: HTMLElement): string => {
    const aria = el.getAttribute('aria-labelledby');
    if (aria) { const t = byIds(aria); if (t) return t; }
    const al = el.getAttribute('aria-label'); if (al) return clip(al);
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) { const t = Array.from(labels).map(textOf).join(' '); if (t) return t; }
    if (el.id) { const l = document.querySelector(`label[for="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : el.id.replace(/["\\]/g, '\\$&')}"]`); if (l) { const t = textOf(l); if (t) return t; } }
    // Nearby text: previous siblings, or the parent's leading text (common in div-based forms).
    let node: Element | null = el;
    for (let depth = 0; node && depth < 3; depth++) {
      let sib = node.previousElementSibling;
      while (sib) {
        if (!sib.querySelector('input,select,textarea')) { const t = textOf(sib); if (t) return t; }
        else break;
        sib = sib.previousElementSibling;
      }
      node = node.parentElement;
      if (node && node.querySelectorAll('input,select,textarea').length > 1) break;
    }
    return clip(el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name') || '');
  };

  const helpFor = (el: HTMLElement) => byIds(el.getAttribute('aria-describedby'));

  const sectionFor = (el: Element): string | undefined => {
    const fs = el.closest('fieldset');
    const legend = fs?.querySelector('legend');
    if (legend) return clip(textOf(legend), 120);
    // nearest preceding heading in document order
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
    let last: Element | undefined;
    for (const h of heads) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) last = h; else break;
    }
    return last ? clip(textOf(last), 120) : undefined;
  };

  const groupLabel = (inputs: HTMLInputElement[]): string => {
    const first = inputs[0];
    const rg = first.closest('[role="radiogroup"],[role="group"]');
    if (rg) {
      const t = byIds(rg.getAttribute('aria-labelledby')) || clip(rg.getAttribute('aria-label'));
      if (t) return t;
    }
    const fs = first.closest('fieldset');
    const legend = fs?.querySelector('legend');
    if (legend && textOf(legend)) return textOf(legend);
    // Lowest ancestor containing all inputs; use its text before the first input.
    let anc: Element | null = first.parentElement;
    while (anc && !inputs.every((i) => anc!.contains(i))) anc = anc.parentElement;
    for (let a = anc, d = 0; a && d < 3; a = a.parentElement, d++) {
      let sib = a.previousElementSibling;
      if (sib && !sib.querySelector('input,select,textarea')) { const t = textOf(sib); if (t) return t; }
      // Leading heading/label-like child of the ancestor
      const lead = a.querySelector(':scope > label, :scope > p, :scope > span, :scope > div > label, :scope > h3, :scope > h4');
      if (lead && !lead.querySelector('input')) { const t = textOf(lead); if (t) return t; }
    }
    return clip(first.name);
  };

  const optionLabel = (i: HTMLInputElement) => {
    const t = (i.labels && i.labels.length ? textOf(i.labels[0]) : '') || clip(i.getAttribute('aria-label')) || clip(i.value);
    return t || 'on';
  };

  const result: ScanResult = {
    url: location.href.slice(0, 500),
    title: clip(document.title, 200),
    host: location.hostname,
    pageContext: clip([
      textOf(document.querySelector('h1')),
      document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    ].filter(Boolean).join(' — '), 400),
    fields: [],
    skipped: [],
  };

  document.querySelectorAll('[data-formpilot-id]').forEach((e) => { e.removeAttribute('data-formpilot-id'); e.removeAttribute('data-formpilot-opt'); });
  let n = 0;
  const nextId = () => `fp-${++n}`;
  const groups = new Map<string, HTMLInputElement[]>();

  const elements = Array.from(document.querySelectorAll<HTMLElement>('input, select, textarea'));
  for (const el of elements) {
    if (result.fields.length >= MAX_FIELDS) break;
    const tag = el.tagName.toLowerCase();
    const input = el as HTMLInputElement;
    const type = tag === 'input' ? (input.type || 'text').toLowerCase() : tag;
    if (['hidden', 'submit', 'button', 'reset', 'image', 'search', 'range', 'color'].includes(type)) continue;
    if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) continue;
    if (isHidden(el)) continue;

    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    const label = cleanLabel(labelFor(el));

    if (type === 'password') { result.skipped.push({ reason: 'password', label: label || 'Password' }); continue; }
    if (type === 'file') { result.skipped.push({ reason: 'file', label: label || 'File upload' }); continue; }
    const probe = `${label} ${input.name || ''} ${el.id || ''} ${ac}`;
    if (ac.startsWith('cc-') || SENSITIVE.test(probe)) { result.skipped.push({ reason: 'sensitive', label: label || 'Sensitive field' }); continue; }

    if (type === 'radio' || type === 'checkbox') {
      const key = `${type}:${input.form ? Array.from(document.forms).indexOf(input.form) : -1}:${input.name || el.id || Math.random()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(input);
      continue;
    }

    const id = nextId();
    el.setAttribute('data-formpilot-id', id);
    if (tag === 'select') {
      const sel = el as HTMLSelectElement;
      result.fields.push({
        id, kind: 'select', label, name: clip(sel.name, 100) || undefined, autocomplete: ac || undefined,
        options: Array.from(sel.options).map((o) => clip(o.text, 150)).filter(Boolean).slice(0, 300),
        required: sel.required || el.getAttribute('aria-required') === 'true',
        currentValue: sel.selectedIndex > 0 ? clip(sel.options[sel.selectedIndex].text) : undefined,
        helpText: helpFor(el) || undefined, section: sectionFor(el),
      });
    } else {
      const ta = el as HTMLInputElement | HTMLTextAreaElement;
      result.fields.push({
        id, kind: tag === 'textarea' ? 'textarea' : 'text', inputType: tag === 'textarea' ? undefined : type,
        label, name: clip(ta.name, 100) || undefined, placeholder: clip(ta.placeholder, 200) || undefined,
        autocomplete: ac || undefined, required: ta.required || el.getAttribute('aria-required') === 'true',
        maxLength: ta.maxLength > 0 ? ta.maxLength : undefined,
        currentValue: ta.value ? clip(ta.value, 2000) : undefined,
        helpText: helpFor(el) || undefined, section: sectionFor(el),
      });
    }
  }

  for (const [key, inputs] of groups) {
    if (result.fields.length >= MAX_FIELDS) break;
    const isRadio = key.startsWith('radio');
    const id = nextId();
    inputs.forEach((i, idx) => { i.setAttribute('data-formpilot-id', id); i.setAttribute('data-formpilot-opt', String(idx)); });
    const options = inputs.map(optionLabel);
    if (!isRadio && inputs.length === 1) {
      const i = inputs[0];
      // For a lone checkbox, its own label is the question ("I agree to…", "Willing to relocate").
      const own = cleanLabel(optionLabel(i));
      result.fields.push({
        id, kind: 'checkbox', label: own !== 'on' ? own : cleanLabel(groupLabel(inputs)),
        name: clip(i.name, 100) || undefined, required: i.required, currentValue: i.checked, section: sectionFor(i),
      });
      continue;
    }
    result.fields.push({
      id, kind: isRadio ? 'radio' : 'checkbox-group', label: cleanLabel(groupLabel(inputs)),
      name: clip(inputs[0].name, 100) || undefined, options,
      required: inputs.some((i) => i.required),
      currentValue: isRadio ? (inputs.find((i) => i.checked) ? optionLabel(inputs.find((i) => i.checked)!) : undefined)
        : inputs.filter((i) => i.checked).map(optionLabel),
      section: sectionFor(inputs[0]),
    });
  }

  // Keep visual (document) order.
  const pos = (id: string) => {
    const el = document.querySelector(`[data-formpilot-id="${id}"]`);
    return el ? elements.indexOf(el as HTMLElement) : 1e9;
  };
  result.fields.sort((a, b) => pos(a.id) - pos(b.id));
  return result;
}
