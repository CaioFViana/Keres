import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'getting-around',
  title: 'Navegando pelo app',
  summary: 'Use o menu certo para o momento em que você está trabalhando.',
  keywords: ['menu', 'voltar', 'celular', 'tela larga'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O Keres tem dois menus. O menu principal cuida das histórias e da sua conta; o menu da história mostra os elementos e ferramentas da história que está aberta.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Antes de abrir uma história, você usa o menu principal para importar um backup. Depois de abrir “A Cidade de Vidro”, usa o menu da história para chegar a Personagens, Cenas e Análise da história.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Em tela larga, use o menu visível à esquerda; você pode arrastar sua borda para ajustar a largura.',
        'No celular, toque no ícone de menu no cabeçalho para abrir o drawer.',
        'Toque em um item do menu para voltar à lista principal daquele assunto.',
        'Use o botão Voltar do aparelho ou do navegador para retornar pela sequência de telas que abriu.',
        'Toque em Ajuda no final do menu para pesquisar ou navegar pelo catálogo.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Abrir uma história muda o menu disponível, mas não altera seus dados. Sair para Seleção de Histórias deixa a história intacta e permite abrir outra.',
    },
    { type: 'seeAlso', pages: ['story-list', 'using-this-help', 'lists-and-search'] },
  ],
};
export default page;
