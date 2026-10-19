import type { Lang } from './http';

/**
 * What a reviewer reads, in English and Portuguese. The checklist is the reviewer's script from
 * `docs/age_verification_reviewer.md`, shortened to what the screen needs; the handbook stays the authority.
 */

/** The messages a decision can answer with. Typed values are never part of any of them. */
export type ReviewFlash =
  | 'approved'
  | 'rejected'
  | 'not-open'
  | 'not-claimed'
  | 'held-by-other'
  | 'retry-refused'
  | 'signed-out';

export interface ReviewMessages {
  title: string;
  operator: string;
  signIn: {
    heading: string;
    name: string;
    password: string;
    submit: string;
    note: string;
    invalid: string;
    locked: string;
    signedOut: string;
  };
  signOut: string;
  queue: {
    heading: string;
    empty: string;
    heldHeading: string;
    waiting: string;
    attempt: string;
    retry: string;
    username: string;
    claim: string;
    open: string;
  };
  age: (minutes: number) => string;
  item: {
    heading: string;
    back: string;
    attemptLabel: string;
    images: { front: string; back: string; photo: string };
    checklistHeading: string;
    checklist: string[];
    handbookNote: string;
    approveHeading: string;
    approveNote: string;
    name: string;
    kind: string;
    number: string;
    dateOfBirth: string;
    approve: string;
    refuseHeading: string;
    reason: string;
    refuse: string;
    kinds: Record<'rg' | 'cnh' | 'passport' | 'other-id', string>;
  };
  reasons: Record<
    'underage' | 'document_unreadable' | 'document_not_original' | 'face_mismatch' | 'other',
    string
  >;
  flash: Record<ReviewFlash, string>;
  errors: {
    underage: string;
    invalidIdentity: string;
    badForm: string;
    csrf: string;
    reasonNotSelectable: string;
  };
  notFound: string;
}

