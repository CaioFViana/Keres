import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'publish-story',
  title: 'Publicar uma história',
  summary:
    'Coloque uma história sua na página pública de um servidor, para qualquer pessoa baixar.',
  keywords: ['publicar', 'público', 'vitrine', 'compartilhar', 'baixar', 'senha'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Alguns servidores têm uma página pública que lista as histórias que seus usuários escolheram publicar. Publicar coloca ali uma cópia congelada de uma história sua, como um arquivo que qualquer pessoa pode baixar e abrir no próprio Keres e, se quiser, também como manuscrito e como uma página para ler online.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Isto não é publicar uma história no sentido comum. O que vai para essa página é a base Keres de uma história - a estrutura, os personagens, as cenas, as notas. O Keres é sempre um complemento ao meio em que a história está de fato sendo feita: um livro, um jogo, uma campanha. Ele não é esse meio, e uma versão publicada não é uma obra pronta sendo distribuída.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você terminou de planejar “A Cidade de Vidro” e quer que outras pessoas vejam como ela foi montada, ou que comecem a própria versão a partir da sua. Você publica uma versão; alguém baixa e importa no app dela.',
    },
    { type: 'heading', level: 2, text: 'Antes de conseguir publicar' },
    {
      type: 'list',
      items: [
        'A história precisa ser sua. Histórias compartilhadas com você, mesmo com permissão de escrita, nunca aparecem nesta tela.',
        'Você precisa estar conectado ao servidor da história naquele momento.',
        'A história precisa estar sincronizada - nenhuma alteração local esperando para chegar ao servidor.',
      ],
    },
    {
      type: 'paragraph',
      text: 'Quando falta alguma dessas coisas, a tela diz qual das três é, em vez de simplesmente recusar.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu principal', 'Publicar história'] },
    {
      type: 'steps',
      items: [
        'Abra na lista a história que quer publicar.',
        'Escolha como a versão deve ser nomeada.',
        'Escolha o que a versão leva: o arquivo da história (.zip), o manuscrito, a leitura online. Ao menos um precisa estar ligado; a tela diz Selecione ao menos um até isso acontecer.',
        'Decida se ela fica listada publicamente ou escondida atrás de uma senha.',
        'Escolha Criar nova versão pública.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que uma versão leva' },
    {
      type: 'table',
      headers: ['Chave', 'O que os leitores recebem'],
      rows: [
        [
          'Publicar o arquivo da história (.zip)',
          'O arquivo que qualquer pessoa pode baixar e importar no próprio Keres. Vem ligado por padrão.',
        ],
        [
          'Anexar manuscrito',
          'A prosa como documento para baixar, no formato que você escolher (Word, PDF, EPUB e outros), feito com as mesmas opções da exportação no aparelho.',
        ],
        [
          'Publicar a leitura online',
          'Um botão Ler online na página pública da história (veja abaixo).',
        ],
      ],
    },
    {
      type: 'paragraph',
      text: 'Uma versão pode deixar o arquivo de fora, para uma história que você só quer que seja lida, não copiada. As opções do manuscrito aparecem assim que uma das duas últimas chaves é ligada.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Se o servidor for mais antigo que o seu app e não puder incluir o manuscrito ou a leitura, a versão é publicada mesmo assim - sem eles - e a tela avisa.',
    },
    { type: 'heading', level: 2, text: 'O link' },
    {
      type: 'paragraph',
      text: 'Ao publicar, o endereço público da história é mostrado, e a tela continua exibindo esse endereço enquanto ela estiver publicada. É ele que você compartilha, e ele não muda quando uma versão nova é publicada.',
    },
    { type: 'heading', level: 2, text: 'Leitura online' },
    {
      type: 'paragraph',
      text: 'Uma versão pode levar uma página de leitura: ligue Publicar a leitura online e a versão ganha um botão Ler online na página pública da história. Ela é feita com as mesmas opções do manuscrito (arco, nomes das cenas, tipografia, aspas), então a história lê igual na página e no arquivo. Uma história linear vira uma página só, com índice; uma história ramificada é lida uma cena por vez.',
    },
    {
      type: 'paragraph',
      text: 'Numa história ramificada, escolhas que dependem de algo que o leitor ainda não juntou aparecem fechadas, sem dizer o motivo; só os itens que o leitor tem são mostrados, nunca as marcas internas da história. O leitor pode voltar um passo, ver o caminho que fez, recomeçar e guardar saves: um automático e quantos nomeados quiser. Os saves ficam no próprio navegador do leitor, separados por versão.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A página de leitura é feita da história como ela está na hora de publicar. Uma cena que nenhuma escolha parece alcançar entra assim mesmo, depois das que podem ser alcançadas. O texto que você escreveu aparece como texto puro: nada nele pode rodar.',
    },
    { type: 'heading', level: 2, text: 'Nomes das versões' },
    {
      type: 'table',
      headers: ['Estilo', 'Fica assim'],
      rows: [
        ['Versão + data', 'v12-2026-08-19'],
        ['Só a versão', 'v12'],
        ['Só a data', '2026-08-19'],
      ],
    },
    {
      type: 'paragraph',
      text: 'Publicar duas vezes no mesmo dia usando só a data acrescenta um número à segunda, então duas versões de uma história nunca dividem o mesmo nome.',
    },
    { type: 'heading', level: 2, text: 'Pública ou atrás de senha' },
    {
      type: 'paragraph',
      text: 'Uma história pública aparece na lista da página, para qualquer pessoa encontrar. Uma história protegida por senha não aparece em lugar nenhum: só abre para quem tem o link e a senha. Serve para mostrar uma história a alguém que não tem conta naquele servidor, sem colocá-la diante do mundo. Cada publicação aplica a escolha feita naquele momento: publicar com o cadeado desligado torna a história pública de novo, e publicar com ele ligado troca a senha antiga pela que você digitou.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'A escolha vale para a história inteira, não para uma versão. A página pública mostra uma história com todas as versões dentro dela, então publicar sem senha abre todas as versões que estavam atrás da senha antiga - inclusive as que já estavam no ar. O app avisa antes de isso acontecer.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Senha é um segredo compartilhado, não uma permissão por pessoa. Quem receber pode repassar. Para dar acesso a uma pessoa específica e poder tirar depois, adicione-a como leitora da história.',
    },
    { type: 'heading', level: 2, text: 'Limites de publicação' },
    {
      type: 'paragraph',
      text: 'Um servidor pode limitar quantas versões uma conta publica por dia. Quando o limite chega, a tela diz que seu plano não permite mais publicações hoje; tente de novo em algumas horas. Nada se perde - a versão apenas não é criada.',
    },
    { type: 'heading', level: 2, text: 'Versões antigas' },
    {
      type: 'paragraph',
      text: 'O servidor guarda as cinco versões mais recentes de cada história. Publicar uma sexta tira a mais antiga da página. O seu histórico dentro do app não é afetado por isso.',
    },
    { type: 'heading', level: 2, text: 'Tirar do ar' },
    {
      type: 'paragraph',
      text: 'Você pode remover uma versão específica, ou despublicar a história inteira e tirar todas as versões da página de uma vez. Nenhuma das duas coisas apaga nada da história em si. Vale lembrar que quem já baixou uma cópia continua com ela.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Publicar não altera a história, não aparece no registro de atividades dela e não interfere na sincronização. Quem lê ou escreve essa história com você é avisado quando uma versão nova é publicada.',
    },
    { type: 'seeAlso', pages: ['import-export', 'collaborators', 'what-is-a-server'] },
  ],
};
export default page;
