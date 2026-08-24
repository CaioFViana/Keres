import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'role-reversal',
  title: 'Inversão de papéis',
  summary: 'O caçador vira caça; o protetor passa a ser protegido.',
  keywords: [
    'inversao de papeis',
    'role reversal',
    'reversao',
    'troca de poder',
    'virada',
    'mentor',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma troca estrutural em que dois personagens invertem posições de poder, conhecimento ou dependência. Funciona porque o público já aprendeu o arranjo original, então a inversão é lida na hora e obriga os dois a improvisar.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma relação ficou estável tempo suficiente para o público a considerar dada.',
        'Você quer um ponto médio que mude os termos, e não o cenário.',
        'O aluno precisa superar o mestre, ou o perseguidor precisa ser exposto.',
        'Você precisa de uma cena que revele como o personagem é sem a vantagem de sempre.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Por doze capítulos o delegado a interroga. No capítulo treze é ela quem tem a pasta e ele quem responde, na mesma sala, nas mesmas cadeiras.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Inverter sem ter estabelecido o arranjo original com clareza suficiente para se sentir.',
        'Trocar as posições mas não os comportamentos, e nada de fato se revelar.',
        'Inverter tantas vezes que o poder passa a parecer arbitrário.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['kill-the-mentor', 'the-foil', 'impossible-choice', 'subversion-of-tropes'],
    },
  ],
};
export default page;
