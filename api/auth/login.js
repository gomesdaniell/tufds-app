// api/auth/login.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readRange } from '../../lib/sheets.js';

const JWT_SECRET = process.env.TUFDS_JWT_SECRET || 'dev-secret-change-me';
const COOKIE = 'tufds_token';
const MAX_AGE = 60 * 60 * 8; // 8h

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, message: 'Método não permitido' });
    }

    const { email, senha } = req.body || {};
    if (!email || !senha)
      return res.status(400).json({ ok: false, message: 'Informe e-mail e senha.' });

    // Lê planilha: aba "Cadastro"
    const rows = await readRange('Cadastro!A1:AD'); // inclui col AC (SENHA_HASH)
    if (!rows.length)
      return res.status(500).json({ ok: false, message: 'Planilha vazia ou inacessível.' });

    const header = rows[0];
    const ixEmail = header.findIndex(h => /e-?mail/i.test(h));
    const ixHash  = header.findIndex(h => /senha.*hash/i.test(h));
    const ixNome  = header.findIndex(h => /nome/i.test(h));

    if (ixEmail < 0 || ixHash < 0)
      return res.status(500).json({ ok: false, message: 'Colunas não encontradas (E-mail ou SENHA_HASH).' });

    const found = rows.slice(1).find(r => String(r[ixEmail] || '').trim().toLowerCase() === email.toLowerCase());
    if (!found)
      return res.status(401).json({ ok: false, message: 'E-mail não cadastrado.' });

    const hash = String(found[ixHash] || '').trim();
    const ok = await bcrypt.compare(String(senha), hash);
    if (!ok)
      return res.status(401).json({ ok: false, message: 'Senha incorreta.' });

    const nome = found[ixNome] || email;
    const token = jwt.sign({ sub: email, nome }, JWT_SECRET, { expiresIn: MAX_AGE });

    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`
    );

    return res.status(200).json({ ok: true, message: 'Login autorizado.' });
  } catch (e) {
    console.error('Erro login Sheets:', e);
    return res.status(500).json({ ok: false, message: 'Erro no login.' });
  }
}
