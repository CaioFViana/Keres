import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'data-and-backup',
  title: 'Seus dados e backup',
  summary: 'Proteja histórias locais com cópias exportadas.',
  keywords: ['seus dados e backup', 'ajuda'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Dados locais ficam no aparelho; dados de histórias ligadas a servidor também são enviados para sincronização.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Consulte seus dados e backup quando essa parte do trabalho precisar de uma decisão ou revisão.',
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
