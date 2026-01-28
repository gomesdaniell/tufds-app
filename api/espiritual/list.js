// /api/espiritual/list.js
import { readRange } from '../../lib/sheets.js';

function safeStr(v){ return String(v ?? '').trim(); }

function slug(s=''){
  return safeStr(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'');
}

// tenta padronizar datas que vierem como Date do Sheets
function formatDateCell(v){
  if (!v) return '';
  if (v instanceof Date) {
    // usa UTC pra não cair no dia anterior
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth()+1).padStart(2,'0');
    const d = String(v.getUTCDate()).padStart(2,'0');
    return `${d}/${m}/${y}`;
  }
  return safeStr(v);
}

export default async function handler(req, res) {
  try {
    // Ajuste o range se você souber o “fim” exato. Aqui deixei folgado.
    const grid = await readRange('Espiritual!A1:AZ200');
    if (!grid || grid.length < 3) {
      return res.status(200).json({ ok:true, cols:[], rows:[] });
    }

    // headers
    const h1 = (grid[0] || []).map(safeStr); // grupos (mesclados -> vazios)
    const h2 = (grid[1] || []).map(safeStr); // campos

    // normaliza tamanho
    const maxCols = Math.max(h1.length, h2.length, ...grid.map(r => r.length));
    const row1 = h1.concat(Array(maxCols - h1.length).fill(''));
    const row2 = h2.concat(Array(maxCols - h2.length).fill(''));

    // reconstrói “grupo” propagando o último não vazio (efeito merge)
    let currentGroup = '';
    const cols = [];
    const keyCount = new Map();

    for (let c=0; c<maxCols; c++){
      const g = row1[c] || currentGroup;
      if (row1[c]) currentGroup = row1[c];

      // label do campo: prioridade linha2; fallback linha1 se linha2 vazia
      const label = row2[c] || row1[c] || `Coluna ${c+1}`;

      const group = g || 'Geral';

      // key única por coluna
      let baseKey = slug(group) + '__' + slug(label);
      if (baseKey === '__') baseKey = `col_${c+1}`;

      const n = (keyCount.get(baseKey) || 0) + 1;
      keyCount.set(baseKey, n);
      const key = n === 1 ? baseKey : `${baseKey}_${n}`;

      cols.push({ index: c, group, label, key });
    }

    // dados começam na linha 3 (index 2)
    const rows = [];
    for (let r=2; r<grid.length; r++){
      const line = grid[r] || [];
      // critério de parada: se "Nome Completo" (coluna 0) estiver vazio, ignora/para
      const nome = safeStr(line[0]);
      if (!nome) continue;

      const obj = { __row: r+1 }; // linha real na planilha (1-based)
      for (let c=0; c<maxCols; c++){
        const col = cols[c];
        const raw = (line[c] ?? '');
        // formata datas automaticamente se vier Date
        obj[col.key] = (raw instanceof Date) ? formatDateCell(raw) : safeStr(raw);
      }
      rows.push(obj);
    }

    return res.status(200).json({ ok:true, cols, rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
