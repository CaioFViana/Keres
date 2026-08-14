import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-conflicts',
  title: 'Quando aparece um conflito',
  summary: 'Escolha como conciliar mudanças locais e do servidor.',
  keywords: ['conflito', 'manter meu', 'servidor', 'sincronização'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um conflito aparece quando o aplicativo não pode aplicar automaticamente uma mudança local e uma mudança do servidor.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você altera a descrição de uma cena offline enquanto outra pessoa altera a mesma descrição no servidor. A janela mostra as duas versões.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Leia o motivo e o elemento mostrados na janela.',
        'Quando houver campos contestados, escolha Minha ou Servidor em cada campo.',
        'Use Manter o meu para enviar sua escolha ou Manter o servidor para descartar a cópia local.',
        'Se a exclusão estiver envolvida, confirme restaurar sua cópia ou aceitar a exclusão. Use Adiar apenas para decidir depois.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A escolha define a versão que volta a sincronizar. Enquanto adiado, o conflito continua pendente e pode impedir que aquela alteração seja enviada.',
    },
    { type: 'seeAlso', pages: ['sync-basics', 'activity-log', 'account-limits'] },
  ],
};
export default page;
