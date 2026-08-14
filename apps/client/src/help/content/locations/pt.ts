import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'locations',
  title: 'Locais',
  summary: 'Descreva os espaços onde a história acontece.',
  keywords: ['local', 'clima', 'cultura', 'política'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Locais são os espaços do seu mundo, de continentes a salas. Cenas escolhem um Local para registrar onde acontecem.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A Estação Central pode ter clima úmido, cultura mercante e política dividida entre duas famílias; esses detalhes mantêm as cenas coerentes.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Locais', '+'] },
    {
      type: 'steps',
      items: [
        'Crie um Local e informe Nome.',
        'Use Descrição para a visão geral.',
        'Preencha Clima, Cultura e Política quando forem úteis à narrativa.',
        'Depois de salvar, vincule o local a cenas e organize sua posição no mapa.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Nome do lugar. Preencha para salvar.',
          note: 'Aparece ao escolher o local de uma cena.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite: 'Como o local é e o que o torna reconhecível.',
          note: 'Fica disponível nos detalhes.',
        },
        {
          key: 'climate',
          label: 'Clima',
          whatToWrite: 'Condições climáticas relevantes.',
          note: 'Ajuda a manter cenas coerentes.',
        },
        {
          key: 'culture',
          label: 'Cultura',
          whatToWrite: 'Costumes, valores ou modo de vida.',
          note: 'Pode orientar personagens e conflitos.',
        },
        {
          key: 'politics',
          label: 'Política',
          whatToWrite: 'Poderes, regras ou disputas do lugar.',
          note: 'Pode orientar conflitos.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar o local.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Detalhes que não cabem nos outros campos.',
          note: 'Ficam na ficha.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Cenas dependem de um Local. O mapa pode mostrar locais dentro de outros e conexões de caminho. Excluir um local exige revisar as cenas que o usam.',
    },
    { type: 'seeAlso', pages: ['scenes', 'location-map', 'characters'] },
  ],
};
export default page;
