import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'account-limits',
  title: 'Limites da conta',
  summary: 'Entenda os limites que um servidor pode aplicar à sua conta.',
  keywords: ['limite', 'armazenamento', 'mídia', 'conta'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Cada servidor pode definir limites para histórias, elementos e espaço de mídia da conta.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ao importar um vídeo grande, o servidor pode recusar a sincronização se a conta já usou todo o espaço permitido.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Leia a mensagem exibida quando uma criação ou sincronização é recusada por limite.',
        'Libere espaço removendo mídias ou conteúdo que não precisa manter no servidor, quando isso for adequado.',
        'Se precisar de mais capacidade, consulte o administrador do servidor.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O conteúdo continua local até poder ser sincronizado, mas um conflito de limite exige sua decisão. Limites e regras de cadastro dependem do servidor, não do aplicativo.',
    },
    { type: 'seeAlso', pages: ['sync-conflicts', 'gallery', 'data-and-backup'] },
  ],
};
export default page;
