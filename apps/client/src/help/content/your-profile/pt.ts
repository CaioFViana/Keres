import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'your-profile',
  title: 'Seu perfil',
  summary: 'Escolha como outras pessoas veem você no servidor.',
  keywords: ['seu perfil', 'ajuda'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Seu perfil reúne nome de exibição, @tag, avatar e bio. A @tag é usada por amigos para encontrar você.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Consulte seu perfil quando essa parte do trabalho precisar de uma decisão ou revisão.',
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
