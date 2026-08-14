import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'item-journeys',
  title: 'Trajetória de um item',
  summary: 'Registre onde um item mudou de estado ou de dono, cena a cena.',
  keywords: ['item', 'trajetória', 'dono', 'estado'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma trajetória é uma parada na história de um Item. Ela registra em qual Cena uma mudança acontece, o novo estado e, se houver, o novo dono.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A chave começa enferrujada com Lia. Na Cena “Mercado”, uma trajetória registra Novo dono do personagem: Omar e Novo estado: reparada.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Trajetória de itens', '+'] },
    {
      type: 'steps',
      items: [
        'Escolha o Item que mudou.',
        'Escolha a Cena em que a mudança acontece.',
        'Preencha Novo estado.',
        'Escolha Novo dono do personagem somente se o item passar para alguém.',
        'Salve e acrescente Etiquetas, Notas ou Veja também quando precisar de contexto.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'itemId',
          label: 'Item',
          whatToWrite:
            'Escolha o objeto cuja trajetória está sendo registrada. É necessário para salvar.',
          note: 'A parada aparece na trajetória desse item.',
        },
        {
          key: 'sceneId',
          label: 'Cena',
          whatToWrite: 'Escolha em qual Cena a mudança ocorre. É necessário para salvar.',
          note: 'Liga a mudança ao ponto da narrativa em que aconteceu.',
        },
        {
          key: 'newCharacterOwnerId',
          label: 'Novo dono do personagem',
          whatToWrite: 'Escolha quem passa a possuir o item; deixe vazio se o dono não mudar.',
          note: 'É diferente do dono inicial informado na ficha do Item.',
        },
        {
          key: 'newState',
          label: 'Novo estado',
          whatToWrite: 'Descreva como o item fica depois desta Cena. É necessário para salvar.',
          note: 'Sugere estados já usados na história.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Explique por que a mudança ocorreu ou registre um detalhe de continuidade.',
          note: 'Ficam na parada e podem receber comentários.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A trajetória aparece ao consultar o Item e liga sua mudança a uma Cena. Excluir uma parada não apaga o Item nem altera seu Estado inicial.',
    },
    { type: 'seeAlso', pages: ['items', 'scenes', 'effects'] },
  ],
};
export default page;
