import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'subtext',
  title: 'Subtexto',
  summary: 'O que se quer dizer sob o que se diz. Em geral, o conteúdo real da cena.',
  keywords: ['subtexto', 'subtext', 'dialogo', 'implicito', 'nao dito', 'tensao'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O vão entre a superfície de uma fala e a intenção dela. Personagens discutem a louça e falam do casamento. Existe subtexto sempre que um personagem tem motivo para não dizer aquilo diretamente, e ele dá ao público o prazer de entender sem que lhe expliquem.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Dois personagens querem coisas incompatíveis e ambos sabem disso.',
        'A cena está literal demais e cada fala declara o próprio propósito.',
        'Uma relação tem história que o público deve inferir, não receber.',
        'Há luto, desejo ou vergonha em cena, que raramente se anunciam.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ele pergunta se ela comeu. Ela diz que não está com fome. Ele pergunta de novo ao sair. Nenhum dos dois menciona a carta sobre a mesa.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Subtexto tão fundo que nada aflora, e a cena passa a ser sobre nada.',
        'Um personagem explicar o subtexto, o que o apaga.',
        'Usar onde a franqueza seria mais forte; às vezes as pessoas dizem a coisa.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['dialogue-beats', 'show-dont-tell', 'iceberg-theory', 'dramatic-irony'],
    },
  ],
};
export default page;
