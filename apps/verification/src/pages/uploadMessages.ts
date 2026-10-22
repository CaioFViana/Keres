import type { Lang } from './http';

/**
 * What the person reads on the upload page, in English and Portuguese. The page is about what is collected and who
 * reads it: no sentence here promises more than the service does (see `docs/compliance/age_verification.md`).
 */

/** Why an upload was refused. The codes are what the page's script reads; the texts are what the person sees. */
export type UploadRefusal =
  | 'invalid'
  | 'rate_limited'
  | 'request_too_large'
  | 'bad_request'
  | 'unexpected_field'
  | 'too_many'
  | 'missing_front'
  | 'missing_photo'
  | 'too_large'
  | 'not_an_image'
  | 'unexpected';

export interface UploadMessages {
  title: string;
  heading: string;
  /** Exactly three short lines: what is collected, who reads it, when it is destroyed (and that nothing else is asked). */
  lead: [string, string, string];
  frontLabel: string;
  frontHint: string;
  backLabel: string;
  photoHeading: string;
  photoHint: string;
  cameraStart: string;
  cameraCapture: string;
  cameraRetake: string;
  /** Shown with the file input that replaces the camera: the photo must be taken now, not picked from earlier ones. */
  photoFallback: string;
  photoLabel: string;
  send: string;
  sending: string;
  networkError: string;
  done: { heading: string; text: string };
  invalid: { heading: string; text: string };
  refusals: Record<UploadRefusal, string>;
  /** `{mb}` is replaced with the per-image limit in megabytes. */
  tooLargeNote: string;
  operatorLabel: string;
}

export const UPLOAD_MESSAGES: Record<Lang, UploadMessages> = {
  en: {
    title: 'Verify your age',
    heading: 'Verify your age',
    lead: [
      'We take a photo of your identity document (front, and back if it has one) and one live photo of you, taken now.',
      'A human reviewer working for the operator of this server reads them to check that you are 18 or over.',
      'They are destroyed as soon as the decision is made. We ask for nothing else.',
    ],
    frontLabel: 'Identity document, front',
    frontHint: 'Required. A JPEG, PNG or WebP photo of the whole document, all four edges visible.',
    backLabel: 'Identity document, back (if it has one)',
    photoHeading: 'Live photo',
    photoHint:
      'Look at the camera. The photo is taken here, now; a photo taken earlier is refused.',
    cameraStart: 'Turn on camera',
    cameraCapture: 'Take photo',
    cameraRetake: 'Retake photo',
    photoFallback:
      'The camera cannot be used in this window. Take the live photo now with your phone camera and choose it here. A photo taken earlier is refused.',
    photoLabel: 'Live photo (take it now)',
    send: 'Send',
    sending: 'Sending...',
    networkError: 'The documents could not be sent. Check your connection and try again.',
    done: {
      heading: 'Thank you',
      text: 'We received your documents. You can close this window and go back to the Keres app.',
    },
    invalid: {
      heading: 'This link is no longer valid',
      text: 'Open the verification again from the Keres app to get a new link.',
    },
    refusals: {
      invalid: 'This link is no longer valid.',
      rate_limited: 'Too many attempts. Wait a few minutes and try again.',
      request_too_large: 'The upload is larger than this service accepts.',
      bad_request: 'The form could not be read. Try again.',
      unexpected_field: 'The form has a field this page does not ask for. Send it again.',
      too_many: 'Send each image once: one front, one back if there is one, and one live photo.',
      missing_front: 'Choose the front of the document.',
      missing_photo: 'Take the live photo first.',
      too_large: 'An image is too large.',
      not_an_image: 'Send a JPEG, PNG or WebP image.',
      unexpected: 'Something went wrong. Try again.',
    },
    tooLargeNote: 'Each image may be up to {mb} MB.',
    operatorLabel: 'Verification service of this Keres server',
  },
  pt: {
    title: 'Verificação de idade',
    heading: 'Verificação de idade',
    lead: [
      'Tiramos uma foto do seu documento de identidade (frente e, se tiver, verso) e uma foto sua ao vivo, tirada agora.',
      'Um revisor humano do operador deste servidor lê as fotos para confirmar que você tem 18 anos ou mais.',
      'Elas são destruídas assim que a decisão for tomada. Não pedimos mais nada.',
    ],
    frontLabel: 'Documento de identidade, frente',
    frontHint:
      'Obrigatório. Foto JPEG, PNG ou WebP do documento inteiro, com as quatro bordas visíveis.',
    backLabel: 'Documento de identidade, verso (se tiver)',
    photoHeading: 'Foto ao vivo',
    photoHint: 'Olhe para a câmera. A foto é tirada aqui, agora; uma foto tirada antes é recusada.',
    cameraStart: 'Ligar câmera',
    cameraCapture: 'Tirar foto',
    cameraRetake: 'Tirar outra foto',
    photoFallback:
      'Não é possível usar a câmera nesta janela. Tire a foto ao vivo agora, com a câmera do seu aparelho, e escolha-a aqui. Foto tirada antes é recusada.',
    photoLabel: 'Foto ao vivo (tire agora)',
    send: 'Enviar',
    sending: 'Enviando...',
    networkError: 'Não foi possível enviar os documentos. Verifique a conexão e tente de novo.',
    done: {
      heading: 'Obrigado',
      text: 'Recebemos os seus documentos. Pode fechar esta janela e voltar ao app Keres.',
    },
    invalid: {
      heading: 'Este link não é mais válido',
      text: 'Abra a verificação de novo no app Keres para receber um novo link.',
    },
    refusals: {
      invalid: 'Este link não é mais válido.',
      rate_limited: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
      request_too_large: 'O envio é maior do que este serviço aceita.',
      bad_request: 'Não foi possível ler o formulário. Tente de novo.',
      unexpected_field: 'O formulário tem um campo que esta página não pede. Envie de novo.',
      too_many: 'Envie cada imagem uma vez: uma frente, um verso se houver, e uma foto ao vivo.',
      missing_front: 'Escolha a frente do documento.',
      missing_photo: 'Tire a foto ao vivo primeiro.',
      too_large: 'Uma imagem é grande demais.',
      not_an_image: 'Envie uma imagem JPEG, PNG ou WebP.',
      unexpected: 'Algo deu errado. Tente de novo.',
    },
    tooLargeNote: 'Cada imagem pode ter até {mb} MB.',
    operatorLabel: 'Serviço de verificação deste servidor Keres',
  },
};
