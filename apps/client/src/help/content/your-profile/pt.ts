import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'your-profile',
  title: 'Seu perfil',
  summary: 'Escolha como sua conta aparece em cada servidor.',
  keywords: ['perfil', 'avatar', 'bio', 'tag'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O perfil pertence à sua conta em um servidor e inclui cor, ícone e biografia do avatar. Sua @tag é o identificador pelo qual outras pessoas encontram você.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você escolhe uma estrela dourada e escreve “revisora de fantasia” para que colaboradores reconheçam sua conta no servidor.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Servidores no menu principal.',
        'No servidor desejado, toque no ícone de perfil.',
        'Escolha Cor do avatar, Ícone do avatar e escreva a Bio, com até 200 caracteres.',
        'Salve. Para alterar sua @tag, toque nela na lista de servidores e confirme a edição.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Seu avatar e nome aparecem em amizades, colaboradores, comentários e favoritos públicos naquele servidor. O perfil não muda o usuário local do aplicativo.',
    },
    { type: 'seeAlso', pages: ['friends', 'collaborators', 'app-settings'] },
  ],
};
export default page;
