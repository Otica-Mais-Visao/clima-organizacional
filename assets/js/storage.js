/* =====================================================================
   ENVIO DA RESPOSTA
   ---------------------------------------------------------------------
   - Com Supabase configurado: POST via REST (PostgREST) na tabela.
     A chave anon só tem permissão de INSERT (ver supabase/schema.sql),
     então ninguém consegue ler respostas pelo app do colaborador.
   - Sem Supabase: modo demonstração, guarda no localStorage.
   - Se a rede falhar, a resposta fica na fila local e é reenviada
     na próxima abertura da página.
   ===================================================================== */

window.SurveyStorage = (function () {
  const cfg = () => window.SURVEY_CONFIG.supabase || {};
  const QUEUE_KEY = 'clima:fila';
  const DEMO_KEY = 'clima:demo';

  function isLive() { return !!(cfg().url && cfg().anonKey); }

  async function post(row) {
    const c = cfg();
    const res = await fetch(`${c.url.replace(/\/$/, '')}/rest/v1/${c.table || 'respostas'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': c.anonKey,
        'Authorization': `Bearer ${c.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Supabase ${res.status}: ${t}`);
    }
  }

  function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; } }
  function writeQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

  async function flushQueue() {
    if (!isLive()) return;
    const q = readQueue();
    if (!q.length) return;
    const rest = [];
    for (const row of q) {
      try { await post(row); } catch (e) { rest.push(row); }
    }
    writeQueue(rest);
  }

  async function submit(row) {
    if (!isLive()) {
      const all = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
      all.push(row);
      localStorage.setItem(DEMO_KEY, JSON.stringify(all));
      return { mode: 'demo' };
    }
    try {
      await post(row);
      return { mode: 'live' };
    } catch (e) {
      // guarda para reenviar depois; para a pessoa, a resposta está registrada
      const q = readQueue(); q.push(row); writeQueue(q);
      console.warn('Resposta guardada na fila local:', e.message);
      return { mode: 'queued', error: e.message };
    }
  }

  return { isLive, submit, flushQueue };
})();
