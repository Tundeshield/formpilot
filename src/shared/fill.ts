import type { FillResult, FillValue } from './types';

/**
 * Injected into the page. Self-contained (see scan.ts). Populates fields only —
 * it never clicks submit buttons, never calls form.submit() and never presses Enter.
 */
export function fillFields(values: FillValue[], highlight: boolean): FillResult[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const mark = (el: HTMLElement) => {
    if (!highlight) return;
    el.setAttribute('data-formpilot-filled', '1');
    el.style.outline = '2px solid #6366f1';
    el.style.outlineOffset = '2px';
    setTimeout(() => { el.style.outlineColor = 'rgba(99,102,241,0.35)'; }, 2500);
  };
  const optLabel = (i: HTMLInputElement) =>
    norm((i.labels && i.labels[0] ? i.labels[0].textContent : '') || i.getAttribute('aria-label') || i.value || '');

  // Works with React/Vue controlled inputs by using the native prototype setter.
  const setNative = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus({ preventScroll: true });
    if (setter) setter.call(el, value); else el.value = value;
    fire(el, 'input'); fire(el, 'change');
    el.blur();
  };

  const setChecked = (i: HTMLInputElement, want: boolean) => {
    if (i.checked !== want) i.click(); // click() dispatches the events frameworks listen to
    if (i.checked !== want) { i.checked = want; fire(i, 'input'); fire(i, 'change'); }
  };

  return values.map(({ id, kind, value }): FillResult => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-formpilot-id="${id}"]`));
    if (!els.length) return { id, ok: false, error: 'Field not found — the page may have changed. Rescan.' };
    try {
      if (kind === 'text' || kind === 'textarea') {
        const el = els[0] as HTMLInputElement | HTMLTextAreaElement;
        let v = String(value ?? '');
        if (el.maxLength > 0) v = v.slice(0, el.maxLength);
        setNative(el, v); mark(el);
        return { id, ok: true };
      }
      if (kind === 'select') {
        const sel = els[0] as HTMLSelectElement;
        const want = norm(String(value));
        const idx = Array.from(sel.options).findIndex((o) => norm(o.text) === want || norm(o.value) === want);
        if (idx < 0) return { id, ok: false, error: 'Option not available in this dropdown' };
        sel.focus({ preventScroll: true });
        sel.selectedIndex = idx; fire(sel, 'input'); fire(sel, 'change'); sel.blur(); mark(sel);
        return { id, ok: true };
      }
      const inputs = els as HTMLInputElement[];
      if (kind === 'checkbox') {
        setChecked(inputs[0], value === true || norm(String(value)) === 'true' || norm(String(value)) === 'yes');
        mark(inputs[0]);
        return { id, ok: true };
      }
      if (kind === 'radio') {
        const want = norm(String(value));
        const hit = inputs.find((i) => optLabel(i) === want || norm(i.value) === want);
        if (!hit) return { id, ok: false, error: 'Option not available' };
        setChecked(hit, true); mark(hit);
        return { id, ok: true };
      }
      if (kind === 'checkbox-group') {
        const wants = (Array.isArray(value) ? value : [String(value)]).map((v) => norm(String(v)));
        inputs.forEach((i) => { setChecked(i, wants.includes(optLabel(i)) || wants.includes(norm(i.value))); });
        inputs.forEach(mark);
        return { id, ok: true };
      }
      return { id, ok: false, error: 'Unsupported field type' };
    } catch (e) {
      return { id, ok: false, error: e instanceof Error ? e.message : 'Could not fill field' };
    }
  });
}

/** Injected: scroll a field into view and pulse it, so users can see what an answer maps to. */
export function revealField(id: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-formpilot-id="${id}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const prev = el.style.boxShadow;
  el.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.45)';
  setTimeout(() => { el.style.boxShadow = prev; }, 1400);
  return true;
}
