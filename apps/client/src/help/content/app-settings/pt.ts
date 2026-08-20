import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'app-settings',
  title: 'Configurações do aplicativo',
  summary: 'Ajuste seu nome local, idioma e aparência do Keres neste aparelho.',
  keywords: ['tema escuro', 'idioma', 'nome de usuário', 'redefinir aplicativo'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Estas configurações controlam a aparência e a identificação local do aplicativo. Elas não alteram o Tema de uma história, que é uma informação sobre o assunto da narrativa.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você pode usar o modo escuro à noite e escolher português para a interface, mantendo uma história cujo Tema é “perdão”. Uma escolha não muda a outra.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'No menu principal, abra Configurações.',
        'Em Usuário, escreva o nome que identifica você neste aparelho.',
        'Em Idioma, escolha o idioma da interface. A Ajuda acompanha essa escolha.',
        'Ative ou desative Modo escuro para mudar a aparência do aplicativo.',
        'Ative ou desative Formato 24 horas para escolher como os atributos personalizados de Data mostram e editam a hora.',
        'Ative ou desative Sugerir recursos literários para mostrar ou ocultar a lista de Recursos literários no menu.',
        'Use Redefinir aplicativo somente quando quiser apagar os dados locais e voltar à instalação inicial. Leia a confirmação antes de aceitar.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Idioma e aparência se aplicam a todo o aplicativo neste aparelho. O nome local não é o mesmo que o nome, a @tag ou o perfil de uma conta em servidor. Redefinir remove histórias locais, mídias e conexões salvas deste aparelho.',
    },
    {
      type: 'paragraph',
      text: 'Mostrar ajuda controla o atalho de ajuda contextual nos cabeçalhos das páginas compatíveis. Sugerir recursos literários apenas mostra ou oculta aquele item do menu; nada é apagado.',
    },
    {
      type: 'seeAlso',
      pages: ['your-profile', 'data-and-backup', 'using-this-help', 'story-devices'],
    },
  ],
};
export default page;
