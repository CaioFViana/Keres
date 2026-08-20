import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'impossible-choice',
  title: 'Escolha impossível',
  summary: 'Duas opções, ambas ruins, e nenhuma terceira porta.',
  keywords: ['escolha impossivel', 'dilema', 'impossible choice', 'garfo de morton', 'sacrificio'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um dilema construído para que todo caminho disponível custe ao personagem algo que ele valoriza. Como recusar também é escolher, ele expõe prioridades que o personagem jamais declararia. É o instrumento mais direto para revelar valores sob pressão.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Você precisa mostrar, e não afirmar, no que o personagem acredita de fato.',
        'O clímax deve girar em torno de uma decisão, e não de uma luta.',
        'Dois bens igualmente simpáticos estão em conflito real.',
        'Em obra ramificada, em que cada opção precisa ser defensável diante de um público real.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ela pode entregar o colega e manter a clínica aberta, ou calar e vê-la fechar. Os dois desfechos são o final; a história é qual deles ela consegue suportar.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Pesar tanto uma das opções que não há dilema, só adiamento.',
        'Deixar uma terceira via surgir de fora e resgatar o personagem.',
        'Pular as consequências; a escolha vale pouco se ninguém paga por ela na página.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['hobsons-choice', 'want-vs-need', 'ticking-clock', 'role-reversal'],
    },
  ],
};
export default page;
