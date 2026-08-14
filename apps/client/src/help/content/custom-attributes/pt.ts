import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'custom-attributes',
  title: 'Atributos customizados',
  summary: 'Crie campos próprios para os elementos da sua história.',
  keywords: ['campo', 'atributo', 'valor padrão', 'obrigatório'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Atributos customizados acrescentam campos aos formulários de um tipo de elemento, como Personagem ou Item.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Crie “Nível de suspeita” para Personagens, com tipo Número e valor padrão 0.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Atributos customizados', '+'] },
    {
      type: 'steps',
      items: [
        'Escolha o tipo de elemento.',
        'Informe o Nome de exibição e escolha o Tipo.',
        'Defina Obrigatório, Valor padrão e Ordem quando necessário.',
        'Salve; o campo passa a aparecer nos formulários e detalhes desse tipo.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'displayName',
          label: 'Nome de exibição',
          whatToWrite: 'O rótulo que escritores verão.',
          note: 'Pode ser editado depois.',
        },
        {
          key: 'type',
          label: 'Tipo',
          whatToWrite: 'Escolha Texto, Texto longo, Número, Sim/não, Data ou Sugestão.',
          note: 'Define como o valor é preenchido.',
        },
        {
          key: 'required',
          label: 'Obrigatório',
          whatToWrite: 'Ative se cada elemento desse tipo precisar de um valor.',
          note: 'Impede salvar o elemento sem preenchimento.',
        },
        {
          key: 'defaultValue',
          label: 'Valor padrão',
          whatToWrite: 'Um valor inicial para novas fichas.',
          note: 'Pode ser alterado em cada ficha.',
        },
        {
          key: 'order',
          label: 'Ordem',
          whatToWrite: 'A posição em que o campo deve aparecer.',
          note: 'Organiza formulários e detalhes.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O campo aparece no formulário, detalhe, Busca Avançada e Busca Global. Sua identificação permanece a mesma mesmo que o nome visível mude.',
    },
    { type: 'seeAlso', pages: ['suggestions', 'lists-and-search', 'characters'] },
  ],
};
export default page;
