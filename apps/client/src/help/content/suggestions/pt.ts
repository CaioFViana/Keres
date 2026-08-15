import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'suggestions',
  title: 'Listas de sugestões',
  summary: 'Organize os valores sugeridos ao preencher campos repetidos da história.',
  keywords: ['sugestão', 'gênero', 'raça', 'relação', 'valor', 'lista'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Listas de sugestões guardam valores que você pode reaproveitar em campos repetidos, como gênero e raça de personagens, tipo de relação, estado de item e atributos customizados do tipo Sugestão.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Em vez de digitar “Navegadora” com grafias diferentes em cada ficha, salve esse valor como sugestão de ocupação. Ao preencher outro personagem, basta selecioná-lo e a organização permanece consistente.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Sugestões.',
        'Escolha a lista desejada. O rótulo mostra o tipo de elemento e o campo que usarão aqueles valores.',
        'Digite um novo valor e toque em Adicionar.',
        'Use o lápis para corrigir um valor ou a lixeira para removê-lo. Apenas quem pode editar a história faz essas alterações.',
        'Ao preencher uma ficha, abra o campo correspondente e escolha um dos valores sugeridos, ou escreva outro quando fizer sentido.',
      ],
    },
    { type: 'callout', tone: 'info', text: 'Editar um novo valor no campo também funciona. A lista que sugestões utiliza é baseada não só nos valores padrões cadastrados na história, mas como também todos os valores únicos utilizados neste campo. Mas cuidado! Se não houver mais entidades com este campo novo, ele desaparece de sugestões futuras, precisando ser adicionado novamente.' },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A lista escolhida aparece nos formulários que usam aquele campo. Alterar a lista não reescreve valores que já estão salvos nas fichas; ela apenas muda as opções oferecidas nas próximas edições.',
    },
    {
      type: 'seeAlso',
      pages: ['custom-attributes', 'characters', 'character-relationships', 'items'],
    },
  ],
};

export default page;
