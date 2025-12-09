// api/auth/logout.js (ESM)
export default async function handler(req, res) {
  res.setHeader("Set-Cookie", "tufds_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0");
  res.status(200).json({ ok:true });
}
