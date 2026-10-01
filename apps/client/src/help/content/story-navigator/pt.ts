import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-navigator',
  title: 'Navegador da história',
  summary:
    'Percorra uma história ramificada uma cena por vez, como um leitor faria, para testar escolhas, condições e efeitos.',
  keywords: [
    'navegador',
    'simular',
    'simulação',
    'testar',
    'jogar',
    'ramificada',
    'escolha',
    'gatilho',
    'item',
    'rota',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O Navegador da história é uma simulação da leitura da sua história ramificada. Ele mostra uma cena, o estado que o leitor carrega - itens e gatilhos - e as escolhas disponíveis a partir dela. Escolha uma e você cai na cena seguinte, com os efeitos dessa escolha e os da própria cena aplicados, como seriam para um leitor de verdade.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Ele só existe em histórias ramificadas. Numa história linear não há o que escolher, então a tela avisa que não está disponível.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você desconfia que a escolha “Abrir o cofre” nunca pode ser tomada, porque a chave é dada por uma cena que o leitor pode pular. Comece na primeira cena, percorra o caminho que o preocupa e veja a escolha ficar esmaecida, com o motivo escrito embaixo.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Tramas', 'Navegador da história'] },
    {
      type: 'steps',
      items: [
        'Abra Tramas e toque em Navegador da história (o ícone de play) no cabeçalho. Ele começa na cena marcada como início, ou na primeira cena quando nenhuma está marcada.',
        'Use Cena inicial para começar em outro ponto. Escolher uma cena reinicia a simulação a partir dela.',
        'Leia o cartão da cena: o nome, o resumo e, abaixo, o que o leitor carrega e quais gatilhos estão ativos.',
        'Toque numa escolha para segui-la. Uma escolha que o estado atual não permite fica esmaecida e diz por quê - por exemplo, que exige um gatilho ou é bloqueada por um que está ativo.',
        'Continue escolhendo até chegar a uma cena que diz Este caminho termina aqui.',
        'Toque no nome da cena para abri-la e editá-la; ao voltar, você retorna ao Navegador.',
        'Reiniciar simulação recomeça da cena inicial, sem nada carregado.',
      ],
    },
    { type: 'heading', level: 2, text: 'Lendo o cartão' },
    {
      type: 'table',
      headers: ['O que você vê', 'O que significa'],
      rows: [
        [
          'Visitadas, Itens, Gatilhos',
          'Quantas cenas o percurso atravessou, quantos itens ele tem e quantos gatilhos estão ativos.',
        ],
        ['Itens agora / Gatilhos ativos', 'Os nomes desses itens e gatilhos.'],
        [
          'As linhas com marcador',
          'O que acabou de acontecer: a escolha tomada, a cena em que entrou e cada item ou gatilho dado, retirado, ativado ou desativado no caminho.',
        ],
        [
          'Uma escolha esmaecida',
          'Uma escolha cujas condições falham agora, com o gatilho ou a condição que a impede.',
        ],
      ],
    },
    { type: 'heading', level: 2, text: 'Transformando um percurso em Rota' },
    {
      type: 'paragraph',
      text: 'A simulação é temporária; sair da tela a esquece. Quando um percurso vale a pena guardar, Salvar como rota cria uma Rota com as cenas por onde você passou, com um nome sugerido que você pode mudar. Substituir rota escreve o percurso sobre os passos de uma Rota que já existe - depois de pedir confirmação, porque os passos antigos se perdem. Substituir exige que já exista uma Rota.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Substituir rota sobrescreve todos os passos da Rota escolhida. Na dúvida, use Salvar como rota.',
    },
    { type: 'heading', level: 2, text: 'Onde mais ele aparece' },
    {
      type: 'paragraph',
      text: 'O Manuscrito de uma história ramificada tem uma visualização Explorar cenas que é o mesmo percurso, mostrando a prosa de cada cena em vez do resumo. Ali dá para ler e adicionar comentários enquanto se explora.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O Navegador não altera nada na história: nenhuma cena, escolha, item ou gatilho é editado ao percorrê-lo, e o percurso não é sincronizado nem entra no registro de atividade. Só Salvar como rota e Substituir rota gravam algo, e apenas em Rotas. O que ele mostra depende do que você criou em Escolhas, Condições de escolha e Efeitos, então um resultado inesperado costuma apontar para um deles.',
    },
    {
      type: 'seeAlso',
      pages: ['routes', 'choices', 'choice-conditions', 'effects', 'story-state', 'manuscript'],
    },
  ],
};
export default page;
