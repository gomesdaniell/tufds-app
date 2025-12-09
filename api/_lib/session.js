// api/_lib/session.js  (ESM)
import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

// helpers base64url
const b64u = (b) => Buffer.from(b).toString("base64url");
const ub64 = (s) => Buffer.from(s, "base64url").toString();

export function signSession(payload) {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = b64u(JSON.stringify(payload));
  const data   = `${header}.${body}`;
  const sig    = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySession(token) {
  if (!token) return null;
  const [h, b, s] = token.split(".");
  if (!h || !b || !s) return null;
  const data = `${h}.${b}`;
  const expSig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  if (expSig !== s) return null;

  const payload = JSON.parse(ub64(b));
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

// lê cookie simples
export function readCookie(req, name) {
  const raw = req.headers?.cookie || "";
  const parts = raw.split(/;\s*/g);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
