import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'add-server',
  title: 'Cadastrando um servidor',
  summary: 'Conecte uma conta existente ou crie uma conta em um servidor Keres.',
  keywords: [
    'servidor',
    'endereço',
    'entrar',
    'criar conta',
    'esqueci minha senha',
    'código de recuperação',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Este formulário adiciona ao aplicativo a conta que você usa em um servidor Keres.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você recebe o endereço https://keres.exemplo.com. Com ele e sua conta, pode sincronizar a mesma história entre aparelhos.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'No menu principal, abra Servidores e toque em adicionar.',
        'Escolha Entrar para uma conta existente ou Criar conta para um cadastro novo.',
        'Informe o Endereço do servidor, sem caminhos como /api, /admin ou /swagger, seu nome de usuário e senha.',
        'Ao criar conta, confirme a senha e, se quiser, dê um Nome ao servidor para reconhecê-lo na lista.',
        'Confirme. Ao criar uma conta nova, a tela mostra em seguida uma lista de códigos de recuperação.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Salve esses códigos de recuperação em um lugar seguro antes de sair da tela. Eles aparecem só essa vez, e cada um permite voltar a entrar na sua conta caso você esqueça a senha.',
    },
    { type: 'heading', level: 3, text: 'Esqueceu sua senha?' },
    {
      type: 'paragraph',
      text: 'Se você já tem uma conta mas não lembra a senha, não precisa da senha antiga para voltar a acessá-la.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Isto é para entrar em um servidor pela primeira vez neste aparelho. Se o servidor já está na sua lista, use Trocando a senha em vez disso - não precisa removê-lo e adicioná-lo de novo.',
    },
    {
      type: 'steps',
      items: [
        'Na tela de entrar, toque em Esqueceu sua senha?.',
        'Informe seu nome de usuário, um dos códigos de recuperação que você salvou, e a nova senha que quer usar.',
        'Confirme. Você entra na conta na hora, já com a nova senha.',
      ],
    },
    {
      type: 'paragraph',
      text: 'Cada código de recuperação funciona só uma vez. Se acabarem, peça a quem administra o servidor para gerar novos.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O servidor aparece na lista com o estado de conexão, sua @tag e a data da última sincronização. Depois você pode enviar histórias para ele, editar o perfil, trocar a senha e recuperar o acesso mais tarde com um código de recuperação salvo, se precisar.',
    },
    {
      type: 'seeAlso',
      pages: ['what-is-a-server', 'your-profile', 'change-password', 'sync-basics'],
    },
  ],
};
export default page;
