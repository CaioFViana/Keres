import type { HelpPage } from '@/src/content/help/types';
const page: HelpPage = {
  id: 'browse-showcase',
  title: 'Navegar pela vitrine de um servidor',
  summary:
    'Leia, baixe ou guarde uma cópia do que outras pessoas publicaram num servidor, sem sair do app.',
  keywords: [
    'vitrine',
    'navegar',
    'link',
    'colar',
    'baixar',
    'ler online',
    'senha',
    'pack',
    'autor',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um servidor pode ter um site público, a vitrine, onde as pessoas publicam histórias, os autores escrevem uma página sobre si e os packs são compartilhados. A Vitrine do app mostra esse mesmo site sem sair do app: você navega, abre uma história e escolhe o que fazer com ela.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma amiga manda o link de “O Vale Silencioso”. Cole-o na Vitrine: a história abre, e você pode lê-la online, baixar os arquivos ou importar uma cópia para a sua lista.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'paragraph', text: 'Para abrir um link que alguém passou:' },
    { type: 'path', segments: ['Menu principal', 'Vitrine'] },
    {
      type: 'steps',
      items: [
        'Cole o link no campo, ou toque no botão da área de transferência. Na web, Ctrl+V em qualquer lugar da tela também funciona.',
        'O app diz de quem é o servidor e para onde o link aponta. Um link que não é de uma página de vitrine, ou que não é seguro, é explicado em vez de aberto.',
        'O link de um servidor que você registrou abre como seu. O link de qualquer outro servidor abre como convidado: dá para ler e baixar, e nada seu é enviado. Registre esse servidor para entrar e sincronizar com ele.',
      ],
    },
    {
      type: 'paragraph',
      text: 'Para navegar por um servidor que você registrou, escolha-o em Seus servidores. Na lista de histórias e na página do servidor também há um atalho para a Vitrine.',
    },
    {
      type: 'list',
      items: [
        'Histórias: busque e filtre por gênero, idioma, estrutura e forma da obra. Cada história mostra as suas versões.',
        'Autores: a página de um autor tem a biografia, os links e as histórias dele.',
        'Packs: o que cada pack traz. Baixe um para começar novas histórias a partir dele.',
      ],
    },
    { type: 'paragraph', text: 'Para cada versão de uma história:' },
    {
      type: 'list',
      items: [
        'Ler online abre o leitor do próprio servidor no seu navegador.',
        'Baixar pacote salva o arquivo Keres (.zip); Manuscrito salva o documento que o autor publicou.',
        'Importar uma cópia cria uma nova história na sua lista a partir do pacote, com a própria cópia das mídias.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Uma história pode ter senha. O app a pede antes de mostrar qualquer coisa; depois de desbloquear, ler, baixar e importar funcionam por cerca de uma hora.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Navegar não muda nada no servidor nem nas suas histórias. Uma cópia importada é uma história nova, separada da do autor; importar de novo cria outra. Um pack baixado fica no seu aparelho e pode ser aplicado ao criar uma história.',
    },
    {
      type: 'seeAlso',
      pages: ['import-export', 'publish-story', 'packs', 'add-server', 'friends'],
    },
  ],
};
export default page;
