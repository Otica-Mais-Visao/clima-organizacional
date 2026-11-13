/* =====================================================================
   PAINEL DE RESULTADOS · Pesquisa de Clima Mais Visão & Golden Mix
   Lê a tabela `respostas` (só com login autorizado) e calcula tudo no
   navegador. Nunca exibe uma loja com menos de `minResponses` respostas.
   ===================================================================== */
(function () {
  'use strict';
  const C = window.SURVEY_CONFIG, SB = C.supabase, SECS = window.SURVEY_SECTIONS, CTX = window.SURVEY_CONTEXT;
  const MIN = C.minResponses || 4;
  const BRAND = C.brands || { MV: 'Mais Visão', GM: 'Golden Mix' };
  const KEY = 'clima:painel';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => n == null ? '—' : `${Math.round(n)}%`;
  const IS_LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const DEMO = IS_LOCAL && new URLSearchParams(location.search).has('demo');

  /* Perguntas em que SIM é um sinal NEGATIVO (invertidas no índice). */
  const NEG = new Set(['l01', 'l04']);

  /* ---- metadados das perguntas ---- */
  const Q = {}, YN_SECS = [], TEXTQ = {};
  SECS.forEach(s => {
    const yn = s.questions.filter(q => q.type === 'yn');
    if (yn.length) YN_SECS.push({ id: s.id, num: s.num, title: s.title, short: shortTitle(s), naOpt: !!s.naOpt, qs: yn.map(q => q.id) });
    s.questions.forEach(q => {
      Q[q.id] = { ...q, sec: s };
      if (q.type === 'text') TEXTQ[q.id] = q.text;
      if (q.followUpIf) { Q[q.followUpIf.id] = { ...q.followUpIf, sec: s, parent: q.id }; TEXTQ[q.followUpIf.id] = q.followUpIf.text; }
    });
  });
  function shortTitle(s) {
    return ({ clima: 'Clima', praticas: 'Práticas', gerente: 'Gerente', auditoria: 'Auditoria', diretoria: 'Donos', geral: 'Liderança geral' })[s.id] || s.title;
  }
  const ALL_YN = YN_SECS.flatMap(s => s.qs);
  const STORE = {}; C.stores.forEach(s => STORE[s.slug] = s);

  /* ---- auth ---- */
  let token = sessionStorage.getItem(KEY) || '';
  async function login(email, pass) {
    const r = await fetch(`${SB.url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB.anonKey },
      body: JSON.stringify({ email, password: pass })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_code === 'invalid_credentials' ? 'E-mail ou senha incorretos.' : (j.msg || j.error_description || 'Não foi possível entrar.'));
    token = j.access_token; sessionStorage.setItem(KEY, token); sessionStorage.setItem(KEY + ':who', email);
  }
  function logout() {
    token = ''; sessionStorage.removeItem(KEY); sessionStorage.removeItem(KEY + ':who');
    $('#panel').classList.add('hide'); $('#loginWrap').classList.remove('hide');
    $('#topTools').classList.add('hide'); $('#who').textContent = '';
  }
  async function fetchRows() {
    if (DEMO) return demoRows();
    const r = await fetch(`${SB.url}/rest/v1/${SB.table || 'respostas'}?select=rodada,loja,loja_nome,bandeira,gestor,area,tempo_casa,respostas,textos,criado_em&order=criado_em.asc`,
      { headers: { apikey: SB.anonKey, Authorization: `Bearer ${token}` } });
    if (r.status === 401) { logout(); throw new Error('Sessão expirada. Entre novamente.'); }
    if (!r.ok) throw new Error(`Erro ${r.status} ao ler as respostas.`);
    return r.json();
  }

  /* ---- estatística ---- */
  function stat(rows, qid) {
    let sim = 0, nao = 0, na = 0;
    for (const r of rows) { const v = r.respostas && r.respostas[qid]; if (v === 'sim') sim++; else if (v === 'nao') nao++; else if (v === 'na') na++; }
    const valid = sim + nao; const pct = valid ? sim / valid * 100 : null;
    const fav = pct == null ? null : (NEG.has(qid) ? 100 - pct : pct);
    return { sim, nao, na, valid, pct, fav, asked: sim + nao + na };
  }
  function index(rows, qids) {
    const v = qids.map(q => stat(rows, q).fav).filter(x => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  const level = f => f == null ? 'na' : f >= 70 ? 'ok' : f >= 50 ? 'warn' : 'bad';
  const color = f => ({ ok: '#27BE8A', warn: '#F0A640', bad: '#E5484D', na: '#CFCBC0' })[level(f)];
  const levelTxt = f => ({ ok: 'Saudável', warn: 'Atenção', bad: 'Crítico', na: 'Sem dados' })[level(f)];
  const groupBy = (rows, k) => rows.reduce((m, r) => ((m[r[k]] = m[r[k]] || []).push(r), m), {});

  /* ---- estado ---- */
  let ROWS = [], R = [], tab = ['geral','lojas','lideranca','comentarios','adesao'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'geral', scope = 'ALL', storeSel = new URLSearchParams(location.search).get('loja') || null;
  const charts = {};
  function chart(id, cfg) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    const el = document.getElementById(id); if (!el || !window.Chart) return;
    Chart.defaults.font.family = '"Open Sans", system-ui, sans-serif'; Chart.defaults.color = '#555';
    charts[id] = new Chart(el, cfg);
  }

  function setRound() {
    const rounds = [...new Set(ROWS.map(r => r.rodada))].sort().reverse();
    const sel = $('#selRodada'); const cur = sel.value || C.round;
    const list = rounds.length ? rounds : [C.round];
    sel.innerHTML = list.map(r => `<option ${r === cur ? 'selected' : ''}>${esc(r)}</option>`).join('');
  }
  function applyFilters() {
    const rod = $('#selRodada').value;
    R = ROWS.filter(r => r.rodada === rod && (scope === 'ALL' || r.bandeira === scope));
  }

  /* ================= RENDER ================= */
  function render() {
    applyFilters();
    const all = ROWS.filter(r => r.rodada === $('#selRodada').value);
    $('#tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('section[data-tab]').forEach(s => s.classList.toggle('hide', s.dataset.tab !== tab));
    $('#cntCmt').textContent = all.filter(r => r.textos && Object.values(r.textos).some(v => v && String(v).trim())).length;
    $('#cntLojas').textContent = Object.values(groupBy(all, 'loja')).filter(g => g.length >= MIN).length;
    $('#heroSub').textContent = `Rodada ${$('#selRodada').value} · prazo ${fmtDate(C.deadline)} · ${all.length} resposta${all.length === 1 ? '' : 's'} até agora${scope !== 'ALL' ? ` · filtrando ${BRAND[scope]}` : ''}`;
    if (!all.length) { $('#content').innerHTML = ''; $('#emptyAll').classList.remove('hide'); return; }
    $('#emptyAll').classList.add('hide');
    ({ geral: renderGeral, lojas: renderLojas, lideranca: renderLideranca, comentarios: renderComentarios, adesao: renderAdesao })[tab](all);
  }
  function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }

  /* ---------- Visão geral ---------- */
  function renderGeral(all) {
    const mv = all.filter(r => r.bandeira === 'MV'), gm = all.filter(r => r.bandeira === 'GM');
    const idx = index(R, ALL_YN);
    const head = C.totalHeadcount || 0;
    const storesOk = Object.values(groupBy(R, 'loja')).filter(g => g.length >= MIN).length;
    const l04 = stat(R, 'l04'), l02 = stat(R, 'l02'), l01 = stat(R, 'l01');

    const secCards = YN_SECS.map(s => {
      const f = index(R, s.qs), fm = index(mv, s.qs), fg = index(gm, s.qs);
      return `<div class="secBox"><div class="eyebrow">${esc(s.num)} · ${esc(s.short)}</div>
        <div class="v c-${level(f)}">${fmt(f)}</div>
        <div class="track"><i class="b-${level(f)}" style="width:${f || 0}%"></i></div>
        <div class="cmp" style="margin-top:6px">MV <b>${fmt(fm)}</b> · GM <b>${fmt(fg)}</b></div></div>`;
    }).join('');

    const ranked = ALL_YN.map(q => ({ q, s: stat(R, q) })).filter(x => x.s.fav != null).sort((a, b) => a.s.fav - b.s.fav);
    const hl = (list) => list.map(({ q, s }) => `<div class="hl"><div class="pct c-${level(s.fav)}">${fmt(s.fav)}<small>favorável</small></div>
      <div class="tx">${esc(Q[q].text)}<small>${esc(Q[q].sec.num)} · ${esc(Q[q].sec.title)}${NEG.has(q) ? ' · pergunta invertida (NÃO é o favorável)' : ''} · ${s.valid} resp.</small></div></div>`).join('');

    $('#content').innerHTML = `
      <div class="grid g4 fade">
        <div class="card dark span2"><div class="gauge"><div class="ring lg" style="--p:${idx || 0};--c:${color(idx)}" data-v="${fmt(idx)}"></div>
          <div><div class="eyebrow" style="color:var(--gold)">Índice de favorabilidade</div>
          <div class="kpi"><div class="v">${levelTxt(idx)}</div><div class="l" style="color:#bbb">média do % de respostas favoráveis nas 20 perguntas (perguntas negativas invertidas)</div></div>
          <div class="small" style="margin-top:10px;color:#ddd">Mais Visão <b style="color:var(--gold)">${fmt(index(mv, ALL_YN))}</b> &nbsp;·&nbsp; Golden Mix <b style="color:var(--gold)">${fmt(index(gm, ALL_YN))}</b></div></div></div></div>
        <div class="card"><div class="kpi"><div class="l">Respostas recebidas</div><div class="v">${R.length}${head ? `<small> / ${head}</small>` : ''}</div>
          <div class="d">${head ? `${Math.round(R.length / head * 100)}% de adesão · ` : ''}MV ${mv.length} · GM ${gm.length}</div></div>
          <div class="stack" style="margin-top:12px"><i style="width:${all.length ? mv.length / all.length * 100 : 0}%;background:var(--gold)"></i><i style="width:${all.length ? gm.length / all.length * 100 : 0}%;background:#1A1A1A"></i></div>
          <div class="legend"><span><i class="dot" style="background:var(--gold)"></i>Mais Visão</span><span><i class="dot" style="background:#1A1A1A"></i>Golden Mix</span></div></div>
        <div class="card"><div class="kpi"><div class="l">Lojas com resultado próprio</div><div class="v">${storesOk}<small> / ${C.stores.filter(s => scope === 'ALL' || s.brand === scope).length}</small></div>
          <div class="d">mínimo de ${MIN} respostas por loja; abaixo disso a loja entra só no total da bandeira</div></div></div>
      </div>

      <div class="card fade" style="margin-top:16px"><div class="cardHead"><div><h3>Resultado por bloco</h3><p class="lead">% favorável em cada tema. Verde ≥ 70 · Laranja 50–69 · Vermelho &lt; 50.</p></div></div>
        <div class="secRow">${secCards}</div></div>

      <div class="grid g3 fade" style="margin-top:16px">
        <div class="card"><h3>Pontos de atenção</h3><p class="lead">Menores índices de favorabilidade</p>${hl(ranked.slice(0, 4)) || '<div class="empty">Sem dados</div>'}</div>
        <div class="card"><h3>Pontos fortes</h3><p class="lead">Maiores índices de favorabilidade</p>${hl(ranked.slice(-4).reverse()) || '<div class="empty">Sem dados</div>'}</div>
        <div class="card"><h3>Sinais de segurança psicológica</h3><p class="lead">Perguntas-chave do bloco de liderança</p>
          ${sig('Sentem receio de represália por opinar', l04.pct, l04.valid, true)}
          ${sig('Veem espaço seguro para relatar problemas', l02.pct, l02.valid, false)}
          ${sig('Acham que a relação com as chefias precisa melhorar', l01.pct, l01.valid, true)}
          ${sig('Acreditam que mudanças na liderança melhorariam o ambiente', stat(R, 'l05').pct, stat(R, 'l05').valid, true)}
        </div>
      </div>

      <div class="grid g2 fade" style="margin-top:16px">
        <div class="card"><h3>Mais Visão × Golden Mix por bloco</h3><p class="lead">% favorável por tema em cada bandeira</p><div class="ch" style="height:320px"><canvas id="chRadar"></canvas></div></div>
        <div class="card"><h3>Ranking de lojas</h3><p class="lead">Índice geral das lojas com ${MIN}+ respostas</p><div class="ch" style="height:320px"><canvas id="chLojas"></canvas></div><div id="noLojas"></div></div>
      </div>

      <div class="card fade" style="margin-top:16px"><div class="cardHead"><div><h3>Todas as perguntas</h3><p class="lead">% de SIM entre quem respondeu SIM ou NÃO. A marca preta indica a outra bandeira quando houver filtro.</p></div></div>
        ${questionBars(R, null)}</div>`;

    // radar
    chart('chRadar', {
      type: 'radar',
      data: { labels: YN_SECS.map(s => s.short), datasets: [
        { label: 'Mais Visão', data: YN_SECS.map(s => index(mv, s.qs)), borderColor: '#E0A800', backgroundColor: 'rgba(255,191,0,.25)', pointBackgroundColor: '#E0A800', borderWidth: 2 },
        { label: 'Golden Mix', data: YN_SECS.map(s => index(gm, s.qs)), borderColor: '#1A1A1A', backgroundColor: 'rgba(26,26,26,.12)', pointBackgroundColor: '#1A1A1A', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, backdropColor: 'transparent', font: { size: 10 } }, grid: { color: '#E9E7E1' }, angleLines: { color: '#E9E7E1' }, pointLabels: { font: { family: 'Montserrat', weight: '700', size: 11 } } } }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.raw)}` } } } }
    });
    // ranking lojas
    const lojas = Object.entries(groupBy(R, 'loja')).filter(([, g]) => g.length >= MIN).map(([slug, g]) => ({ slug, name: STORE[slug]?.name || g[0].loja_nome, brand: g[0].bandeira, n: g.length, f: index(g, ALL_YN) })).sort((a, b) => b.f - a.f);
    if (!lojas.length) { $('#noLojas').innerHTML = `<div class="empty"><b>Nenhuma loja com ${MIN}+ respostas ainda</b>Assim que uma loja atingir ${MIN} respostas ela aparece aqui.</div>`; $('#chLojas').style.display = 'none'; }
    else chart('chLojas', {
      type: 'bar',
      data: { labels: lojas.map(l => `${l.name} (${l.n})`), datasets: [{ data: lojas.map(l => l.f), backgroundColor: lojas.map(l => color(l.f)), borderRadius: 6, barThickness: 18 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { min: 0, max: 100, grid: { color: '#E9E7E1' }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false }, ticks: { font: { family: 'Montserrat', weight: '700', size: 11 } } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${fmt(c.raw)} favorável · ${BRAND[lojas[c.dataIndex].brand]}` } } },
        onClick: (e, els) => { if (els.length) { storeSel = lojas[els[0].index].slug; tab = 'lojas'; render(); } } }
    });
  }
  function sig(label, pct, n, negative) {
    const f = pct == null ? null : (negative ? 100 - pct : pct);
    return `<div class="hbar"><div class="t">${esc(label)}<small>${n} resp. válidas</small></div><div class="track"><i class="b-${level(f)}" style="width:${pct || 0}%"></i></div><div class="n">${fmt(pct)}<small>disseram SIM</small></div></div>`;
  }
  function questionBars(rows, cmpRows, opts = {}) {
    let html = '';
    YN_SECS.forEach(s => {
      html += `<div class="eyebrow" style="margin:18px 0 4px">${esc(s.num)} · ${esc(s.title)}${s.naOpt ? ' <span class="tag neutral" style="font-size:10px">tem opção "sem contato"</span>' : ''}</div>`;
      s.qs.forEach(q => {
        const st = stat(rows, q), cmp = cmpRows ? stat(cmpRows, q) : null;
        const neg = NEG.has(q);
        html += `<div class="hbar"><div class="t"><code>${q}</code>${esc(Q[q].text)}<small>${st.sim} sim · ${st.nao} não${st.na ? ` · ${st.na} sem contato` : ''}${neg ? ' · <b>SIM é sinal negativo</b>' : ''}${cmp && cmp.pct != null ? ` · ${esc(opts.cmpLabel || 'referência')}: ${fmt(cmp.pct)}` : ''}</small></div>
          <div class="track"><i class="b-${level(st.fav)}" style="width:${st.pct || 0}%"></i>${cmp && cmp.pct != null ? `<span class="mark" style="left:${cmp.pct}%"></span>` : ''}</div>
          <div class="n">${fmt(st.pct)}<small>SIM</small></div></div>`;
      });
    });
    return html;
  }

  /* ---------- Lojas ---------- */
  function renderLojas(all) {
    const byStore = groupBy(R, 'loja');
    const stores = C.stores.filter(s => scope === 'ALL' || s.brand === scope);
    const cards = stores.map(s => {
      const g = byStore[s.slug] || []; const ok = g.length >= MIN; const f = ok ? index(g, ALL_YN) : null;
      return `<button class="store ${ok ? '' : 'locked'} ${storeSel === s.slug ? 'on' : ''}" data-slug="${s.slug}">
        <div class="nm">${esc(s.name)}<span class="tag ${s.brand.toLowerCase()}">${BRAND[s.brand]}</span></div>
        <div class="score ${ok ? 'c-' + level(f) : ''}">${ok ? fmt(f) : `${g.length} de ${MIN} respostas`}${ok ? ' <small>favorável</small>' : ''}</div>
        <div class="track"><i class="${ok ? 'b-' + level(f) : 'b-na'}" style="width:${ok ? f : (g.length / MIN * 100)}%"></i></div>
        <div class="meta"><span>${g.length} resposta${g.length === 1 ? '' : 's'}</span><span>${ok ? `<span class="tag ${level(f)}">${levelTxt(f)}</span>` : '<span class="tag neutral">aguardando</span>'}</span></div></button>`;
    }).join('');

    // heatmap lojas × blocos
    const okStores = stores.filter(s => (byStore[s.slug] || []).length >= MIN);
    let heat = '';
    if (okStores.length) {
      heat = `<div class="card fade" style="margin-top:16px"><h3>Mapa de calor · lojas × blocos</h3><p class="lead">% favorável. Só lojas com ${MIN}+ respostas. Clique na linha para abrir a loja.</p>
        <div style="overflow-x:auto"><table class="heat"><tr><th>Loja</th><th class="num">Resp.</th>${YN_SECS.map(s => `<th style="text-align:center">${esc(s.short)}</th>`).join('')}<th style="text-align:center">Geral</th></tr>
        ${okStores.map(s => { const g = byStore[s.slug]; return `<tr style="cursor:pointer" data-slug="${s.slug}"><td><b>${esc(s.name)}</b> <span class="tag ${s.brand.toLowerCase()}" style="font-size:10px">${s.brand}</span></td><td class="num">${g.length}</td>
          ${YN_SECS.map(sec => { const f = index(g, sec.qs); return `<td class="h ${f == null ? 'na' : ''}" style="background:${heatBg(f)}">${fmt(f)}</td>`; }).join('')}
          <td class="h" style="background:${heatBg(index(g, ALL_YN))}"><b>${fmt(index(g, ALL_YN))}</b></td></tr>`; }).join('')}</table></div></div>`;
    }

    $('#content').innerHTML = `<div class="storeGrid fade">${cards}</div>${heat}<div id="storeDetail"></div>`;
    $('#content').querySelectorAll('[data-slug]').forEach(el => el.addEventListener('click', () => { storeSel = el.dataset.slug; renderLojas(all); document.getElementById('storeDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    if (storeSel) renderStoreDetail(all, storeSel);
  }
  const heatBg = f => f == null ? '#F3F2EE' : f >= 70 ? `rgba(39,190,138,${.18 + (f - 70) / 30 * .5})` : f >= 50 ? `rgba(240,166,64,${.25 + (f - 50) / 20 * .35})` : `rgba(229,72,77,${.22 + (50 - f) / 50 * .45})`;

  function renderStoreDetail(all, slug) {
    const s = STORE[slug]; const g = all.filter(r => r.loja === slug); const brandRows = all.filter(r => r.bandeira === s.brand);
    const box = $('#storeDetail');
    if (g.length < MIN) {
      box.innerHTML = `<div class="card fade" style="margin-top:16px"><div class="cardHead"><div><h3>${esc(s.name)} <span class="tag ${s.brand.toLowerCase()}">${BRAND[s.brand]}</span></h3></div></div>
        <div class="empty"><b>${g.length} de ${MIN} respostas</b>Para proteger o anonimato, o resultado desta loja só aparece a partir de ${MIN} respostas. Até lá, as respostas entram apenas no total ${BRAND[s.brand]}.</div></div>`;
      return;
    }
    const f = index(g, ALL_YN), fb = index(brandRows, ALL_YN);
    const delta = (a, b) => a == null || b == null ? '' : `<span class="delta ${a - b >= 0 ? 'up' : 'dn'}">${a - b >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(a - b))} pts</span>`;
    const secs = YN_SECS.map(sec => { const x = index(g, sec.qs), y = index(brandRows, sec.qs); return `<div class="secBox"><div class="eyebrow">${esc(sec.num)} · ${esc(sec.short)}</div><div class="v c-${level(x)}">${fmt(x)}</div><div class="track"><i class="b-${level(x)}" style="width:${x || 0}%"></i></div><div class="cmp" style="margin-top:6px">${BRAND[s.brand]}: ${fmt(y)} ${delta(x, y)}</div></div>`; }).join('');

    // gestores (Sé)
    let mgr = '';
    if (s.managers && s.managers.length) {
      const bm = groupBy(g.filter(r => r.gestor), 'gestor');
      const sec = YN_SECS.find(x => x.id === 'gerente');
      mgr = `<div class="card fade" style="margin-top:16px"><h3>Bloco 3A por gestor(a)</h3><p class="lead">Esta loja tem mais de um(a) gestor(a). Cada um aparece só com ${MIN}+ respostas da própria equipe.</p><div class="secRow">` +
        s.managers.map(m => { const rows = bm[m] || []; const ok = rows.length >= MIN; const x = ok ? index(rows, sec.qs) : null;
          return `<div class="secBox"><div class="eyebrow">${esc(m)}</div><div class="v c-${level(x)}">${ok ? fmt(x) : `${rows.length}/${MIN}`}</div><div class="cmp">${ok ? `${rows.length} respostas · gerente` : 'aguardando respostas'}</div></div>`; }).join('') + '</div></div>';
    }

    const tempo = groupBy(g, 'tempo_casa'), area = groupBy(g, 'area');
    const dist = (obj, order) => order.filter(k => obj[k]).map(k => `<span class="tag neutral">${esc(k)} <b>${obj[k].length}</b></span>`).join(' ') || '<span class="muted small">—</span>';

    box.innerHTML = `<div class="card fade" style="margin-top:16px"><div class="cardHead"><div><div class="eyebrow">Detalhe da loja</div><h2>${esc(s.name)} <span class="tag ${s.brand.toLowerCase()}">${BRAND[s.brand]}</span></h2>
        <p class="lead">${g.length} respostas · comparada com o total ${BRAND[s.brand]} (${brandRows.length} respostas)</p></div>
        <div class="gauge"><div class="ring" style="--p:${f || 0};--c:${color(f)}" data-v="${fmt(f)}"></div><div><div class="kpi"><div class="v" style="font-size:22px">${levelTxt(f)}</div><div class="l">índice geral · ${BRAND[s.brand]} ${fmt(fb)} ${delta(f, fb)}</div></div></div></div></div>
      <div class="secRow">${secs}</div>
      <div style="margin-top:14px" class="small muted">Perfil de quem respondeu (só para leitura do grupo; nunca cruzamos perfil × resposta por loja) — Área: ${dist(area, CTX.areas)} &nbsp; Tempo de casa: ${dist(tempo, CTX.tempo)}</div></div>
      ${mgr}
      <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Loja × bandeira por bloco</h3><p class="lead">% favorável</p><div class="ch" style="height:280px"><canvas id="chStore"></canvas></div></div>
      <div class="card"><h3>Comentários</h3><p class="lead">Para proteger quem escreveu, os textos abertos nunca são exibidos por loja — só agrupados por bandeira na aba Comentários.</p>
        <div class="kpi"><div class="v">${g.filter(r => r.textos && Object.values(r.textos).some(v => v && String(v).trim())).length}</div><div class="l">pessoas desta loja escreveram algo</div></div></div></div>
      <div class="card" style="margin-top:16px"><div class="cardHead"><div><h3>Todas as perguntas · ${esc(s.name)}</h3><p class="lead">Barra = % de SIM na loja · marca preta = % de SIM na bandeira ${BRAND[s.brand]}</p></div></div>${questionBars(g, brandRows, { cmpLabel: BRAND[s.brand] })}</div>`;
    chart('chStore', { type: 'bar', data: { labels: YN_SECS.map(x => x.short), datasets: [
        { label: s.name, data: YN_SECS.map(x => index(g, x.qs)), backgroundColor: '#FFBF00', borderRadius: 6 },
        { label: BRAND[s.brand], data: YN_SECS.map(x => index(brandRows, x.qs)), backgroundColor: '#1A1A1A', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100, grid: { color: '#E9E7E1' }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.raw)}` } } } } });
  }

  /* ---------- Liderança ---------- */
  function renderLideranca(all) {
    const mv = all.filter(r => r.bandeira === 'MV'), gm = all.filter(r => r.bandeira === 'GM');
    const blocks = YN_SECS.filter(s => ['gerente', 'auditoria', 'diretoria', 'geral'].includes(s.id));
    const cards = blocks.map(s => {
      const f = index(R, s.qs); const asked = s.qs.map(q => stat(R, q)); const na = asked.reduce((a, b) => a + b.na, 0), tot = asked.reduce((a, b) => a + b.asked, 0);
      return `<div class="card"><div class="eyebrow">${esc(s.num)}</div><h3 style="margin-bottom:8px">${esc(s.title.replace('Conduta das chefias — ', '').replace('Conduta da diretoria — ', ''))}</h3>
        <div class="gauge"><div class="ring" style="--p:${f || 0};--c:${color(f)}" data-v="${fmt(f)}"></div><div class="small"><div><b>${levelTxt(f)}</b></div><div class="muted">MV ${fmt(index(mv, s.qs))} · GM ${fmt(index(gm, s.qs))}</div>${s.naOpt ? `<div class="muted" style="margin-top:4px">${tot ? Math.round(na / tot * 100) : 0}% marcaram "sem contato"</div>` : ''}</div></div></div>`;
    }).join('');
    const qs = blocks.flatMap(s => s.qs);
    $('#content').innerHTML = `<div class="grid g4 fade">${cards}</div>
      <div class="card fade" style="margin-top:16px"><h3>Perguntas de liderança · Mais Visão × Golden Mix</h3><p class="lead">% favorável por pergunta (l01 e l04 invertidas: quanto menos SIM, melhor)</p><div class="ch" style="height:${qs.length * 34 + 60}px"><canvas id="chLid"></canvas></div></div>
      <div class="card fade" style="margin-top:16px"><h3>Cobertura das respostas</h3><p class="lead">Quem marcou "não tenho contato suficiente" não entra no cálculo. Uma fatia cinza grande significa pouco contato da equipe com aquele grupo.</p>
        ${blocks.filter(s => s.naOpt).flatMap(s => s.qs).map(q => { const st = stat(R, q); const t = st.asked || 1; return `<div class="hbar"><div class="t"><code>${q}</code>${esc(Q[q].text)}<small>${st.sim} sim · ${st.nao} não · ${st.na} sem contato</small></div><div class="stack"><i style="width:${st.sim / t * 100}%;background:var(--ok)"></i><i style="width:${st.nao / t * 100}%;background:var(--bad)"></i><i style="width:${st.na / t * 100}%;background:#CFCBC0"></i></div><div class="n">${Math.round(st.na / t * 100)}%<small>sem contato</small></div></div>`; }).join('')}
        <div class="legend"><span><i class="dot b-ok"></i>SIM</span><span><i class="dot b-bad"></i>NÃO</span><span><i class="dot b-na"></i>Sem contato</span></div></div>`;
    chart('chLid', { type: 'bar', data: { labels: qs.map(q => `${q} · ${Q[q].text.length > 60 ? Q[q].text.slice(0, 58) + '…' : Q[q].text}`), datasets: [
        { label: 'Mais Visão', data: qs.map(q => stat(mv, q).fav), backgroundColor: '#FFBF00', borderRadius: 5 },
        { label: 'Golden Mix', data: qs.map(q => stat(gm, q).fav), backgroundColor: '#1A1A1A', borderRadius: 5 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { min: 0, max: 100, grid: { color: '#E9E7E1' }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false }, ticks: { font: { size: 11 }, autoSkip: false } } }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: c => Q[qs[c[0].dataIndex]].text, label: c => ` ${c.dataset.label}: ${fmt(c.raw)} favorável` } } } } });
  }

  /* ---------- Comentários ---------- */
  function renderComentarios(all) {
    const qOpts = Object.keys(TEXTQ).map(k => `<option value="${k}">${esc(TEXTQ[k])}</option>`).join('');
    $('#content').innerHTML = `<div class="card fade"><div class="filters">
        <div><label>Bandeira</label><select id="fB"><option value="">Todas</option><option value="MV">Mais Visão</option><option value="GM">Golden Mix</option></select></div>
        <div style="flex:2"><label>Pergunta</label><select id="fQ"><option value="">Todas</option>${qOpts}</select></div>
        <div><label>Área</label><select id="fA"><option value="">Todas</option>${CTX.areas.map(a => `<option>${esc(a)}</option>`).join('')}</select></div>
        <div style="flex:2"><label>Buscar palavra</label><input id="fS" placeholder="ex.: comissão, horário, respeito"></div></div>
      <p class="small muted" style="margin:0">Nomes de pessoas e lojas foram removidos automaticamente no celular do colaborador antes do envio. Os textos nunca são mostrados por loja.</p></div>
      <div id="cmtList"></div>`;
    if (scope !== 'ALL') $('#fB').value = scope;
    const draw = () => {
      const b = $('#fB').value, q = $('#fQ').value, a = $('#fA').value, s = $('#fS').value.trim().toLowerCase();
      const items = [];
      all.forEach(r => { if (b && r.bandeira !== b) return; if (a && r.area !== a) return; Object.entries(r.textos || {}).forEach(([k, v]) => { if (!v || !String(v).trim()) return; if (q && k !== q) return; if (s && !String(v).toLowerCase().includes(s)) return; items.push({ k, v: String(v), r }); }); });
      const byQ = groupBy(items, 'k');
      const hi = t => s ? esc(t).replace(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`) : esc(t);
      $('#cmtList').innerHTML = items.length ? `<div class="card fade" style="margin-top:16px"><div class="cardHead"><h3>${items.length} comentário${items.length === 1 ? '' : 's'}</h3><span class="small muted">de ${new Set(items.map(i => i.r)).size} pessoas</span></div>` +
        Object.keys(TEXTQ).filter(k => byQ[k]).map(k => `<div class="qhead"><h4>${esc(TEXTQ[k])}</h4><span class="tag neutral">${byQ[k].length}</span></div>` +
          byQ[k].map(i => `<div class="cmt"><div class="m"><span class="tag ${i.r.bandeira.toLowerCase()}">${BRAND[i.r.bandeira]}</span><span>${esc(i.r.area || '')}</span><span>· ${esc(i.r.tempo_casa || '')}</span></div>${hi(i.v)}</div>`).join('')).join('') + '</div>'
        : `<div class="empty" style="margin-top:16px"><b>Nenhum comentário com esses filtros</b>As perguntas abertas são opcionais; nem todo mundo escreve.</div>`;
    };
    ['fB', 'fQ', 'fA'].forEach(id => $('#' + id).addEventListener('change', draw)); $('#fS').addEventListener('input', draw); draw();
  }

  /* ---------- Adesão ---------- */
  function renderAdesao(all) {
    const by = groupBy(all, 'loja');
    const stores = [...C.stores].map(s => ({ s, n: (by[s.slug] || []).length })).sort((a, b) => a.s.brand.localeCompare(b.s.brand) || b.n - a.n);
    const head = C.totalHeadcount || 0;
    const days = {}; all.forEach(r => { const d = (r.criado_em || '').slice(0, 10); if (!d) return; days[d] = days[d] || { MV: 0, GM: 0 }; days[d][r.bandeira]++; });
    const labels = Object.keys(days).sort();
    let cum = 0; const cumData = labels.map(d => cum += days[d].MV + days[d].GM);
    const okN = stores.filter(x => x.n >= MIN).length;
    const daysLeft = C.deadline ? Math.ceil((new Date(C.deadline + 'T23:59:59') - new Date()) / 864e5) : null;
    $('#content').innerHTML = `<div class="grid g4 fade">
        <div class="card"><div class="kpi"><div class="l">Respostas</div><div class="v">${all.length}${head ? `<small> / ${head}</small>` : ''}</div><div class="d">${head ? `${Math.round(all.length / head * 100)}% da equipe` : ''}</div></div></div>
        <div class="card"><div class="kpi"><div class="l">Lojas com ${MIN}+</div><div class="v">${okN}<small> / ${C.stores.length}</small></div><div class="d">${C.stores.length - okN} ainda sem resultado próprio</div></div></div>
        <div class="card"><div class="kpi"><div class="l">Lojas sem nenhuma resposta</div><div class="v c-${stores.filter(x => !x.n).length ? 'bad' : 'ok'}">${stores.filter(x => !x.n).length}</div><div class="d">reforçar o convite nessas lojas</div></div></div>
        <div class="card"><div class="kpi"><div class="l">Prazo</div><div class="v">${daysLeft == null ? '—' : daysLeft >= 0 ? `${daysLeft}<small> dias</small>` : 'encerrado'}</div><div class="d">${fmtDate(C.deadline)}</div></div></div></div>
      <div class="grid g2 fade" style="margin-top:16px">
        <div class="card"><h3>Evolução diária</h3><p class="lead">Respostas por dia e acumulado</p><div class="ch" style="height:280px"><canvas id="chDias"></canvas></div></div>
        <div class="card"><h3>Adesão por loja</h3><p class="lead">Meta mínima: ${MIN} respostas por loja</p>
          ${stores.map(({ s, n }) => `<div class="hbar"><div class="t"><b>${esc(s.name)}</b> <span class="tag ${s.brand.toLowerCase()}" style="font-size:10px">${s.brand}</span></div><div class="track"><i class="${n >= MIN ? 'b-ok' : n ? 'b-warn' : 'b-bad'}" style="width:${Math.min(100, n / Math.max(MIN * 2, 8) * 100)}%"></i><span class="mark" style="left:${MIN / Math.max(MIN * 2, 8) * 100}%"></span></div><div class="n">${n}<small>${n >= MIN ? 'ok' : `faltam ${MIN - n}`}</small></div></div>`).join('')}</div></div>`;
    chart('chDias', { data: { labels: labels.map(d => d.slice(8, 10) + '/' + d.slice(5, 7)), datasets: [
        { type: 'line', label: 'Acumulado', data: cumData, borderColor: '#1A1A1A', backgroundColor: '#1A1A1A', tension: .3, yAxisID: 'y2', pointRadius: 3 },
        { type: 'bar', label: 'Mais Visão', data: labels.map(d => days[d].MV), backgroundColor: '#FFBF00', stack: 'a', borderRadius: 4 },
        { type: 'bar', label: 'Golden Mix', data: labels.map(d => days[d].GM), backgroundColor: '#555', stack: 'a', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#E9E7E1' }, ticks: { precision: 0 } }, y2: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { precision: 0 } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom' } } } });
  }

  /* ---------- exportar ---------- */
  function csv() {
    const rod = $('#selRodada').value; const all = ROWS.filter(r => r.rodada === rod);
    const rows = [['rodada', 'nivel', 'bandeira', 'loja', 'bloco', 'pergunta', 'texto', 'respondentes', 'sim', 'nao', 'sem_contato', 'pct_sim', 'pct_favoravel']];
    const push = (nivel, band, loja, rs) => ALL_YN.forEach(q => { const s = stat(rs, q); rows.push([rod, nivel, band, loja, Q[q].sec.num, q, Q[q].text, s.asked, s.sim, s.nao, s.na, s.pct == null ? '' : s.pct.toFixed(1), s.fav == null ? '' : s.fav.toFixed(1)]); });
    push('grupo', '', '', all); ['MV', 'GM'].forEach(b => push('bandeira', b, '', all.filter(r => r.bandeira === b)));
    Object.entries(groupBy(all, 'loja')).filter(([, g]) => g.length >= MIN).forEach(([slug, g]) => push('loja', g[0].bandeira, STORE[slug]?.name || slug, g));
    const out = '\ufeff' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv;charset=utf-8' })); a.download = `clima-${rod}-resultados.csv`; a.click();
  }

  /* ---------- demo (só localhost?demo) ---------- */
  function demoRows() {
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const out = []; const base = { c01: .8, c02: .78, p01: .62, p02: .48, p03: .55, g01: .82, g02: .7, g03: .66, a01: .45, a02: .5, a03: .4, d01: .6, d02: .58, d03: .47, d04: .52, l01: .7, l02: .4, l03: .5, l04: .45, l05: .75 };
    const txt = ['A comissão poderia ser mais clara, às vezes não entendemos o cálculo.', 'Gosto da equipe, mas falta reconhecimento quando batemos a meta.', 'Mais treinamento de produto ajudaria muito.', 'O horário de fechamento pesa para quem mora longe.', 'Benefícios ok, premiação poderia incluir todo mundo e não só vendas.', 'Sinto que a auditoria chega já com a nota decidida.', 'Mais escuta e menos cobrança no grupo.'];
    C.stores.forEach((s, i) => { const n = [6, 5, 4, 9, 3, 7, 2, 5, 6, 0, 4, 5, 8][i]; const bias = (rnd() - .5) * .35;
      for (let k = 0; k < n; k++) { const resp = {}; const area = CTX.areas[Math.floor(rnd() * 4)]; Object.keys(base).forEach(q => { if (q[0] === 'g' && area === 'Gestão') return; if ('gad'.includes(q[0]) && rnd() < (q[0] === 'a' ? .25 : .1)) { resp[q] = 'na'; return; } resp[q] = rnd() < Math.min(.97, Math.max(.05, base[q] + bias)) ? 'sim' : 'nao'; });
        const textos = {}; if (rnd() < .45) textos.t01 = txt[Math.floor(rnd() * txt.length)]; if (rnd() < .3) textos.t02 = txt[Math.floor(rnd() * txt.length)]; if (resp.l05 === 'sim' && rnd() < .4) textos.l05_txt = txt[Math.floor(rnd() * txt.length)];
        const day = 14 + Math.floor(rnd() * 12);
        out.push({ rodada: C.round, loja: s.slug, loja_nome: s.name, bandeira: s.brand, gestor: s.managers ? s.managers[Math.floor(rnd() * 2)] : null, area, tempo_casa: CTX.tempo[Math.floor(rnd() * 4)], respostas: resp, textos, criado_em: `2026-11-${String(day).padStart(2, '0')}T12:00:00Z` }); } });
    return out;
  }

  /* ---------- boot ---------- */
  async function enter() {
    $('#loginWrap').classList.add('hide'); $('#panel').classList.remove('hide'); $('#topTools').classList.remove('hide');
    $('#who').textContent = DEMO ? 'modo demonstração' : (sessionStorage.getItem(KEY + ':who') || '');
    $('#content').innerHTML = '<div class="spin"></div>';
    try { ROWS = await fetchRows(); setRound(); render(); } catch (e) { $('#content').innerHTML = `<div class="empty"><b>Não foi possível carregar</b>${esc(e.message)}</div>`; }
  }
  $('#formLogin').addEventListener('submit', async e => {
    e.preventDefault(); $('#loginErr').textContent = ''; const b = $('#btnEntrar'); b.disabled = true;
    try { await login($('#email').value.trim(), $('#pass').value); await enter(); } catch (err) { $('#loginErr').textContent = err.message; } finally { b.disabled = false; }
  });
  $('#btnOut').addEventListener('click', logout);
  $('#btnReload').addEventListener('click', enter);
  $('#btnCsv').addEventListener('click', csv);
  $('#btnPrint').addEventListener('click', () => print());
  $('#selRodada').addEventListener('change', render);
  $('#selScope').addEventListener('change', e => { scope = e.target.value; storeSel = null; render(); });
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); render(); });

  if (!SB || !SB.url) $('#loginErr').textContent = 'Supabase não configurado em assets/js/config.js.';
  else if (DEMO) { $('#demoBar').classList.remove('hide'); enter(); }
  else if (token) enter();
})();
