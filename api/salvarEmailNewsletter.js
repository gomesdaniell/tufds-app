// api/newsletter/save.js
import { ensureSheet, appendRows } from '../../lib/sheets.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Use POST' });
    const { email } = (req.body || {});
    if (!email) return res.status(400).json({ ok:false, error:'email obrigatório' });

    const SHEET = 'Newsletter';
    await ensureSheet(SHEET, ['Data/Hora','Email','Origem']);
    const agora = new Date().toISOString(); // ISO (servidor)
    await appendRows(`${SHEET}!A:C`, [[agora, email, 'App TUFDS']]);

    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
