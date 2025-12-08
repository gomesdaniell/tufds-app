// api/auth/logout.js
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, message: 'Método não permitido' });
    }

    // Define o cookie com expiração imediata (logout)
    res.setHeader(
      'Set-Cookie',
      'tufds_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure'
    );

    return res.status(200).json({ ok: true, message: 'Logout realizado com sucesso.' });
  } catch (e) {
    console.error('Erro no logout:', e);
    return res.status(500).json({ ok: false, message: 'Erro ao encerrar sessão.' });
  }
}
