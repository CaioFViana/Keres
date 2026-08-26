import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'save-the-cat',
  title: 'Salve o gato',
  summary: 'Um gesto de decência logo cedo que compra a simpatia do público.',
  keywords: ['salve o gato', 'save the cat', 'simpatia', 'apresentacao', 'primeira impressao'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma gentileza pequena e custosa feita logo no início, geralmente quando ninguém está olhando. Não se trata de tornar o personagem simpático: trata-se de dar ao público um motivo para acompanhar alguém cujo comportamento adiante será difícil.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O protagonista é áspero, criminoso ou frio e ainda assim precisa ser seguido.',
        'A primeira impressão acumula caracterização e convite.',
        'Você precisa estabelecer o valor que o personagem trairá depois.',
        'Um elenco coral precisa distinguir cada membro rapidamente.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Antes de sabermos do que ele vive, ele completa o troco de um desconhecido no caixa e não espera agradecimento.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Uma gentileza que não custa nada, e por isso soa decorativa.',
        'Fazer o gesto para uma plateia dentro da história, o que o transforma em estratégia.',
        'Usar isso como substituto de tornar o personagem interessante.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['pet-the-dog', 'kick-the-dog', 'character-arc', 'save-the-cat-beat-sheet'],
    },
  ],
};
export default page;
