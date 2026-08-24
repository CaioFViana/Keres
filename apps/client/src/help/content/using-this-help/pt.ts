import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'using-this-help',
  title: 'Como usar esta ajuda',
  summary: 'Pesquise uma dúvida ou navegue por assunto sem sair do aplicativo.',
  keywords: ['ajuda', 'pesquisa', 'veja também', 'não encontrei'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A Ajuda é um catálogo dentro do aplicativo. Ela explica tarefas e campos com a mesma linguagem usada nas telas, em vez de mostrar detalhes técnicos.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Se você sabe que quer entender por que uma escolha não aparece, pesquise “condição”. Se ainda está conhecendo o aplicativo, abra “Comece por aqui” e siga a ordem das páginas.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Ajuda pelo último item do menu principal ou do menu da história.',
        'Use a barra fixa no topo para pesquisar por título, palavra-chave, campo ou texto da explicação.',
        'Digite com ou sem acento; por exemplo, “historia” também encontra “história”.',
        'Limpe a busca pelo botão × para voltar às seções no estado em que estavam.',
        'Abra um resultado para ler a página completa.',
        'Use Veja também no fim da página quando quiser continuar por um assunto relacionado.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A busca da Ajuda não altera a história, não entra na Busca Global e não guarda histórico. Links internos permitem avançar entre páginas e voltar uma por uma.',
    },
    { type: 'seeAlso', pages: ['lists-and-search', 'faq', 'troubleshooting'] },
  ],
};
export default page;
