import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'location-map',
  title: 'Mapa de locais',
  summary: 'Organize lugares dentro de lugares e caminhos entre lugares.',
  keywords: ['mapa', 'contém', 'conectado', 'local'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O mapa de locais mostra duas relações diferentes: “contém”, para hierarquia, e “conectado a”, para um caminho ou passagem entre dois locais.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma Sala de mapas está contida no Palácio; o Palácio está conectado à Praça por uma estrada. A sala não precisa estar conectada à praça para fazer parte do palácio.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Locais', 'Mapa de locais'] },
    {
      type: 'steps',
      items: [
        'Crie os Locais antes de organizá-los no mapa.',
        'Abra um local para definir ou remover seu local pai quando quiser indicar “contém”.',
        'No mapa, adicione ou remova conexões quando quiser indicar um caminho entre dois locais.',
        'Abra um local pelo mapa para revisar sua ficha.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Hierarquia e conexões ajudam a ler o mapa e encontrar lugares relacionados. Remover uma relação no mapa não exclui o Local nem as cenas que acontecem nele.',
    },
    { type: 'seeAlso', pages: ['locations', 'scenes', 'location-map'] },
  ],
};
export default page;
