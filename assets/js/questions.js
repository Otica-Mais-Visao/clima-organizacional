/* =====================================================================
   PERGUNTAS DA PESQUISA DE CLIMA ORGANIZACIONAL
   Fonte: documento "Pesquisa de clima perguntas.docx" enviado pela diretoria.
   ---------------------------------------------------------------------
   Para alterar o questionário basta editar este arquivo.
   Cada pergunta tem:
     id      código estável (vai para o banco; não mudar depois de coletar)
     type    'yn' = SIM / NÃO  |  'text' = resposta escrita
     text    enunciado
     naOpt   (yn) rótulo da 3ª opção "deixar em branco", quando permitida
     skipIf  (opcional) função que recebe o contexto e devolve true para pular
     followUpIf (opcional) {value:'sim', ...pergunta} abre uma pergunta só
             quando a resposta for igual a value
   ===================================================================== */

window.SURVEY_SECTIONS = [
  {
    id: 'clima',
    num: '1',
    title: 'Clima organizacional',
    intro: 'Vamos começar pelo seu dia a dia na loja.',
    questions: [
      { id: 'c01', type: 'yn', text: 'Você considera o ambiente de trabalho agradável?' },
      { id: 'c02', type: 'yn', text: 'Você se sente respeitado(a) no ambiente de trabalho?' }
    ]
  },
  {
    id: 'praticas',
    num: '2',
    title: 'Práticas da empresa',
    intro: 'Agora, sobre regras, treinamento e metas.',
    questions: [
      { id: 'p01', type: 'yn', text: 'As regras da empresa são claras para todos os funcionários?' },
      { id: 'p02', type: 'yn', text: 'A empresa oferece treinamento adequado para o desempenho das funções?' },
      { id: 'p03', type: 'yn', text: 'As metas da empresa são comunicadas de maneira clara e transparente?' }
    ]
  },
  {
    id: 'gerente',
    num: '3A',
    title: 'Conduta das chefias — Gerente da loja',
    intro: 'As próximas perguntas são sobre o(a) gerente da sua loja. Se você não tem contato suficiente para responder, use a opção "Não tenho contato suficiente".',
    naOpt: 'Não tenho contato suficiente para responder',
    // Quem é da gestão não avalia a si mesmo: este bloco é pulado.
    skipIf: ctx => ctx.area === 'Gestão',
    questions: [
      { id: 'g01', type: 'yn', text: 'O(a) gerente da loja trata os funcionários com respeito e educação?' },
      { id: 'g02', type: 'yn', text: 'O(a) gerente da loja escuta as opiniões e sugestões dos funcionários?' },
      { id: 'g03', type: 'yn', text: 'O(a) gerente da loja é atuante no balcão de vendas e nos fechamentos?' }
    ]
  },
  {
    id: 'auditoria',
    num: '3B',
    title: 'Conduta das chefias — Auditoria',
    intro: 'Agora sobre a equipe de auditoria que visita e avalia a loja.',
    naOpt: 'Não tenho contato suficiente para responder',
    questions: [
      { id: 'a01', type: 'yn', text: 'A auditoria utiliza critérios claros e consistentes nas avaliações?' },
      { id: 'a02', type: 'yn', text: 'A atuação da auditoria contribui para melhorar os processos e o ambiente de trabalho?' },
      { id: 'a03', type: 'yn', text: 'A auditoria é imparcial nas notas e nos processos de auditoria?' }
    ]
  },
  {
    id: 'diretoria',
    num: '3C',
    title: 'Conduta da diretoria — Donos da empresa',
    intro: 'Agora sobre os donos da empresa.',
    naOpt: 'Não tenho contato suficiente para responder',
    questions: [
      { id: 'd01', type: 'yn', text: 'Os donos da empresa demonstram preocupação com o bem-estar dos colaboradores?' },
      { id: 'd02', type: 'yn', text: 'Os donos da empresa estão abertos a ouvir críticas, sugestões e reclamações?' },
      { id: 'd03', type: 'yn', text: 'Você acredita que os donos da empresa tomam providências quando recebem reclamações sobre problemas no ambiente de trabalho?' },
      { id: 'd04', type: 'yn', text: 'Você enxerga propósito e oportunidades de carreira na empresa?' }
    ]
  },
  {
    id: 'geral',
    num: '4',
    title: 'Avaliação geral da liderança',
    intro: 'Últimas perguntas de SIM ou NÃO, pensando nas chefias em geral.',
    questions: [
      { id: 'l01', type: 'yn', text: 'Você acredita que a relação entre funcionários e chefias precisa melhorar?' },
      { id: 'l02', type: 'yn', text: 'Você considera que existe um espaço seguro para relatar problemas de conduta das chefias?' },
      { id: 'l03', type: 'yn', text: 'Você acredita que reclamações feitas de boa-fé são tratadas com seriedade pela empresa?' },
      { id: 'l04', type: 'yn', text: 'Você sente receio de sofrer consequências negativas por expressar sua opinião sobre a gestão?' },
      {
        id: 'l05', type: 'yn',
        text: 'Você acredita que mudanças na postura da liderança melhorariam o ambiente de trabalho?',
        followUpIf: {
          value: 'sim',
          id: 'l05_txt', type: 'text',
          text: 'Quais mudanças? Descreva, por favor.',
          placeholder: 'Escreva do seu jeito, sem citar nomes…'
        }
      }
    ]
  },
  {
    id: 'abertas',
    num: '5',
    title: 'Com as suas palavras',
    intro: 'Para fechar, duas perguntas abertas. Pode escrever pouco ou muito. Lembre: não cite nomes de pessoas nem de lojas.',
    questions: [
      {
        id: 't01', type: 'text',
        text: 'Como você enxerga a remuneração, a premiação e os benefícios da empresa?',
        placeholder: 'Ex.: o que funciona bem, o que poderia ser diferente…'
      },
      {
        id: 't02', type: 'text',
        text: 'Para finalizar: tem algo sobre o seu ambiente de trabalho ou sobre a empresa que não foi perguntado e que você gostaria de relatar? Fique à vontade.',
        placeholder: 'Qualquer coisa que você acha importante a diretoria saber…'
      }
    ]
  }
];

