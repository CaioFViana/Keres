import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'suggestions',
  title: 'Listas de sugestões',
  summary: 'Organize os valores sugeridos ao preencher campos repetidos da história.',
  keywords: [
    'sugestão',
    'gênero',
    'raça',
    'relação',
    'valor',
    'lista',
    'lista nomeada',
    'copiar',
    'renomear',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Listas de sugestões guardam valores que você pode reaproveitar em campos repetidos, como gênero e raça de personagens, tipo de relação, estado de item e atributos customizados do tipo Sugestão. Também pode criar listas nomeadas suas, que não estão ligadas a um campo.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Em vez de digitar “Navegadora” com grafias diferentes em cada ficha, salve esse valor como sugestão de ocupação. Para cores, armas ou outros vocabulários que não são um campo nativo, crie uma lista nomeada e copie valores para as listas que devem compartilhá-los.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Sugestões'] },
    {
      type: 'steps',
      items: [
        'Escolha a lista desejada. Listas nativas e de atributos customizados mostram o tipo de elemento e o campo. Listas que você criou aparecem com o nome, e abaixo do título há uma chave de campo curta — no mesmo estilo dos atributos customizados, sem o identificador interno.',
        'Digite um novo valor e toque em Adicionar.',
        'Toque num valor para abrir seus detalhes. Lá é possível ver todas as entidades que o usam, renomeá-lo ou removê-lo dos valores salvos. Apenas quem pode editar a história faz essas alterações.',
        'Ao renomear, escolha se todos os usos atuais da história também devem ser atualizados. Renomear para um valor já existente funde os dois: todos os usos atuais mudam e o valor salvo antigo é removido.',
        'Use o ícone de mais para criar uma lista nomeada. Informe o nome de exibição e guarde.',
        'Numa lista nomeada, use o lápis da barra para renomeá-la. Isso muda só o nome que você vê na lista e no histórico da história. A chave do campo permanece a mesma.',
        'Use o ícone de copiar para levar valores guardados para outras listas. Só entram valores únicos; o que já existir no destino é ignorado. As listas não ficam ligadas depois da cópia.',
        'Use a lixeira numa lista nomeada para apagar essa lista e todos os valores guardados nela. Listas de campos nativos ou customizados não se apagam aqui.',
        'Ao preencher uma ficha, abra o campo correspondente e escolha um dos valores sugeridos, ou escreva outro quando fizer sentido.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Editar um valor novo no campo da ficha também funciona. Listas nativas e de atributos incluem tanto os valores guardados aqui quanto cada valor único já usado naquele campo. Se nenhuma ficha ainda usar um valor que nunca foi guardado em Sugestões, ele some das sugestões futuras até você adicioná-lo de novo. Listas nomeadas só guardam o que você cadastrou; não herdam o uso ao vivo do campo.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A lista escolhida aparece nos formulários que usam aquele campo. Remover um valor só o retira do catálogo salvo; os usos existentes permanecem. Renomear pode reescrever todos os usos atuais, e cada entidade alterada fica registrada no histórico de operações. Criar, renomear ou apagar uma lista nomeada fica no histórico com o nome de exibição da lista, não com um identificador interno.',
    },
    {
      type: 'seeAlso',
      pages: ['custom-attributes', 'characters', 'character-relationships', 'items'],
    },
  ],
};

export default page;
