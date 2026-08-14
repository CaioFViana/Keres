import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'change-password',
  title: 'Trocando a senha',
  summary: 'Altere a senha da sua conta em um servidor cadastrado.',
  keywords: ['senha', 'conta', 'servidor'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Esta tela troca a senha da conta no servidor escolhido; não troca o nome local do aplicativo.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você quer substituir uma senha antiga por uma nova antes de usar a conta em outro aparelho.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Servidores no menu principal.',
        'No servidor desejado, toque no ícone de chave.',
        'Informe Senha atual, Nova senha e Confirmar nova senha.',
        'Salve. A nova senha precisa cumprir o tamanho mínimo informado pela tela.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A alteração vale para a conta naquele servidor. Outros aparelhos podem precisar entrar novamente com a nova senha; ela não altera histórias nem perfis.',
    },
    { type: 'seeAlso', pages: ['add-server', 'your-profile', 'troubleshooting'] },
  ],
};
export default page;
