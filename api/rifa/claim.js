import { sheets, SHEET_ID, TAB, ensureHeader, nowBR } from "./_client.js";

export default async function handler(req,res){
  if (req.method!=="POST") return res.status(405).json({ok:false, message:"Method Not Allowed"});
  try{
    const b = await req.json?.() || req.body || {};
    const rifaId = String(b?.rifaId||'').trim();
    const numero = Number(b?.numero||0);
    const comprador = String(b?.comprador||'').trim();
    const pago = b?.pago ? "Sim" : "";
    if(!rifaId || !numero) throw new Error("Dados obrigatórios ausentes.");

    const s = await sheets(); await ensureHeader(s);
    // carrega tudo para achar a linha
    const r = await s.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `${TAB}!A:G`
    });
    const rows = r.data.values || [];
    const head = rows[0]||[];
    const col = (name)=> head.indexOf(name)+1;

    let targetRow = -1;
    for(let i=1;i<rows.length;i++){
      if(rows[i][0]===rifaId && Number(rows[i][2])===numero){ targetRow = i+1; break; }
    }
    if(targetRow<2) throw new Error("Número não encontrado.");

    await s.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!D${targetRow}:G${targetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[
        comprador, nowBR(), (comprador ? "Vendido" : "Livre"), (comprador ? pago : "")
      ]] }
    });

    res.json({ok:true});
  }catch(e){ res.status(500).json({ok:false, message:e.message}); }
}
