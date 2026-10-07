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
      text: 'Uma história é um universo, e um arco é uma obra dentro dele: um livro, um filme, uma edição, uma temporada ou um módulo de campanha. A história continua com o mesmo elenco, mundo, calendário e anotações compartilhados, então um personagem pode viver por todas as obras.',
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
        'Se quiser, acrescente uma descrição, escolha um Ícone (busque na biblioteca ou use os recentes) e um tema para o arco.',
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
          key: 'medium',
          label: 'Forma da obra',
          whatToWrite:
            'Escolha o que é esta obra: prosa, roteiro, quadrinhos, storyboard ou campanha de mesa.',
          note: 'Escolhe termos mais amigáveis e a exportação certa para este arco. Nunca limita o que você pode adicionar, e você pode mudar quando quiser.',
        },
        {
          key: 'author',
          label: 'Autor desta obra',
          whatToWrite: 'Quem escreveu esta obra, se for diferente do autor da história.',
          note: 'Vazio, usa o autor da história e, depois, o seu @handle.',
        },
        {
          key: 'coverGalleryId',
          label: 'Capa',
          whatToWrite: 'Escolha uma imagem da galeria para representar esta obra.',
          note: 'Opcional. Não copia nem move a imagem.',
        },
        {
          key: 'pageFormat',
          label: 'Formato de página',
          whatToWrite:
            'Para quadrinhos ou storyboard: o formato do quadro em que a imagem de uma página aparece (A5, gibi americano, B5 mangá ou widescreen).',
          note: 'Opcional. Se ficar em branco, o meio escolhe (quadrinhos usam a página de gibi americano, storyboard 16:9).',
        },
        {
          key: 'themeOverride',
          label: 'Tema',
          whatToWrite: 'Escolha um tema para este arco ou mantenha o tema da história.',
          note: 'O tema muda a aparência enquanto o arco está selecionado; não muda o tema da história.',
        },
      ],
    },
    {
      type: 'paragraph',
      text: 'Enquanto um arco está selecionado, a tela de vocabulário edita os termos desse arco. Um termo deixado vazio usa o da história e, depois, o padrão da forma da obra.',
    },
    { type: 'heading', level: 2, text: 'Quadrinhos, storyboards e campanhas' },
    {
      type: 'paragraph',
      text: 'Em quadrinhos ou storyboard, cada cena pode ter páginas (ou quadros) com uma imagem e seu texto, e o arco define o quadro em que as imagens aparecem. Numa campanha de mesa, o botão Nova sessão na tela de capítulos pede apenas a data real e abre a sessão com a primeira cena pronta. O pacote Campanha acrescenta um campo de data, etiquetas e notas iniciais se você quiser; nada exige isso, e uma campanha exporta como crônica por padrão.',
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
    { type: 'seeAlso', pages: ['chapters', 'scene-pages', 'appearance', 'story-settings'] },
  ],
};

export default page;
