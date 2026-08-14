import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'faq',
  title: 'Perguntas frequentes',
  summary: 'Encontre respostas curtas e caminhos para as páginas detalhadas.',
  keywords: ['perguntas', 'dúvidas', 'offline', 'backup', 'servidor'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Perguntas frequentes reúne respostas rápidas para dúvidas comuns sobre histórias, servidores e dados.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você precisa saber se importar apaga uma história: a resposta rápida diz que não e aponta para a página detalhada quando necessário.',
    },
    { type: 'heading', level: 3, text: 'Respostas rápidas' },
    {
      type: 'faq',
      items: [
        {
          question: 'Posso usar o Keres sem servidor?',
          answer:
            'Sim. Histórias locais funcionam no aparelho; servidor é opcional para sincronizar e colaborar.',
        },
        {
          question: 'Importar substitui uma história existente?',
          answer: 'Não. Importar cria uma nova história local.',
        },
        {
          question: 'Como faço backup?',
          answer: 'Exporte a história e guarde o arquivo em um local seguro.',
        },
        {
          question: 'Por que uma escolha não aparece?',
          answer: 'Em história ramificada, confira origem, destino e as condições da escolha.',
        },
        {
          question: 'O que faço ao ver um conflito?',
          answer:
            'Compare Minha e Servidor, escolha por campo quando possível ou adie para decidir depois.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Use a busca desta Ajuda para encontrar uma palavra da sua dúvida.',
        'Abra a página detalhada indicada em Veja também quando precisar de mais contexto.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Estas respostas não alteram dados; elas apontam o recurso que executa cada ação.',
    },
    {
      type: 'seeAlso',
      pages: ['using-this-help', 'what-is-a-server', 'data-and-backup', 'sync-conflicts'],
    },
  ],
};
export default page;
