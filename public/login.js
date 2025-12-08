<!-- login.html -->
<form id="login-form" autocomplete="on">
  <label>E-mail</label>
  <input id="email" type="email" required />
  <label>Senha</label>
  <input id="senha" type="password" required />
  <button type="submit">Entrar</button>
  <p id="msg" style="color:#b91c1c"></p>
</form>

<script>
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msg');
  msg.textContent = '';

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, senha }),
      // NÃO use credentials: 'include' aqui; o cookie HttpOnly será setado pela resposta
    });

    const data = await res.json().catch(()=> ({}));

    if (!res.ok || !data.ok) {
      msg.textContent = data?.message || 'Falha no login.';
      return;
    }

    // cookie HttpOnly foi setado; agora redireciona pro painel
    window.location.href = '/app/index.html';
  } catch (err) {
    msg.textContent = 'Erro de rede. Tente novamente.';
    console.error(err);
  }
});
</script>
