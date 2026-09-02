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
        'Adicione entidades existentes pelo seletor. A mesma entidade pode ser pincada mais de uma vez.',
        'Adicione uma nota para o que ainda não é entidade.',
        'Arraste um pin para o mover. Toque nele para abrir sua ficha ou editar a nota.',
        'Para criar uma ligação, ative Ligar nós no cabeçalho e arraste de um pin até outro.',
        'No diálogo, escolha se a ligação é direcionada, o sentido da seta e um texto opcional.',
        'Guarde de propósito. Reverter restaura o último desenho guardado. Abrir uma entidade mantém o desenho por guardar na memória até guardar, fechar a app, ou abrir outro board.',
      ],
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
      text: 'Boards não alteram o mapa da história, o de locais nem as relações de personagem. As ligações e seus textos ficam no board. Abrir uma entidade pincada mantém o desenho por guardar na memória até guardar, fechar a app, ou abrir outro board. Guardar grava um único update do desenho inteiro; se duas pessoas editarem o mesmo board, escolhe-se o seu, o delas, ou uma cópia — os desenhos não se fundem.',
    },
  ],
};
export default page;
