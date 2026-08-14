import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'gallery',
  title: 'Galeria',
  summary: 'Importe e reaproveite imagens, áudios e vídeos.',
  keywords: ['galeria', 'história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A Galeria guarda mídia da história. A mesma mídia pode ilustrar vários elementos.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use galeria para organizar a narrativa e conferir ligações antes de escrever ou revisar.',
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
