import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'manuscript',
  title: 'Manuscrito',
  summary: 'Escreva a história em si, cena por cena, e leia tudo como um documento.',
  keywords: ['manuscrito', 'escrever', 'editor', 'prosa', 'exportar', 'negrito', 'itálico', 'leitura'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O manuscrito é a prosa da história, escrita dentro do Keres em vez de outro app. Cada cena guarda seu próprio corpo de texto, e a tela de manuscrito junta todas as cenas num único documento de leitura.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: '“Saindo da estação” tem um resumo de uma linha para planejar e três parágrafos de prosa para ler. O editor da cena guarda a prosa; o manuscrito a mostra junto com todas as outras cenas, na ordem da história.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Elementos narrativos', 'Abrir cena', 'Escrever manuscrito'] },
    {
      type: 'steps',
      items: [
        'Abra uma cena e selecione Escrever manuscrito (ícone de lápis no header, ou o cartão Manuscrito).',
        'Escreva no modo Escrever. A barra acima do texto aplica **negrito**, *itálico*, __sublinhado__ e ~~tachado~~; o texto fica a salvo como rascunho local até você salvar.',
        'Troque para Ler para ver a página formatada, ou para Revisar para ler e responder os comentários da cena.',
        'Abra o Manuscrito pelo header dos elementos narrativos (ícone de livro) para ler tudo em ordem, buscar no texto completo ou exportar.',
        'No manuscrito, toque o título da cena para abri-la, ou o lápis ao lado para editar sua prosa. O ícone de olho alterna a leitura pura: títulos e botões somem para que nenhum toque acidental o tire de lá.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A prosa viaja com a cena no sync e nos backups. A exportação gera arquivos Word, PDF, Markdown ou texto puro; em histórias ramificadas cada rota exporta separadamente, com as escolhas apontando para a página da cena de destino. Fragmentos sem capítulo e cenas de eventos podem entrar como apêndice ou ficar fora da exportação.',
    },
    {
      type: 'seeAlso',
      pages: ['scenes', 'chapters', 'comments', 'choices', 'routes', 'import-export'],
    },
  ],
};
export default page;
