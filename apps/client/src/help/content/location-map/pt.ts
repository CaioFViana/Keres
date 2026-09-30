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
        'Acima do mapa, Adicionar imagem de fundo dá uma base visual, e Adicionar locais e Adicionar marcador colocam pontos no canvas.',
        'Arraste pontos ou imagens para posicioná-los; o modo Editar layout libera os controles de tamanho e camadas.',
        'Ative Ligar nós acima do mapa e arraste de um ponto até outro para criar uma ligação. Ligar nós, Editar objetos e Editar layout são exclusivos: ligar um desliga os outros.',
        'No diálogo, escolha se a ligação é direcionada, o sentido A → B ou B → A, e um texto opcional.',
        'Abra um Local pelo mapa para revisar sua ficha, relações e destino de mapa.',
        'Guarde com o visto no cabeçalho; a seta de desfazer (Reverter) volta ao último mapa guardado.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'As alterações por guardar ficam neste aparelho, por mapa, mesmo que você feche a app. Na próxima vez que abrir o mapa elas voltam, com um aviso; se o mapa guardado mudou entretanto o aviso diz isso, e Reverter descarta o seu rascunho.',
    },
    { type: 'heading', level: 2, text: 'Formas, linhas e carimbos' },
    {
      type: 'paragraph',
      text: 'Adicionar objetos (ícone de formas) desenha por cima do mapa: retângulos, elipses, molduras, linhas, polígonos, formas prontas e carimbos (um ícone). Funciona como no board: arraste para retângulos, elipses, molduras e formas prontas; toque em cada ponto de uma linha ou polígono e escolha Concluir; toque uma vez para um carimbo. Editar objetos seleciona um para mover, remodelar, bloquear, mudar a camada ou abrir os detalhes (rótulo, cor, tracejado ou preenchido). Nada do que se desenha altera Locais nem relações.',
    },
    { type: 'heading', level: 2, text: 'Trajetos' },
    {
      type: 'paragraph',
      text: 'Mostrar trajetos (ícone de pegadas) desenha por cima do mapa o caminho de um personagem ou de um item, de um ponto de Local ao seguinte, na ordem da história. Escolha quem seguir na folha - vários personagens e itens ao mesmo tempo - e, numa história ramificada, também a Rota que o caminho segue. Limpar seleção os esconde.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'O trajeto é calculado a partir das cenas em que o personagem aparece (ou da jornada do item) e do Local em que cada cena acontece; nada é guardado no mapa, e a seleção é esquecida ao sair. As paradas cujo Local não está neste mapa são contadas num aviso (“2 paradas fora deste mapa”) em vez de desenhadas.',
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
      text: 'Hierarquia e conexões entre Locais alteram as relações da história e podem aparecer onde essas relações são usadas. Posições, imagens, marcadores, textos, destinos de mapa e ligações com marcadores pertencem somente a este mapa. Remover um ponto não exclui o Local nem as cenas que acontecem nele. Formas, linhas e carimbos pertencem somente a este mapa e entram na exportação dele em PNG ou SVG.',
    },
    {
      type: 'seeAlso',
      pages: ['locations', 'scenes', 'boards', 'characters', 'item-journeys', 'app-settings'],
    },
  ],
};
export default page;
