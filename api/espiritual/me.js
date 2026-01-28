// /api/espiritual/me.js
import { readRange } from '../../lib/sheets.js';

// ⚠️ Ajuste este import conforme seu projeto:
// se você já tem um helper de sessão, use ele.
// Vou assumir que existe algo como getSessionUser(req) em /lib/auth.js.
// Se não existir, já abaixo eu te dou a versão "sem helper", usando seu /api/auth/me.js via fetch (server-side).
import { getSessionUser } from '../../lib/auth.js';

function safeStr(v){ return String(v ?? '').trim(); }

function slug(s=''){
  return safeStr(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'');
}

function formatDateCell(v){
  if (!v) return '';
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth()+1).padStart(2,'0');
    const d = String(v.getUTCDate()).padStart(2,'0');
    return `${d}/${m}/${y}`;
  }
  return safeStr(v);
}

export default async function handler(req, res) {
  try {
    const user = await getSessionUser(req); // { email, nome, role? }
    if (!user?.email) return res.status(401).json({ ok:false, error:'Não autenticado' });

    const grid = await readRange('Espiritual!A1:AZ200');
    if (!grid || grid.length < 3) return res.status(200).json({ ok:true, cols:[], row:null });

    const h1 = (grid[0] || []).map(safeStr);
    const h2 = (grid[1] || []).map(safeStr);

    const maxCols = Math.max(h1.length, h2.length, ...grid.map(r => r.length));
    const row1 = h1.concat(Array(maxCols - h1.length).fill(''));
    const row2 = h2.concat(Array(maxCols - h2.length).fill(''));

    // reconstrói grupos
    let currentGroup = '';
    const cols = [];
    const keyCount = new Map();

    for (let c=0; c<maxCols; c++){
      const g = row1[c] || currentGroup;
      if (row1[c]) currentGroup = row1[c];
      const label = row2[c] || row1[c] || `Coluna ${c+1}`;
      const group = g || 'Geral';

      let baseKey = slug(group) + '__' + slug(label);
      if (baseKey === '__') baseKey = `col_${c+1}`;

      const n = (keyCount.get(baseKey) || 0) + 1;
      keyCount.set(baseKey, n);
      const key = n === 1 ? baseKey : `${baseKey}_${n}`;

      cols.push({ index:c, group, label, key });
    }

    // achar a coluna de email (recomendado)
    // Se você ainda não tem no sheet, o ideal é criar uma coluna "Email" no bloco azul.
    const emailCol =
      cols.find(c => (c.label||'').toLowerCase() === 'email') ||
      cols.find(c => (c.label||'').toLowerCase().includes('e-mail'));

    if (!emailCol) {
      return res.status(400).json({
        ok:false,
        error:'Coluna "Email" não encontrada na aba Espiritual. Crie uma coluna Email para vincular login ao prontuário.'
      });
    }

    const target = user.email.trim().toLowerCase();

    // varre linhas e encontra a do usuário logado
    let found = null;
    for (let r=2; r<grid.length; r++){
      const line = grid[r] || [];
      const cell = safeStr(line[emailCol.index]).toLowerCase();
      if (!cell) continue;
      if (cell === target) {
        const obj = { __row: r+1 };
        for (let c=0; c<maxCols; c++){
          const col = cols[c];
          const raw = line[c] ?? '';
          obj[col.key] = (raw instanceof Date) ? formatDateCell(raw) : safeStr(raw);
        }
        found = obj;
        break;
      }
    }

    return res.status(200).json({ ok:true, cols, row: found });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
