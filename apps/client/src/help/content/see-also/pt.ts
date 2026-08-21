import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'see-also',
  title: 'Veja também',
  summary: 'Crie uma ligação livre e mútua entre dois elementos relacionados.',
  keywords: ['relacionar', 'vínculo', 'conectar', 'referência cruzada', 'veja também'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Veja também cria uma referência entre dois elementos da mesma história. O vínculo é mútuo: se uma personagem aponta para um local, o mesmo local também mostra a personagem.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ligue a personagem Mara ao Observatório porque o local é importante para a história dela. Isso não diz que ela está lá em toda cena nem substitui uma etiqueta; apenas deixa uma referência útil nas duas fichas.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra a ficha de um personagem, cena, local, item, nota ou outro elemento que tenha a seção Veja também.',
        'Abra a seção Veja também e escolha os elementos relacionados no seletor.',
        'A seleção é aplicada imediatamente. Remova um item do seletor para desfazer o vínculo.',
        'No detalhe de um elemento, toque numa relação para abrir a ficha correspondente.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Use Etiquetas para agrupar muitos elementos por uma palavra curta e Notas para guardar texto. Use Veja também quando o importante é navegar de uma ficha a outra.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A relação aparece nos detalhes dos dois elementos e permite navegar entre eles. Desfazer o vínculo não exclui nenhum elemento, nota, etiqueta ou mídia.',
    },
    { type: 'seeAlso', pages: ['notes', 'tags', 'gallery', 'character-relationships'] },
  ],
};

export default page;
