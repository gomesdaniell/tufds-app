// api/presencas/init.js
import { readRange } from '../../lib/sheets.js';

function norm(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();
}

export default async function handler(req, res){
  try{
    if (req.method !== 'GET') {
      return res.status(405).json({ ok:false, message:'Método não permitido' });
    }

    // Lê header + linhas suficientes (A1:AG cobre bastante)
    const rows = await readRange('Cadastro!A1:AG');
    if (!rows.length) return res.status(200).json({ ok:true, nomes: [] });

    const header = rows[0].map(h=>String(h||'').trim());
    const iNome  = header.findIndex(h => /nome completo/i.test(h) || /nome/i.test(h));
    const iAtivo = header.findIndex(h => /ativo/i.test(h) || /status/i.test(h) || /situa(ç|c)ao/i.test(h));

    if (iNome < 0) {
      return res.status(200).json({ ok:true, nomes: [] });
    }

    const nomes = rows.slice(1)
      .map(r => {
        const nome = String(r[iNome] || '').trim();
        const st   = iAtivo >= 0 ? norm(r[iAtivo]) : 'sim';
        const ativo = (!st || st === 'sim' || st.startsWith('ativo'));
        return { nome, ativo };
      })
      .filter(x => x.nome && x.ativo)
      .map(x => x.nome)
      .filter((v,i,a)=>a.indexOf(v)===i)
      .sort((a,b)=>a.localeCompare(b,'pt-BR'));

    return res.status(200).json({ ok:true, nomes });
  }catch(err){
    console.error('presencas/init erro:', err);
    return res.status(500).json({ ok:false, message: err.message || String(err) });
  }
}
