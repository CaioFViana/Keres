import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'what-is-a-server',
  title: 'O que é um servidor Keres',
  summary: 'Entenda quando usar sincronização e colaboração.',
  keywords: ['o que é um servidor keres', 'configurar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um servidor é opcional: ele permite manter histórias entre aparelhos e trabalhar com outras pessoas.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use o que é um servidor keres quando precisar adaptar o aplicativo ao seu modo de trabalhar.',
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
