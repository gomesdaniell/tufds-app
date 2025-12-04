// api/_utils.js
export function findColIndex(header, variants) {
  const h = header.map((x) => String(x || '').trim().toLowerCase());
  const v = variants.map((x) => String(x).toLowerCase());
  let best = -1, bestScore = -1;
  h.forEach((name, idx) => {
    let score = 0;
    v.forEach((w) => { if (name.includes(w)) score += w.length; });
    if (score > bestScore) { bestScore = score; best = idx; }
  });
  return best; // -1 se não achou
}

export function parseNumberBR(x) {
  if (typeof x === 'number') return x;
  const s = String(x || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function formatDatePtBr(date, tz = 'America/Manaus') {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz, dateStyle: 'short', timeStyle: 'short'
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
