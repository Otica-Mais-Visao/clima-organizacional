/* =====================================================================
   CONFIGURAÇÃO DA RODADA
   ---------------------------------------------------------------------
   1) Lojas: o link de cada loja é  https://SEU-DOMINIO/?loja=<slug>
      (ou /<slug> com o rewrite do vercel.json). O link identifica a LOJA,
      nunca a pessoa.
   2) Supabase: preencher url + anonKey quando o projeto estiver criado.
      Enquanto estiver vazio, o app roda em modo demonstração (nada é
      enviado; a resposta fica só no navegador).
   ===================================================================== */

window.SURVEY_CONFIG = {
  round: '2026-11',                 // identificador da rodada (vai no banco)
  deadline: '2026-11-28',           // só para exibir na tela final (AAAA-MM-DD)
  minResponses: 4,                  // corte de anonimato por loja (exibição no painel)

  supabase: {
    url: 'https://izyldybktecldhxcpjdv.supabase.co',
    anonKey: 'sb_publishable_XX3FJlsHBQioWtg9BuZxQg__i6wGkEr',  // chave publicável (só insere, por RLS)
    table: 'respostas'
  },

  brands: { MV: 'Mais Visão', GM: 'Golden Mix' },

  stores: [
    { slug: 'mv-tatuape',       name: 'Tatuapé',          brand: 'MV' },
    { slug: 'mv-santo-amaro',   name: 'Santo Amaro',      brand: 'MV' },
    { slug: 'mv-osasco',        name: 'Osasco',           brand: 'MV' },
    { slug: 'mv-se',            name: 'Sé',               brand: 'MV', managers: ['Gabriela', 'Luis Claudio'] },
    { slug: 'mv-taboao',        name: 'Taboão da Serra',  brand: 'MV' },
    { slug: 'gm-pimentas',      name: 'Pimentas',         brand: 'GM' },
    { slug: 'gm-sao-bernardo',  name: 'São Bernardo',     brand: 'GM' },
    { slug: 'gm-taboao',        name: 'Taboão',           brand: 'GM' },
    { slug: 'gm-vila-luzita',   name: 'Vila Luzita',      brand: 'GM' },
    { slug: 'gm-rua-direita',   name: 'Rua Direita',      brand: 'GM' },
    { slug: 'gm-vila-matilde',  name: 'Vila Matilde',     brand: 'GM' },
    { slug: 'gm-sao-luis',      name: 'São Luís',         brand: 'GM' },
    { slug: 'gm-vila-sabrina',  name: 'Vila Sabrina',     brand: 'GM' }
  ]
};
