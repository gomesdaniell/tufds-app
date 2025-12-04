// api/ping.js
export default async function handler(req, res) {
  try {
    return res.status(200).json({ ok: true, when: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
