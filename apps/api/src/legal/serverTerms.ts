import { createHash } from 'node:crypto';
import type { AgeVerificationMode } from '@keres/shared';

/**
 * The server's terms of service, served at `GET /api/keres-tos`.
 *
 * Versioned on purpose: clients record which version was accepted, and a bump means
 * asking again. Third-party operators replace this text with their own - the route
 * always serves *this* server's rules, whatever they are.
 *
 * The text depends on the age-verification mode (`AGE_VERIFICATION_MODE`, see
 * `docs/compliance/age_verification.md`): a `required` server verifies its accounts through a verification
 * service; a `manual` one says plainly that it runs no automated check, that minors are not
 * allowed by default, that an administrator marks verified accounts by hand, and that it takes no
 * payments (plans are granted by its team). Both share the version number, so the digest (the hash
 * recorded with each acceptance) is what tells the two texts apart.
 * The privacy policy (`privacyPolicy.ts`, served at `keres-privacy`) details data handling.
 */
export const SERVER_TERMS_VERSION = 1;
export const SERVER_TERMS_UPDATED_AT = '2026-10-14';

export interface ServerTermsSection {
  heading: string;
  paragraphs: string[];
}

/** A section whose wording depends on the mode. Every other section reads the same in both. */
interface ModeSection {
  required: ServerTermsSection;
  manual: ServerTermsSection;
}

type Section = ServerTermsSection | ModeSection;

interface ServerTermsText {
  what: Section;
  accounts: Section;
  conduct: Section;
  moderation: Section;
  plans: Section;
  deleting: Section;
  changes: Section;
  age: Section;
  refunds: Section;
  reports: Section;
  operator: Section;
}

/**
 * The hash of the text a server in `mode` shows. A server that is not `required` must pass its
 * mode: the default is the `required` text, so a `manual` server's acceptances would be
 * recorded against the wrong hash.
 */
export function serverTermsDigest(mode: AgeVerificationMode = 'required'): string {
  return createHash('sha256')
    .update(JSON.stringify(serverTermsFor(mode)), 'utf8')
    .digest('hex');
}

