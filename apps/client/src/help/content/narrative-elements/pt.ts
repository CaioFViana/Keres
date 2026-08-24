import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'narrative-elements',
  title: 'Elementos narrativos',
  summary:
    'Planeje capítulos, cenas e, em histórias branching, as escolhas entre cenas em um só lugar.',
  keywords: ['narrativa', 'capítulos', 'cenas', 'escolhas', 'mapa da história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Elementos narrativos é o espaço de trabalho da estrutura da história. Capítulos agrupam cenas; cenas guardam os acontecimentos; histórias branching conectam cenas por escolhas.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'paragraph',
      text: 'Ele mantém a estrutura e a navegação da história juntas, permitindo ir da visão geral até um capítulo, uma cena ou uma escolha sem trocar de espaço de trabalho.',
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Um capítulo chamado “Chegada” pode conter as cenas “Na estação” e “O primeiro encontro”; em uma história branching, escolhas ligam esse encontro aos caminhos seguintes.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Crie um capítulo e então adicione cenas dentro dele.',
        'Expanda um capítulo para revisar e abrir suas cenas.',
        'Em uma história linear, abra a timeline pelo cabeçalho; em uma história branching, adicione escolhas a partir de uma cena e abra o mapa da história ali.',
        'Use busca e filtros para encontrar um capítulo, uma cena ou uma escolha sem sair deste espaço.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A busca avançada separa os campos de Capítulo, Cena e Escolha. Campos de Escolha aparecem somente em histórias branching. Em histórias lineares, a duração e o intervalo das cenas também alimentam a timeline.',
    },
    { type: 'seeAlso', pages: ['chapters', 'scenes', 'choices', 'story-map', 'lists-and-search'] },
  ],
};

export default page;
