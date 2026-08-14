import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'activity-log',
  title: 'Histórico de atividade',
  summary: 'Veja alterações registradas em uma história sincronizada.',
  keywords: ['histórico de atividade', 'ajuda'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O histórico mostra operações compartilhadas. Criado em marca o início; Atualizado em marca a alteração mais recente.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Consulte histórico de atividade quando essa parte do trabalho precisar de uma decisão ou revisão.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra a tela correspondente pelo menu.',
        'Leia as informações ou escolha a ação necessária.',
        'Confirme a alteração quando a tela pedir.',
        'Volte à história ou à lista para conferir o resultado.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O resultado pode aparecer em colaboração, sincronização, listas ou detalhes relacionados, conforme a ação realizada.',
    },
    { type: 'seeAlso', pages: ['using-this-help', 'sync-basics', 'data-and-backup'] },
  ],
};
export default page;
