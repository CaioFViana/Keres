import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-dashboard',
  title: 'O painel da história',
  summary: 'Veja um retrato da história aberta e atalhos para revisar seu planejamento.',
  keywords: [
    'painel',
    'resumo',
    'contagens',
    'atalhos',
    'continuar a escrever',
    'retomar',
    'arcos',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O painel é a página inicial de uma história aberta. Ele tem um bloco Escrever para retomar de onde parou, resume quantos elementos você cadastrou, mostra atividades recentes e exibe uma faixa quando há conflitos de sincronização para revisar.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ao ver que há muitas cenas e nenhum local, você percebe que ainda pode registrar onde esses acontecimentos se passam.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra uma história pela lista.',
        'Use o nome da história no topo para confirmar qual está aberta.',
        'Em Escrever, Continuar a escrever reabre a última cena que você editou, com o capítulo e há quanto tempo; Nova cena, Novo personagem e Nova nota abrem os formulários em branco. Quem só lê vê Abrir no lugar e nenhum atalho de novo item.',
        'O cartão do Manuscrito conta cenas e capítulos e tem Ler e Exportar; Publicar também está lá, para o dono da história, onde há servidor.',
        'Nos arcos do universo, Gerenciar abre os arcos, tocar num arco o edita e Adicionar Arco cria um.',
        'Leia os cartões de resumo para ver as contagens de personagens, locais, capítulos, cenas e outros elementos.',
        'Toque no atalho da análise quando quiser revisar avisos.',
        'Se aparecer uma faixa vermelha de conflito, toque nela para revisar os conflitos de sincronização pendentes desta história.',
        'Use o menu para abrir a lista do elemento que deseja completar.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O painel apenas mostra informações já registradas; ele não cria nem altera elementos, e seus atalhos só abrem telas que já existem - nada é criado até você salvar lá. A seta de cada atalho leva de volta ao painel. As contagens mudam quando você adiciona, edita ou exclui conteúdo. A faixa de conflito só aparece enquanto existem conflitos de sincronização não revisados para a história aberta.',
    },
    { type: 'seeAlso', pages: ['story-analysis', 'sync-conflicts', 'characters', 'scenes'] },
  ],
};
export default page;
