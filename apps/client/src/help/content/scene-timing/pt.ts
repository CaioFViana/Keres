import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'scene-timing',
  title: 'Tempo e ritmo das cenas',
  summary: 'Registre o tempo entre cenas e quanto cada acontecimento dura.',
  keywords: ['intervalo', 'duração', 'tempo', 'normalizar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Intervalo é o tempo que passa desde a cena anterior. Duração é quanto tempo a própria cena ocupa. Você informa valor e unidade, de segundos a eras.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Linha do tempo',
      text: 'Cena 1: a reunião dura 1 hora. Cena 2: a viagem começa 2 dias depois e dura 3 horas. Na Cena 2, Intervalo é 2 dias; Duração é 3 horas.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra a cena que deseja ajustar.',
        'Informe o Intervalo desde a cena anterior e escolha a unidade.',
        'Informe a Duração da própria cena e escolha a unidade.',
        'Em Configurações da história, use normalizar tempo quando quiser recalcular a sequência a partir desses valores. O tempo poderá ser mostrado como 26 horas ou como 1 dia e 2 horas.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Tempo e ritmo ajudam você a comparar a sequência das cenas e são usados ao normalizar a história. Eles não mudam a Ordem de leitura dos capítulos.',
    },
    { type: 'seeAlso', pages: ['scenes', 'chapters', 'story-settings'] },
  ],
};
export default page;
