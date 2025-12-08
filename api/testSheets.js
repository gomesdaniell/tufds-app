import { readRange } from '../lib/sheets.js';

export default async function handler(req, res) {
  try {
    const rows = await readRange('Cadastro!A1:AD');
    return res.status(200).json({ linhas: rows.length, exemplo: rows.slice(0, 5) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ erro: err.message });
  }
}
