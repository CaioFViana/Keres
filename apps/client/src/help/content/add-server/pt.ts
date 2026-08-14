import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'add-server',
  title: 'Cadastrando um servidor',
  summary: 'Conecte uma conta existente ou crie uma conta em um servidor Keres.',
  keywords: ['servidor', 'endereço', 'entrar', 'criar conta'],
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
        'Informe o Endereço do servidor, sem caminhos como /admin ou /swagger, seu nome de usuário e senha.',
        'Ao criar conta, confirme a senha. Dê um Nome ao servidor se quiser reconhecê-lo na lista e confirme.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O servidor aparece na lista com o estado de conexão, sua @tag e a data da última sincronização. Depois você pode enviar histórias para ele, editar o perfil e trocar a senha.',
    },
    { type: 'seeAlso', pages: ['what-is-a-server', 'your-profile', 'sync-basics'] },
  ],
};
export default page;
