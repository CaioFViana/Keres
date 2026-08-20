import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'iceberg-theory',
  title: 'Teoria do iceberg',
  summary: 'Deixe de fora a maior parte do que você sabe; a omissão ainda será sentida.',
  keywords: [
    'teoria do iceberg',
    'iceberg theory',
    'omissao',
    'hemingway',
    'contencao',
    'implicito',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A ideia de que a obra ganha peso quando o autor sabe muito mais do que está na página e omite de propósito. A omissão só funciona quando o conhecimento existe: o público sente o contorno do que falta. Ausência inventada soa apenas como vagueza.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O passado ameaça virar ensaio.',
        'Você quer o público se inclinando para frente em vez de recebendo um relatório.',
        'Formatos curtos, em que cada frase precisa carregar mais que a superfície.',
        'Luto e trauma, em que o relato direto muitas vezes diminui o assunto.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você escreveu duas páginas de história dos irmãos. Fique com uma frase: ele ainda põe a mesa para quatro. Todo o resto continua nas suas anotações.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Omitir o que você nunca resolveu, e o público sentir aquilo como buraco.',
        'Sonegar clareza básica, o que é confusão, não contenção.',
        'Tratar a ideia como licença para pular a cena difícil em vez de comprimi-la.',
      ],
    },
    { type: 'seeAlso', pages: ['show-dont-tell', 'subtext', 'the-wound', 'sensory-grounding'] },
  ],
};
export default page;
