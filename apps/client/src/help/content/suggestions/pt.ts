import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'suggestions',
  title: 'Listas de sugestões',
  summary: 'Reaproveite valores usados na história ao preencher campos.',
  keywords: ['listas de sugestões', 'configurar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Sugestões oferecem valores já usados em campos como gênero, raça ou tipo de relação; você pode adicionar outros ao digitar.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use listas de sugestões quando precisar adaptar o aplicativo ao seu modo de trabalhar.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra a tela correspondente pelo menu.',
        'Preencha ou escolha as opções disponíveis.',
        'Salve ou confirme a alteração quando a tela solicitar.',
        'Volte ao menu para usar o recurso atualizado.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A alteração vale para o recurso escolhido e pode aparecer em formulários, buscas, colaboração ou sincronização relacionados.',
    },
    { type: 'seeAlso', pages: ['story-settings', 'sync-basics', 'friends'] },
  ],
};
export default page;
