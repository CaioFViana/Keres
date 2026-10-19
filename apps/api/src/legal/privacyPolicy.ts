import { createHash } from 'node:crypto';
import type { AgeVerificationMode } from '@keres/shared';

/**
 * The server's privacy policy, served at `GET /api/keres-privacy`.
 *
 * Versioned like the terms: clients show which version applies, and a bump means
 * announcing it again. Third-party operators replace this text with their own - the route
 * always serves *this* server's policy, whatever it is. Every claim below was verified
 * against the codebase; keep it that way when the code changes.
 *
 * The sections that touch age verification or payments depend on the mode (`AGE_VERIFICATION_MODE`):
 * a `manual` server runs no verification service and takes no payments, so it collects no
 * verification data and has no payment providers, and says so. Both modes share the version number.
 */
export const PRIVACY_POLICY_VERSION = 1;
export const PRIVACY_POLICY_UPDATED_AT = '2026-10-14';

export interface PrivacyPolicySection {
  heading: string;
  paragraphs: string[];
}

/** A section whose wording depends on the mode. Every other section reads the same in both. */
interface ModeSection {
  required: PrivacyPolicySection;
  manual: PrivacyPolicySection;
}

type Section = PrivacyPolicySection | ModeSection;

interface PrivacyPolicyText {
  who: Section;
  collect: Section;
  neverCollect: Section;
  why: Section;
  share: Section;
  keep: Section;
  rights: Section;
  security: Section;
  minors: Section;
  age: Section;
  changes: Section;
}

/**
 * The hash of the policy a server in `mode` shows, recorded with each acceptance. A `manual`
 * server must pass its mode: the default is the `required` text.
 */
export function privacyPolicyDigest(mode: AgeVerificationMode = 'required'): string {
  return createHash('sha256')
    .update(JSON.stringify(privacyPolicyFor(mode)), 'utf8')
    .digest('hex');
}