export const REVIEW_MESSAGES: Record<Lang, ReviewMessages> = {
  en: {
    title: 'Review',
    operator: 'Age verification review, for this server only',
    signIn: {
      heading: 'Reviewer sign in',
      name: 'Name',
      password: 'Password',
      submit: 'Sign in',
      note: 'Your account is yours alone. Every image you open is logged.',
      invalid: 'The name or the password is wrong.',
      locked: 'Too many failed attempts. Wait 15 minutes and try again.',
      signedOut: 'You are signed out.',
    },
    signOut: 'Sign out',
    queue: {
      heading: 'Queue',
      empty: 'Nothing is waiting.',
      heldHeading: 'Held by you',
      waiting: 'Waiting',
      attempt: 'Attempt',
      retry: 'retry',
      username: 'Username (as Keres gave it)',
      claim: 'Claim',
      open: 'Open',
    },
    age: (minutes) => {
      if (minutes < 60) return `${minutes} min`;
      if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`;
      return `${Math.floor(minutes / (60 * 24))} d`;
    },
    item: {
      heading: 'Sending',
      back: 'Back to the queue',
      attemptLabel: 'Attempt',
      images: {
        front: 'Identity document, front',
        back: 'Identity document, back',
        photo: 'Live photo',
      },
      checklistHeading: 'The check, in this order',
      checklist: [
        'Document whole and legible: four edges visible, text sharp, no glare, blur or finger. If not: Document unreadable.',
        'Original capture, taken now: not a screenshot, a photo of a screen, a print, a copy, a specimen or a template, and not visibly edited. If not: Not an original document.',
        'Live photo: a person in front of the camera, looking at it, whose face matches the document. A photo of a photo or of a screen is not a live person. If not: Face does not match.',
        'Adult: the holder must be 18 or over on the day of review, by the date of birth. If under 18: Under 18.',
        'Type the document data exactly as printed: name, kind, number and date of birth. The service keeps none of it.',
        'Decide. Approve only when checks 1 to 4 pass and the data is typed. When in doubt, refuse.',
      ],
      handbookNote:
        'Never copy, screenshot, photograph, print or describe an image outside this screen, and do not write down names, numbers or dates.',
      approveHeading: 'Approve',
      approveNote:
        'Type what is printed. The service refuses an approval for a holder under 18 and then discards what you typed.',
      name: 'Name on the document',
      kind: 'Document kind',
      number: 'Document number',
      dateOfBirth: 'Date of birth',
      approve: 'Approve',
      refuseHeading: 'Refuse',
      reason: 'Reason',
      refuse: 'Refuse',
      kinds: { rg: 'RG', cnh: 'CNH', passport: 'Passport', 'other-id': 'Other ID' },
    },
    reasons: {
      underage: 'Under 18 (no retry)',
      document_unreadable: 'Document unreadable',
      document_not_original: 'Not an original document',
      face_mismatch: 'Face does not match, or no live person',
      other: 'Other: a doubt the codes do not name',
    },
    flash: {
      approved: 'Approval recorded. The images and their key are destroyed.',
      rejected: 'Refusal recorded. The images and their key are destroyed.',
      'not-open': 'That sending is no longer open. It may be decided already, or it has expired.',
      'not-claimed': 'Claim the sending first.',
      'held-by-other': 'Another reviewer holds this sending.',
      'retry-refused':
        'You refused an earlier sending of this person, so this retry goes to another reviewer.',
      'signed-out': 'You are signed out.',
    },
    errors: {
      underage:
        'The holder is under 18 on the day of the decision. Refuse with the reason "Under 18". Nothing you typed was kept.',
      invalidIdentity:
        'The date of birth must be a real date, and the name, the kind and the number must be filled in. Nothing you typed was kept.',
      badForm: 'The form could not be read. Try again.',
      csrf: 'The form has expired. Reload the page and try again.',
      reasonNotSelectable: 'That reason cannot be chosen here.',
    },
    notFound: 'Not found.',
  },
  pt: {
    title: 'Revisão',
    operator: 'Revisão de verificação de idade, só para este servidor',
    signIn: {
      heading: 'Entrada do revisor',
      name: 'Nome',
      password: 'Senha',
      submit: 'Entrar',
      note: 'Sua conta é só sua. Cada imagem que você abre fica registrada.',
      invalid: 'O nome ou a senha estão errados.',
      locked: 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.',
      signedOut: 'Você saiu.',
    },
    signOut: 'Sair',
    queue: {
      heading: 'Fila',
      empty: 'Nada aguardando.',
      heldHeading: 'Com você',
      waiting: 'Aguardando',
      attempt: 'Tentativa',
      retry: 'nova tentativa',
      username: 'Usuário (como o Keres enviou)',
      claim: 'Assumir',
      open: 'Abrir',
    },
    age: (minutes) => {
      if (minutes < 60) return `${minutes} min`;
      if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`;
      return `${Math.floor(minutes / (60 * 24))} d`;
    },
    item: {
      heading: 'Envio',
      back: 'Voltar à fila',
      attemptLabel: 'Tentativa',
      images: {
        front: 'Documento de identidade, frente',
        back: 'Documento de identidade, verso',
        photo: 'Foto ao vivo',
      },
      checklistHeading: 'A verificação, nesta ordem',
      checklist: [
        'Documento inteiro e legível: quatro bordas visíveis, texto nítido, sem reflexo, borrão ou dedo. Se não: Documento ilegível.',
        'Captura original, feita agora: não é print de tela, foto de tela, impressão, cópia, espécime ou modelo, e não tem edição visível. Se não: Não é documento original.',
        'Foto ao vivo: uma pessoa diante da câmera, olhando para ela, com o rosto igual ao do documento. Foto de foto ou de tela não é pessoa ao vivo. Se não: Rosto não confere.',
        'Maior de idade: a pessoa deve ter 18 anos ou mais no dia da revisão, pela data de nascimento. Se menor de 18: Menor de 18.',
        'Digite os dados do documento exatamente como impressos: nome, tipo, número e data de nascimento. O serviço não guarda nada disso.',
        'Decida. Aprove só quando as verificações 1 a 4 passarem e os dados estiverem digitados. Na dúvida, recuse.',
      ],
      handbookNote:
        'Nunca copie, tire print, fotografe, imprima ou descreva uma imagem fora desta tela, e não anote nomes, números ou datas.',
      approveHeading: 'Aprovar',
      approveNote:
        'Digite o que está impresso. O serviço recusa a aprovação de quem tem menos de 18 anos e descarta o que você digitou.',
      name: 'Nome no documento',
      kind: 'Tipo de documento',
      number: 'Número do documento',
      dateOfBirth: 'Data de nascimento',
      approve: 'Aprovar',
      refuseHeading: 'Recusar',
      reason: 'Motivo',
      refuse: 'Recusar',
      kinds: { rg: 'RG', cnh: 'CNH', passport: 'Passaporte', 'other-id': 'Outro documento' },
    },
    reasons: {
      underage: 'Menor de 18 (sem nova tentativa)',
      document_unreadable: 'Documento ilegível',
      document_not_original: 'Não é documento original',
      face_mismatch: 'Rosto não confere, ou não há pessoa ao vivo',
      other: 'Outro: uma dúvida que os códigos não nomeiam',
    },
    flash: {
      approved: 'Aprovação registrada. As imagens e a chave delas foram destruídas.',
      rejected: 'Recusa registrada. As imagens e a chave delas foram destruídas.',
      'not-open': 'Este envio não está mais aberto. Pode já ter sido decidido, ou ter vencido.',
      'not-claimed': 'Assuma o envio primeiro.',
      'held-by-other': 'Outro revisor está com este envio.',
      'retry-refused':
        'Você recusou um envio anterior desta pessoa, então esta nova tentativa vai para outro revisor.',
      'signed-out': 'Você saiu.',
    },
    errors: {
      underage:
        'A pessoa tem menos de 18 anos no dia da decisão. Recuse com o motivo "Menor de 18". Nada do que você digitou foi guardado.',
      invalidIdentity:
        'A data de nascimento precisa ser uma data real, e o nome, o tipo e o número precisam estar preenchidos. Nada do que você digitou foi guardado.',
      badForm: 'Não foi possível ler o formulário. Tente de novo.',
      csrf: 'O formulário expirou. Recarregue a página e tente de novo.',
      reasonNotSelectable: 'Este motivo não pode ser escolhido aqui.',
    },
    notFound: 'Não encontrado.',
  },
};
