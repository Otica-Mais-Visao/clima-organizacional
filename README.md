# Pesquisa de Clima Organizacional · Mais Visão & Golden Mix

App anônimo, mobile-first, sem login, para os colaboradores das 13 lojas responderem pelo celular.
Site estático (HTML + CSS + JS puro) — não precisa de build. Banco: Supabase.

## Estrutura

```
index.html                 app do colaborador
assets/js/questions.js     PERGUNTAS (edite aqui para mudar o questionário)
assets/js/config.js        lojas, rodada, prazo e credenciais do Supabase
assets/js/storage.js       envio ao Supabase (com fila offline) ou modo demo
assets/js/app.js           lógica das telas
assets/css/style.css       identidade visual (preto + dourado Golden Mix)
assets/img/                logos
supabase/schema.sql        tabela, segurança (RLS) e visões agregadas
vercel.json                links curtos por loja (/mv-tatuape) + noindex
```

## Como funciona

1. Cada loja recebe um link próprio: `https://SEU-DOMINIO/mv-tatuape` (ou `?loja=mv-tatuape`). O link identifica a **loja**, nunca a pessoa.
2. O colaborador confirma a loja onde atua, informa área e tempo de casa (grupos amplos) e responde **20 perguntas de SIM/NÃO** em 6 blocos (Clima, Práticas, Gerente, Auditoria, Diretoria, Avaliação geral) + 3 abertas.
3. Nos blocos de chefia há a opção **"Não tenho contato suficiente para responder"** (fica em branco).
4. Quem marca área **Gestão** não responde o bloco do gerente (não se autoavalia).
5. Na loja **Sé** (2 gestores) a pessoa indica o gestor direto.
6. Textos abertos passam por anonimização automática no aparelho (nomes e lojas → `[nome]`, `[loja]`) antes de serem enviados.
7. Sem Supabase configurado, o app roda em **modo demonstração** (nada é enviado).

## Colocar em produção (passo a passo)

### 1. Supabase — já configurado (13/11/2026)
Projeto: `izyldybktecldhxcpjdv` (Oticas Mais Visão). O `schema.sql` já foi executado e `config.js` já aponta para ele com a chave **publicável** (`sb_publishable_…`), que só consegue **inserir** respostas (RLS). A tabela foi zerada após os testes.

Para repetir em outro projeto: SQL Editor → rode `supabase/schema.sql`; Project Settings → API Keys → copie a Project URL e a publishable key para `assets/js/config.js`.

> Nunca coloque a chave **secret** no app. Leitura das respostas só pelo painel do Supabase (Table Editor / SQL).

### 2. Publicar (Vercel, conta da empresa)
1. vercel.com → Add New Project → importar `Otica-Mais-Visao/clima-organizacional`.
2. Framework: **Other**. Sem build command. Deploy.
3. (Opcional) Domínio próprio, ex.: `pesquisa.maisvisao.com.br`.

Qualquer `git push` na branch `main` publica automaticamente.

### 3. Links e QR por loja
Links: `https://SEU-DOMINIO/<slug>` — slugs em `assets/js/config.js`.
Gere o QR de cada link (qualquer gerador) para o cartaz no caixa/copa.

## Resultados
No Supabase → Table Editor: `respostas` (bruto), `resultado_por_loja` (só lojas com ≥ 4 respostas), `resultado_por_bandeira`, `adesao`. Códigos das perguntas (`c01`, `g02`…) estão em `assets/js/questions.js`.

## Privacidade
Não coleta nome, CPF, e-mail, telefone nem IP de forma identificável. Loja com menos de 4 respostas só aparece no total da bandeira. Textos são anonimizados antes de salvar.
