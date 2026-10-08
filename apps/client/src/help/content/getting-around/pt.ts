import type { HelpPage } from '../../types';

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
        'No menu principal, Seleção de Histórias fica no topo. Criar reúne Pacotes, Exemplos e Importar uma história; Servidor (só onde há servidor) reúne Gerenciar Servidores e Gerenciar Amizades; Ajuda e Configurações do Aplicativo ficam no fim. Um ponto em Gerenciar Amizades ou Gerenciar Servidores - ou no grupo Servidor enquanto ele está fechado - avisa que há uma mensagem que você ainda não abriu.',
        'No menu da história, as entradas ficam em grupos - Escrever, Componentes, Mundo, Material, Organizar e revisar - sob o nome da história. Toque no nome de um grupo para abri-lo ou fechá-lo: o grupo da tela aberta fica aberto, e os outros ficam como você os deixou, história por história. A busca é a caixa no topo.',
        'No menu da história, pequenas marcas dizem o que há atrás de uma entrada sem abri-la: um número em Histórico para mudanças que ainda faltam chegar ao servidor (vermelho quando o servidor recusou alguma, com um ponto no grupo enquanto ele está fechado) e Publicada em Publicar e exportar.',
        'Use a seta do cabeçalho, ou o botão Voltar do aparelho ou do navegador, para retornar pela sequência de telas que abriu. Uma tela aberta por um atalho - do painel, por exemplo - leva de volta para onde você estava.',
        'Toque em Ajuda no final do menu para pesquisar ou navegar pelo catálogo.',
        'Quando um cabeçalho tem mais ações do que cabem, elas se juntam em Mais ações (o ícone de hambúrguer): toque para ver cada uma com o seu nome.',
        'Num formulário, a ação Redefinir do cabeçalho pergunta Descartar alterações? - num item novo apaga tudo o que foi digitado, num existente restaura os valores guardados. Nenhuma das duas se desfaz.',
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
