import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'scene-music',
  title: 'Música numa cena',
  summary:
    'Uma cena pode ter música: uma gravação ou um link da Galeria, com uma nota de quando entra e se as pessoas da história a ouvem. Ajuda a planejar a história; nunca é publicada.',
  keywords: [
    'música',
    'musica',
    'canção',
    'cancao',
    'trilha',
    'trilha sonora',
    'deixa',
    'ambiente',
    'áudio',
    'audio',
    'link',
    'playlist',
    'galeria',
    'na história',
    'papel',
    'cena',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma cena pode ter quantas músicas quiser. Cada uma aponta para um arquivo de áudio ou um link que você guarda na Galeria, e leva duas notas: quando entra, e se as pessoas da história a ouvem. Funciona em todo tipo de obra: um quadrinho pode ter trilha, um roteiro suas deixas de música, uma campanha a música da mesa, e um romance a canção que alguém canta na taverna.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A cena “A briga na taverna” tem duas músicas. Uma é o link de uma playlist, marcada como trilha, que entra “quando a primeira cadeira quebra”. A outra é a gravação da canção que o bardo canta, marcada como ouvida na história.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Coloque o arquivo de áudio ou o link na Galeria da história.',
        'Abra a cena, depois a música, e adicione uma com +. Escolha o arquivo ou o link.',
        'Diga se é ouvida na história ou é trilha, e escreva quando entra.',
        'Use as setas para subir ou descer uma música.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'role',
          label: 'Ouvida na história ou trilha',
          whatToWrite:
            'Ouvida na história: as pessoas da cena a ouvem, porque alguém a canta, a toca ou a deixa ligada. Trilha: só quem conta a história a ouve, como a música por baixo de uma cena de quadrinhos ou a música da mesa durante uma luta.',
          note: 'A mesma música pode ser uma coisa numa cena e outra em outra. Trilha é o padrão para uma gravação ou um link.',
        },
        {
          key: 'cue',
          label: 'Quando entra',
          whatToWrite:
            'Uma linha de direção: “quando ela abre a porta”, “corta no grito”. Texto livre.',
          note: 'Opcional. Na exportação de roteiro vai como uma nota que não imprime.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Quando o arquivo some' },
    {
      type: 'paragraph',
      text: 'Se o arquivo ou o link for apagado da Galeria, a música não se perde. Ela fica com sua nota e mostra “removida”. Escolha outra coisa para ela, ou apague. A Análise da História avisa de músicas que apontam para algo que sumiu.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A música pertence à cena: vai com ela quando você exporta a história ou clona um exemplo. Cada música conta para o limite de itens do seu plano. Gravações e links da Galeria nunca são publicados; são para você.',
    },
  ],
};
export default page;
