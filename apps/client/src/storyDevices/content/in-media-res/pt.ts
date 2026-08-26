import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'in-media-res',
  title: 'In medias res',
  summary: 'Abrir no meio da ação e preencher o contexto depois.',
  keywords: ['in medias res', 'abertura', 'meio da acao', 'gancho', 'comecar tarde', 'cold open'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A obra começa num momento de pressão já em curso, e o que o público precisa para entender chega depois, distribuído pelas cenas seguintes. Compra atenção com uma pergunta que o público quer ver respondida.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O começo cronológico natural é necessário, mas não é interessante.',
        'Você precisa de uma primeira página, ou primeiro minuto, que mereça o segundo.',
        'A premissa é fácil de captar sem preâmbulo.',
        'Você quer que a exposição seja lida como resposta, e não como aula.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Em vez de abrir com a entrevista, abra com ela já no elevador, com a pasta que não devia ter levado, as mãos tremendo, quarenta andares para decidir.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Abrir num caos que o público não consegue decifrar: aí não há pergunta, só barulho.',
        'Emendar no gancho um flashback longo que desfaz o embalo recém-comprado.',
        'Usar por reflexo, até todo capítulo começar em disparada e nada mais impactar.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['in-late-out-early', 'fichtean-curve', 'chapter-hook', 'frame-story'],
    },
  ],
};
export default page;
