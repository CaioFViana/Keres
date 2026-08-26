import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'save-the-cat-beat-sheet',
  title: 'Folha de batidas',
  summary: 'Um modelo comercial de quinze batidas com proporções fixas.',
  keywords: [
    'folha de batidas',
    'save the cat',
    'snyder',
    'batidas',
    'tudo esta perdido',
    'beat sheet',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um modelo de roteiro que nomeia quinze batidas e mais ou menos onde caem: imagem de abertura, tema declarado, apresentação, catalisador, debate, entrada no segundo ato, trama B, diversão e jogo, ponto médio, o cerco se fecha, tudo está perdido, noite escura da alma, entrada no terceiro ato, final, imagem final. O valor dele é diagnóstico, não gerador.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um rascunho parece sem forma e você quer ver qual batida falta ou está fora de lugar.',
        'Você escreve num gênero comercial cujo público conhece esse ritmo.',
        'Você quer o tema dito em voz alta cedo, para que o final possa respondê-lo.',
        'Você precisa comparar sua estrutura com uma referência comum entre colaboradores.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você percebe que seu "tudo está perdido" chega no finzinho, sem espaço para a noite escura. Adiantá-lo dá ao personagem tempo de decidir em vez de apenas sobreviver.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Escrever para as porcentagens e produzir uma obra competente e esquecível.',
        'Confundir a folha de batidas com a história; ela descreve forma, não sentido.',
        'Usá-la em formatos para os quais nunca foi feita, como conto ou obra literária lenta.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['three-act-structure', 'seven-point-structure', 'save-the-cat', 'theme-statement'],
    },
  ],
};
export default page;
