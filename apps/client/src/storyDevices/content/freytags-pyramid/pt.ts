import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'freytags-pyramid',
  title: 'Pirâmide de Freytag',
  summary:
    'Uma curva em cinco partes: exposição, ação crescente, clímax, ação decrescente, desfecho.',
  keywords: ['freytag', 'piramide', 'climax', 'desfecho', 'tragedia', 'freytags pyramid'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma descrição do século XIX sobre a forma dramática, tirada da tragédia clássica. Ela põe o clímax perto do meio, e não do fim, e dá peso real à ação decrescente: o trecho em que as consequências se desenrolam depois do ato decisivo.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'A história trata mais de consequência do que de suspense.',
        'Uma tragédia, em que o público precisa assistir à queda inteira.',
        'Você quer um final que respire em vez de parar no pico.',
        'Você está analisando uma obra pronta e quer vocabulário para a curva dela.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma juíza aceita a propina no ponto médio. O resto da obra não é se ela será pega, e sim a aritmética lenta do que a propina lhe custa, terminando num desfecho silencioso em vez de um estrondo.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Aplicar a formas comerciais rápidas, que querem o clímax perto do fim.',
        'Confundir ação decrescente com epílogo; a ação decrescente ainda tem conflito.',
        'Ler a pirâmide como fórmula em vez de descrição de obras já escritas.',
      ],
    },
    { type: 'seeAlso', pages: ['three-act-structure', 'fichtean-curve', 'pacing', 'bookending'] },
  ],
};
export default page;
