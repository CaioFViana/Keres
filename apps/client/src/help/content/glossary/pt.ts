import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'glossary',
  title: 'Glossário',
  summary: 'Consulte o significado dos termos que aparecem na interface.',
  keywords: ['glossário', 'cena', 'capítulo', 'marcador', 'etiqueta'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Este glossário resume palavras da interface; cada página indicada abaixo explica o recurso em mais detalhe.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ao ler “Marcador” numa condição, consulte aqui o resumo e abra Inventário e marcadores para configurar esse recurso.',
    },
    { type: 'heading', level: 3, text: 'Termos principais' },
    {
      type: 'table',
      headers: ['Termo', 'Significado'],
      rows: [
        ['Cena', 'Um momento da história, ligado a um local e opcionalmente a um capítulo.'],
        ['Escolha', 'Uma decisão que leva de uma cena a outra em história ramificada.'],
        ['Marcador', 'Um nome que registra que algo aconteceu no estado do leitor.'],
        ['Etiqueta', 'Uma palavra curta para agrupar elementos.'],
        [
          'Colaborador',
          'Uma pessoa com acesso de dono, escritor ou leitor a uma história sincronizada.',
        ],
        [
          'Código de recuperação',
          'Um código de uso único mostrado ao criar uma conta em um servidor, usado para definir uma nova senha caso você a esqueça.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Pesquise o termo nesta Ajuda.',
        'Abra a página indicada em Veja também para aprender a usar o recurso.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O glossário não altera sua história; ele apenas ajuda a interpretar os nomes usados nas telas.',
    },
    { type: 'seeAlso', pages: ['scenes', 'choices', 'tags', 'collaborators', 'story-state'] },
  ],
};
export default page;
