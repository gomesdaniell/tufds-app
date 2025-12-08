// api/auth/login.js

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { readRange } from '../../lib/sheets.js';

const JWT_SECRET = process.env.TUFDS_JWT_SECRET || 'dev-secret-change-me';
const COOKIE = 'tufds_token';
const MAX_AGE = 60 * 60 * 8; // 8h

function normalize(str) {
  return String(str || '').trim();
}

// Detecta formato do hash e valida
async function checkPasswordAgainstHash(plain, storedHash) {
  const hash = String(storedHash || '').trim();


  // 2) SHA-256 Base64 (padrão do Apps Script com .digest(SHA_256) + Base64)
  const isLikelySha256B64 = /^[A-Za-z0-9+/]{40,44}={0,2}$/.test(hash);
  if (isLikelySha256B64) {
    const digest = crypto
      .createHash('sha256')
      .update(String(plain), 'utf8')
      .digest('base64');

    // logs de sanidade (aparecem nos Function Logs da Vercel)
    console.log('🧩 Calculado:', digest);
    console.log('🧩 Armazenado:', hash);

    return digest === hash;
  }

  // (outros formatos poderiam ser adicionados aqui se necessário)
  return false;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, message: 'Método não permitido' });
    }

    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ ok: false, message: 'Informe e-mail e senha.' });
    }

    // Lê planilha: aba "Cadastro" (até AD cobre a coluna AC = SENHA_HASH)
    const rows = await readRange('Cadastro!A1:AD');
    if (!rows.length) {
      return res.status(500).json({ ok: false, message: 'Planilha vazia ou inacessível.' });
    }

    const header = rows[0].map(h => String(h || '').trim());
    const ixEmail = header.findIndex(h => /e-?mail/i.test(h));
    const ixHash  = header.findIndex(h => /senha.*hash/i.test(h));
    const ixNome  = header.findIndex(h => /^nome\b/i.test(h));

    if (ixEmail < 0 || ixHash < 0) {
      return res.status(500).json({ ok: false, message: 'Colunas não encontradas (E-mail ou SENHA_HASH).' });
    }

    const alvo = rows
      .slice(1)
      .find(r => normalize(r[ixEmail]).toLowerCase() === normalize(email).toLowerCase());

    if (!alvo) {
      return res.status(401).json({ ok: false, message: 'E-mail não cadastrado.' });
    }

    const storedHash = normalize(alvo[ixHash]);
    const passOK = await checkPasswordAgainstHash(senha, storedHash);
    if (!passOK) {
      return res.status(401).json({ ok: false, message: 'Senha incorreta.' });
    }

    const nome = normalize(alvo[ixNome]) || normalize(email);

    const token = jwt.sign({ sub: normalize(email), nome }, JWT_SECRET, { expiresIn: MAX_AGE });
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
