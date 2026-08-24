import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'scenes',
  title: 'Cenas',
  summary: 'Planeje cada acontecimento, onde ele ocorre e quem participa.',
  keywords: ['cena', 'local', 'capítulo', 'participantes', 'inicial', 'final'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma cena registra um acontecimento da história. Ela pertence a um capítulo, acontece em um Local e pode reunir personagens.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: '“Partida da estação” fica no capítulo A viagem, acontece na Estação Central e reúne Lia e Omar. Marque-a como Cena inicial se for o começo de uma história ramificada.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'path',
      segments: ['Menu da história', 'Capítulos', 'Abrir capítulo', 'Adicionar cena'],
    },
    {
      type: 'steps',
      items: [
        'Abra o capítulo que deve conter a cena e toque em Adicionar cena.',
        'Informe Nome.',
        'Escolha o Capítulo e o Local; o local precisa estar preenchido.',
        'Use Resumo para registrar o acontecimento.',
        'Depois de salvar, adicione personagens participantes, etiquetas, notas, mídia e relações.',
        'Marque Cena inicial ou Cena final quando isso representar o caminho da história.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Um nome reconhecível para o acontecimento. Preencha para salvar.',
          note: 'Aparece em listas, escolhas e mapas.',
        },
        {
          key: 'summary',
          label: 'Resumo',
          whatToWrite: 'O que acontece nesta cena.',
          note: 'Ajuda a revisar a sequência.',
        },
        {
          key: 'chapterId',
          label: 'Capítulo',
          whatToWrite: 'O capítulo em que o leitor encontra a cena.',
          note: 'Define o agrupamento e a ordem de leitura.',
        },
        {
          key: 'locationId',
          label: 'Local',
          whatToWrite: 'Onde a cena acontece. Escolha um Local já cadastrado.',
          note: 'É necessário para salvar e liga a cena ao mundo.',
        },
        {
          key: 'isStart',
          label: 'Cena inicial',
          whatToWrite: 'Ative quando esta for o início do caminho ramificado.',
          note: 'O mapa e a análise usam essa marca.',
        },
        {
          key: 'isFinish',
          label: 'Cena final',
          whatToWrite: 'Ative quando esta encerrar um caminho.',
          note: 'A análise avisa se uma cena final ainda tiver escolhas de saída.',
        },
        {
          key: 'gap',
          label: 'Intervalo',
          whatToWrite: 'O tempo que passou desde a cena anterior.',
          note: 'Informe também a unidade ao lado do valor.',
        },
        {
          key: 'duration',
          label: 'Duração',
          whatToWrite: 'Quanto tempo esta cena dura.',
          note: 'Informe também a unidade ao lado do valor.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar a cena.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Lembretes de roteiro ou produção.',
          note: 'Ficam na ficha da cena.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Cenas aparecem no capítulo, no Local, nas participações de personagens e nas Escolhas. Cena inicial e final afetam o mapa e os avisos da análise.',
    },
    {
      type: 'seeAlso',
      pages: ['chapters', 'locations', 'scene-timing', 'choices', 'story-analysis'],
    },
  ],
};
export default page;
