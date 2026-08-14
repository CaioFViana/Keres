import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'choice-conditions',
  title: 'Condições para uma escolha aparecer',
  summary: 'Defina quando uma escolha é mostrada ao leitor.',
  keywords: ['condições para uma escolha aparecer', 'história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Condições verificam visitas, itens e marcadores antes de uma escolha aparecer. Grupos usam todas as condições ou qualquer uma delas.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use condições para uma escolha aparecer para deixar uma decisão de narrativa clara antes de revisar a próxima cena.',
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
