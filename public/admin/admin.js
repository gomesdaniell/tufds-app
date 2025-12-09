// public/admin/admin.js
async function loadPartial(url, initFn) {
  const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
  const html = await res.text();
  const view = document.getElementById('view');
  view.innerHTML = html;

  // chama o init específico desta tela (se houver)
  if (typeof initFn === 'function') {
    await initFn();
  }
}

/* ===========================
   INIT: CONTROLE DE FALTAS
   =========================== */
async function initFaltas() {
  // garante que está autenticado
  try {
    const me = await fetch('/api/auth/me.js');
    const j = await me.json();
    if (!j.ok) { window.location.href = '/public/login.html'; return; }
  } catch {
    window.location.href = '/public/login.html';
    return;
  }

  // pega dados do backend
  const r = await fetch('/api/faltas/init.js', { cache: 'no-store' });
  const j = await r.json();
  if (!j.ok) throw new Error('Falha ao carregar init de faltas.');

  // preenche Nomes
  const sel = document.getElementById('nome');
  sel.innerHTML = '<option value="">Selecione...</option>' +
    j.nomes.map(n => `<option>${n}</option>`).join('');

  // data padrão (yyyy-mm-dd)
  const dt = document.getElementById('dataAusencia');
  dt.value = j.hojeISO || '';
  dt.dataset.hoje = j.hojeISO || '';

  // preenche Motivos (garantindo "Outros" ao final)
  const motivos = Array.isArray(j.motivos) ? j.motivos.slice() : [];
  if (!motivos.includes('Outros')) motivos.push('Outros');

  const box = document.getElementById('motivosBox');
  box.innerHTML = '';
  motivos.forEach((m, idx) => {
    const id = 'mot_' + idx;
    const div = document.createElement('div');
    div.className = 'motivo';
    div.innerHTML = `
      <input type="checkbox" id="${id}" value="${m}">
      <label for="${id}">${m}</label>
    `;
    box.appendChild(div);
  });

  // contador de observação
  const MIN_OBS = 30;
  const obs = document.getElementById('observacao');
  const obsCount = document.getElementById('obsCount');
  obs.addEventListener('input', (e) => {
    const n = e.target.value.replace(/\s+/g,' ').trim().length;
    obsCount.textContent = Math.max(0, n|0);
  });

  // submit
  const btn = document.getElementById('enviar');
  const msg = document.getElementById('msg');

  btn.addEventListener('click', async () => {
    const nome = document.getElementById('nome').value;
    const dataAusencia = document.getElementById('dataAusencia').value;
    const observacao = document.getElementById('observacao').value.trim();
    const motivos = Array.from(document.querySelectorAll('#motivosBox input[type=checkbox]:checked'))
      .map(ch => ch.value);

    if (!nome) { alert('Selecione o nome.'); return; }
    if (!dataAusencia) { alert('Informe a data da ausência.'); return; }
    if (observacao.replace(/\s+/g,' ').trim().length < MIN_OBS) {
      alert('A observação precisa ter, no mínimo, 30 caracteres.'); return;
    }

    btn.disabled = true; btn.textContent = 'Enviando...';
    msg.style.display = 'none'; msg.className = ''; msg.textContent = '';

    try {
      const res = await fetch('/api/faltas/salvar.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, dataAusencia, motivos, observacao })
      });
      const out = await res.json();
      if (!out.ok) throw new Error(out.message || 'Erro ao salvar');

      btn.disabled = false; btn.textContent = 'Registrar falta';
      msg.className = 'ok'; msg.textContent = `✅ Falta registrada! Protocolo: ${out.registroID}`;
      msg.style.display = 'block';

      // limpa campos
      document.getElementById('dataAusencia').value = dt.dataset.hoje || '';
      document.getElementById('observacao').value = '';
      obsCount.textContent = '0';
      document.querySelectorAll('#motivosBox input[type=checkbox]').forEach(ch => ch.checked = false);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Registrar falta';
      msg.className = 'err'; msg.textContent = '❌ ' + e.message;
      msg.style.display = 'block';
    }
  });
}

/* ===========================
   INICIALIZADORES DAS ABAS
   =========================== */
const VIEWS = {
  // Transparência Financeira
  financeiro: () => loadPartial('/public/admin/partials/FinanceiroView.html', async () => {
    // se quiser, aqui dá para chamar initFinanceiro() (igual fizemos pro faltas)
  }),

  // Registro de Presenças (placeholder)
  presencas: () => loadPartial('/public/admin/partials/Presencas.html', null),

  // Controle de Faltas
  faltas: () => loadPartial('/public/admin/partials/Faltas.html', initFaltas),

  // Aulas de Desenvolvimento
  aulas: () => loadPartial('/public/admin/partials/Aulas.html', async () => {}),

  // Desenvolvimento Individual (placeholder)
  desenvolvimento: () => loadPartial('/public/admin/partials/Desenvolvimento.html', null),

  // Aniversariantes
  aniversariantes: () => loadPartial('/public/admin/partials/Aniversariantes.html', async () => {})
};

// wire dos botões do topo
function bindMenu() {
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const k = btn.getAttribute('data-view');
      document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (VIEWS[k]) VIEWS[k]();
    });
  });
}

// ao carregar o painel, abre Faltas por padrão (ou o que preferir)
window.addEventListener('DOMContentLoaded', () => {
  bindMenu();
  // ativa o botão correto
  const btn = document.querySelector('[data-view="faltas"]');
  btn?.classList.add('active');
  VIEWS.faltas();
});
