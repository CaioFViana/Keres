/**
 * The official server's terms of service, served verbatim at `GET /api/keres-tos`.
 *
 * Versioned on purpose: clients record which version was accepted, and a bump means
 * asking again. Third-party operators replace this text with their own - the route
 * always serves *this* server's rules, whatever they are.
 */
export const SERVER_TERMS_VERSION = 1;
export const SERVER_TERMS_UPDATED_AT = '2026-10-12';

export interface ServerTermsSection {
  heading: string;
  paragraphs: string[];
}

const en: ServerTermsSection[] = [
  {
    heading: '1. What this server is',
    paragraphs: [
      'This server hosts Keres accounts, story synchronization, collaboration, publications and plans. The Keres app works offline and with any server; these terms cover this server only. Other servers have their own rules.',
    ],
  },
  {
    heading: '2. Accounts',
    paragraphs: [
      'Register with a username and password. You are responsible for keeping your password and recovery codes safe. Registration may be closed by the administrator at any time.',
    ],
  },
  {
    heading: '3. Acceptable conduct',
    paragraphs: [
      'Do not publish or share sexually explicit content, spam, abuse, harassment, or anything illegal. Stories flagged adults-only (+18) hold mature themes and are gated to age-verified adults; collaborators who are not verified are removed from them.',
      'Reports from other users are reviewed, and abusive accounts are blocked or removed.',
    ],
  },
  {
    heading: '4. Moderation',
    paragraphs: [
      'Administrators may inspect, hide or remove content and suspend accounts that break these terms. A removed or gated story is indistinguishable from an unpublished one to anyone without access.',
    ],
  },
  {
    heading: '5. Plans and payments',
    paragraphs: [
      'Paid plans extend storage, publishing and collaboration ceilings. Purchases made through the device store follow that store refund policy and the applicable law. Server-side charges are not refunded except as required by law.',
    ],
  },
  {
    heading: '6. Deleting your account',
    paragraphs: [
      'You may delete your account at any time from the server details screen. Deletion deactivates the account immediately and erases personal data within 30 days. Content you contributed to stories owned by others remains, attributed to a removed account. Financial records are kept as long as the law requires.',
    ],
  },
];

const pt: ServerTermsSection[] = [
  {
    heading: '1. O que é este servidor',
    paragraphs: [
      'Este servidor hospeda contas Keres, sincronização de histórias, colaboração, publicações e planos. O aplicativo Keres funciona offline e com qualquer servidor; estes termos cobrem somente este servidor. Outros servidores têm suas próprias regras.',
    ],
  },
  {
    heading: '2. Contas',
    paragraphs: [
      'Cadastre-se com nome de usuário e senha. Você é responsável por guardar sua senha e seus códigos de recuperação. O cadastro pode ser fechado pelo administrador a qualquer momento.',
    ],
  },
  {
    heading: '3. Conduta aceitável',
    paragraphs: [
      'Não publique nem compartilhe conteúdo sexualmente explícito, spam, abuso, assédio ou qualquer coisa ilegal. Histórias marcadas como adultas (+18) tratam de temas maduros e são restritas a adultos verificados; colaboradores não verificados são removidos delas.',
      'Denúncias de outros usuários são avaliadas, e contas abusivas são bloqueadas ou removidas.',
    ],
  },
  {
    heading: '4. Moderação',
    paragraphs: [
      'Administradores podem inspecionar, ocultar ou remover conteúdo e suspender contas que quebrem estes termos. Uma história removida ou restrita é indistinguível de uma não publicada para quem não tem acesso.',
    ],
  },
  {
    heading: '5. Planos e pagamentos',
    paragraphs: [
      'Planos pagos ampliam armazenamento, publicação e limites de colaboração. Compras feitas pela loja do dispositivo seguem a política de reembolso da loja e a lei aplicável. Cobranças feitas direto no servidor não são reembolsadas, exceto quando exigido por lei.',
    ],
  },
  {
    heading: '6. Excluir sua conta',
    paragraphs: [
      'Você pode excluir sua conta a qualquer momento na tela de detalhes do servidor. A exclusão desativa a conta de imediato e apaga os dados pessoais em até 30 dias. Conteúdo que você contribuiu em histórias de outros permanece, atribuído a uma conta removida. Registros financeiros são guardados pelo tempo exigido por lei.',
    ],
  },
];

export const SERVER_TERMS: Record<'en' | 'pt', ServerTermsSection[]> = { en, pt };