const en: PrivacyPolicyText = {
  who: {
    heading: '1. Who we are',
    paragraphs: [
      'This server is operated by the Keres team (keres.me). Questions about privacy, your data or these terms: use the contact form on keres.me.',
      'The Keres app works with any server. Every other server is its own data controller with its own policy; we answer only for this one.',
    ],
  },
  collect: {
    required: {
      heading: '2. What we collect',
      paragraphs: [
        'Account: your username, a tag, and your password and recovery codes in hashed form only - we never store them readable.',
        'Content you send us: synchronized stories, messages, publications and reports. Direct messages live on the server in readable form so they can be delivered; administrators may inspect content when moderating.',
        'Payments: order identifiers and purchase-token hashes. Card data never touches our servers; it stays with the device store or the payment provider.',
        'Technical data: when you sign in, sign up, recover your password or renew your session, we record the moment, the kind of event, your account and your IP address (access records). The security audit of actions on the server keeps what was done, by which account, with what outcome and the app version, but no IP address. Both are used to stop abuse and, for the access records, to meet the law.',
        'Contact form: the address a visitor writes to, so we can reply.',
        'Age verification, on servers that run it: see section 10.',
      ],
    },
    manual: {
      heading: '2. What we collect',
      paragraphs: [
        'Account: your username, a tag, and your password and recovery codes in hashed form only - we never store them readable. If you are verified as an adult, also your choice of whether to see adults-only content in public listings.',
        'Content you send us: synchronized stories, messages, publications and reports. Direct messages live on the server in readable form so they can be delivered; administrators may inspect content when moderating.',
        'Technical data: when you sign in, sign up, recover your password or renew your session, we record the moment, the kind of event, your account and your IP address (access records). The security audit of actions on the server keeps what was done, by which account, with what outcome and the app version, but no IP address. Both are used to stop abuse and, for the access records, to meet the law.',
        'Contact form: the address a visitor writes to, so we can reply.',
        'Age: this server runs no age-verification service and takes no payments. It keeps only whether an administrator marked your account as verified, and when: see section 10.',
      ],
    },
  },
  neverCollect: {
    heading: '3. What we never collect',
    paragraphs: [
      'No analytics, no advertising identifiers, no location, no contacts, no telemetry. What you write offline stays on your device until you choose to send it somewhere.',
    ],
  },
  why: {
    required: {
      heading: '4. Why we process it',
      paragraphs: [
        'To run your account and the service you asked for; to comply with legal duties (financial records and, where the law requires it of the operator, access records); to keep the service secure; and to defend rights in disputes. These are the legal bases of Brazil General Data Protection Law (contract, legal obligation, legitimate interest, protection of rights).',
      ],
    },
    manual: {
      heading: '4. Why we process it',
      paragraphs: [
        'To run your account and the service you asked for; to comply with legal duties (where the law requires it of the operator, access records); to keep the service secure; and to defend rights in disputes. These are the legal bases of Brazil General Data Protection Law (contract, legal obligation, legitimate interest, protection of rights).',
      ],
    },
  },
  share: {
    required: {
      heading: '5. Who we share with',
      paragraphs: [
        'Payment providers (Stripe, PayPal, Google Play) receive only what each purchase needs. Some providers process data outside Brazil; those transfers follow the data-protection rules for international transfer, under the same contractual and security safeguards. We do not sell data. Content is disclosed only to the people you share it with, or when a court orders it.',
      ],
    },
    manual: {
      heading: '5. Who we share with',
      paragraphs: [
        'This server uses no payment provider and sends no data to one. We do not sell data. Content is disclosed only to the people you share it with, or when a court orders it.',
      ],
    },
  },
  keep: {
    required: {
      heading: '6. How long we keep it',
      paragraphs: [
        'Account data lives until you delete the account, then personal data is erased within 30 days. A story you delete, and the stories of an account that was erased, are erased from the server 30 days after the deletion (they stay in the copies other people made, and on your devices). Kept longer, as the law requires: minimal proof that the terms were accepted, financial records, security audit (up to one year, without IP address) and access records with your IP address (six months, counted from each record, even if you delete the account). Contact messages from visitors are erased after 90 days. Server backups keep the last 30 daily copies plus one copy per month for three months, so a copy of data you already deleted can survive until it rotates out, for about three months at most. To keep a deleted account from coming back with a restored backup, we keep a separate list of the identifiers of deleted accounts and the dates, with no names or content, for 100 days. When a report says that content is illegal, the child-protection law for digital environments (ECA Digital, art. 27) obliges us to keep a copy of the reported item, and the data and sign-in records of the person responsible for it, for six months, or longer if an authority requires it, even if the item or the account is deleted meanwhile; only the administrators can read that copy. Age verification records follow section 10.',
      ],
    },
    manual: {
      heading: '6. How long we keep it',
      paragraphs: [
        'Account data lives until you delete the account, then personal data is erased within 30 days. A story you delete, and the stories of an account that was erased, are erased from the server 30 days after the deletion (they stay in the copies other people made, and on your devices). Kept longer, as the law requires: minimal proof that the terms were accepted, security audit (up to one year, without IP address) and access records with your IP address (six months, counted from each record, even if you delete the account). Contact messages from visitors are erased after 90 days. Server backups keep the last 30 daily copies plus one copy per month for three months, so a copy of data you already deleted can survive until it rotates out, for about three months at most. To keep a deleted account from coming back with a restored backup, we keep a separate list of the identifiers of deleted accounts and the dates, with no names or content, for 100 days. When a report says that content is illegal, the child-protection law for digital environments (ECA Digital, art. 27) obliges us to keep a copy of the reported item, and the data and sign-in records of the person responsible for it, for six months, or longer if an authority requires it, even if the item or the account is deleted meanwhile; only the administrators can read that copy. The verification mark follows section 10.',
      ],
    },
  },
  rights: {
    required: {
      heading: '7. Your rights',
      paragraphs: [
        'Confirm, access, correct, export, anonymize, block, limit or delete your data, and ask who we shared it with: use the contact form on keres.me. Deleting the account and exporting your data are also available inside the app, in the server details. The export includes your access records and the history of your age verification, but not your stories, which are already on your device. Deletion has the legal exceptions of the previous section.',
      ],
    },
    manual: {
      heading: '7. Your rights',
      paragraphs: [
        'Confirm, access, correct, export, anonymize, block, limit or delete your data, and ask who we shared it with: use the contact form on keres.me. Deleting the account and exporting your data are also available inside the app, in the server details. The export includes your access records, your verification mark and your adults-only display choice, but not your stories, which are already on your device. Deletion has the legal exceptions of the previous section.',
      ],
    },
  },
  security: {
    heading: '8. Security',
    paragraphs: [
      'Passwords, recovery codes and publication secrets are stored hashed; traffic is encrypted in transit; sessions expire and can be revoked. No system is perfect: keep your password and recovery codes safe, and keep copies of work that matters.',
    ],
  },
  minors: {
    heading: '9. Minors',
    paragraphs: [
      'Minors are not allowed on this server by default. Accounts are for people 18 or older. We do not knowingly keep data from minors; accounts found to belong to minors are closed and their data erased.',
    ],
  },
  age: {
    required: {
      heading: '10. Age verification',
      paragraphs: [
        "Accounts on this server are verified as adults before they become active. The verification is run by the verification service of this server, operated by this server's operator (on the official server, the Keres team), and never by another server or operator. You send an identity document and a live photo to that service; a human reviewer there checks them and decides. This server never receives the document, the photo, the date of birth or the document number.",
        'The document and the photo are used only to check age and are never used to profile anyone. The service destroys them at the decision and keeps no readable copy in any backup: each sending is encrypted with its own key, and that key is destroyed at the decision. Every time a reviewer views an image, the view is recorded in an audit log, without its content.',
        "This server keeps the result, the method, the dates, an opaque reference from the service and, only for approved verifications, an HMAC commitment computed by the service with a key kept outside our database. The commitment reveals nothing about the document; it stops the same document from verifying a second account on this server. The result stays with the account and, after the account is deleted, as pseudonymised proof of the verification for the prescription period defined in the operator's governance record.",
        'A refused or expired sending keeps no document and no commitment: the service destroys the document at the decision, and this server drops the record of that sending after a 30-day window, the time to try again. A pending account that nobody completes within the period this server sets is deleted, together with its submission.',
        'Verification data is used only to verify age (Lei 15.211/2025, Art. 13) and is never used to profile anyone (Art. 26).',
      ],
    },
    manual: {
      heading: '10. Age verification',
      paragraphs: [
        'This server runs no age-verification service and collects no verification data: it never receives or keeps an identity document, a photo or a date of birth. When an account is verified, it happens by other means, outside this server, and an administrator then marks the account as verified by hand.',
        'This server keeps that mark, the date and the method (manual), and the security audit records which administrator granted or removed it. If you are verified, it also keeps your choice of whether to see adults-only content in public listings, which you can change at any time in your profile in the app. The mark and the choice live with the account; the audit entry follows section 6.',
      ],
    },
  },
  changes: {
    heading: '11. Changes to this policy',
    paragraphs: [
      'Material changes are announced in advance, in the app and on the site, and shown again before they apply. If you disagree, delete your account and stop using the server.',
    ],
  },
};