/* Perguntas de contexto (não identificam a pessoa; servem só para agrupar
   resultados). Áreas e tempo de casa são grupos amplos de propósito. */
window.SURVEY_CONTEXT = {
  areas: ['Vendas', 'Caixa e administrativo', 'Promoção', 'Laboratório / técnico', 'Gestão'],
  tempo: ['Menos de 6 meses', '6 meses a 1 ano', '1 a 3 anos', 'Mais de 3 anos']
};

/* Textos institucionais (do documento da diretoria) */
window.SURVEY_COPY = {
  title: 'Pesquisa de Clima Organizacional',
  subtitle: 'Ambiente, práticas da empresa e conduta das chefias',
  objective: 'Avaliar o ambiente de trabalho, as práticas da empresa, a conduta das chefias e a satisfação dos funcionários, identificando oportunidades de melhoria.',
  anon: 'Não é necessário se identificar: não pedimos nome, CPF, e-mail nem telefone.',
  rules: [
    'Responda com sinceridade, marcando apenas uma opção: SIM ou NÃO.',
    'Se não tiver contato suficiente com um dos grupos de liderança, use a opção "Não tenho contato suficiente".',
    'Para preservar o anonimato, não escreva nomes de pessoas, lojas ou detalhes que possam identificar você ou terceiros.',
    'Os resultados são apresentados de forma agrupada, nunca individualmente.'
  ],
  closing: 'Sua opinião é importante para identificar pontos que precisam de atenção e contribuir para um ambiente de trabalho mais justo, respeitoso, transparente e profissional. O objetivo desta pesquisa é promover melhorias, não identificar ou expor funcionários.'
};