const en: ServerTermsText = {
  what: {
    heading: '1. What this server is',
    paragraphs: [
      'This server hosts Keres accounts, story synchronization, collaboration, publications and plans. The Keres app works offline and with any server; these terms cover this server only. Other servers have their own rules.',
    ],
  },
  accounts: {
    heading: '2. Accounts',
    paragraphs: [
      'Register with a username and password. You are responsible for keeping your password and recovery codes safe. Registration may be closed by the administrator at any time.',
    ],
  },
  conduct: {
    required: {
      heading: '3. Acceptable conduct',
      paragraphs: [
        'Do not publish or share sexually explicit content, spam, abuse, harassment, or anything illegal. Adults-only (+18) stories are accepted only if the settings of this server allow them (the server screen in the app says so); where they are allowed, they are available only to accounts verified as adults (section 8). Where they are not allowed, stories sent or published with the +18 flag are refused.',
        'Reports from other users are reviewed, and abusive accounts are blocked or removed.',
      ],
    },
    manual: {
      heading: '3. Acceptable conduct',
      paragraphs: [
        'Do not publish or share sexually explicit content, spam, abuse, harassment, or anything illegal. Adults-only (+18) stories are accepted on this server only if its settings allow them (the server screen in the app says so); where they are allowed, they are open only to accounts verified as adults (section 8). Where they are not allowed, stories sent or published with the +18 flag are refused. Marking a story +18 on your own device is always possible: only sending it to this server is refused.',
        'Reports from other users are reviewed, and abusive accounts are blocked or removed.',
      ],
    },
  },
  moderation: {
    heading: '4. Moderation',
    paragraphs: [
      'Administrators may inspect, hide or remove content and suspend accounts that break these terms. A removed or gated story is indistinguishable from an unpublished one to anyone without access.',
    ],
  },
  plans: {
    required: {
      heading: '5. Plans and payments',
      paragraphs: [
        'Paid plans extend storage, publishing and collaboration ceilings. Purchases made through the device store follow that store refund policy and the applicable law. Server-side charges are not refunded except as required by law.',
      ],
    },
    manual: {
      heading: '5. Plans',
      paragraphs: [
        'This server takes no payments and sells nothing. The limits on storage, publishing and collaboration that apply to your account come from the plan the server team assigns to it, and the team may grant plans to accounts at its discretion. The plan that applies to you, and its limits, are shown in the server details screen.',
      ],
    },
  },
  deleting: {
    required: {
      heading: '6. Deleting your account',
      paragraphs: [
        'You may delete your account at any time from the server details screen. Deletion deactivates the account immediately and erases personal data within 30 days. Content you contributed to stories owned by others remains, attributed to a removed account. Financial records are kept as long as the law requires.',
      ],
    },
    manual: {
      heading: '6. Deleting your account',
      paragraphs: [
        'You may delete your account at any time from the server details screen. Deletion deactivates the account immediately and erases personal data within 30 days. Content you contributed to stories owned by others remains, attributed to a removed account.',
      ],
    },
  },
  changes: {
    required: {
      heading: '7. Changes to these terms',
      paragraphs: [
        'We may update these terms as the service and the law change. Material changes are announced in advance, in the app and on the site, and asked again before they apply to you. If you disagree, cancel your plan and stop using the server.',
      ],
    },
    manual: {
      heading: '7. Changes to these terms',
      paragraphs: [
        'We may update these terms as the service and the law change. Material changes are announced in advance, in the app and on the site, and asked again before they apply to you. If you disagree, delete your account and stop using the server.',
      ],
    },
  },
  age: {
    required: {
      heading: '8. Age and verification',
      paragraphs: [
        "Accounts are for people 18 or older, and on this server they are verified before they become active. The check is run by the verification service of this server, operated by this server's operator (on the official server, the Keres team). You send an identity document and a live photo to that service only, never to another server, and a human reviewer there decides.",
        'Registration stays pending until that decision. A pending account can only check its verification and log out, and no other user can find it. The account becomes active only after the verification is approved.',
        'A document that belongs to someone else verifies nobody: the live photo must show the holder of the document, and the reviewer checks that the holder is of age.',
        'A refusal is never a dead end, with one exception: a refusal because the holder is under 18 has no retry and closes the account at once. Any other refusal lets you send again, a limited number of times set by this server, and the new sending is looked at by a different reviewer than the one who refused the previous one. Running out of attempts closes the account too.',
        "An account found to belong to a minor is closed. Where this server allows adults-only (+18) stories, they are open only to verified accounts: if an administrator revokes the verification, or the account is found to be a minor's, the account is removed from every adults-only story at once and loses access to them.",
        "After you delete your account, the proof of its verification is kept pseudonymised for the prescription period defined in the operator's governance record, as the privacy policy explains.",
      ],
    },
    manual: {
      heading: '8. Age and verification',
      paragraphs: [
        'Minors are not allowed on this server by default. Accounts are for people 18 or older, and every account starts unverified.',
        'This server runs no automated age check and never receives an identity document, a photo or a date of birth. When an account is verified, it happens by other means, outside the app and outside this server, and an administrator then marks the account as verified by hand. An administrator may remove that mark at any time.',
        "Where this server allows adults-only (+18) stories, they are open only to verified accounts: if the verification is removed, or the account is found to be a minor's, the account is removed from every adults-only story at once and loses access to them. Seeing adults-only stories in public listings is also your choice: a verified account can turn it on or off at any time in its profile in the app.",
        'An account found to belong to a minor is closed.',
      ],
    },
  },
  refunds: {
    required: {
      heading: '9. Refunds',
      paragraphs: [
        'Purchases made through the device store follow that store refund policy, plus your statutory rights. Charges made directly by the server can be cancelled within 7 days of contracting for a full, updated refund, as the Consumer Defense Code requires. After that, server-side charges are not refunded except as required by law.',
      ],
    },
    manual: {
      heading: '9. Refunds',
      paragraphs: [
        'This server takes no payments, so it charges nothing and has nothing to refund.',
      ],
    },
  },
  reports: {
    heading: '10. Reports',
    paragraphs: [
      'Anything can be reported: a story, a user, a message or a publication, with a report type (non-consensual intimate content, copyright, spam or abuse, illegal, or other). Content showing nudity or private sexual acts without the participant authorization is removed diligently after their notice. Copyright reports are reviewed under our own moderation policy - Brazilian law provides no statutory notice-and-takedown for copyright - and the author can appeal a removal. Other reports are reviewed, and abusive accounts are blocked or removed.',
    ],
  },
  operator: {
    heading: '11. Operator, privacy and law',
    paragraphs: [
      "How your data is handled is in the privacy policy, readable before registration and in the server details. Questions about privacy, your data or these terms: use the contact form this server's operator publishes (on the official server, the contact form on keres.me). These terms follow Brazilian law.",
    ],
  },
};

