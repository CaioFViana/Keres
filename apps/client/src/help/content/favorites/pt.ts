import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'favorites',
  title: 'Favoritos',
  summary: 'Destaque o que merece ser reencontrado rapidamente.',
  keywords: ['favoritos', 'história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Favoritos marcam histórias e elementos importantes. Em colaboração, a história define se a marca é global, individual ou individual pública.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use favoritos para organizar a narrativa e conferir ligações antes de escrever ou revisar.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra o item correspondente no Menu da história.',
        'Crie ou selecione o registro que deseja trabalhar.',
        'Preencha as informações necessárias e salve.',
        'Volte à lista ou ao mapa para revisar o resultado.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'As informações ficam disponíveis nos detalhes e ferramentas relacionadas da mesma história. Revise os vínculos antes de excluir algo que outra tela possa usar.',
    },
    { type: 'seeAlso', pages: ['scenes', 'story-analysis', 'lists-and-search'] },
  ],
};
export default page;
