import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'chapter-hook',
  title: 'Gancho de capítulo',
  summary: 'Primeira e última frases feitas para puxar o público através do intervalo.',
  keywords: [
    'gancho de capitulo',
    'chapter hook',
    'primeira frase',
    'ultima frase',
    'abertura',
    'fechamento',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A frase que abre uma unidade e a frase que a fecha, tratadas como trabalho deliberado, e não como o que o rascunho por acaso deixou ali. A última linha cria motivo para continuar; a primeira paga a decisão de ter continuado.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Na revisão: leia só a primeira e a última linha de cada capítulo, em sequência.',
        'Publicação seriada ou episódica, em que o intervalo é tempo real.',
        'Um capítulo é bom e ninguém lembra dele, porque começa e termina em arrumação.',
        'Você quer trocar de tom ou de ponto de vista e precisa de uma passagem limpa.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Fim: "O segundo envelope tinha a letra dela." Começo do capítulo seguinte: "Ela estava morta havia onze anos."',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Ganchos que prometem algo que o capítulo seguinte não entrega.',
        'Terminar todo capítulo numa pergunta até o público parar de perguntar.',
        'Abrir com uma frase forte desconectada da cena que vem depois.',
      ],
    },
    { type: 'seeAlso', pages: ['cliffhanger', 'in-late-out-early', 'pacing', 'bookending'] },
  ],
};
export default page;
