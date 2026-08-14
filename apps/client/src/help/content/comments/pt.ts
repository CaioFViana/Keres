import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'comments',
  title: 'Comentários',
  summary: 'Converse sobre um campo específico com sua equipe.',
  keywords: ['comentários', 'história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Comentários podem apontar um campo e guardar um trecho citado para orientar uma revisão.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use comentários para deixar uma decisão de narrativa clara antes de revisar a próxima cena.',
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
