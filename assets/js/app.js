/* =====================================================================
   APP DO COLABORADOR — uma pergunta por tela, mobile-first, sem login.
   Depende de: config.js, questions.js, storage.js
   ===================================================================== */
(function () {
  const CFG = window.SURVEY_CONFIG, SECS = window.SURVEY_SECTIONS, CTX = window.SURVEY_CONTEXT, COPY = window.SURVEY_COPY;
  const $ = s => document.querySelector(s);
  const STATE_KEY = 'clima:estado';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- estado ---------- */
  let S = load() || fresh();
  function fresh() {
    return { idx: 0, store: null, fromLink: false, manager: null, area: null, tempo: null, answers: {}, texts: {}, startedAt: null, masked: [] };
  }
  function load() { try { return JSON.parse(sessionStorage.getItem(STATE_KEY)); } catch (e) { return null; } }
  function save() { sessionStorage.setItem(STATE_KEY, JSON.stringify(S)); }
  function reset() { S = fresh(); detectStore(); save(); }

  /* ---------- loja pelo link: ?loja=slug  ou  /slug ---------- */
  function detectStore() {
    const p = new URLSearchParams(location.search).get('loja') || location.pathname.replace(/^\/|\/$/g, '').toLowerCase();
    const st = CFG.stores.find(s => s.slug === p);
    if (st) { S.store = st.slug; S.fromLink = true; }
  }
  if (!S.store) detectStore();

  const store = () => CFG.stores.find(s => s.slug === S.store) || null;
  const brandName = b => CFG.brands[b] || b;
  const ctx = () => ({ area: S.area, store: store(), manager: S.manager });

  /* ---------- lista de passos (dinâmica: depende de área e respostas) ---------- */
  function steps() {
    const list = [{ t: 'welcome' }, { t: 'store' }];
    const st = store();
    if (st && st.managers && st.managers.length > 1) list.push({ t: 'manager' });
    list.push({ t: 'area' }, { t: 'tempo' });
    SECS.forEach(sec => {
      if (sec.skipIf && sec.skipIf(ctx())) return;
      sec.questions.forEach((q, i) => {
        list.push({ t: 'q', sec, q, first: i === 0 });
        if (q.followUpIf && S.answers[q.id] === q.followUpIf.value) list.push({ t: 'q', sec, q: q.followUpIf, follow: true });
      });
    });
    list.push({ t: 'review' }, { t: 'done' });
    return list;
  }
  const qSteps = L => L.filter(x => x.t === 'q');

  /* ---------- navegação ---------- */
  function go(n) { S.idx = Math.max(0, n); save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function next() { go(S.idx + 1); }
  function back() {
    // ao voltar, garante que não ficamos em um follow-up removido
    const L = steps(); go(Math.min(S.idx - 1, L.length - 1));
  }

  /* ---------- anonimização de textos ---------- */
  const STOP = new Set(['Eu', 'Ele', 'Ela', 'Eles', 'Elas', 'Na', 'No', 'Nas', 'Nos', 'Nós', 'Quando', 'Mas', 'Ontem', 'Hoje', 'Sim', 'Não', 'Acho', 'Acredito', 'Também', 'Porque', 'Por', 'Para', 'Com', 'Sem', 'Que', 'Isso', 'Essa', 'Esse', 'Esta', 'Este', 'Tem', 'Falta', 'Muito', 'Pouco', 'Nada', 'Tudo', 'Loja', 'Empresa', 'Gerente', 'Auditoria', 'Diretoria', 'Dono', 'Donos', 'Golden', 'Mix', 'Mais', 'Visão', 'Ótica', 'Óticas', 'Vendas', 'Caixa', 'Laboratório', 'Promoção', 'Gestão', 'Natal', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', 'Deus', 'Obrigado', 'Obrigada', 'Whatsapp', 'WhatsApp', 'Rh', 'RH', 'Sr', 'Sra']);
  function mask(text) {
    const found = [];
    let out = text;
    // nomes de lojas
    CFG.stores.forEach(st => {
      const re = new RegExp('\\b' + st.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      if (re.test(out)) { found.push(st.name); out = out.replace(re, '[loja]'); }
    });
    // palavras com inicial maiúscula fora do início de frase
    out = out.replace(/(^|[^.!?\n]\s+)([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,})/g, (m, pre, w) => {
      if (STOP.has(w)) return m;
      found.push(w); return pre + '[nome]';
    });
    return { out, found: [...new Set(found)] };
  }

  /* ---------- render ---------- */
  function render() {
    const L = steps();
    if (S.idx >= L.length) S.idx = L.length - 1;
    const step = L[S.idx];
    const Q = qSteps(L), qi = step.t === 'q' ? Q.indexOf(step) : (S.idx < 2 ? -1 : Q.length);
    $('#prog').style.width = (step.t === 'welcome' ? 0 : step.t === 'done' ? 100 : Math.round(Math.max(0, qi) / (Q.length + 1) * 100)) + '%';
    $('#demoBar').classList.toggle('hide', window.SurveyStorage.isLive());
    const st = store();
    $('#hdrStore').innerHTML = st && step.t !== 'welcome' ? `<span>Loja</span><b>${esc(st.name)}</b>` : '';
    const B = $('#body');
    B.innerHTML = '';
    const el = document.createElement('div'); el.className = 'screen'; el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.flex = '1';
    el.innerHTML = ({ welcome, store: storeScreen, manager, area, tempo, q: question, review, done })[step.t](step, L, Q, qi);
    B.appendChild(el);
    if (step.t === 'q' && step.q.type === 'text') { const ta = $('#ta'); if (ta) setTimeout(() => ta.focus(), 50); }
  }

  function welcome() {
    const st = store();
    const nQ = SECS.reduce((a, s) => a + s.questions.filter(q => q.type === 'yn').length, 0);
    return `
      <div class="eyebrow">${esc(COPY.subtitle)}</div>
      <h1 style="margin:8px 0 10px">${esc(COPY.title)}</h1>
      <p class="muted" style="margin:0 0 14px">${esc(COPY.objective)}</p>
      ${st ? `<div class="card" style="padding:12px 16px;display:flex;gap:10px;align-items:center"><span style="font-size:22px">📍</span><div><div class="muted" style="font-size:12px">Link da loja</div><b>${esc(st.name)} · ${esc(brandName(st.brand))}</b></div></div>` : ''}
      <div class="lock" style="margin-top:12px"><span style="font-size:20px">🔒</span><div><b>Pesquisa anônima.</b> ${esc(COPY.anon)} Os resultados são apresentados de forma agrupada, nunca individualmente.</div></div>
      <div class="stats"><div><b>${nQ}</b>perguntas de SIM ou NÃO</div><div><b>3</b>perguntas abertas</div><div><b>~5 min</b>para responder</div></div>
      <div class="card" style="margin-top:12px"><div class="eyebrow">Como responder</div><ul class="rules">${COPY.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
      <div class="nav"><span></span><button class="btn gold" style="width:auto;min-width:200px" id="start">Começar</button></div>`;
  }

  function storeScreen() {
    const st = store();
    if (st && S.fromLink && !S.pickList) {
      return `
        <div class="eyebrow">Sua loja</div>
        <h2 class="q">Pelo link, você trabalha na loja <span style="color:#9a7300">${esc(st.name)}</span>. É nela que você atua hoje?</h2>
        <p class="muted" style="margin:-10px 0 18px;font-size:14px">Isso serve só para agrupar as respostas por loja. Não identifica você.</p>
        <div class="opts">
          <button data-act="confirmStore">Sim, atuo na loja ${esc(st.name)}</button>
          <button data-act="pickList">Não, atuo em outra loja</button>
        </div>
        <div class="nav"><button class="link" data-act="back">← Voltar</button></div>`;
    }
    const groups = ['MV', 'GM'].map(b => `<div class="grp">${esc(brandName(b))}</div>` + CFG.stores.filter(s => s.brand === b).map(s => `<button data-act="setStore" data-v="${s.slug}" class="${S.store === s.slug ? 'sel' : ''}">${esc(s.name)}</button>`).join('')).join('');
    return `
      <div class="eyebrow">Sua loja</div>
      <h2 class="q">Em qual loja você atua hoje?</h2>
      <p class="muted" style="margin:-10px 0 18px;font-size:14px">Escolha a loja onde você trabalha de fato. Isso serve só para agrupar as respostas.</p>
      <div class="opts">${groups}</div>
      <div class="nav"><button class="link" data-act="back">← Voltar</button></div>`;
  }

  function manager() {
    const st = store();
    return `
      <div class="eyebrow">Sua loja · ${esc(st.name)}</div>
      <h2 class="q">Na loja ${esc(st.name)} há mais de um(a) gestor(a). Quem é o seu gestor direto?</h2>
      <p class="muted" style="margin:-10px 0 18px;font-size:14px">As perguntas sobre "gerente da loja" serão sobre essa pessoa.</p>
      <div class="opts">${st.managers.map(m => `<button data-act="setManager" data-v="${esc(m)}" class="${S.manager === m ? 'sel' : ''}">${esc(m)}</button>`).join('')}</div>
      <div class="nav"><button class="link" data-act="back">← Voltar</button></div>`;
  }

  function area() {
    return `
      <div class="eyebrow">Sobre você</div>
      <h2 class="q">Qual é a sua área?</h2>
      <p class="muted" style="margin:-10px 0 18px;font-size:14px">Usamos só grandes grupos, para que ninguém seja identificado.</p>
      <div class="opts">${CTX.areas.map(a => `<button data-act="setArea" data-v="${esc(a)}" class="${S.area === a ? 'sel' : ''}">${esc(a)}</button>`).join('')}</div>
      <div class="nav"><button class="link" data-act="back">← Voltar</button></div>`;
  }

  function tempo() {
    return `
      <div class="eyebrow">Sobre você</div>
      <h2 class="q">Há quanto tempo você trabalha na empresa?</h2>
      <div class="opts">${CTX.tempo.map(a => `<button data-act="setTempo" data-v="${esc(a)}" class="${S.tempo === a ? 'sel' : ''}">${esc(a)}</button>`).join('')}</div>
      <div class="nav"><button class="link" data-act="back">← Voltar</button></div>`;
  }

  function question(step, L, Q, qi) {
    const { sec, q } = step;
    const cur = q.type === 'text' ? (S.texts[q.id] || '') : (S.answers[q.id] || '');
    const gestaoNote = sec.id === 'gerente' ? '' : (S.area === 'Gestão' && step.first && sec.id === 'auditoria' ? `<div class="note">Como você é da gestão, não há perguntas sobre o(a) gerente da loja. Suas respostas sobre auditoria e diretoria entram normalmente.</div>` : '');
    const maskNote = S.lastMask && S.lastMask.length ? `<div class="note ok">🔒 Para proteger o anonimato, removemos do texto anterior: <b>${esc(S.lastMask.join(', '))}</b>.</div>` : '';
    let body = '';
    if (q.type === 'yn') {
      body = `
        <div class="yn">
          <button data-act="yn" data-v="sim" class="${cur === 'sim' ? 'sel' : ''}">SIM</button>
          <button data-act="yn" data-v="nao" class="${cur === 'nao' ? 'sel' : ''}">NÃO</button>
        </div>
        ${sec.naOpt ? `<button class="na ${cur === 'na' ? 'sel' : ''}" data-act="yn" data-v="na">${esc(sec.naOpt)}</button>` : ''}`;
    } else {
      body = `
        <textarea id="ta" placeholder="${esc(q.placeholder || 'Escreva aqui…')}" maxlength="1500">${esc(cur)}</textarea>
        <div class="hint"><span>🔒</span><span>Não escreva nomes de pessoas nem de lojas. Se escrever, serão removidos automaticamente antes de salvar.</span></div>
        <button class="btn gold" data-act="sendText">Continuar</button>
        <button class="link" data-act="skipText" style="display:block;margin:6px auto 0">Prefiro não responder</button>`;
    }
    return `
      ${step.first ? `<div class="secChip"><span>${esc(sec.num)}</span>${esc(sec.title)}</div><p class="muted" style="margin:12px 0 0;font-size:14.5px">${esc(sec.intro)}</p>` : `<div class="secChip"><span>${esc(sec.num)}</span>${esc(sec.title)}</div>`}
      ${gestaoNote}${maskNote}
      <div class="counter"><span>Pergunta ${qi + 1} de ${Q.length}</span>${step.follow ? '<span>complemento</span>' : ''}</div>
      <h2 class="q">${esc(q.text)}</h2>
      ${body}
      <div class="nav"><button class="link" data-act="back">← Voltar</button>${q.type === 'yn' && cur ? `<button class="btn sm" data-act="next">Próxima →</button>` : '<span></span>'}</div>`;
  }

  function review(step, L, Q) {
    const bySec = {};
    Q.forEach(s => { const k = s.sec.num + ' ' + s.sec.title; bySec[k] = bySec[k] || { n: 0, a: 0 }; bySec[k].n++; const v = s.q.type === 'text' ? S.texts[s.q.id] : S.answers[s.q.id]; if (v) bySec[k].a++; });
    const missing = Q.filter(s => s.q.type === 'yn' && !S.answers[s.q.id]);
    const st = store();
    return `
      <div class="eyebrow">Quase lá</div>
      <h2 class="q">Revise e envie suas respostas</h2>
      <div class="sum">
        <div><b>Loja</b><span>${esc(st.name)}${S.manager ? ' · ' + esc(S.manager) : ''}</span></div>
        <div><b>Área</b><span>${esc(S.area)}</span></div>
        <div><b>Tempo de casa</b><span>${esc(S.tempo)}</span></div>
        ${Object.entries(bySec).map(([k, v]) => `<div><b>${esc(k)}</b><span>${v.a} de ${v.n}</span></div>`).join('')}
      </div>
      ${missing.length ? `<div class="note" style="margin-top:12px">Você deixou <b>${missing.length}</b> pergunta(s) de SIM/NÃO sem resposta. Pode voltar para responder ou enviar assim mesmo.</div>` : ''}
      <p class="muted" style="font-size:13.5px;margin:14px 0 0">Depois de enviar não é possível alterar. Nenhum dado pessoal é gravado: só loja, área, tempo de casa e as respostas.</p>
      <div class="nav"><button class="link" data-act="back">← Voltar</button><button class="btn gold" style="width:auto;min-width:180px" data-act="submit">Enviar respostas</button></div>`;
  }

  function done() {
    const d = CFG.deadline ? new Date(CFG.deadline + 'T12:00:00') : null;
    const dl = d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
    const r = S.result || {};
    return `
      <div class="done">
        <div class="ic">✓</div>
        <h2>Resposta enviada. Obrigado!</h2>
        <p class="muted" style="margin:10px 0 0">${esc(COPY.closing)}</p>
        ${dl ? `<p style="margin:14px 0 0;font-size:14.5px">O resultado agrupado da sua loja será compartilhado com a equipe após <b>${dl}</b>, junto com o que vai mudar.</p>` : ''}
        ${r.mode === 'queued' ? `<div class="note" style="margin-top:14px;text-align:left">Sua resposta ficou guardada neste aparelho e será enviada automaticamente quando a conexão voltar. Pode fechar a página.</div>` : ''}
        ${r.mode === 'demo' ? `<div class="note" style="margin-top:14px;text-align:left">Modo demonstração: nada foi enviado.</div>` : ''}
      </div>
      <div class="nav" style="justify-content:center"><button class="btn ghost" style="width:auto" data-act="restart">Encerrar</button></div>`;
  }

  /* ---------- ações ---------- */
  function clearMaskNote() { S.lastMask = null; }
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'start') { if (!S.startedAt) S.startedAt = Date.now(); S.pickList = false; next(); return; }
    const act = b.dataset.act, v = b.dataset.v;
    if (!act) return;
    clearMaskNote();
    switch (act) {
      case 'back': back(); break;
      case 'next': next(); break;
      case 'confirmStore': next(); break;
      case 'pickList': S.pickList = true; save(); render(); break;
      case 'setStore': S.store = v; S.manager = null; S.pickList = false; next(); break;
      case 'setManager': S.manager = v; next(); break;
      case 'setArea': {
        const was = S.area; S.area = v;
        // se mudou de/para Gestão, respostas do bloco "gerente" deixam de valer
        if (was !== v && v === 'Gestão') SECS.find(s => s.id === 'gerente').questions.forEach(q => delete S.answers[q.id]);
        next(); break;
      }
      case 'setTempo': S.tempo = v; next(); break;
      case 'yn': {
        const step = steps()[S.idx]; S.answers[step.q.id] = v;
        if (step.q.followUpIf && v !== step.q.followUpIf.value) delete S.texts[step.q.followUpIf.id];
        save(); setTimeout(next, 120); break;
      }
      case 'sendText': {
        const step = steps()[S.idx]; const raw = ($('#ta').value || '').trim();
        if (raw) { const m = mask(raw); S.texts[step.q.id] = m.out; S.lastMask = m.found; } else delete S.texts[step.q.id];
        next(); break;
      }
      case 'skipText': { const step = steps()[S.idx]; delete S.texts[step.q.id]; next(); break; }
      case 'submit': await submit(); break;
      case 'restart': reset(); render(); break;
    }
  });

  async function submit() {
    const st = store();
    const row = {
      rodada: CFG.round,
      loja: st.slug,
      loja_nome: st.name,
      bandeira: st.brand,
      gestor: S.manager || null,
      area: S.area,
      tempo_casa: S.tempo,
      respostas: S.answers,          // {c01:'sim', g01:'na', ...}
      textos: S.texts,               // {l05_txt:'…', t01:'…', t02:'…'} já anonimizados
      origem: S.fromLink ? 'link' : 'lista',
      duracao_seg: S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : null,
      versao_questionario: 'v2-2026-11'
    };
    $('#body').innerHTML = '<div class="spin"></div><p class="muted" style="text-align:center">Enviando…</p>';
    const result = await window.SurveyStorage.submit(row);
    S.result = result; S.idx = steps().length - 1; save(); render();
    sessionStorage.removeItem(STATE_KEY); // aparelho compartilhado: próxima pessoa começa do zero
  }

  /* ---------- início ---------- */
  window.SurveyStorage.flushQueue();
  if (S.result) { reset(); }
  render();
})();
