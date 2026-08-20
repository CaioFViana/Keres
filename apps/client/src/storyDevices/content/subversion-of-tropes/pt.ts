import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'subversion-of-tropes',
  title: 'Quebra de expectativa',
  summary: 'Invocar uma convenção conhecida e depois mudar o que ela faz.',
  keywords: [
    'quebra de expectativa',
    'subversao',
    'tropo',
    'expectativa',
    'genero',
    'desconstrucao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Montar um padrão que o público reconhece e então entregar outra coisa. Só funciona se a convenção for de fato estabelecida antes, porque o sentido nasce da diferença entre o que foi prometido e o que chegou.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O gênero é muito conhecido e a entrega literal seria inerte.',
        'Você quer dizer algo sobre a própria convenção.',
        'Um tipo de personagem merece ser tratado como pessoa.',
        'Uma batida está previsível e a previsibilidade está custando atenção.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O mentor faz o discurso, a música cresce, e o aluno diz que aquilo é um plano terrível e vai embora. A cena funciona porque conhecíamos a forma que ela quebrou.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Subverter por subverter, o que deixa um vão onde deveria haver sentido.',
        'Cinismo confundido com lucidez; recusar a convenção não é o mesmo que respondê-la.',
        'Subverter uma convenção que o público não tem de fato.',
      ],
    },
    { type: 'seeAlso', pages: ['lampshading', 'role-reversal', 'red-herring', 'rule-of-three'] },
  ],
};
export default page;
