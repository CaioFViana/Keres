import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'choices',
  title: 'Escolhas',
  summary: 'Ligue uma cena a outra e escreva a decisão que abre cada caminho.',
  keywords: ['escolha', 'cena de origem', 'cena de destino', 'caminho', 'ramificada'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma escolha é a ligação entre duas cenas de uma história ramificada: ela nasce em uma Cena de origem, mostra um Texto e leva a uma Cena de destino.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Na cena “A porta da estação abre”, o leitor vê “Seguir Mara para o trem”. Essa escolha leva à cena “Dentro do trem”. Outra escolha, “Investigar o corredor”, leva a uma cena diferente.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Escolhas. Esse menu só está disponível em histórias ramificadas.',
        'Toque em + para criar uma escolha, ou abra uma existente para editar.',
        'Escolha a Cena de origem e a Cena de destino, escreva o Texto e acrescente Anotações da escolha se precisar.',
        'Salve. Depois de salvar uma nova escolha, você pode adicionar etiquetas, notas, Veja também, condições e efeitos.',
        'Abra o Mapa da história ou a Análise da história para conferir se o novo caminho faz sentido.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'text',
          label: 'Texto',
          whatToWrite:
            'Escreva a opção que será apresentada ao leitor, como “Seguir Mara para o trem”. Este campo é obrigatório.',
          note: 'É o nome da escolha nas listas, no detalhe e no mapa.',
        },
        {
          key: 'sourceScene',
          label: 'Cena de origem',
          whatToWrite: 'Selecione a cena em que esta decisão aparece. Este campo é obrigatório.',
          note: 'O mapa desenha a saída a partir desta cena.',
        },
        {
          key: 'destinationScene',
          label: 'Cena de destino',
          whatToWrite: 'Selecione a cena para onde esta decisão leva. Este campo é obrigatório.',
          note: 'O mapa desenha a chegada nessa cena.',
        },
        {
          key: 'notes',
          label: 'Anotações da escolha',
          whatToWrite:
            'Registre intenção, consequência ou uma pendência de revisão. Pode ficar em branco.',
          note: 'Aparece no detalhe da escolha, separada de notas vinculadas.',
        },
        {
          key: 'choiceSearch',
          label: 'Texto ou anotações da escolha',
          whatToWrite:
            'Este é um campo apenas de busca. Digite uma palavra para encontrá-la no texto ou nas anotações da escolha.',
          note: 'Ele aparece na busca avançada e não adiciona um novo valor à escolha.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Cada escolha cria uma ligação no Mapa da história e é verificada pela Análise. Condições podem esconder, bloquear ou habilitar a escolha; efeitos podem alterar os itens e marcadores usados nas próximas decisões.',
    },
    {
      type: 'seeAlso',
      pages: ['branching-basics', 'story-map', 'choice-conditions', 'effects', 'story-state'],
    },
  ],
};
export default page;
