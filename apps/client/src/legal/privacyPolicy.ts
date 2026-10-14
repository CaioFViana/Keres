/**
 * The app's own privacy policy, shown at first install and readable any time from Settings.
 *
 * Versioned on purpose: the install records which version was shown, and a bump means
 * showing it again. This policy covers the software; every server has its own policy for
 * accounts and hosting (served at `keres-privacy`, read before creating an account there).
 */
export const CLIENT_PRIVACY_VERSION = 1;
export const CLIENT_PRIVACY_UPDATED_AT = '2026-10-14';

export interface ClientPrivacySection {
  heading: string;
  paragraphs: string[];
}

const en: ClientPrivacySection[] = [
  {
    heading: '1. Offline first',
    paragraphs: [
      'Keres is a writing app that works offline. What you make lives on your device; servers only enter the picture when you connect one for synchronization, collaboration, publications or plans.',
    ],
  },
  {
    heading: '2. What stays on your device',
    paragraphs: [
      'Your stories, sketches, songs, settings and drafts stay local until you send them somewhere. Deleting the app erases the local copy. Session tokens are kept in the device secure storage and can be revoked per server.',
    ],
  },
  {
    heading: '3. What leaves the device',
    paragraphs: [
      'Only what you choose, and only to servers you connect: the account you create there, the content you synchronize or publish, and, on servers that sell plans, purchases, which are processed by the device store or the payment provider - card data never passes through the app servers from us. Age verification documents and photos leave the device only when you ask for an account on a server that requires them: see section 7.',
    ],
  },
  {
    heading: '4. What the app never collects',
    paragraphs: [
      'No analytics, no advertising identifiers, no location, no contacts, no crash telemetry, no identity document, no tracking across apps. The app requests no camera, microphone, location or contacts permission.',
    ],
  },
  {
    heading: '5. Your rights',
    paragraphs: [
      'Your work is already yours and portable: stories export to open formats from the app. Data held by a server follows that server policy, including deleting the account and exporting your data. Questions: use the contact form on keres.me.',
    ],
  },
  {
    heading: '6. Security on the device',
    paragraphs: [
      'Tokens live in the device secure storage. The story database relies on the device protection: use a screen lock and system encryption, and keep backups of work that matters.',
    ],
  },
  {
    heading: '7. Age verification',
    paragraphs: [
      "The app collects no identity document and holds no age data of its own. When you ask for an account on a server that requires verification, the app opens that server's verification page, and your document and live photo go straight from the device to that server's verification service.",
      'No copy stays on the device or on Keres servers. From the moment they are sent, the processing is governed by the privacy policy of that server, not by this one.',
      'A server may instead leave verification to an administrator, who marks the account as verified by other means, as the official server does. Then nothing is sent from the app: no document, no photo, no date of birth. A verified account can also choose, in its profile, whether it sees adults-only (+18) content in public listings; that choice is kept on the server of that account.',
    ],
  },
  {
    heading: '8. Minors',
    paragraphs: [
      'Writing offline has no age gate. Minors are not allowed on servers by default: creating an account on a server requires being 18 or older, and a server may also require proof of age, as section 7 describes.',
    ],
  },
  {
    heading: '9. Changes to this policy',
    paragraphs: [
      'Material changes are announced in the app and shown again before they apply. If you disagree, stop using Keres and delete the app.',
    ],
  },
];

const pt: ClientPrivacySection[] = [
  {
    heading: '1. Offline primeiro',
    paragraphs: [
      'Keres é um aplicativo de escrita que funciona offline. O que você cria mora no seu dispositivo; servidores só entram em cena quando você conecta um para sincronização, colaboração, publicações ou planos.',
    ],
  },
  {
    heading: '2. O que fica no seu dispositivo',
    paragraphs: [
      'Suas histórias, esboços, músicas, ajustes e rascunhos ficam locais até você enviá-los para algum lugar. Apagar o aplicativo apaga a cópia local. Tokens de sessão ficam no armazenamento seguro do dispositivo e podem ser revogados por servidor.',
    ],
  },
  {
    heading: '3. O que sai do dispositivo',
    paragraphs: [
      'Somente o que você escolher, e somente para servidores que você conectar: a conta que você criar lá, o conteúdo que você sincronizar ou publicar, e, nos servidores que vendem planos, compras, processadas pela loja do dispositivo ou pelo provedor de pagamento — dados de cartão nunca passam pelos nossos servidores a partir do aplicativo. Documentos e fotos para verificação de idade saem do dispositivo somente quando você pede uma conta num servidor que os exige: veja a seção 7.',
    ],
  },
  {
    heading: '4. O que o aplicativo nunca coleta',
    paragraphs: [
      'Sem analytics, sem identificadores de publicidade, sem localização, sem contatos, sem telemetria de falhas, sem documento de identidade, sem rastreamento entre aplicativos. O aplicativo não pede permissão de câmera, microfone, localização ou contatos.',
    ],
  },
  {
    heading: '5. Seus direitos',
    paragraphs: [
      'Seu trabalho já é seu e portátil: histórias exportam para formatos abertos no aplicativo. Dados guardados por um servidor seguem a política daquele servidor, incluindo excluir a conta e exportar seus dados. Dúvidas: use o formulário de contato em keres.me.',
    ],
  },
  {
    heading: '6. Segurança no dispositivo',
    paragraphs: [
      'Tokens ficam no armazenamento seguro do dispositivo. O banco de histórias conta com a proteção do aparelho: use bloqueio de tela e criptografia do sistema, e mantenha backups do trabalho que importa.',
    ],
  },
  {
    heading: '7. Verificação de idade',
    paragraphs: [
      'O aplicativo não coleta nenhum documento de identidade e não guarda dado de idade próprio. Quando você pede uma conta num servidor que exige verificação, o aplicativo abre a página de verificação daquele servidor, e seu documento e sua foto ao vivo saem do dispositivo diretamente para o serviço de verificação daquele servidor.',
      'Nenhuma cópia fica no dispositivo nem nos servidores da Keres. A partir do envio, o tratamento é regido pela política de privacidade daquele servidor, e não por esta.',
      'Um servidor pode, em vez disso, deixar a verificação a cargo de um administrador, que marca a conta como verificada por outros meios, como faz o servidor oficial. Nesse caso nada sai do aplicativo: nem documento, nem foto, nem data de nascimento. Uma conta verificada também pode escolher, no perfil, se vê conteúdo adulto (+18) nas listagens públicas; essa escolha fica guardada no servidor daquela conta.',
    ],
  },
  {
    heading: '8. Menores',
    paragraphs: [
      'Escrever offline não tem verificação de idade. Menores não são permitidos nos servidores por padrão: criar uma conta num servidor exige 18 anos ou mais, e o servidor pode também exigir prova de idade, como descreve a seção 7.',
    ],
  },
  {
    heading: '9. Alterações desta política',
    paragraphs: [
      'Mudanças relevantes são avisadas no aplicativo e mostradas de novo antes de valerem. Se discordar, pare de usar o Keres e apague o aplicativo.',
    ],
  },
];

export const CLIENT_PRIVACY: Record<'en' | 'pt', ClientPrivacySection[]> = { en, pt };

/** The policy in the language the app is showing: Portuguese when it is, English otherwise. */
export function clientPrivacyFor(language: string | undefined): ClientPrivacySection[] {
  return (language ?? 'en').split('-')[0] === 'pt' ? CLIENT_PRIVACY.pt : CLIENT_PRIVACY.en;
}
