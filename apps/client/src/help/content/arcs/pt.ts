import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'arcs',
  title: 'Arcos, volumes e fases',
  summary: 'Organize uma história em livros, fases ou outras seções grandes sem separar seu mundo.',
  keywords: ['arco', 'arcos', 'volume', 'volumes', 'fase', 'capítulos', 'eventos', 'tema'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um arco é uma seção grande dentro de uma história: um livro de uma série, uma fase de campanha ou um movimento distinto em uma narrativa longa. A história continua com o mesmo elenco, mundo, calendário e anotações compartilhados.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Toda história começa com um arco padrão. Ele dá a cada capítulo e evento um lugar a que pertencer, então você não precisa configurá-lo antes de escrever.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'paragraph',
      text: 'Use arcos quando o mesmo mundo precisa de limites editoriais mais claros. Eles permitem focar listas e visões em um livro ou fase, enquanto personagens, locais e outros materiais compartilhados continuam disponíveis em toda a história.',
    },
    {
      type: 'example',
      title: 'Uma trilogia em uma história',
      text: 'Crie um arco para cada livro de uma trilogia. Atribua cada capítulo ao seu livro. Um personagem apresentado no primeiro livro continua sendo o mesmo no segundo, enquanto as listas de capítulos e as visões narrativas podem ficar focadas no livro que você está revisando.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Personalização', 'Arcos'] },
    {
      type: 'steps',
      items: [
        'Abra Personalização no menu da história e escolha Arcos.',
        'Escolha Adicionar para criar outro arco e dê a ele um nome claro.',
        'Se quiser, acrescente uma descrição e escolha um tema para o arco.',
        'Abra um capítulo ou evento e escolha o arco ao qual ele pertence.',
        'Use o seletor de arcos no cabeçalho da história quando quiser focar em um arco.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Nome',
          whatToWrite: 'Um nome para o livro, fase ou outra seção.',
          note: 'Use um nome claro ao escolher o arco em um capítulo ou evento.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite: 'Uma nota curta sobre o propósito, período ou foco deste arco.',
          note: 'É opcional; pode ajudar a distinguir seções parecidas no planejamento.',
        },
        {
          key: 'themeOverride',
          label: 'Tema',
          whatToWrite: 'Escolha um tema para este arco ou mantenha o tema da história.',
          note: 'O tema muda a aparência enquanto o arco está selecionado; não muda o tema da história.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Capítulos e eventos pertencem a um arco. Cenas, personagens, locais e itens continuam compartilhados pela história e aparecem em um arco quando participam desses capítulos ou eventos. Ao remover um arco extra, seus capítulos vão para o arco padrão.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'O arco padrão não pode ser removido. Ele é o destino seguro dos capítulos quando outro arco é removido.',
    },
    { type: 'seeAlso', pages: ['chapters', 'appearance', 'story-settings'] },
  ],
};

export default page;
