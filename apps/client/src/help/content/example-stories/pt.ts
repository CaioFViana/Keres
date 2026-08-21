import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'example-stories',
  title: 'Histórias de exemplo',
  summary: 'Instale uma cópia para explorar recursos sem mexer em sua obra.',
  keywords: ['exemplo', 'instalar', 'idioma'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Histórias de exemplo são narrativas prontas incluídas no aplicativo para demonstração e prática.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Instale um exemplo ramificado para observar cenas, escolhas e o mapa antes de criar esses elementos na sua própria história.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu principal', 'Histórias de exemplo'] },
    {
      type: 'steps',
      items: [
        'Abra o catálogo.',
        'Escolha o idioma disponível para o exemplo.',
        'Toque em Instalar.',
        'Abra a cópia criada na sua lista de histórias.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A instalação cria uma cópia sua e independente. Editar ou excluir essa cópia não altera o catálogo nem qualquer outro exemplo.',
    },
    { type: 'seeAlso', pages: ['first-story', 'story-list', 'import-export'] },
  ],
};
export default page;
