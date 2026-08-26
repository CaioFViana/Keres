import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'pacing',
  title: 'Ritmo narrativo',
  summary: 'Controlar a velocidade da leitura pelo tamanho de frases, parágrafos e cenas.',
  keywords: [
    'ritmo narrativo',
    'pacing',
    'cadencia',
    'tamanho de frase',
    'tensao',
    'resumo',
    'velocidade',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O público lê na velocidade que a prosa permite. Frases e parágrafos curtos aceleram; frases longas com orações subordinadas desaceleram e convidam à reflexão. O tamanho das cenas, o espaço em branco e a proporção entre resumo e dramatização fazem o mesmo trabalho em escala maior.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'A ação soa achatada porque as frases têm o mesmo tamanho das reflexões.',
        'Uma passagem reflexiva parece apressada e sem mérito.',
        'O meio da obra se arrasta e você não encontra uma causa de trama.',
        'Você precisa que um momento impacte, e desacelerar é a técnica inteira.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ele correu. A porta estava fechada. Atrás dele, alguém riu. Depois, mais adiante, três linhas que se desenrolam por meia página enquanto ele espera a própria respiração baixar.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Ritmo acelerado o tempo todo, o que achata os picos que ele deveria criar.',
        'Confundir ritmo com número de acontecimentos; uma cena lenta pode ser tensa.',
        'Resumir os momentos pelos quais o público veio e dramatizar os que ele não queria.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['scene-and-sequel', 'in-late-out-early', 'ticking-clock', 'rule-of-three'],
    },
  ],
};
export default page;
