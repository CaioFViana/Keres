import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'lampshading',
  title: 'Lampshading',
  summary:
    'Fazer um personagem nomear a implausibilidade para o público parar de discutir com ela.',
  keywords: ['lampshading', 'coincidencia', 'consciencia de genero', 'assumir', 'plausibilidade'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Assumir em voz alta, pela boca de um personagem, uma coincidência, uma convenção ou um absurdo, para que o público saiba que a obra também viu aquilo. Compra boa vontade trocando suspensão de descrença por uma piada, ou um desconforto, compartilhado.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma coincidência necessária pararia o público na hora.',
        'Você usa uma convenção de propósito e quer que isso fique claro.',
        'Comédia, em que nomear a engrenagem já é o prazer.',
        'O público conhece o gênero e vai perceber a manobra de qualquer forma.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Alguém diz, em voz alta, que entre todos os hospitais da cidade foram parar justamente naquele, e segue em frente. A coincidência fica; a objeção foi gasta.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Usar para desculpar um problema estrutural real em vez de corrigi-lo.',
        'Nomear tudo, até a obra virar comentário sobre uma história em vez de história.',
        'Quebrar um tom construído com cuidado por uma piada que custa mais do que rende.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['deus-ex-machina', 'subversion-of-tropes', 'frame-story', 'red-herring'],
    },
  ],
};
export default page;
