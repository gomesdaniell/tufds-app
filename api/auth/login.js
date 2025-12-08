// api/auth/login.js
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { readRange } from '../../lib/sheets.js';

const JWT_SECRET = process.env.TUFDS_JWT_SECRET || 'dev-secret-change-me';
const COOKIE = 'tufds_token';
const MAX_AGE = 60 * 60 * 8; // 8h
const DEBUG_AUTH = process.env.DEBUG_AUTH === '1';

function norm(s=''){ return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
function isHex(s){ return /^[a-f0-9]+$/i.test(s); }
function isB64(s){ return /^[A-Za-z0-9+/]+=?=?$/.test(s); }

function detectHash(hashRaw=''){
  const h = String(hashRaw).trim();
  if (!h) return { kind:'empty' };
  if (h.startsWith('$2a$') || h.startsWith('$2b$') || h.startsWith('$2y$')) return { kind:'bcrypt' };
  if (h.startsWith('sha256:')) return { kind:'sha256-hex', value: h.slice(7) };
  if (h.startsWith('md5:'))    return { kind:'md5-hex',   value: h.slice(4) };

  // heurísticas:
  if (h.length === 64 && isHex(h)) return { kind:'sha256-hex', value:h };
  if ((h.length === 43 || h.length === 44) && isB64(h)) return { kind:'sha256-b64', value:h };

  return { kind:'unknown' };
}

async function verifyPassword(plain, hashRaw){
  const d = detectHash(hashRaw);
  const pwd = String(plain);

  if (d.kind === 'bcrypt') {
    return bcrypt.compare(pwd, hashRaw);
  }
  if (d.kind === 'sha256-hex') {
    const digest = crypto.createHash('sha256').update(pwd, 'utf8').digest('hex');
    return digest.toLowerCase() === String(d.value).toLowerCase();
  }
  if (d.kind === 'sha256-b64') {
    const digest = crypto.createHash('sha256').update(pwd, 'utf8').digest('base64').replace(/=+$/,'');
    const target = String(d.value).replace(/=+$/,''); // tolera = final
    return digest === target;
  }
  if (d.kind === 'md5-hex') {
    const digest = crypto.createHash('md5').update(pwd, 'utf8').digest('hex');
    return digest.toLowerCase() === String(d.value).toLowerCase();
  }

  return false; // formato desconhecido
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok:false, message:'Método não permitido' });
    }

    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ ok:false, message:'Informe e-mail e senha.' });
    }

    // Lê a aba Cadastro (até AD para cobrir a coluna AC = SENHA_HASH)
    const rows = await readRange('Cadastro!A1:AD');
    if (!rows.length) {
      return res.status(500).json({ ok:false, message:'Planilha vazia ou inacessível.' });
    }

    const header = rows[0].map(h => String(h).trim());
    const ixEmail = header.findIndex(h => /e-?mail/i.test(h));
    const ixHash  = header.findIndex(h => /senha.*hash/i.test(h));
    const ixNome  = header.findIndex(h => /^nome/i.test(h));

    if (ixEmail < 0 || ixHash < 0) {
      return res.status(500).json({ ok:false, message:'Colunas não encontradas (E-mail ou SENHA_HASH).' });
    }

    const alvo = norm(email).toLowerCase();
    const found = rows.slice(1).find(r => norm(r[ixEmail]||'').toLowerCase() === alvo);

    if (!found) {
      return res.status(401).json({ ok:false, message:'E-mail não cadastrado.' });
    }

    const hash = String(found[ixHash] || '').trim();
    const ok = await verifyPassword(String(senha), hash);

    if (!ok) {
      const detail = DEBUG_AUTH ? `Formato hash: ${detectHash(hash).kind}` : undefined;
      return res.status(401).json({ ok:false, message:'Senha incorreta.', detail });
    }

    const nome = (found[ixNome] || email).toString();

    const token = jwt.sign({ sub: email, nome }, JWT_SECRET, { expiresIn: MAX_AGE });

    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; Secure`
    );

    return res.status(200).json({ ok:true, message:'Login autorizado.' });
  } catch (e) {
    console.error('Erro login Sheets:', e);
    return res.status(500).json({ ok:false, message:'Erro no login.' });
  }
}
