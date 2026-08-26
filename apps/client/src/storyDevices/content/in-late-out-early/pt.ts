import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'in-late-out-early',
  title: 'Entre tarde, saia cedo',
  summary: 'Comece a cena o mais perto possível do conflito e saia antes da arrumação.',
  keywords: [
    'entre tarde saia cedo',
    'in late out early',
    'entrada de cena',
    'corte',
    'montagem',
    'enxugar',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Entre em cada cena depois dos cumprimentos e da caminhada até a mesa, e corte no instante em que o objetivo dela é cumprido, de preferência uma fala antes do que o público espera. As lacunas o público preenche de graça, e a obra anda.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Na revisão: quase toda cena de primeiro rascunho começa uma página cedo demais.',
        'O diálogo chega ao ponto por meio de andaimes educados.',
        'Você quer que a próxima cena herde a tensão desta.',
        'A mídia pune tempo morto, como no audiovisual e nos quadrinhos.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Corte a chegada, o casaco, o café. Comece em: "Você contou pra eles." Termine com a mão dela indo ao celular, antes de vermos para quem liga.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Cortar tão cedo que o público perde a geografia da cena.',
        'Remover toda batida de descanso até a obra cansar.',
        'Terminar num falso tom de mistério quando a cena já havia acabado.',
      ],
    },
    { type: 'seeAlso', pages: ['scene-and-sequel', 'in-media-res', 'pacing', 'cliffhanger'] },
  ],
};
export default page;
