import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'troubleshooting',
  title: 'Resolvendo problemas',
  summary: 'Encontre ações seguras para dificuldades comuns do aplicativo.',
  keywords: ['problema', 'não conecta', 'importação', 'mídia', 'história sumiu'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Esta página reúne os primeiros passos para conexão, sessão, importação, mídia e histórias que não aparecem como esperado.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma mídia não abre: confira a conexão, tente abrir o detalhe novamente e preserve um backup antes de apagar qualquer dado.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Para servidor inacessível, confira o endereço e a conexão e tente novamente.',
        'Para sessão expirada, abra Servidores e entre novamente na conta.',
        'Para importação ou mídia recusada, confira formato, espaço e limite da conta.',
        'Para história ausente, confira a lista, o servidor correto e use exportações de backup antes de redefinir o aplicativo.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Redefinir o aplicativo remove dados locais. Exporte uma cópia primeiro sempre que a história for importante; conflitos e limites devem ser resolvidos pela janela apresentada.',
    },
    { type: 'seeAlso', pages: ['data-and-backup', 'sync-conflicts', 'add-server'] },
  ],
};
export default page;
