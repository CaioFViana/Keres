import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'effects',
  title: 'Efeitos de uma cena ou escolha',
  summary: 'Registre mudanças que acontecem depois de uma cena ou decisão.',
  keywords: ['efeitos de uma cena ou escolha', 'história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Efeitos podem dar ou tirar itens e ligar ou desligar marcadores. Eles ajudam a análise a entender os caminhos da história.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use efeitos de uma cena ou escolha para deixar uma decisão de narrativa clara antes de revisar a próxima cena.',
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
