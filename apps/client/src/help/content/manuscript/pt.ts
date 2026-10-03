import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'manuscript',
  title: 'Manuscrito',
  summary: 'Escreva a história em si, cena por cena, e leia tudo como um documento.',
  keywords: [
    'manuscrito',
    'escrever',
    'editor',
    'prosa',
    'exportar',
    'negrito',
    'itálico',
    'leitura',
    'lista',
  ],
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
    {
      type: 'path',
      segments: ['Menu da história', 'Elementos narrativos', 'Abrir cena', 'Escrever manuscrito'],
    },
    {
      type: 'steps',
      items: [
        'Abra uma cena e selecione Escrever manuscrito (ícone de lápis no header, ou o cartão Manuscrito).',
        'Escreva no modo Escrever. A barra acima do texto aplica **negrito**, *itálico*, __sublinhado__ e ~~tachado~~, além de listas com marcadores e numeradas; o que você digita fica como está (uma fala com "- " não vira lista sozinha). Para desfazer uma lista, toque de novo no botão de lista com o cursor nela. Para falas de diálogo, prefira o traço longo — (no celular, segure o hífen para achá-lo). O texto fica a salvo como rascunho local até você salvar. Sob o texto um contador mostra palavras e caracteres; uma cena comporta cerca de 30.000 caracteres (umas 5.000 palavras), o editor avisa ao chegar perto e, passado o limite, a cena deve ser dividida em duas.',
        'Troque para Ler para ver a página formatada, ou para Revisar para ler e responder os comentários da cena: trechos comentados ficam marcados no texto, e um botão mostra quantos comentários a cena tem. Para comentar um trecho, selecione-o, toque em Copiar e depois em Comentários - o trecho é oferecido como citação (na web, basta selecionar).',
        'Abra o Manuscrito pelo header dos elementos narrativos (ícone de livro) para ler tudo em ordem, buscar no texto completo ou exportar. Abrir índice, ao lado da busca, lista as cenas agrupadas por capítulo, com busca própria e a contagem de comentários de cada uma; toque numa para ir até ela.',
        'No manuscrito, toque o título da cena para abri-la, ou o lápis ao lado para editar sua prosa. O ícone de olho alterna a leitura pura: títulos e botões somem para que nenhum toque acidental o tire de lá.',
        'Exportar (ícone de compartilhar) abre a tela de exportação: comece de um modelo (e-book, livro impresso, envio a editoras) ou escolha você mesmo formato, conteúdo, folha de rosto, diagramação e tratamento do texto. Opções que um formato não usa não aparecem para ele.',
      ],
    },
    { type: 'heading', level: 2, text: 'Lendo uma história ramificada' },
    {
      type: 'paragraph',
      text: 'Numa história ramificada o manuscrito tem um seletor de Visualização acima do texto: Ler uma rota mostra as cenas de uma rota em ordem (escolha qual ao lado), Todas as cenas mostra todas, e Explorar cenas lê do jeito que o Navegador de história percorre a história - uma cena por vez, com as escolhas indisponíveis até o leitor ter o que precisa. Em Explorar, escolha uma cena inicial, toque numa escolha para seguir e use Reiniciar simulação para recomeçar. Revisar funciona em todas as visualizações, então dá para ler e adicionar comentários enquanto se explora.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A prosa viaja com a cena no sync e nos backups. A exportação gera arquivos Word, PDF, EPUB, HTML, Markdown ou texto puro - iguais em todo dispositivo e ao publicar no showcase. O PDF usa uma fonte serifada padrão, então texto fora dos alfabetos ocidentais (chinês, árabe, emoji) não aparece nele; EPUB e Word o mantêm; uma história ramificada exporta como um livro-jogo inteiro: todas as cenas que uma escolha alcança a partir do início (ou de cada início, quando há vários, com uma página de abertura para escolher), numeradas na ordem em que o leitor as encontra ou embaralhadas como num livro-jogo impresso, com cada escolha apontando para o número ou a página do destino - cenas que nada parece levar até elas fecham o livro. Fragmentos sem capítulo e cenas de eventos podem entrar como apêndice ou ficar fora da exportação.',
    },
    {
      type: 'seeAlso',
      pages: ['scenes', 'chapters', 'comments', 'choices', 'routes', 'import-export'],
    },
  ],
};
export default page;