const pt: ServerTermsText = {
  what: {
    heading: '1. O que é este servidor',
    paragraphs: [
      'Este servidor hospeda contas Keres, sincronização de histórias, colaboração, publicações e planos. O aplicativo Keres funciona offline e com qualquer servidor; estes termos cobrem somente este servidor. Outros servidores têm suas próprias regras.',
    ],
  },
  accounts: {
    heading: '2. Contas',
    paragraphs: [
      'Cadastre-se com nome de usuário e senha. Você é responsável por guardar sua senha e seus códigos de recuperação. O cadastro pode ser fechado pelo administrador a qualquer momento.',
    ],
  },
  conduct: {
    required: {
      heading: '3. Conduta aceitável',
      paragraphs: [
        'Não publique nem compartilhe conteúdo sexualmente explícito, spam, abuso, assédio ou qualquer coisa ilegal. Histórias de conteúdo adulto (+18) só são aceitas se as configurações deste servidor permitirem (a tela do servidor no app informa); onde são permitidas, ficam disponíveis somente para contas verificadas como de adultos (seção 8). Onde não são permitidas, histórias enviadas ou publicadas com a flag +18 são recusadas.',
        'Denúncias de outros usuários são avaliadas, e contas abusivas são bloqueadas ou removidas.',
      ],
    },
    manual: {
      heading: '3. Conduta aceitável',
      paragraphs: [
        'Não publique nem compartilhe conteúdo sexualmente explícito, spam, abuso, assédio ou qualquer coisa ilegal. Histórias de conteúdo adulto (+18) só são aceitas neste servidor se as configurações dele permitirem (a tela do servidor no app informa); onde são permitidas, ficam abertas somente a contas verificadas como de adultos (seção 8). Onde não são permitidas, histórias enviadas ou publicadas com a flag +18 são recusadas. Marcar uma história como +18 no seu próprio aparelho é sempre possível: só enviá-la a este servidor é recusado.',
        'Denúncias de outros usuários são avaliadas, e contas abusivas são bloqueadas ou removidas.',
      ],
    },
  },
  moderation: {
    heading: '4. Moderação',
    paragraphs: [
      'Administradores podem inspecionar, ocultar ou remover conteúdo e suspender contas que quebrem estes termos. Uma história removida ou restrita é indistinguível de uma não publicada para quem não tem acesso.',
    ],
  },
  plans: {
    required: {
      heading: '5. Planos e pagamentos',
      paragraphs: [
        'Planos pagos ampliam armazenamento, publicação e limites de colaboração. Compras feitas pela loja do dispositivo seguem a política de reembolso da loja e a lei aplicável. Cobranças feitas direto no servidor não são reembolsadas, exceto quando exigido por lei.',
      ],
    },
    manual: {
      heading: '5. Planos',
      paragraphs: [
        'Este servidor não recebe pagamentos e não vende nada. Os limites de armazenamento, publicação e colaboração da sua conta vêm do plano que a equipe do servidor atribui a ela, e a equipe pode conceder planos a contas a seu critério. O plano que vale para você, e seus limites, aparecem na tela de detalhes do servidor.',
      ],
    },
  },
  deleting: {
    required: {
      heading: '6. Excluir sua conta',
      paragraphs: [
        'Você pode excluir sua conta a qualquer momento na tela de detalhes do servidor. A exclusão desativa a conta de imediato e apaga os dados pessoais em até 30 dias. Conteúdo que você contribuiu em histórias de outros permanece, atribuído a uma conta removida. Registros financeiros são guardados pelo tempo exigido por lei.',
      ],
    },
    manual: {
      heading: '6. Excluir sua conta',
      paragraphs: [
        'Você pode excluir sua conta a qualquer momento na tela de detalhes do servidor. A exclusão desativa a conta de imediato e apaga os dados pessoais em até 30 dias. Conteúdo que você contribuiu em histórias de outros permanece, atribuído a uma conta removida.',
      ],
    },
  },
  changes: {
    required: {
      heading: '7. Alterações destes termos',
      paragraphs: [
        'Podemos atualizar estes termos conforme o serviço e a lei mudam. Mudanças relevantes são avisadas com antecedência, no aplicativo e no site, e pedidas de novo antes de valerem para você. Se discordar, cancele seu plano e pare de usar o servidor.',
      ],
    },
    manual: {
      heading: '7. Alterações destes termos',
      paragraphs: [
        'Podemos atualizar estes termos conforme o serviço e a lei mudam. Mudanças relevantes são avisadas com antecedência, no aplicativo e no site, e pedidas de novo antes de valerem para você. Se discordar, exclua sua conta e pare de usar o servidor.',
      ],
    },
  },
  age: {
    required: {
      heading: '8. Idade e verificação',
      paragraphs: [
        'Contas são para pessoas de 18 anos ou mais e, neste servidor, são verificadas antes de ficarem ativas. A conferência é feita pelo serviço de verificação deste servidor, operado pelo operador deste servidor (no servidor oficial, a equipe Keres). Você envia um documento de identidade e uma foto ao vivo somente a esse serviço, nunca a outro servidor, e um revisor humano decide.',
        'O cadastro fica pendente até essa decisão. Uma conta pendente só pode consultar sua verificação e sair, e nenhum outro usuário a encontra. A conta só fica ativa depois que a verificação é aprovada.',
        'Documento de outra pessoa não verifica ninguém: a foto ao vivo precisa mostrar o titular do documento, e o revisor confere se o titular tem a idade mínima.',
        'Recusa nunca é um beco sem saída, com uma exceção: a recusa por ser menor de 18 anos não tem nova tentativa e encerra a conta de imediato. Qualquer outra recusa permite enviar de novo, um número limitado de vezes definido por este servidor, e o novo envio é conferido por um revisor diferente daquele que recusou o anterior. Esgotar as tentativas também encerra a conta.',
        'Conta descoberta como sendo de menor é encerrada. Onde este servidor permite histórias +18, elas são abertas somente a contas verificadas: se um administrador revogar a verificação, ou se a conta for descoberta como sendo de menor, ela sai de todas as histórias +18 de imediato e perde o acesso a elas.',
        'Depois que você excluir sua conta, a prova da verificação dela fica guardada de forma pseudonimizada pelo prazo prescricional definido no registro de governança do operador, como explica a política de privacidade.',
      ],
    },
    manual: {
      heading: '8. Idade e verificação',
      paragraphs: [
        'Menores não são permitidos neste servidor por padrão. Contas são para pessoas de 18 anos ou mais, e toda conta começa não verificada.',
        'Este servidor não faz nenhuma checagem automática de idade e nunca recebe documento de identidade, foto nem data de nascimento. Quando uma conta é verificada, isso acontece por outros meios, fora do aplicativo e fora deste servidor, e um administrador então marca a conta como verificada à mão. Um administrador pode retirar essa marca a qualquer momento.',
        'Onde este servidor permite histórias +18, elas são abertas somente a contas verificadas: se a verificação for retirada, ou se a conta for descoberta como sendo de menor, ela sai de todas as histórias +18 de imediato e perde o acesso a elas. Ver histórias +18 nas listagens públicas também é uma escolha sua: uma conta verificada pode ligar ou desligar isso a qualquer momento no perfil dentro do aplicativo.',
        'Conta descoberta como sendo de menor é encerrada.',
      ],
    },
  },
  refunds: {
    required: {
      heading: '9. Reembolsos',
      paragraphs: [
        'Compras feitas pela loja do dispositivo seguem a política de reembolso da loja, além dos seus direitos legais. Cobranças feitas diretamente pelo servidor podem ser canceladas em até 7 dias da contratação com reembolso integral e atualizado, como exige o Código de Defesa do Consumidor. Depois disso, cobranças feitas direto no servidor não são reembolsadas, exceto quando exigido por lei.',
      ],
    },
    manual: {
      heading: '9. Reembolsos',
      paragraphs: [
        'Este servidor não recebe pagamentos, então não cobra nada e não há o que reembolsar.',
      ],
    },
  },
  reports: {
    heading: '10. Denúncias',
    paragraphs: [
      'Qualquer coisa pode ser denunciada: uma história, um usuário, uma mensagem ou uma publicação, com um tipo de denúncia (conteúdo íntimo não consentido, direitos autorais, spam ou abuso, ilegal, ou outro). Conteúdo com nudez ou atos sexuais privados sem autorização do participante é removido diligentemente após o aviso dele. Denúncias de direitos autorais são avaliadas pela nossa própria política de moderação — a lei brasileira não prevê remoção por notificação para direitos autorais — e o autor pode recorrer da remoção. Outras denúncias são avaliadas, e contas abusivas são bloqueadas ou removidas.',
    ],
  },
  operator: {
    heading: '11. Operador, privacidade e lei',
    paragraphs: [
      'Como seus dados são tratados está na política de privacidade, legível antes do cadastro e nos detalhes do servidor. Dúvidas sobre privacidade, seus dados ou estes termos: use o formulário de contato que o operador deste servidor publica (no servidor oficial, o formulário de contato em keres.me). Estes termos seguem a lei brasileira.',
    ],
  },
};

function pick(section: Section, mode: AgeVerificationMode): ServerTermsSection {
  return 'heading' in section ? section : section[mode];
}

/** The sections in document order, for one mode. Both languages keep the same order and count. */
function sectionsOf(text: ServerTermsText, mode: AgeVerificationMode): ServerTermsSection[] {
  return [
    text.what,
    text.accounts,
    text.conduct,
    text.moderation,
    text.plans,
    text.deleting,
    text.changes,
    text.age,
    text.refunds,
    text.reports,
    text.operator,
  ].map((section) => pick(section, mode));
}

/** The terms a server running in `mode` serves, in both languages. */
export function serverTermsFor(
  mode: AgeVerificationMode,
): Record<'en' | 'pt', ServerTermsSection[]> {
  return { en: sectionsOf(en, mode), pt: sectionsOf(pt, mode) };
}

/**
 * The `required` text, kept under its old name because `api.ts` still serves it. Wire the route to
 * `serverTermsFor(mode)` and this constant can go.
 */
export const SERVER_TERMS = serverTermsFor('required');
