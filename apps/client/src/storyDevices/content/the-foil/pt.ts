import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'the-foil',
  title: 'O contraste',
  summary: 'Um personagem construído para contrastar e tornar o protagonista legível.',
  keywords: ['contraste', 'sombra do heroi', 'foil', 'parceiro', 'rival', 'oposicao'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um personagem cujos traços são arranjados para destacar o protagonista: mesma situação, instinto oposto. Um bom contraste não é oposto em tudo — quanto mais próximos forem em circunstância, mais afiada corta a única diferença.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O protagonista é difícil de caracterizar porque nada o mede.',
        'Você quer defender um tema por meio de duas pessoas, e não de narração.',
        'Uma parceria, rivalidade ou dupla de irmãos está no centro da obra.',
        'O antagonista precisa ser mais do que um obstáculo.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Dois médicos da mesma turma, mesmo hospital, mesma ambição. Um anota tudo; o outro lembra de tudo. A história trata de qual hábito sobrevive a um erro.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Construir um contraste sem vida própria fora da comparação.',
        'Contrastar em tantos eixos que a diferença significativa se perde.',
        'Fazer o contraste estar sempre errado, o que transforma oposição em sermão.',
      ],
    },
    { type: 'seeAlso', pages: ['thematic-mirror', 'flat-arc', 'role-reversal', 'character-arc'] },
  ],
};
export default page;
