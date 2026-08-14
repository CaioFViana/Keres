import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'add-server',
  title: 'Cadastrando um servidor',
  summary: 'Adicione um servidor, crie uma conta ou entre em uma existente.',
  keywords: ['cadastrando um servidor', 'configurar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Cadastrar um servidor guarda o endereço fornecido por quem o administra e permite criar ou usar sua conta nele.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use cadastrando um servidor quando precisar adaptar o aplicativo ao seu modo de trabalhar.',
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
