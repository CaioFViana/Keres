import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'items',
  title: 'Itens',
  summary: 'Acompanhe objetos importantes, seu estado inicial e quem os possui.',
  keywords: ['objeto', 'estado inicial', 'dono', 'trajetória'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Itens são objetos relevantes para a narrativa. A ficha registra como o objeto começa; a trajetória registra mudanças posteriores de estado ou de dono.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A chave pode começar no estado “enferrujada” e ter Lia como dona. Na cena do mercado, sua trajetória pode registrar que ela passou para Omar e foi reparada.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Itens', '+'] },
    {
      type: 'steps',
      items: [
        'Crie o item e preencha Nome.',
        'Use Categoria e Estado inicial quando ajudarem a organizar o acervo.',
        'Escolha Dono do personagem se alguém já possuir o item no início.',
        'Salve para adicionar Etiquetas, Notas, mídia, atributos customizados e Veja também.',
        'Use Trajetória de um item para registrar mudanças que acontecem em cenas.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Como você reconhece o objeto. Preencha para salvar.',
          note: 'Aparece nas listas, buscas e trajetórias.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite: 'Aspecto, função ou importância do item.',
          note: 'É exibida no detalhe e pode receber comentários.',
        },
        {
          key: 'category',
          label: 'Categoria',
          whatToWrite: 'Um grupo como arma, carta ou relíquia.',
          note: 'Sugere valores já usados na história.',
        },
        {
          key: 'initialState',
          label: 'Estado inicial',
          whatToWrite: 'Como o item está antes de qualquer mudança registrada.',
          note: 'É diferente do estado em cada parada da trajetória.',
        },
        {
          key: 'characterOwnerId',
          label: 'Dono do personagem',
          whatToWrite: 'Quem começa com o item, se houver.',
          note: 'O detalhe mostra o nome do personagem escolhido.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Lembretes que não cabem nos outros campos.',
          note: 'São exibidas no detalhe e podem receber comentários.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar o item.',
          note: 'Entra no filtro de favoritos.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O item pode aparecer em trajetórias, efeitos, condições, buscas, mídia e vínculos. Remover uma trajetória não exclui o item; excluir o item exige revisar essas referências.',
    },
    { type: 'seeAlso', pages: ['item-journeys', 'effects', 'choice-conditions', 'gallery'] },
  ],
};
export default page;
