import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'plots',
  title: 'Tramas',
  summary: 'Agrupe as cenas de uma linha narrativa e acompanhe até onde ela chega.',
  keywords: ['trama', 'linha narrativa', 'enredo', 'cobertura', 'leitor'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma Trama é uma linha narrativa da história: um conjunto de Cenas que contam a mesma coisa, com uma nota curta explicando o papel de cada Cena ali. A mesma Cena pode participar de várias Tramas, inclusive em histórias ramificadas.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A trama “Redenção do capitão” reúne cinco cenas espalhadas por três capítulos. Na cena “A carta”, a nota diz “ele descobre que o irmão sobreviveu”.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Tramas', '+'] },
    {
      type: 'steps',
      items: [
        'Dê um nome à Trama e, se quiser, descreva-a em Detalhes.',
        'Depois de salvar, use a seção Cenas nesta trama no próprio formulário da Trama.',
        'Escolha a Cena e escreva a nota de uma linha sobre o papel dela na Trama.',
        'Volte à Trama para ler as Cenas dela em ordem narrativa.',
        'Use a Matriz, a Cobertura e o Leitor no topo da lista para ver o conjunto.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Nomeie a linha narrativa em poucas palavras. É necessário para salvar.',
          note: 'É por ele que a Trama aparece nas listas, na matriz e na busca.',
        },
        {
          key: 'details',
          label: 'Detalhes',
          whatToWrite: 'Explique do que essa linha trata e onde ela pretende chegar.',
          note: 'Aparece no detalhe da Trama e também é pesquisado na busca global.',
        },
        {
          key: 'note',
          label: 'Nota da cena',
          whatToWrite:
            'Em uma linha, diga o que aquela Cena faz por esta Trama. É necessário para salvar a ligação.',
          note: 'Fica no formulário e no detalhe da Trama, além das células da matriz.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A Cobertura mostra quantas Cenas ativas cada Trama percorre; como uma Cena pode estar em várias Tramas, os percentuais não somam 100%. Excluir uma Trama remove só as ligações dela: as Cenas continuam intactas. Em histórias ramificadas, use Rotas para registrar um caminho possível sem limitar a cobertura da Trama.',
    },
    { type: 'seeAlso', pages: ['routes', 'scenes', 'chapters', 'narrative-elements'] },
  ],
};
export default page;
