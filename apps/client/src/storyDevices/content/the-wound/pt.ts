import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'the-wound',
  title: 'A ferida',
  summary: 'Uma lesão do passado que explica a defesa do presente.',
  keywords: ['a ferida', 'a chaga', 'the wound', 'passado', 'trauma', 'defeito', 'fantasma'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um evento específico anterior à história que ensinou ao personagem uma lição falsa. É a lição, não o evento, que move o comportamento agora: ela produz a defesa, o ponto cego e o motivo pelo qual ele recusará justamente aquilo de que precisa.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um defeito parece arbitrário e você precisa que ele soe merecido.',
        'Você precisa justificar uma recusa, uma fobia ou um padrão de autossabotagem.',
        'O final exige que o personagem arrisque exatamente o que já o machucou.',
        'Você está construindo uma relação em que duas feridas se agravam mutuamente.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Aos nove anos ela ficou seis horas esperando na porta da escola. Nunca se atrasa, nunca depende de ninguém, e não perdoa atraso alheio. A história nunca precisa dizer isso por inteiro.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Explicar a ferida num único flashback que resolve o mistério do personagem.',
        'Torná-la tão extrema que vira a personalidade inteira.',
        'Curá-la só por tomada de consciência, e não por uma ação tomada sob risco.',
      ],
    },
    { type: 'seeAlso', pages: ['want-vs-need', 'character-arc', 'flat-arc', 'iceberg-theory'] },
  ],
};
export default page;
