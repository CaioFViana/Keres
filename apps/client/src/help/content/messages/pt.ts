import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'messages',
  title: 'Mensagens',
  summary: 'Escreva para seus amigos e para os administradores de um servidor.',
  keywords: ['mensagem', 'caixa de entrada', 'conversa', 'administrador', 'amigo', 'contato'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'As mensagens permitem conversar dentro do app: com um amigo em um servidor, ou com os administradores desse servidor. Cada conversa é com uma pessoa (ou com os administradores) em um servidor.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você pergunta a Joana, uma amiga, o que ela achou de uma cena. Em outro dia, escreve aos administradores do seu servidor sobre os limites da sua conta, e eles respondem na mesma conversa.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Gerenciar Amizades no menu principal e toque no ícone de mensagens para ver suas conversas.',
        'Para começar uma, toque em nova mensagem e escolha um amigo ou os administradores de um servidor. Você também pode tocar no ícone de mensagem em um amigo, ou abrir o amigo e usar o ícone de mensagem no topo.',
        'Escreva a mensagem e toque em enviar. O contador mostra quantos caracteres ainda cabem, e a linha abaixo mostra quantas mensagens você ainda pode enviar hoje.',
        'Um pequeno ponto em Gerenciar Amizades no menu principal (e no grupo Servidor enquanto ele está fechado), e uma marca no ícone da caixa de entrada, avisa que há uma mensagem que você ainda não abriu; um ponto em Gerenciar Servidores diz o mesmo sobre os administradores de um servidor. Ela some quando você abre a conversa, e fica guardada só neste dispositivo.',
        'Para remover uma mensagem só para você, toque na lixeira dela. Para limpar a conversa inteira, use a lixeira no topo. O outro lado mantém a cópia dele.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Você só pode escrever para quem é seu amigo naquele servidor: se a amizade acaba, a conversa sai da sua lista, e volta se vocês se tornarem amigos de novo. As mensagens precisam de conexão com o servidor; elas não ficam guardadas no dispositivo. O servidor limita por dia quantas mensagens você envia a outros usuários, conforme o seu plano, e quantas aos administradores. Os administradores veem qual conta escreveu a eles, mas um amigo nunca fica sabendo se você leu a mensagem dele.',
    },
    { type: 'seeAlso', pages: ['friends', 'account-limits', 'what-is-a-server'] },
  ],
};
export default page;
