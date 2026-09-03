import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'location-map',
  title: 'Mapa de locais',
  summary: 'Posicione locais, imagens, marcadores e ligações do seu mundo.',
  keywords: ['mapa', 'contém', 'conectado', 'local', 'marcador', 'ligação'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O Mapa de locais é um desenho salvo: posicione Locais sobre imagens da galeria, acrescente marcadores livres e ligue os pontos. Entre Locais, ele pode mostrar “contém”, para hierarquia, e “conectado a”, para um caminho ou passagem.',
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
        'Use Adicionar imagens para colocar uma base visual e Adicionar locais ou Marcador para colocar pontos no canvas.',
        'Arraste pontos ou imagens para posicioná-los; o modo Editar layout libera os controles de tamanho e camadas.',
        'Ative Ligar nós no cabeçalho e arraste de um ponto até outro para criar uma ligação.',
        'No diálogo, escolha se a ligação é direcionada, o sentido A → B ou B → A, e um texto opcional.',
        'Abra um Local pelo mapa para revisar sua ficha, relações e destino de mapa.',
      ],
    },
    { type: 'heading', level: 2, text: 'Direção, textos e marcadores' },
    {
      type: 'paragraph',
      text: 'Entre dois Locais, uma ligação não direcionada cria “conectado a”; uma ligação direcionada cria “contém”, com a seta do pai para o filho. O texto fica salvo só neste mapa e aparece sobre a linha e na exportação. Ligações que envolvem um marcador — marcador com marcador ou com Local — também ficam só neste mapa: marcadores não mudam a estrutura da história.',
    },
    { type: 'heading', level: 2, text: 'Destinos de mapa' },
    {
      type: 'paragraph',
      text: 'Um Local ou marcador pode apontar para outro Mapa de locais. O pequeno ícone de saída indica o destino; mantenha o ponto pressionado até aparecer o pop de saída e solte para abrir o outro mapa.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Hierarquia e conexões entre Locais alteram as relações da história e podem aparecer onde essas relações são usadas. Posições, imagens, marcadores, textos, destinos de mapa e ligações com marcadores pertencem somente a este mapa. Remover um ponto não exclui o Local nem as cenas que acontecem nele.',
    },
    { type: 'seeAlso', pages: ['locations', 'scenes', 'boards'] },
  ],
};
export default page;
