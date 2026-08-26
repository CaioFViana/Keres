import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'friends',
  title: 'Amigos',
  summary: 'Envie e responda pedidos de amizade no mesmo servidor.',
  keywords: ['amigo', 'tag', 'convite', 'aceitar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Amizade liga duas contas no mesmo servidor. Ela é necessária antes de adicionar alguém como colaborador de uma história.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você procura a @tag de Joana, envia o pedido e, depois que ela aceita, pode convidá-la para escrever na sua história.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Amigos no menu principal e toque em adicionar.',
        'Escolha o servidor, informe a @tag da pessoa e toque em verificar.',
        'Confirme o pedido quando a conta encontrada estiver correta.',
        'Na lista, abra um pedido recebido para aceitar, recusar ou desfazer uma amizade.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A amizade só vale no servidor escolhido. Depois de aceita, a pessoa pode ser selecionada como colaboradora; desfazer a amizade não apaga histórias, mas pode impedir novos convites.',
    },
    { type: 'seeAlso', pages: ['your-profile', 'collaborators', 'what-is-a-server'] },
  ],
};
export default page;
