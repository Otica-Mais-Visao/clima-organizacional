-- =====================================================================
-- AJUSTES DE SEGURANÇA · rodar uma vez no SQL Editor (13/11/2026)
-- 1) As views agregadas passam a respeitar o RLS da tabela
--    (antes, a chave pública conseguia ler os percentuais agregados).
-- 2) Leitura dos resultados só para os e-mails autorizados da diretoria,
--    mesmo que alguém crie uma conta por fora.
-- 3) Remove a linha de teste.
-- =====================================================================
alter view public.resultado_por_loja     set (security_invoker = true);
alter view public.resultado_por_bandeira set (security_invoker = true);
alter view public.adesao                 set (security_invoker = true);

drop policy if exists "diretoria le" on public.respostas;
create policy "diretoria le" on public.respostas
  for select to authenticated
  using ( lower(auth.jwt() ->> 'email') in (
    'diretoria@oticamaisvisao.com.br'   -- acesso do painel /resultados
    -- adicione outros e-mails aqui, um por linha, entre aspas e com vírgula
  ) );

delete from public.respostas where rodada = 'teste';
select 'ok' as feito, count(*) as respostas from public.respostas;
