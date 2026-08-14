import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'what-is-keres',
  title: 'O que é o Keres',
  summary: 'Um lugar para organizar o universo da sua história, mesmo sem internet.',
  keywords: ['começar', 'planejamento', 'offline', 'organizar história'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Keres é um aplicativo de planejamento de histórias. Ele reúne personagens, locais, capítulos, cenas, itens, regras e anotações para você consultar enquanto escreve.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você escreve o capítulo em seu editor preferido. No Keres, registra que Lia encontrou uma chave na estação, quem estava com ela e em que cena isso aconteceu. Mais tarde, encontra esse detalhe sem reler todo o texto.',
    },
    {
      type: 'paragraph',
      text: 'O Keres organiza o universo da narrativa; ele não é um editor de manuscritos. Você pode escrever o texto onde preferir.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'No primeiro acesso, escolha seu nome local e o idioma.',
        'No menu principal, crie uma história.',
        'Abra a história e comece pelo elemento que já conhece: um personagem, local, capítulo ou cena.',
        'Volte às listas sempre que quiser completar ou revisar as informações.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Tudo o que você registra fica disponível nas listas, buscas, detalhes e relações da mesma história. O aplicativo funciona sem internet; um servidor só é necessário se você quiser sincronizar entre aparelhos ou colaborar.',
    },
    { type: 'seeAlso', pages: ['first-story', 'how-keres-organizes', 'what-is-a-server'] },
  ],
};
export default page;
