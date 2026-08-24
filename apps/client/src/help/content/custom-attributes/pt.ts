import type { HelpPage } from '../../types';
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
          whatToWrite:
            'Escolha Texto, Texto longo, Número, Sim/não, Data, Sugestão, Lista de sugestões ou Entidade.',
          note: 'Define como o valor é preenchido.',
        },
        {
          key: 'suggestionList',
          label: 'Lista de sugestões',
          whatToWrite:
            'Vários valores de sugestão na mesma ficha. Digite um termo novo ou escolha no catálogo; os dois alimentam a lista compartilhada de Sugestões desse campo.',
          note: 'Na tela de detalhe os valores aparecem separados por vírgula.',
        },
        {
          key: 'targetEntityType',
          label: 'Tipo da entidade alvo',
          whatToWrite: 'Para o tipo Entidade, escolha qual tipo de entidade ele pode referenciar.',
          note: 'Fica fixo depois da criação.',
        },
        {
          key: 'dateValues',
          label: 'Valores de data',
          whatToWrite: 'O tipo Data abre um calendário, e cada data pode ter hora ou não.',
          note: 'É uma data interna da história: nunca muda com o seu fuso horário.',
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
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Um atributo de Entidade permite selecionar um Personagem, Local, Item, Cena, Capítulo, Nota ou Regra do Mundo. O tipo alvo fica fixo ao criar o atributo e ele não tem valor padrão. Se a entidade referenciada for excluída, o atributo permanece, mas aparece como indisponível.',
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
