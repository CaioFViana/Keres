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
 * `docs/age_verification.md`): a `required` server verifies its accounts, a `disabled` one says
 * plainly that it verifies nobody and has no adults-only area. Both share the version number, so
 * the digest (the hash recorded with each acceptance) is what tells the two texts apart.
 * The privacy policy (`privacyPolicy.ts`, served at `keres-privacy`) details data handling.
 */
export const SERVER_TERMS_VERSION = 3;
export const SERVER_TERMS_UPDATED_AT = '2026-10-12';

export interface ServerTermsSection {
  heading: string;
  paragraphs: string[];
}

/** A section whose wording depends on the mode. Every other section reads the same in both. */
interface ModeSection {
  required: ServerTermsSection;
  disabled: ServerTermsSection;
}

interface ServerTermsText {
  what: ServerTermsSection;
  accounts: ServerTermsSection;
  conduct: ModeSection;
  moderation: ServerTermsSection;
  plans: ServerTermsSection;
  deleting: ServerTermsSection;
  changes: ServerTermsSection;
  age: ModeSection;
  refunds: ServerTermsSection;
  reports: ServerTermsSection;
  operator: ServerTermsSection;
}

/**
 * The hash of the text a server in `mode` shows. A server that is not `required` must pass its
 * mode: the default is the `required` text, so a `disabled` server's acceptances would be
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
    disabled: {
      heading: '3. Acceptable conduct',
      paragraphs: [
        'Do not publish or share sexually explicit content, spam, abuse, harassment, or anything illegal. This server does not accept adults-only (+18) content: stories sent or published with the +18 flag are refused. Other servers decide for themselves in their own terms.',
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
    heading: '5. Plans and payments',
    paragraphs: [
      'Paid plans extend storage, publishing and collaboration ceilings. Purchases made through the device store follow that store refund policy and the applicable law. Server-side charges are not refunded except as required by law.',
    ],
  },
  deleting: {
    heading: '6. Deleting your account',
    paragraphs: [
      'You may delete your account at any time from the server details screen. Deletion deactivates the account immediately and erases personal data within 30 days. Content you contributed to stories owned by others remains, attributed to a removed account. Financial records are kept as long as the law requires.',
    ],
  },
  changes: {
    heading: '7. Changes to these terms',
    paragraphs: [
      'We may update these terms as the service and the law change. Material changes are announced in advance, in the app and on the site, and asked again before they apply to you. If you disagree, cancel your plan and stop using the server.',
    ],
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
    disabled: {
      heading: '8. Age',
      paragraphs: [
        'Accounts are meant for people 18 or older. No age verification on this server: no adults-only area exists and no account is verified. Accounts are active as soon as they are created.',
        'Other servers that allow mature themes say so in their own terms and verify age themselves.',
      ],
    },
  },
  refunds: {
    heading: '9. Refunds',
    paragraphs: [
      'Purchases made through the device store follow that store refund policy, plus your statutory rights. Charges made directly by the server can be cancelled within 7 days of contracting for a full, updated refund, as the Consumer Defense Code requires. After that, server-side charges are not refunded except as required by law.',
    ],
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
      'How your data is handled is in the privacy policy, readable before registration and in the server details. Operator: [legal name, CNPJ and address - to be published before release]. Questions about privacy, your data or these terms: privacy@keres.me. These terms follow Brazilian law.',
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
    disabled: {
      heading: '3. Conduta aceitável',
      paragraphs: [
        'Não publique nem compartilhe conteúdo sexualmente explícito, spam, abuso, assédio ou qualquer coisa ilegal. Este servidor não aceita conteúdo adulto (+18): histórias enviadas ou publicadas com a flag +18 são recusadas. Outros servidores decidem por conta própria em seus termos.',
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
    heading: '5. Planos e pagamentos',
    paragraphs: [
      'Planos pagos ampliam armazenamento, publicação e limites de colaboração. Compras feitas pela loja do dispositivo seguem a política de reembolso da loja e a lei aplicável. Cobranças feitas direto no servidor não são reembolsadas, exceto quando exigido por lei.',
    ],
  },
  deleting: {
    heading: '6. Excluir sua conta',
    paragraphs: [
      'Você pode excluir sua conta a qualquer momento na tela de detalhes do servidor. A exclusão desativa a conta de imediato e apaga os dados pessoais em até 30 dias. Conteúdo que você contribuiu em histórias de outros permanece, atribuído a uma conta removida. Registros financeiros são guardados pelo tempo exigido por lei.',
    ],
  },
  changes: {
    heading: '7. Alterações destes termos',
    paragraphs: [
      'Podemos atualizar estes termos conforme o serviço e a lei mudam. Mudanças relevantes são avisadas com antecedência, no aplicativo e no site, e pedidas de novo antes de valerem para você. Se discordar, cancele seu plano e pare de usar o servidor.',
    ],
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
    disabled: {
      heading: '8. Idade',
      paragraphs: [
        'Contas são para pessoas de 18 anos ou mais. Sem verificação de idade neste servidor: não existe área adulta e nenhuma conta é verificada. As contas ficam ativas assim que são criadas.',
        'Outros servidores que permitem temas maduros dizem isso em seus próprios termos e verificam a idade por conta própria.',
      ],
    },
  },
  refunds: {
    heading: '9. Reembolsos',
    paragraphs: [
      'Compras feitas pela loja do dispositivo seguem a política de reembolso da loja, além dos seus direitos legais. Cobranças feitas diretamente pelo servidor podem ser canceladas em até 7 dias da contratação com reembolso integral e atualizado, como exige o Código de Defesa do Consumidor. Depois disso, cobranças feitas direto no servidor não são reembolsadas, exceto quando exigido por lei.',
    ],
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
      'Como seus dados são tratados está na política de privacidade, legível antes do cadastro e nos detalhes do servidor. Operador: [razão social, CNPJ e endereço — a publicar antes do lançamento]. Dúvidas sobre privacidade, seus dados ou estes termos: privacy@keres.me. Estes termos seguem a lei brasileira.',
    ],
  },
};

/** The sections in document order, for one mode. Both languages keep the same order and count. */
function sectionsOf(text: ServerTermsText, mode: AgeVerificationMode): ServerTermsSection[] {
  return [
    text.what,
    text.accounts,
    text.conduct[mode],
    text.moderation,
    text.plans,
    text.deleting,
    text.changes,
    text.age[mode],
    text.refunds,
    text.reports,
    text.operator,
  ];
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
