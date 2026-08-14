import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-state',
  title: 'Inventário e marcadores',
  summary: 'Acompanhe o que o leitor carrega e o que já aconteceu.',
  keywords: ['inventário e marcadores', 'história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O estado do leitor reúne inventário e marcadores. Efeitos escrevem esse estado e condições o leem.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use inventário e marcadores para deixar uma decisão de narrativa clara antes de revisar a próxima cena.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra o elemento correspondente no Menu da história.',
        'Crie ou edite o registro desejado.',
        'Preencha as opções que descrevem sua decisão e salve.',
        'Volte aos detalhes para conferir os vínculos.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O recurso é usado por cenas, escolhas, análise ou detalhes relacionados, conforme o vínculo que você criou.',
    },
    { type: 'seeAlso', pages: ['choices', 'scenes', 'story-analysis'] },
  ],
};
export default page;
