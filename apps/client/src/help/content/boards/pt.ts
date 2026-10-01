import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'boards',
  title: 'Boards',
  summary: 'Esboços livres e pequenos do dicionário: pins, notas e setas que não são relações.',
  keywords: ['board', 'corkboard', 'quadro', 'pin', 'esboço'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um board é um desenho com nome. Você pinca personagens, locais, cenas e outros itens do dicionário, solta notas livres e cria ligações entre eles. Essas ligações pertencem só ao board — não viram relações de personagem nem “ver também”.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Um board para a família real, outro para a conspiração do acto II. Cada um fica pequeno o bastante para rearranjar à mão. O mapa da história e o de locais continuam automáticos e fiéis ao modelo.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Boards no menu da história e crie um board com um nome curto.',
        'Acima do board, Adicionar uma entidade abre o seletor para pincar entidades existentes. A mesma entidade pode ser pincada mais de uma vez.',
        'Adicionar nota serve para o que ainda não é entidade. Adicionar objetos desenha formas, linhas e carimbos - veja abaixo.',
        'Arraste um pin para o mover. Toque nele para abrir sua ficha ou editar a nota.',
        'Para criar uma ligação, ative Ligar nós na barra acima do board e arraste de um pin até outro. Ligar nós, Editar objetos e Editar layout são exclusivos: ligar um desliga os outros.',
        'No diálogo, escolha se a ligação é direcionada, o sentido da seta e um texto opcional.',
        'Guarde com o visto no cabeçalho; a seta de desfazer (Reverter) volta ao último desenho guardado. Ambos ficam apagados até algo mudar.',
      ],
    },
    { type: 'heading', level: 2, text: 'Formas, linhas e carimbos' },
    {
      type: 'paragraph',
      text: 'Além de pins e notas, o board aceita objetos desenhados: uma moldura em volta dos conspiradores, uma linha marcando uma fronteira, uma estrela na cena-chave. São só decoração e agrupamento; nada do que se desenha vira relação nem muda a história.',
    },
    {
      type: 'steps',
      items: [
        'Abra Adicionar objetos (ícone de formas) e escolha um grupo: Desenhar (retângulo, elipse, moldura, linha, polígono), Formas prontas (quadrado, losango, triângulo, pentágono, hexágono, estrela) ou Carimbo (um ícone).',
        'Retângulo, elipse, moldura e as formas prontas desenham-se arrastando pelo canvas. Numa linha, toque para pôr cada ponto e depois em Concluir; o polígono fecha-se sozinho ao concluir. Num carimbo, toque onde ele vai. Cancelar sai sem criar nada.',
        'Ative Editar objetos para selecionar um: aparecem alças para o mover ou arrastar seus pontos e cantos, e uma coluna com Editar detalhes, Trazer para a frente, Enviar para trás, Bloquear objeto e Desselecionar.',
        'Editar detalhes define o rótulo, a cor, se é tracejado ou preenchido, ou o ícone de um carimbo. Remover apaga o objeto.',
        'Um objeto bloqueado ainda pode ser selecionado e ter os detalhes editados, mas não pode ser movido nem redimensionado até ser desbloqueado.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Os objetos são guardados, partilhados e exportados junto com o desenho, no PNG ou SVG escolhido nas Configurações.',
    },
    { type: 'heading', level: 2, text: 'Ligações no board' },
    {
      type: 'paragraph',
      text: 'Uma ligação simples representa uma associação. Uma ligação direcionada mostra uma seta; escolha A → B ou B → A no diálogo. O texto opcional aparece sobre a linha, por exemplo “protege”, “descobriu” ou “leva a”.',
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Um título curto para este esboço. Obrigatório para guardar o board.',
          note: 'É assim que o board aparece na lista e na pesquisa.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite:
            'Nota opcional sobre o propósito deste board (a conspiração, a família, o acto II).',
          note: 'Não aparece no canvas. Usada na lista e na pesquisa.',
        },
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'As alterações por guardar ficam neste aparelho, por board, mesmo que você feche a app ou abra uma entidade a partir de um pin. Na próxima vez que abrir o board elas voltam, com um aviso. Se o board guardado mudou entretanto, o aviso diz isso; use Reverter para descartar o seu rascunho e ficar com o guardado.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Se duas pessoas guardarem o mesmo board, o Keres não funde os desenhos. Fique com o seu, com o delas, ou com o delas e grave o seu noutro board.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Apagar uma personagem (ou qualquer entidade pincada) não corrompe o board. O pin fica como “entidade excluída” até o tirar, e revive se a entidade for restaurada.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Boards não alteram o mapa da história, o de locais nem as relações de personagem. As ligações e seus textos ficam no board. Guardar grava um único update do desenho inteiro; se duas pessoas editarem o mesmo board, escolhe-se o seu, o delas, ou uma cópia — os desenhos não se fundem.',
    },
  ],
};
export default page;
