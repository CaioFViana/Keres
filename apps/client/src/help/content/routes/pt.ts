import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'routes',
  title: 'Rotas',
  summary: 'Defina um caminho possível pela história ramificada e leia ou simule esse percurso.',
  keywords: ['rota', 'caminho', 'escolha', 'leitor', 'navegador', 'ramificada'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma Rota é um caminho possível que você define em uma história ramificada. Ela registra a Cena inicial e, em cada passo, qual Escolha leva à próxima Cena. Não é uma cópia da história nem altera suas Escolhas.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A rota “Mara pega o trem” começa na estação, escolhe “Seguir Mara” e termina na chegada. Você pode abri-la no Leitor para revisar apenas esse percurso, sem atravessar os outros caminhos.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Tramas', 'Rotas'] },
    {
      type: 'steps',
      items: [
        'Em uma história ramificada, abra Tramas e depois Rotas.',
        'Crie a rota, dê um nome e salve. Em seguida, abra Editar passos.',
        'Escolha a Cena inicial. Para cada Cena seguinte, a tela oferece somente as Escolhas que realmente saem dela.',
        'Termine a rota quando chegar a um final, ou continue por outra Escolha disponível.',
        'Use o Leitor da rota para ler o caminho escolhido e o Navegador da história para testar Escolhas, condições e efeitos sem salvar uma rota.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Dê um nome que identifique o percurso, como “Final da aliança”.',
          note: 'É obrigatório e aparece na lista de Rotas e no Leitor.',
        },
        {
          key: 'details',
          label: 'Notas',
          whatToWrite:
            'Descreva a intenção narrativa, o final ou o público deste caminho. Pode ficar vazio.',
          note: 'Não muda as cenas ou escolhas.',
        },
        {
          key: 'sceneId',
          label: 'Cena',
          whatToWrite: 'Escolha a cena em que cada passo da rota acontece.',
          note: 'A primeira é a Cena inicial; as seguintes são determinadas pela Escolha anterior.',
        },
        {
          key: 'selectedChoiceId',
          label: 'Escolha tomada',
          whatToWrite: 'Selecione a Escolha que leva desta cena à próxima, ou termine a rota aqui.',
          note: 'A tela não permite pular para uma cena sem uma Escolha válida entre elas.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Uma Rota não altera o Mapa, as Cenas ou as Escolhas. O Leitor usa somente os passos dela. Se uma Escolha for excluída ou passar a levar a outra Cena, a rota é sinalizada para reparo antes de poder ser lida.',
    },
    { type: 'seeAlso', pages: ['branching-basics', 'choices', 'story-map', 'story-state'] },
  ],
};

export default page;
