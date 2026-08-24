import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'how-to-use-devices',
  title: 'Como usar esta lista',
  summary: 'O que estes verbetes são, o que não são, e como ir além deles.',
  keywords: ['recursos', 'ofício', 'escrita', 'pesquisa', 'aviso', 'como usar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um catálogo curto de recursos narrativos: técnicas com nome próprio que escritores, roteiristas e designers de jogos trocam entre si. Cada verbete diz o que o recurso é, quando costuma ajudar, um exemplo e como ele costuma falhar.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Aviso honesto: esta lista foi compilada por alguém que não é especialista em teoria literária. Os verbetes são resumos curtos de termos já consagrados por outros, escritos para provocar a sua pesquisa — não para encerrá-la. Trate cada página como ponto de partida e vá atrás da fonte.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'paragraph',
      text: 'Recursos são ferramentas, não regras. Obras excelentes quebram todas elas de propósito. Use a lista quando estiver travado, quando uma cena funciona e você não sabe dizer por quê, ou quando quiser vocabulário para um problema que já sente.',
    },
    {
      type: 'paragraph',
      text: 'O texto é propositalmente agnóstico de mídia — "a obra", "a cena", "o público" — para servir igualmente a um romance, um roteiro, uma HQ ou um jogo ramificado.',
    },
    { type: 'heading', level: 2, text: 'Como pesquisar mais a fundo' },
    {
      type: 'steps',
      items: [
        'Anote o nome original, geralmente em inglês, porque quase toda a bibliografia usa ele.',
        'Procure quem cunhou o termo e leia essa pessoa, não um resumo dela.',
        'Ache três obras da sua própria mídia que usam o recurso e veja como cada uma o entorta.',
        'Use o recurso de propósito em um rascunho. Ler sobre ele ensina muito menos do que usá-lo mal.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Nada. Esta lista é material de consulta: não lê, não altera e não guarda nada da sua história. Você pode ocultá-la por completo desligando "Sugerir recursos literários" nas Configurações do Aplicativo.',
    },
    { type: 'seeAlso', pages: ['three-act-structure', 'want-vs-need', 'show-dont-tell'] },
  ],
};
export default page;
