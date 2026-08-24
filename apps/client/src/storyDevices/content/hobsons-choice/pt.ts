import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'hobsons-choice',
  title: 'Ilusão de escolha',
  summary: 'Opções são oferecidas, mas só uma é viável.',
  keywords: ['ilusao de escolha', 'hobsons choice', 'escolha falsa', 'ramificacao', 'agencia'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma situação apresentada como decisão em que recusar não é sobrevivível e as alternativas são decorativas. Usada de propósito, dramatiza impotência; usada por descuido, faz o público sentir que a atenção dele foi desperdiçada.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O tema é coerção, pobreza, burocracia ou cativeiro.',
        'Você quer que se veja um personagem aceitando algo que não escolheu.',
        'Em obra ramificada, quando afunilar de volta a uma linha única é inevitável.',
        'Você quer que o público perceba que a escolha nunca foi real.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O contrato oferece três planos de pagamento. Ela precisa assinar hoje, e os três terminam com a mesma casa pertencendo a outra pessoa.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Apresentar como dilema genuíno, o que engana o público.',
        'Em obra interativa, oferecer opções de desfecho idêntico sem assumir isso.',
        'Usar tantas vezes que o público deixa de acreditar que alguma escolha importa.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['impossible-choice', 'ticking-clock', 'theme-statement', 'subversion-of-tropes'],
    },
  ],
};
export default page;
