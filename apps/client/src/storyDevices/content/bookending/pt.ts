import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'bookending',
  title: 'Fecho circular',
  summary: 'Terminar onde começou, para que a diferença seja o ponto.',
  keywords: [
    'fecho circular',
    'bookending',
    'imagem de abertura',
    'imagem final',
    'eco',
    'simetria',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Repetir no fecho a situação, imagem ou frase de abertura. Como o entorno é idêntico, tudo o que mudou fica mensurável: a mesma cozinha, a mesma pergunta, outra resposta.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um arco de personagem precisa de prova em vez de afirmação.',
        'A obra trata de retorno, ciclos ou herança.',
        'Você quer um final que pareça composto em vez de interrompido.',
        'A imagem de abertura é forte e ainda tem o que dar.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Abre com ela esperando uma ligação que não vai atender. Fecha com o mesmo telefone, a mesma sala, e ela atendendo no primeiro toque.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Repetir sem mudança, o que soa como truque de autor e não como final.',
        'Fazer o eco tão literal que ele se anuncia.',
        'Fechar em círculo uma obra cujo sentido depende de deixar o ponto de partida para trás.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['motif-and-leitmotif', 'character-arc', 'chapter-hook', 'frame-story'],
    },
  ],
};
export default page;
