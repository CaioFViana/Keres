import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sketch',
  title: 'Esboços',
  summary:
    'Uma prancheta para ideias de cena e rascunhos de quadrinhos: pincel, borracha, balde, camadas, seleção, tamanhos de folha e exportação para a galeria. Rápido e leve, não um programa de pintura.',
  keywords: [
    'esboço',
    'esboco',
    'desenho',
    'desenhar',
    'pincel',
    'caneta',
    'marcador',
    'borracha',
    'balde',
    'preencher',
    'cor',
    'conta-gotas',
    'laço',
    'laco',
    'selecionar',
    'mover',
    'camada',
    'página',
    'pagina',
    'papel',
    'quadrinho',
    'balão',
    'balao',
    'fala',
    'texto',
    'carimbo',
    'desfazer',
    'exportar',
    'svg',
    'png',
    'galeria',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um esboço é um desenho nomeado sobre uma folha de papel: um lugar para anotar uma cena, um layout, uma pose ou uma página de quadrinhos. Escolha uma ferramenta e ela continua ativa, então dá para fazer quantos traços quiser. Um dedo desenha; dois dedos movem, ampliam e giram a visão. A ferramenta mão devolve o dedo único para a câmera. Diferente de um quadro, o esboço não fixa entidades da história.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você rascunha o impasse na sala do trono em seis quadros rápidos numa página webtoon, pinta a capa da rainha com o balde, põe balões de fala por cima e exporta a página para a galeria para anexá-la à cena.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Esboços pelo cabeçalho da galeria, crie um com + e escolha o papel (A4, A5, quadrado, largo ou webtoon).',
        'Escolha o pincel e ajuste tipo, cor, tamanho e opacidade na faixa sob as ferramentas. Faça quantos traços quiser; a ferramenta continua ativa.',
        'Use a borracha para cortar traços, o balde para preencher uma região fechada e o conta-gotas para reaproveitar uma cor do desenho.',
        'Abra Camadas para adicionar, ocultar, bloquear, reordenar ou mesclar; traços novos caem na camada ativa.',
        'Desfazer e refazer percorrem um histórico longo. Salve com o visto no cabeçalho; a seta reverte até o último save.',
        'Exporte pelo canvas: um .svg, um .png, ou salve na galeria como a imagem do esboço.',
      ],
    },
    { type: 'heading', level: 2, text: 'Ferramentas de desenho' },
    {
      type: 'paragraph',
      text: 'O pincel tem três tipos (caneta, marcador, marca-texto), cada um com tamanho e opacidade próprios. A borracha corta traços e preenchimentos por onde passa; o preenchimento é cortado quando você levanta a caneta, e um único desfazer o traz de volta. O balde preenche a região fechada que você toca, lendo todas as camadas ou só a ativa; aumente a tolerância se bordas suaves deixarem pontos, e feche pequenas falhas no contorno se a cor vazar. Linha, retângulo e elipse desenham com o pincel atual.',
    },
    { type: 'heading', level: 2, text: 'Selecionar e mover' },
    {
      type: 'paragraph',
      text: 'A ferramenta de seleção circunda desenho com o laço na camada ativa, ou toca num único traço. O modo traços inteiros pega todo traço que está em maior parte dentro do laço; o modo cortar fatia os traços na borda do laço. Arraste a seleção para mover, um canto para ampliar e a bolinha acima dela para girar. A barra da seleção espelha, duplica, apaga, reordena e move para outra camada.',
    },
    { type: 'heading', level: 2, text: 'Texto, balões e carimbos' },
    {
      type: 'paragraph',
      text: 'Texto, balões de fala e carimbos são objetos editáveis que ficam sempre acima das camadas de desenho. O balão é uma elipse: arraste a área, digite a fala e ajuste o tamanho pelas quatro alças dos cantos. Arraste o ponto para apontar o rabo para quem fala; o rabo sai do balão pela direção mais próxima, entre oito ao redor dele. Toque num objeto com a seleção para editá-lo.',
    },
    { type: 'heading', level: 2, text: 'Camadas e página' },
    {
      type: 'paragraph',
      text: 'As camadas se empilham de baixo para cima. Cada uma pode ser ocultada, bloqueada, deixada translúcida, reordenada, duplicada, mesclada com a de baixo ou limpa. Os preenchimentos do balde ficam sob os traços da camada, então o contorno sempre cobre a borda da cor. O botão de página define o tamanho do papel, a orientação e o fundo (papel, branco ou transparente). A página limita a exportação; desenhar fora dela é permitido, e mudar o tamanho nunca move o desenho.',
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Um título curto para este esboço. Obrigatório para salvar.',
          note: 'É assim que o esboço aparece na lista e na busca.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite:
            'Nota opcional sobre para que serve o esboço (o impasse, o layout dos quadros, uma pose).',
          note: 'Não aparece no canvas. Usada na lista e na busca.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Salvar, tamanho e exportar' },
    {
      type: 'paragraph',
      text: 'Ctrl+Z / Ctrl+Shift+Z funcionam no computador (B pincel, E borracha, G balde, I conta-gotas, V seleção, H mão, [ e ] mudam o tamanho). Um esboço é guardado como dados compactos do desenho, não como imagens, por isso fica leve; uma página muito carregada avisa antes de chegar ao limite. A exportação grava um .svg (o desenho em vetores) ou um .png (a página em imagem, transparente se você escolheu esse fundo). Salvar na galeria guarda um .png como imagem da galeria e o vincula como capa do esboço.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Mudanças não salvas ficam neste aparelho, por esboço, mesmo se você fechar o app. Elas voltam com um aviso na próxima vez que abrir.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Se duas pessoas salvam o mesmo esboço, o Keres não mescla os desenhos. Fique com o seu, com o dela, ou com o dela e salve o seu como outro esboço.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Esboços não alteram o mapa da história, os locais nem qualquer relação. Os únicos outros lugares em que um esboço aparece são a imagem da galeria que você escolher salvar e a lista de esboços. Salvar grava uma atualização para o desenho inteiro.',
    },
  ],
};
export default page;
