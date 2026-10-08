import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'import-export',
  title: 'Importar e exportar',
  summary: 'Guarde uma cópia de uma história, ou crie uma nova a partir de um arquivo exportado.',
  keywords: ['backup', 'exportar', 'importar', 'arquivo'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Exportar prepara uma cópia da história para guardar ou transferir. Importar lê uma cópia exportada e cria outra história na sua lista.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Antes de reestruturar “A Cidade de Vidro”, exporte uma cópia. Se quiser testar uma versão diferente, importe essa cópia: a original continua na lista.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'paragraph', text: 'Para trazer uma história, fora de qualquer história:' },
    { type: 'path', segments: ['Menu principal', 'Importar uma história'] },
    {
      type: 'steps',
      items: [
        'Escolha o arquivo exportado e confirme a criação.',
        'Abra a nova história pela lista e confira os dados antes de editar.',
      ],
    },
    { type: 'paragraph', text: 'Para tirar uma cópia, abra a história primeiro:' },
    { type: 'path', segments: ['Menu da história', 'Publicar e exportar'] },
    {
      type: 'steps',
      items: [
        'Em Cópia da história, escolha Só dados (.json) ou Com mídia (.zip).',
        'Salve ou compartilhe o arquivo no local seguro de sua escolha.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Importar não substitui uma história existente: cria uma nova cópia. Exportar não muda a história. Um arquivo feito por uma versão mais antiga do Keres é atualizado ao ser importado, prosa das cenas inclusa. Um arquivo feito por uma versão mais nova que a do seu app é recusado, com uma mensagem: atualize o app e tente de novo. Para ter a prosa como documento para ler ou enviar (Word, PDF, EPUB...), escolha Exportar manuscrito na mesma tela; a cópia é a história inteira.',
    },
    { type: 'seeAlso', pages: ['data-and-backup', 'story-list', 'example-stories', 'manuscript'] },
  ],
};
export default page;
