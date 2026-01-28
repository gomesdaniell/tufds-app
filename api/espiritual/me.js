// /api/espiritual/me.js (ESM)
import { readRange } from "../../lib/sheets.js";
import { verifySession, readCookie } from "../_lib/session.js";

function safeStr(v){ return String(v ?? "").trim(); }

function slug(s=""){
  return safeStr(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"");
}

function formatDateCell(v){
  if (!v) return "";
  if (v instanceof Date) {
    // usa UTC para não cair no dia anterior
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth()+1).padStart(2,"0");
    const d = String(v.getUTCDate()).padStart(2,"0");
    return `${d}/${m}/${y}`;
  }
  return safeStr(v);
}

export default async function handler(req, res) {
  try {
    // 1) autentica pelo mesmo padrão do /api/auth/me.js
    const token = readCookie(req, "tufds_session");
    const payload = verifySession(token);
    if (!payload?.email) {
      res.status(401).json({ ok:false, error:"Não autenticado" });
      return;
    }
    const userEmail = String(payload.email).trim().toLowerCase();

    // 2) lê planilha
    const grid = await readRange("Espiritual!A1:AZ200");
    if (!grid || grid.length < 3) {
      res.status(200).json({ ok:true, cols:[], row:null });
      return;
    }

    const h1 = (grid[0] || []).map(safeStr); // grupos (mesclados -> vazios)
    const h2 = (grid[1] || []).map(safeStr); // campos

    const maxCols = Math.max(h1.length, h2.length, ...grid.map(r => r.length));
    const row1 = h1.concat(Array(maxCols - h1.length).fill(""));
    const row2 = h2.concat(Array(maxCols - h2.length).fill(""));

    // 3) reconstrói grupos (efeito das células mescladas)
    let currentGroup = "";
    const cols = [];
    const keyCount = new Map();

    for (let c=0; c<maxCols; c++){
      const g = row1[c] || currentGroup;
      if (row1[c]) currentGroup = row1[c];

      const label = row2[c] || row1[c] || `Coluna ${c+1}`;
      const group = g || "Geral";

      let baseKey = slug(group) + "__" + slug(label);
      if (baseKey === "__") baseKey = `col_${c+1}`;

      const n = (keyCount.get(baseKey) || 0) + 1;
      keyCount.set(baseKey, n);
      const key = n === 1 ? baseKey : `${baseKey}_${n}`;

      cols.push({ index:c, group, label, key });
    }

    // 4) acha a coluna Email na planilha
    const emailCol =
      cols.find(c => (c.label||"").toLowerCase() === "email") ||
      cols.find(c => (c.label||"").toLowerCase().includes("e-mail"));

    if (!emailCol) {
      res.status(400).json({
        ok:false,
        error:'Coluna "Email" não encontrada na aba Espiritual. Crie uma coluna Email para vincular login ao prontuário.'
      });
      return;
    }

    // 5) encontra a linha do usuário logado
    let found = null;

    for (let r=2; r<grid.length; r++){
      const line = grid[r] || [];
      const cellEmail = safeStr(line[emailCol.index]).toLowerCase();
      if (!cellEmail) continue;

      if (cellEmail === userEmail) {
        const obj = { __row: r+1 };
        for (let c=0; c<maxCols; c++){
          const col = cols[c];
          const raw = line[c] ?? "";
          obj[col.key] = (raw instanceof Date) ? formatDateCell(raw) : safeStr(raw);
        }
        found = obj;
        break;
      }
    }

    res.status(200).json({ ok:true, cols, row: found });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:String(e) });
  }
}
