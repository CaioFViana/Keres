import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-basics',
  title: 'Como a sincronização funciona',
  summary: 'Trabalhe offline e envie mudanças quando conectar.',
  keywords: ['como a sincronização funciona', 'ajuda'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Sincronização envia a história ligada ao servidor, suas mudanças e mídias. Você pode trabalhar sem rede e sincronizar depois.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Consulte como a sincronização funciona quando essa parte do trabalho precisar de uma decisão ou revisão.',
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
