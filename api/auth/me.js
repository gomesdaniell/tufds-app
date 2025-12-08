// api/auth/me.js
import jwt from 'jsonwebtoken';

const COOKIE = 'tufds_token';
const JWT_SECRET = process.env.TUFDS_JWT_SECRET || 'dev-secret-change-me';

export default async function handler(req, res) {
  try {
    const cookie = req.headers.cookie || '';
    const m = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
    if (!m) return res.status(401).json({ ok:false });

    const token = m[1];
    const payload = jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ ok:true, user:{ email: payload.sub, nome: payload.nome } });
  } catch {
    return res.status(401).json({ ok:false });
  }
}
