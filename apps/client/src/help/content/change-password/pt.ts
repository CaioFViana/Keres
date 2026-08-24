import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'change-password',
  title: 'Trocando a senha',
  summary:
    'Altere a senha da sua conta em um servidor cadastrado, gere novos códigos de recuperação, ou recupere o acesso com um código.',
  keywords: [
    'senha',
    'conta',
    'servidor',
    'código de recuperação',
    'regenerar',
    'esqueci minha senha',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Esta tela troca a senha da conta no servidor escolhido, e também pode substituir seus códigos de recuperação; não troca o nome local do aplicativo.',
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
    { type: 'heading', level: 3, text: 'Não lembra sua senha atual?' },
    {
      type: 'paragraph',
      text: 'Você ainda consegue trocar a senha por aqui mesmo, usando um código de recuperação no lugar da senha atual.',
    },
    {
      type: 'steps',
      items: [
        'Nesta tela, toque em Esqueceu sua senha atual?.',
        'Informe um dos códigos de recuperação que você salvou e a nova senha que quer usar.',
        'Confirme. Você continua com a mesma conta, agora com a nova senha.',
      ],
    },
    { type: 'heading', level: 3, text: 'Gerando novos códigos de recuperação' },
    {
      type: 'paragraph',
      text: 'Abaixo do formulário de senha, esta tela também permite substituir seus códigos de recuperação - útil se você perdeu os que salvou ao criar a conta.',
    },
    {
      type: 'steps',
      items: [
        'Informe Senha atual (o mesmo campo usado acima).',
        'Toque em Gerar novos códigos de recuperação e confirme.',
        'Salve os novos códigos mostrados - como na criação da conta, eles aparecem só essa vez.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Gerar novos códigos substitui todos os anteriores. Qualquer código salvo antes deixa de funcionar, então só faça isso se ainda souber a senha atual e quiser um novo conjunto.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A troca de senha vale para a conta naquele servidor, tenha você usado a senha atual ou um código de recuperação - o servidor continua cadastrado aqui de qualquer forma. Gerar novos códigos substitui quais podem ser usados depois para recuperar a conta. Outros aparelhos podem precisar entrar novamente com a nova senha; nada disso altera histórias nem perfis.',
    },
    { type: 'seeAlso', pages: ['add-server', 'your-profile', 'troubleshooting'] },
  ],
};
export default page;
