/**
 * The app's own terms of service, shown at first install and readable any time from Settings.
 *
 * Versioned on purpose: the install records which version was accepted, and a bump means
 * asking again. These terms cover the software and the conduct expected in it; every server -
 * the official one included - has its own terms for accounts and hosting (see `keres-tos`).
 * The privacy policy (`privacyPolicy.ts`) details how data is handled.
 */
export const CLIENT_TERMS_VERSION = 3;
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
      'What you write for yourself stays yours: these conduct rules bind what you share, send or publish through a server. Do not share or publish sexually explicit content involving others without their consent, spam, abuse, harassment, or anything illegal. Stories flagged adults-only (+18) hold mature themes; servers gate them to verified adults and may remove collaborators who are not verified. Reports are reviewed and abusive accounts are blocked or removed.',
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
      'The app is provided as is. We do our best to keep your work safe, including exports and backups you make, but keeping copies of what matters is your responsibility. Nothing here limits rights the law guarantees you, including consumer remedies for defects in paid plans.',
    ],
  },
  {
    heading: '7. Changes to these terms',
    paragraphs: [
      'We may update these terms as the app and the law change. Material changes are announced in the app and asked again before they apply to you: updating the app presents the new terms for agreement. If you disagree, stop using Keres and delete the app.',
    ],
  },
  {
    heading: '8. Age',
    paragraphs: [
      "The app does not verify your age and keeps no identity document. Writing offline needs no age gate. Creating an account on a server requires being 18 or older, and that server may require its own age verification before the account is activated: the document and photo go straight to that server's verification service, never to the app or to us. Each server answers for its own verification and its own rules, and a server without verification offers no adults-only (+18) area.",
    ],
  },
  {
    heading: '9. Privacy and contact',
    paragraphs: [
      'How your data is handled is in the privacy policy, readable in App Settings. Questions about privacy or these terms: privacy@keres.me. These terms follow Brazilian law.',
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
      'O que você escreve para si mesmo continua seu: estas regras de conduta valem para o que você compartilha, envia ou publica por um servidor. Não compartilhe nem publique conteúdo sexualmente explícito envolvendo terceiros sem o consentimento deles, spam, abuso, assédio ou qualquer coisa ilegal. Histórias marcadas como adultas (+18) tratam de temas maduros; servidores as restringem a adultos verificados e podem remover colaboradores não verificados. Denúncias são avaliadas e contas abusivas são bloqueadas ou removidas.',
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
      'O aplicativo é fornecido como está. Fazemos o possível para manter seu trabalho a salvo, incluindo exportações e backups que você fizer, mas guardar cópias do que importa é sua responsabilidade. Nada aqui limita direitos que a lei garante a você, incluindo reparação por defeitos em planos pagos.',
    ],
  },
  {
    heading: '7. Alterações destes termos',
    paragraphs: [
      'Podemos atualizar estes termos conforme o aplicativo e a lei mudam. Mudanças relevantes são avisadas no aplicativo e pedidas de novo antes de valerem para você: atualizar o aplicativo apresenta os novos termos para concordância. Se discordar, pare de usar o Keres e apague o aplicativo.',
    ],
  },
  {
    heading: '8. Idade',
    paragraphs: [
      'O aplicativo não verifica sua idade e não guarda nenhum documento de identidade. Escrever offline não tem barreira de idade. Criar uma conta num servidor exige 18 anos ou mais, e esse servidor pode exigir a própria verificação de idade antes de ativar a conta: o documento e a foto vão direto ao serviço de verificação daquele servidor, nunca ao aplicativo nem a nós. Cada servidor responde pela sua verificação e pelas suas regras, e um servidor sem verificação não oferece área adulta (+18).',
    ],
  },
  {
    heading: '9. Privacidade e contato',
    paragraphs: [
      'Como seus dados são tratados está na política de privacidade, legível nos Ajustes do aplicativo. Dúvidas sobre privacidade ou estes termos: privacy@keres.me. Estes termos seguem a lei brasileira.',
    ],
  },
];

export const CLIENT_TERMS: Record<'en' | 'pt', ClientTermsSection[]> = { en, pt };

/** The terms in the language the app is showing: Portuguese when it is, English otherwise. */
export function clientTermsFor(language: string | undefined): ClientTermsSection[] {
  return (language ?? 'en').split('-')[0] === 'pt' ? CLIENT_TERMS.pt : CLIENT_TERMS.en;
}
