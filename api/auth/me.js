// api/auth/me.js (ESM)
import { verifySession, readCookie } from "../_lib/session.js";

export default async function handler(req, res) {
  try {
    const token = readCookie(req, "tufds_session");
    const payload = verifySession(token);
    if (!payload) { res.status(401).json({ ok:false }); return; }
    res.status(200).json({ ok:true, user:{ email: payload.email } });
  } catch (e) {
    res.status(200).json({ ok:false });
  }
}
