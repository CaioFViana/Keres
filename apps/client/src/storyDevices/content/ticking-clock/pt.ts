import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'ticking-clock',
  title: 'Relógio correndo',
  summary: 'Um prazo rígido que transforma hesitação em custo.',
  keywords: [
    'relogio correndo',
    'prazo',
    'ticking clock',
    'urgencia',
    'limite de tempo',
    'pressao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um limite imposto de fora — um embarque, uma data de julgamento, uma maré subindo, um manômetro de oxigênio — que torna cada demora cara. Converte urgência vaga em aritmética que o público acompanha, e obriga personagens a agir com informação incompleta.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O meio da obra vagueia porque nada pune a espera.',
        'Você quer que um personagem tome uma decisão ruim de forma plausível.',
        'Uma cena precisa de pressão sem entrar um novo antagonista.',
        'Você quer que o público sinta a estrutura sem que ela seja explicada.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A audiência é na quinta. Cada cabeçalho de capítulo é um dia da semana, e na quarta a protagonista escolhe entre provas e sono.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Um relógio que a história esquece, e o público deixa de acreditar nele.',
        'Esticar o prazo para resolver um problema, ensinando que o relógio é decorativo.',
        'Uma contagem tão apertada que nenhuma cena respira ou reflete.',
      ],
    },
    { type: 'seeAlso', pages: ['pacing', 'impossible-choice', 'macguffin', 'cliffhanger'] },
  ],
};
export default page;