const pt: PrivacyPolicyText = {
  who: {
    heading: '1. Quem somos',
    paragraphs: [
      'Este servidor é operado pela equipe Keres (keres.me). Dúvidas sobre privacidade, seus dados ou estes termos: use o formulário de contato em keres.me.',
      'O aplicativo Keres funciona com qualquer servidor. Cada outro servidor é seu próprio controlador de dados, com sua própria política; respondemos somente por este.',
    ],
  },
  collect: {
    required: {
      heading: '2. O que coletamos',
      paragraphs: [
        'Conta: seu nome de usuário, uma tag, e sua senha e códigos de recuperação somente em forma de hash — nunca os guardamos legíveis.',
        'Conteúdo que você nos envia: histórias sincronizadas, mensagens, publicações e denúncias. Mensagens diretas vivem no servidor em forma legível para poderem ser entregues; administradores podem inspecionar conteúdo ao moderar.',
        'Pagamentos: identificadores de pedido e hashes de token de compra. Dados de cartão nunca tocam nossos servidores; ficam com a loja do dispositivo ou o provedor de pagamento.',
        'Dados técnicos: quando você entra, cria a conta, recupera a senha ou renova a sessão, registramos o momento, o tipo de evento, sua conta e seu endereço IP (registros de acesso). A auditoria de segurança das ações no servidor guarda o que foi feito, por qual conta, com que resultado e a versão do aplicativo, mas não o endereço IP. Ambos servem para conter abuso e, no caso dos registros de acesso, para cumprir a lei.',
        'Formulário de contato: o endereço que o visitante escreve, para podermos responder.',
        'Verificação de idade, nos servidores que a fazem: veja a seção 10.',
      ],
    },
    manual: {
      heading: '2. O que coletamos',
      paragraphs: [
        'Conta: seu nome de usuário, uma tag, e sua senha e códigos de recuperação somente em forma de hash — nunca os guardamos legíveis. Se você é verificado como adulto, também a sua escolha de ver ou não conteúdo +18 nas listagens públicas.',
        'Conteúdo que você nos envia: histórias sincronizadas, mensagens, publicações e denúncias. Mensagens diretas vivem no servidor em forma legível para poderem ser entregues; administradores podem inspecionar conteúdo ao moderar.',
        'Dados técnicos: quando você entra, cria a conta, recupera a senha ou renova a sessão, registramos o momento, o tipo de evento, sua conta e seu endereço IP (registros de acesso). A auditoria de segurança das ações no servidor guarda o que foi feito, por qual conta, com que resultado e a versão do aplicativo, mas não o endereço IP. Ambos servem para conter abuso e, no caso dos registros de acesso, para cumprir a lei.',
        'Formulário de contato: o endereço que o visitante escreve, para podermos responder.',
        'Idade: este servidor não tem serviço de verificação de idade e não recebe pagamentos. Guarda somente se um administrador marcou sua conta como verificada, e quando: veja a seção 10.',
      ],
    },
  },
  neverCollect: {
    heading: '3. O que nunca coletamos',
    paragraphs: [
      'Sem analytics, sem identificadores de publicidade, sem localização, sem contatos, sem telemetria. O que você escreve offline fica no seu dispositivo até você escolher enviá-lo para algum lugar.',
    ],
  },
  why: {
    required: {
      heading: '4. Por que tratamos',
      paragraphs: [
        'Para operar sua conta e o serviço que você pediu; para cumprir deveres legais (registros financeiros e, quando a lei exigir do operador, registros de acesso); para manter o serviço seguro; e para defender direitos em disputas. Estas são as bases legais da Lei Geral de Proteção de Dados (contrato, obrigação legal, legítimo interesse, proteção de direitos).',
      ],
    },
    manual: {
      heading: '4. Por que tratamos',
      paragraphs: [
        'Para operar sua conta e o serviço que você pediu; para cumprir deveres legais (quando a lei exigir do operador, registros de acesso); para manter o serviço seguro; e para defender direitos em disputas. Estas são as bases legais da Lei Geral de Proteção de Dados (contrato, obrigação legal, legítimo interesse, proteção de direitos).',
      ],
    },
  },
  share: {
    required: {
      heading: '5. Com quem compartilhamos',
      paragraphs: [
        'Provedores de pagamento (Stripe, PayPal, Google Play) recebem somente o necessário a cada compra. Alguns provedores tratam dados fora do Brasil; essas transferências seguem as regras de proteção de dados para transferência internacional, sob as mesmas salvaguardas contratuais e de segurança. Não vendemos dados. Conteúdo é revelado somente às pessoas com quem você o compartilha, ou quando a Justiça ordenar.',
      ],
    },
    manual: {
      heading: '5. Com quem compartilhamos',
      paragraphs: [
        'Este servidor não usa provedor de pagamento e não envia dados a nenhum. Não vendemos dados. Conteúdo é revelado somente às pessoas com quem você o compartilha, ou quando a Justiça ordenar.',
      ],
    },
  },
  keep: {
    required: {
      heading: '6. Por quanto tempo guardamos',
      paragraphs: [
        'Dados da conta vivem até você excluir a conta; então os dados pessoais são apagados em até 30 dias. Uma história que você exclui, e as histórias de uma conta que foi apagada, são apagadas do servidor 30 dias depois da exclusão (continuam nas cópias que outras pessoas fizeram e nos seus aparelhos). Guardados por mais tempo, como a lei exige: prova mínima do aceite dos termos, registros financeiros, auditoria de segurança (até um ano, sem endereço IP) e registros de acesso com seu endereço IP (seis meses, contados de cada registro, mesmo que você exclua a conta). Mensagens de contato de visitantes são apagadas após 90 dias. Os backups do servidor guardam as últimas 30 cópias diárias mais uma cópia por mês durante três meses; assim, uma cópia de dados que você já excluiu pode sobreviver até girar para fora, por cerca de três meses no máximo. Para que uma conta excluída não volte com um backup restaurado, guardamos à parte uma lista com os identificadores das contas excluídas e as datas, sem nomes nem conteúdo, por 100 dias. Quando uma denúncia diz que um conteúdo é ilegal, a lei de proteção de crianças e adolescentes em ambientes digitais (ECA Digital, art. 27) nos obriga a guardar uma cópia do item denunciado, e os dados e registros de acesso de quem o publicou, por seis meses, ou mais se uma autoridade exigir, mesmo que o item ou a conta sejam excluídos nesse meio-tempo; só os administradores podem ler essa cópia. Registros de verificação de idade seguem a seção 10.',
      ],
    },
    manual: {
      heading: '6. Por quanto tempo guardamos',
      paragraphs: [
        'Dados da conta vivem até você excluir a conta; então os dados pessoais são apagados em até 30 dias. Uma história que você exclui, e as histórias de uma conta que foi apagada, são apagadas do servidor 30 dias depois da exclusão (continuam nas cópias que outras pessoas fizeram e nos seus aparelhos). Guardados por mais tempo, como a lei exige: prova mínima do aceite dos termos, auditoria de segurança (até um ano, sem endereço IP) e registros de acesso com seu endereço IP (seis meses, contados de cada registro, mesmo que você exclua a conta). Mensagens de contato de visitantes são apagadas após 90 dias. Os backups do servidor guardam as últimas 30 cópias diárias mais uma cópia por mês durante três meses; assim, uma cópia de dados que você já excluiu pode sobreviver até girar para fora, por cerca de três meses no máximo. Para que uma conta excluída não volte com um backup restaurado, guardamos à parte uma lista com os identificadores das contas excluídas e as datas, sem nomes nem conteúdo, por 100 dias. Quando uma denúncia diz que um conteúdo é ilegal, a lei de proteção de crianças e adolescentes em ambientes digitais (ECA Digital, art. 27) nos obriga a guardar uma cópia do item denunciado, e os dados e registros de acesso de quem o publicou, por seis meses, ou mais se uma autoridade exigir, mesmo que o item ou a conta sejam excluídos nesse meio-tempo; só os administradores podem ler essa cópia. A marca de verificação segue a seção 10.',
      ],
    },
  },
  rights: {
    required: {
      heading: '7. Seus direitos',
      paragraphs: [
        'Confirmar, acessar, corrigir, exportar, anonimizar, bloquear, limitar ou excluir seus dados, e saber com quem os compartilhamos: use o formulário de contato em keres.me. Excluir a conta e exportar seus dados também estão disponíveis dentro do aplicativo, nos detalhes do servidor. A exportação inclui seus registros de acesso e o histórico da verificação de idade, mas não suas histórias, que já estão no seu aparelho. A exclusão tem as exceções legais da seção anterior.',
      ],
    },
    manual: {
      heading: '7. Seus direitos',
      paragraphs: [
        'Confirmar, acessar, corrigir, exportar, anonimizar, bloquear, limitar ou excluir seus dados, e saber com quem os compartilhamos: use o formulário de contato em keres.me. Excluir a conta e exportar seus dados também estão disponíveis dentro do aplicativo, nos detalhes do servidor. A exportação inclui seus registros de acesso, sua marca de verificação e sua escolha de exibição de conteúdo +18, mas não suas histórias, que já estão no seu aparelho. A exclusão tem as exceções legais da seção anterior.',
      ],
    },
  },
  security: {
    heading: '8. Segurança',
    paragraphs: [
      'Senhas, códigos de recuperação e segredos de publicação são guardados com hash; o tráfego é criptografado; sessões expiram e podem ser revogadas. Nenhum sistema é perfeito: guarde sua senha e seus códigos, e mantenha cópias do trabalho que importa.',
    ],
  },
  minors: {
    heading: '9. Menores',
    paragraphs: [
      'Menores não são permitidos neste servidor por padrão. Contas são para pessoas de 18 anos ou mais. Não guardamos conscientemente dados de menores; contas que pertencerem a menores são encerradas e seus dados apagados.',
    ],
  },
  age: {
    required: {
      heading: '10. Verificação de idade',
      paragraphs: [
        'Contas deste servidor são verificadas como de adultos antes de ficarem ativas. A conferência é feita pelo serviço de verificação deste servidor, operado pelo operador deste servidor (no servidor oficial, a equipe Keres), e nunca por outro servidor ou operador. Você envia um documento de identidade e uma foto ao vivo a esse serviço; um revisor humano confere e decide. Este servidor nunca recebe o documento, a foto, a data de nascimento nem o número do documento.',
        'Documento e foto servem só para conferir a idade e nunca são usados para perfilar ninguém. O serviço os apaga na decisão e não deixa cópia legível em nenhum backup: cada envio é cifrado com chave própria, e essa chave é destruída na decisão. Cada visualização de imagem por um revisor é registrada em auditoria, sem o conteúdo.',
        'Este servidor guarda o resultado, o método, as datas, uma referência opaca do serviço e, somente para verificações aprovadas, um compromisso HMAC calculado pelo serviço com uma chave mantida fora do nosso banco de dados. O compromisso não revela nada sobre o documento; ele impede que o mesmo documento verifique uma segunda conta neste servidor. O resultado fica com a conta e, depois que a conta é excluída, como prova pseudonimizada da verificação pelo prazo prescricional definido no registro de governança do operador.',
        'Envio recusado ou expirado não guarda documento nem compromisso: o serviço apaga o documento na decisão, e este servidor descarta o registro desse envio após uma janela de 30 dias, o prazo para tentar de novo. Uma conta pendente que ninguém conclui dentro do prazo definido por este servidor é apagada, junto com o envio.',
        'Dados de verificação são usados somente para conferir a idade (Lei 15.211/2025, Art. 13) e nunca para perfilar alguém (Art. 26).',
      ],
    },
    manual: {
      heading: '10. Verificação de idade',
      paragraphs: [
        'Este servidor não tem serviço de verificação de idade e não coleta dados de verificação: nunca recebe nem guarda documento de identidade, foto ou data de nascimento. Quando uma conta é verificada, isso acontece por outros meios, fora deste servidor, e um administrador então marca a conta como verificada à mão.',
        'Este servidor guarda essa marca, a data e o método (manual), e a auditoria de segurança registra qual administrador a concedeu ou retirou. Se você é verificado, guarda também a sua escolha de ver ou não conteúdo +18 nas listagens públicas, que você pode mudar a qualquer momento no seu perfil no aplicativo. A marca e a escolha vivem com a conta; o registro de auditoria segue a seção 6.',
      ],
    },
  },
  changes: {
    heading: '11. Alterações desta política',
    paragraphs: [
      'Mudanças relevantes são avisadas com antecedência, no aplicativo e no site, e mostradas de novo antes de valerem. Se discordar, exclua sua conta e pare de usar o servidor.',
    ],
  },
};

function pick(section: Section, mode: AgeVerificationMode): PrivacyPolicySection {
  return 'heading' in section ? section : section[mode];
}

/** The sections in document order, for one mode. Both languages keep the same order and count. */
function sectionsOf(text: PrivacyPolicyText, mode: AgeVerificationMode): PrivacyPolicySection[] {
  return [
    text.who,
    text.collect,
    text.neverCollect,
    text.why,
    text.share,
    text.keep,
    text.rights,
    text.security,
    text.minors,
    text.age,
    text.changes,
  ].map((section) => pick(section, mode));
}

/** The policy a server running in `mode` serves, in both languages. */
export function privacyPolicyFor(
  mode: AgeVerificationMode,
): Record<'en' | 'pt', PrivacyPolicySection[]> {
  return { en: sectionsOf(en, mode), pt: sectionsOf(pt, mode) };
}

/**
 * The `required` policy, kept under its old name because `api.ts` still serves it. Wire the route
 * to `privacyPolicyFor(mode)` and this constant can go.
 */
export const PRIVACY_POLICY = privacyPolicyFor('required');
