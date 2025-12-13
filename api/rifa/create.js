import { sheets, SHEET_ID, TAB, ensureHeader, nowBR } from "./_client.js";

export default async function handler(req, res){
  if (req.method!=="POST") return res.status(405).json({ok:false, message:"Method Not Allowed"});
  try{
    const body = await req.json?.() || req.body || {};
    const nome = String(body?.nome||'').trim();
    const qtd  = Number(body?.qtd||0);
    if(!nome || !qtd) throw new Error("Informe nome e quantidade.");

    const s = await sheets(); await ensureHeader(s);
    const rifaId = 'RIFA_'+Date.now();

    // cria linhas 1..qtd com Livre
    const rows = Array.from({length:qtd}, (_,i)=>[
      rifaId, nome, (i+1), "", nowBR(), "Livre", ""
    ]);

    await s.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: TAB, valueInputOption:"RAW",
      requestBody: { values: rows }
    });

    res.json({ok:true, rifaId});
  }catch(e){ res.status(500).json({ok:false, message:e.message}); }
}
