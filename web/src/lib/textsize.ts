export function applyTextSize(size?: 'normal' | 'large') {
  let s = size;
  try { s = s || (localStorage.getItem('fp-text') as 'normal' | 'large') || 'normal'; localStorage.setItem('fp-text', s); } catch { s = s || 'normal'; }
  document.documentElement.dataset.text = s;
  return s;
}
