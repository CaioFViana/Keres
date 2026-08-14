import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'create-story',
  title: 'Criando e editando uma história',
  summary: 'Dê um nome, uma identidade e preferências à história antes de preenchê-la.',
  keywords: ['título', 'autor', 'gênero', 'tema', 'criar história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Este formulário cria uma história ou altera os dados básicos de uma que já existe. Título é o único campo que precisa ser preenchido para criar.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Para “A Cidade de Vidro”, você pode usar o gênero Fantasia, indicar Marina Alves como Autora de uma adaptação, escolher Português e registrar uma anotação sobre a versão que está planejando.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Lista de histórias', '+', 'Criar nova história'] },
    {
      type: 'steps',
      items: [
        'Preencha Título.',
        'Escolha Tipo antes de criar; ele não é alterado neste formulário depois que a história existe.',
        'Preencha os demais campos quando ajudarem você a reconhecer ou apresentar a história.',
        'Toque em Criar história ou Atualizar história.',
        'Para mudar tipo, colaboração, servidor, comentários de leitores, tempo das cenas ou favoritos depois, abra Configurações da história.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Título',
          whatToWrite:
            'O nome pelo qual você reconhece a história. É o único campo necessário para criar.',
          note: 'Aparece na lista de histórias e no cabeçalho quando ela está aberta.',
        },
        {
          key: 'type',
          label: 'Tipo',
          whatToWrite:
            'Escolha Linear para uma sequência única ou Ramificada para caminhos com escolhas.',
          note: 'Em Ramificada, o menu Escolhas e o mapa da história ficam disponíveis.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite: 'Um resumo livre para identificar a proposta da história.',
          note: 'Pode aparecer no cartão da lista.',
        },
        {
          key: 'genre',
          label: 'Gênero',
          whatToWrite: 'O gênero narrativo, como fantasia, romance ou mistério.',
          note: 'Aparece no cartão da lista.',
        },
        {
          key: 'author',
          label: 'Autor',
          whatToWrite: 'Quem assina a história. Pode ser diferente do seu nome de conta.',
          note: 'Útil para adaptações e obras em coautoria.',
        },
        {
          key: 'language',
          label: 'Idioma',
          whatToWrite: 'O idioma da história.',
          note: 'Ajuda a identificar histórias no seu acervo.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar a história.',
          note: 'A estrela aparece no cartão da lista.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Lembretes que não cabem nos outros campos.',
          note: 'Ficam junto aos dados da história.',
        },
        {
          key: 'theme',
          label: 'Tema',
          whatToWrite: 'Escolha a aparência visual usada enquanto essa história estiver aberta.',
          note: 'Não é o tema narrativo da obra.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O tipo controla ferramentas de histórias ramificadas. A aparência escolhida é aplicada enquanto a história está aberta. Os outros dados ajudam a reconhecer a história, sem mudar seus personagens ou cenas.',
    },
    { type: 'seeAlso', pages: ['story-type', 'story-settings', 'story-list'] },
  ],
};
export default page;
