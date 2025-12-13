import { sheets, SHEET_ID, TAB, ensureHeader } from "./_client.js";

export default async function handler(req,res){
  if (req.method!=="POST") return res.status(405).json({ok:false, message:"Method Not Allowed"});
  try{
    const b = await req.json?.() || req.body || {};
    const rifaId = String(b?.rifaId||'').trim();
    if(!rifaId) throw new Error("rifaId obrigatório.");

    const s = await sheets(); await ensureHeader(s);
    const r = await s.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `${TAB}!A:G`
    });
    const rows = r.data.values || [];
    const head = rows[0]||[];
    const ix = (name)=> head.indexOf(name);

    const vendidos = [];
    for(let i=1;i<rows.length;i++){
      const row = rows[i];
      if(row[ix("RIFA_ID")]===rifaId && (row[ix("STATUS")]||"") === "Vendido"){
        vendidos.push({
          numero: Number(row[ix("NUMERO")]),
          comprador: row[ix("COMPRADOR")] || ''
        });
      }
    }
    if(!vendidos.length) throw new Error("Nenhum número vendido.");

    const i = Math.floor(Math.random()*vendidos.length);
    const win = vendidos[i];
    res.json({ok:true, numero:win.numero, comprador:win.comprador});
  }catch(e){ res.status(500).json({ok:false, message:e.message}); }
}
