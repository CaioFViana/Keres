/**
 * The app's own terms of service, shown at first install and readable any time from Settings.
 *
 * Versioned on purpose: the install records which version was accepted, and a bump means
 * asking again. These terms cover the software and the conduct expected in it; every server -
 * the official one included - has its own terms for accounts and hosting (see `keres-tos`).
 */
export const CLIENT_TERMS_VERSION = 1;
export const CLIENT_TERMS_UPDATED_AT = '2026-10-12';

export interface ClientTermsSection {
  heading: string;
  paragraphs: string[];
}

const en: ClientTermsSection[] = [
  {
    heading: '1. What Keres is',
    paragraphs: [
      'Keres is an offline-first writing app. What you make lives on your device; servers only enter the picture when you connect one for synchronization, collaboration, publications or plans.',
    ],
  },
  {
    heading: '2. Any server',
    paragraphs: [
      'The app works with any Keres server, ours or someone else. Each server has its own terms for accounts and hosting, presented before you create an account there. We answer only for our official server and never for third parties.',
    ],
  },
  {
    heading: '3. Acceptable conduct',
    paragraphs: [
      'Do not create or share sexually explicit content, spam, abuse, harassment, or anything illegal. Stories flagged adults-only (+18) hold mature themes; explicit sexual content is prohibited everywhere. Reports are reviewed and abusive accounts are blocked or removed.',
    ],
  },
  {
    heading: '4. Your data',
    paragraphs: [
      'Your work stays on your device until you send it somewhere. Deleting the app erases the local copy; deleting an account on a server follows that server deactivation and erasure rules.',
    ],
  },
  {
    heading: '5. Plans and payments',
    paragraphs: [
      'Paid plans extend what servers offer. Purchases made through the device store follow that store refund policy and the applicable law.',
    ],
  },
  {
    heading: '6. No warranty',
    paragraphs: [
      'The app is provided as is. We do our best to keep your work safe, including exports and backups you make, but keeping copies of what matters is your responsibility.',
    ],
  },
];

const pt: ClientTermsSection[] = [
  {
    heading: '1. O que é o Keres',
    paragraphs: [
      'Keres é um aplicativo de escrita que funciona offline primeiro. O que você cria mora no seu dispositivo; servidores só entram em cena quando você conecta um para sincronização, colaboração, publicações ou planos.',
    ],
  },
  {
    heading: '2. Qualquer servidor',
    paragraphs: [
      'O aplicativo funciona com qualquer servidor Keres, o nosso ou o de outra pessoa. Cada servidor tem seus próprios termos para contas e hospedagem, apresentados antes de você criar uma conta nele. Respondemos somente pelo nosso servidor oficial, nunca por terceiros.',
    ],
  },
  {
    heading: '3. Conduta aceitável',
    paragraphs: [
      'Não crie nem compartilhe conteúdo sexualmente explícito, spam, abuso, assédio ou qualquer coisa ilegal. Histórias marcadas como adultas (+18) tratam de temas maduros; conteúdo sexual explícito é proibido em todo lugar. Denúncias são avaliadas e contas abusivas são bloqueadas ou removidas.',
    ],
  },
  {
    heading: '4. Seus dados',
    paragraphs: [
      'Seu trabalho fica no seu dispositivo até você enviá-lo para algum lugar. Apagar o aplicativo apaga a cópia local; excluir uma conta num servidor segue as regras de desativação e apagamento daquele servidor.',
    ],
  },
  {
    heading: '5. Planos e pagamentos',
    paragraphs: [
      'Planos pagos ampliam o que os servidores oferecem. Compras feitas pela loja do dispositivo seguem a política de reembolso da loja e a lei aplicável.',
    ],
  },
  {
    heading: '6. Sem garantia',
    paragraphs: [
      'O aplicativo é fornecido como está. Fazemos o possível para manter seu trabalho a salvo, incluindo exportações e backups que você fizer, mas guardar cópias do que importa é sua responsabilidade.',
    ],
  },
];

export const CLIENT_TERMS: Record<'en' | 'pt', ClientTermsSection[]> = { en, pt };

/** The terms in the language the app is showing: Portuguese when it is, English otherwise. */
export function clientTermsFor(language: string | undefined): ClientTermsSection[] {
  return (language ?? 'en').split('-')[0] === 'pt' ? CLIENT_TERMS.pt : CLIENT_TERMS.en;
}
