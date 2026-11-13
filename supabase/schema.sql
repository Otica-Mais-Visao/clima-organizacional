-- =====================================================================
-- PESQUISA DE CLIMA ORGANIZACIONAL · Mais Visão & Golden Mix
-- Rodar no SQL Editor do Supabase (projeto da empresa), uma única vez.
-- =====================================================================

-- 1) Tabela de respostas (uma linha por colaborador que enviou)
create table if not exists public.respostas (
  id                   uuid primary key default gen_random_uuid(),
  criado_em            timestamptz not null default now(),
  rodada               text not null,                 -- ex.: '2026-11'
  loja                 text not null,                 -- slug: 'mv-tatuape'
  loja_nome            text not null,
  bandeira             text not null check (bandeira in ('MV','GM')),
  gestor               text,                          -- só na Sé (2 gestores)
  area                 text not null,
  tempo_casa           text not null,
  respostas            jsonb not null default '{}',   -- {"c01":"sim","g01":"na",...}
  textos               jsonb not null default '{}',   -- textos já anonimizados no app
  origem               text,                          -- 'link' | 'lista'
  duracao_seg          integer,
  versao_questionario  text
);

create index if not exists respostas_rodada_loja_idx on public.respostas (rodada, loja);

-- 2) Segurança (RLS): a chave pública (anon) só INSERE. Ninguém lê pelo app.
alter table public.respostas enable row level security;

drop policy if exists "anon insere" on public.respostas;
create policy "anon insere" on public.respostas
  for insert to anon with check (true);

-- Leitura só para usuários autenticados (diretoria no painel) ou service_role.
drop policy if exists "diretoria le" on public.respostas;
create policy "diretoria le" on public.respostas
  for select to authenticated
  using ( lower(auth.jwt() ->> 'email') in ('diretoria@oticamaisvisao.com.br') );

revoke update, delete on public.respostas from anon, authenticated;

-- 3) Visão agregada por loja/pergunta, já com corte de anonimato (>= 4 respostas).
--    Lojas com menos de 4 respostas aparecem só no total da bandeira.
create or replace view public.resultado_por_loja with (security_invoker = true) as
with base as (
  select r.rodada, r.loja, r.loja_nome, r.bandeira, kv.key as pergunta, kv.value as resposta
  from public.respostas r, jsonb_each_text(r.respostas) kv
),
n as (
  select rodada, loja, count(*) as respondentes from public.respostas group by 1,2
)
select b.rodada, b.loja, b.loja_nome, b.bandeira, b.pergunta,
       n.respondentes,
       count(*) filter (where b.resposta='sim') as sim,
       count(*) filter (where b.resposta='nao') as nao,
       count(*) filter (where b.resposta='na')  as sem_contato,
       round(100.0 * count(*) filter (where b.resposta='sim')
             / nullif(count(*) filter (where b.resposta in ('sim','nao')),0), 1) as pct_sim
from base b join n using (rodada, loja)
where n.respondentes >= 4
group by 1,2,3,4,5,6;

create or replace view public.resultado_por_bandeira with (security_invoker = true) as
select r.rodada, r.bandeira, kv.key as pergunta,
       count(distinct r.id) as respondentes,
       count(*) filter (where kv.value='sim') as sim,
       count(*) filter (where kv.value='nao') as nao,
       count(*) filter (where kv.value='na')  as sem_contato,
       round(100.0 * count(*) filter (where kv.value='sim')
             / nullif(count(*) filter (where kv.value in ('sim','nao')),0), 1) as pct_sim
from public.respostas r, jsonb_each_text(r.respostas) kv
group by 1,2,3;

-- Adesão por loja (contagem, sem identificar)
create or replace view public.adesao with (security_invoker = true) as
select rodada, bandeira, loja, loja_nome, count(*) as respondentes
from public.respostas group by 1,2,3,4 order by 2,4;

-- security_invoker: as views respeitam o RLS da tabela (anon não lê nada).
-- Painel: /resultados (login com o e-mail autorizado acima).
