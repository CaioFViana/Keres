import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'characters',
  title: 'Personagens',
  summary: 'Registre quem participa da história e os detalhes que ajudam a mantê-los coerentes.',
  keywords: ['personagem', 'biografia', 'personalidade', 'protagonista'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Personagens são as pessoas ou seres que movem a narrativa. A ficha reúne sua identificação, descrição e informações de planejamento.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Lia pode ter Biografia “deixou a cidade aos dezesseis anos” e Linha do tempo planejada “reencontra a irmã no final”. A primeira registra o passado; a segunda é um plano que ainda pode mudar.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Personagens', '+'] },
    {
      type: 'steps',
      items: [
        'Crie a ficha e preencha Nome.',
        'Use os campos de descrição quando ajudarem a escrever ou revisar.',
        'Depois de salvar, acrescente Etiquetas, Notas, relações, participação em cenas e Veja também.',
        'Abra o personagem pela lista para editar ou consultar seus vínculos.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Como o personagem será reconhecido. Preencha para salvar.',
          note: 'Aparece em listas, cenas e relações.',
        },
        {
          key: 'title',
          label: 'Título',
          whatToWrite: 'Cargo, tratamento ou alcunha, se for relevante.',
          note: 'Ajuda a diferenciar personagens.',
        },
        {
          key: 'gender',
          label: 'Gênero',
          whatToWrite: 'A identidade de gênero que você deseja registrar.',
          note: 'Pode sugerir valores já usados.',
        },
        {
          key: 'race',
          label: 'Raça',
          whatToWrite: 'Espécie ou povo do personagem.',
          note: 'Pode sugerir valores já usados.',
        },
        {
          key: 'subrace',
          label: 'Sub-raça',
          whatToWrite: 'Uma divisão mais específica, quando existir.',
          note: 'Pode sugerir valores já usados.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite: 'Aparência ou apresentação geral.',
          note: 'Útil na consulta da ficha.',
        },
        {
          key: 'personality',
          label: 'Personalidade',
          whatToWrite: 'Como a pessoa costuma pensar, sentir ou reagir.',
          note: 'Não substitui Qualidades ou Fraquezas.',
        },
        {
          key: 'motivation',
          label: 'Motivação',
          whatToWrite: 'O que a personagem quer ou por que age.',
          note: 'Ajuda a revisar decisões nas cenas.',
        },
        {
          key: 'qualities',
          label: 'Qualidades',
          whatToWrite: 'Forças, virtudes ou capacidades.',
          note: 'Pode contrastar com Fraquezas.',
        },
        {
          key: 'weaknesses',
          label: 'Fraquezas',
          whatToWrite: 'Limites, falhas ou vulnerabilidades.',
          note: 'Pode gerar conflitos narrativos.',
        },
        {
          key: 'biography',
          label: 'Biografia',
          whatToWrite: 'Fatos que já aconteceram antes do momento atual.',
          note: 'Diferente da Linha do tempo planejada.',
        },
        {
          key: 'plannedTimeline',
          label: 'Linha do tempo planejada',
          whatToWrite: 'Acontecimentos que você pretende desenvolver.',
          note: 'É um plano, não um fato estabelecido.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar esta ficha.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Detalhes que não cabem nos outros campos.',
          note: 'Ficam na ficha.',
        },
        {
          key: 'relationType',
          label: 'Tipo de relação',
          whatToWrite:
            'Este é um campo apenas de busca. Escolha um tipo de relação para encontrar personagens conectados por esse tipo de relação.',
          note: 'Ele busca nas relações do personagem e não adiciona um campo à ficha.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Personagens podem participar de cenas, formar relações, receber etiquetas, notas, mídia e comentários. Excluir uma ficha remove sua disponibilidade nesses vínculos; revise-os antes.',
    },
    { type: 'seeAlso', pages: ['character-relationships', 'scenes', 'tags', 'comments'] },
  ],
};
export default page;
