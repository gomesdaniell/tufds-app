// /api/faxina/list.js
import { readRange } from '../../lib/sheets.js';

function safeStr(v){ return String(v ?? '').trim(); }
function pad2(n){ return String(n).padStart(2,'0'); }

// Data pode vir como Date do Sheets, ou string "31/01", ou "31/01/2026"
function parseDateParts(raw, tz='America/Manaus') {
  if (!raw) return null;

  if (raw instanceof Date) {
    // Usa UTC pra não cair no dia anterior
    const y = raw.getUTCFullYear();
    const m = raw.getUTCMonth() + 1;
    const d = raw.getUTCDate();
    return { y, m, d };
  }

  const s = safeStr(raw);

  // DD/MM/AAAA
  let m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return { d: Number(m1[1]), m: Number(m1[2]), y: Number(m1[3]) };

  // DD/MM (sem ano) -> assume ano atual no fuso de Manaus
  let m2 = s.match(/^(\d{2})\/(\d{2})$/);
  if (m2) {
    const now = new Date();
    const y = Number(new Intl.DateTimeFormat('en-CA',{ timeZone:tz, year:'numeric' }).format(now));
    return { d: Number(m2[1]), m: Number(m2[2]), y };
  }

  return null;
}

function partsToIso(parts){
  if (!parts) return '';
  return `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`;
}
function partsToBR(parts){
  if (!parts) return '';
  return `${pad2(parts.d)}/${pad2(parts.m)}/${parts.y}`;
}

export default async function handler(req, res) {
  try {
    const TZ = 'America/Manaus';

    // Range maior pra pegar todos os nomes (ajuste se precisar)
    const rows = await readRange('Escala da Faxina!B1:K16');
    if (!rows || !rows.length) return res.status(16).json({ ok:true, colunas:[] });

    // Normaliza matriz (garante que todas linhas tenham o mesmo tamanho)
    const maxCols = Math.max(...rows.map(r => r.length));
    const grid = rows.map(r => {
      const rr = r.slice();
      while (rr.length < maxCols) rr.push('');
      return rr;
    });

    // grid[0] = linha 1 (DATA GIRA)
    // grid[1] = linha 2 (DATA LIMPEZA)
    // grid[2] = linha 3 (GRUPO)
    // grid[3] = linha 4 (LÍDER)
    // grid[4+] = participantes (nomes) — coluna B tem números 1..n

    const rowDataGira   = grid[0] || [];
    const rowDataLimp   = grid[1] || [];
    const rowGrupo      = grid[2] || [];
    const rowLider      = grid[3] || [];

    // Coluna B (index 0) é rótulo/número; dados começam na coluna C (index 1)
    // Mas você disse “começa na coluna B e vai até K” — então vamos tratar:
    // - index 0 (B) = rótulos
    // - index 1..(K) = grupos
    const startDataCol = 1; // C dentro do range B:K
    const endDataCol = maxCols - 1;

    const colunas = [];

    for (let c = startDataCol; c <= endDataCol; c++) {
      const giraParts = parseDateParts(rowDataGira[c], TZ);
      const limpParts = parseDateParts(rowDataLimp[c], TZ);

      const grupo = safeStr(rowGrupo[c]);
      const lider = safeStr(rowLider[c]);

      // nomes a partir da linha 5 (index 4)
      const pessoas = [];
      for (let r = 4; r < grid.length; r++) {
        const nome = safeStr(grid[r][c]);
        if (nome) pessoas.push(nome);
      }

      // Se a coluna estiver totalmente vazia, ignora
      const hasAnything = grupo || lider || pessoas.length || giraParts || limpParts;
      if (!hasAnything) continue;

      const dataGiraIso = partsToIso(giraParts);
      const dataLimpIso = partsToIso(limpParts);

      colunas.push({
        colIndex: c, // útil pra debug
        dataGira:  { br: partsToBR(giraParts), iso: dataGiraIso },
        dataLimpeza: { br: partsToBR(limpParts), iso: dataLimpIso },
        grupo: grupo || '',
        lider: lider || '',
        pessoas
      });
    }

    // Ordena pela data de limpeza (se existir), senão pela data de gira
    colunas.sort((a,b) => {
      const A = a.dataLimpeza?.iso || a.dataGira?.iso || '';
      const B = b.dataLimpeza?.iso || b.dataGira?.iso || '';
      return A.localeCompare(B);
    });

    return res.status(200).json({ ok:true, colunas });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
