import { sheets, SHEET_ID, TAB, ensureHeader } from "./_client.js";

export default async function handler(req, res){
  if (req.method!=="GET") return res.status(405).json({ok:false, message:"Method Not Allowed"});
  try{
    const rifaId = String((req.query?.rifaId || req.url?.split("rifaId=")[1] || '')).trim();
    if(!rifaId) throw new Error("rifaId obrigatório.");

    const s = await sheets(); await ensureHeader(s);
    const r = await s.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: `${TAB}!A:G`
    });

    const rows = r.data.values || [];
    const head = rows[0]||[];
    const idx = (name)=> head.indexOf(name);

    const out = [];
    let nome = null;

    for(let i=1;i<rows.length;i++){
      const row = rows[i];
      if(row[idx("RIFA_ID")]===rifaId){
        nome = nome || row[idx("RIFA_NOME")] || '';
        out.push({
          n: Number(row[idx("NUMERO")]),
          comprador: row[idx("COMPRADOR")] || '',
          status: row[idx("STATUS")] || 'Livre',
          pago: row[idx("PAGO")] || ''
        });
      }
    }
    if(!out.length) throw new Error("Rifa não encontrada.");

    // ordena
    out.sort((a,b)=>a.n-b.n);
    res.json({ok:true, nome, numeros:out});
  }catch(e){ res.status(500).json({ok:false, message:e.message}); }
}
