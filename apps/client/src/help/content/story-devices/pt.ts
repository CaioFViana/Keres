import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-devices',
  title: 'Recursos literários',
  summary:
    'Uma lista de consulta sobre técnicas narrativas, ao lado do aplicativo e separada da sua história.',
  keywords: ['recursos literarios', 'recursos narrativos', 'oficio', 'escrita', 'consulta', 'menu'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma segunda lista dentro do aplicativo, ao lado desta ajuda. A ajuda explica o Keres; os Recursos literários explicam o ofício da escrita: técnicas com nome próprio como presságio, desejo e necessidade, ou relógio correndo, com quando ajudam e como costumam falhar.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Foi escrito por alguém que não é especialista em teoria literária. Os verbetes resumem termos consagrados por outros e existem para começar a sua pesquisa, não para substituí-la.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'paragraph',
      text: 'É apenas material de consulta. Nada ali lê, altera ou guarda algo da sua história: não há campo para preencher, não há vínculo com nenhum elemento, e nada entra em importação, exportação ou sincronização.',
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ao planejar um capítulo você quer um nome para a técnica de cortar a cena no auge da tensão. Busca por "corte", encontra o verbete do gancho de suspense, lê as armadilhas, e volta a escrever.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu', 'Recursos literários'] },
    {
      type: 'steps',
      items: [
        'Abra Recursos literários pelo menu. Ele aparece nos dois menus, o de escolher história e o de dentro da história.',
        'Navegue por seção, ou busque: a busca também encontra o nome em inglês de cada recurso.',
        'Abra um verbete e siga os links relacionados no fim da página.',
        'Para ocultar o item do menu, desligue "Sugerir recursos literários" nas Configurações do Aplicativo.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Nada. Desligar o ajuste apenas remove o item do menu; não apaga nada, e religar devolve a lista intacta.',
    },
    { type: 'seeAlso', pages: ['app-settings', 'using-this-help'] },
  ],
};
export default page;
