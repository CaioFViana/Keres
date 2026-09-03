import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'stats',
  title: 'Status',
  summary: 'Meça personagens em eixos que você define e compare todos num gráfico radar.',
  keywords: ['status', 'stat', 'radar', 'tier', 'ranking', 'comparação', 'força'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um sistema opcional, ligado por história, para medir personagens em eixos criados por você — Força, Astúcia, Reputação. Cada eixo tem uma escada de tiers, e cada personagem pode ter um valor nele, por modo.',
    },
    {
      type: 'paragraph',
      text: 'Os status primários viram os eixos do gráfico radar. Os secundários aparecem só como lista de texto, e não têm limite. O gráfico precisa de pelo menos três primários e aceita no máximo doze.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Com a escada F começando em 0, C em 50 e A em 400, um personagem com 100 de Força está dentro de C, a um terço do caminho até A. Quem passa do último tier é desenhado na faixa tracejada fora do gráfico.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'path',
      segments: ['Menu da história', 'Personalização', 'Status'],
    },
    {
      type: 'steps',
      items: [
        'Abra Status em Personalização, ligue o sistema e escolha a notação: letras ou números.',
        'Crie os eixos. Marque como primários os que devem entrar no gráfico.',
        'Edite a escada padrão da história e dê escada própria a um status só quando ele precisar de outra faixa.',
        'Abra um personagem, escolha Editar e preencha os valores. Um modo sem valor próprio herda o do modo normal.',
        'Ao digitar, a régua abaixo do campo mostra onde cada tier começa e onde o valor cai.',
        'Use Comparar para sobrepor até quatro personagens ou modos, e Ranking para listar todo mundo por um status.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'O que este eixo mede. Preencha para salvar.',
          note: 'Aparece no gráfico, na lista e no ranking.',
        },
        {
          key: 'isPrimary',
          label: 'Primário',
          whatToWrite: 'Ative para o status ser um eixo do gráfico radar.',
          note: 'No máximo doze primários; os secundários não têm limite.',
        },
        {
          key: 'label',
          label: 'Rótulo do tier',
          whatToWrite: 'Como o tier é exibido, por exemplo F, C ou SS.',
          note: 'Só usado na notação de letras; em números aparece o próprio valor.',
        },
        {
          key: 'minValue',
          label: 'Piso do tier',
          whatToWrite: 'O menor valor que já pertence a este tier.',
          note: 'Nunca negativo e nunca repetido dentro da mesma escada.',
        },
        {
          key: 'value',
          label: 'Valor',
          whatToWrite: 'Quanto este personagem tem deste status.',
          note: 'Um valor acima do último tier é desenhado fora do gráfico.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Desligar o sistema oculta o painel do personagem e as ferramentas de status; nada é apagado, e religar devolve tudo. Apagar um status remove os valores registrados nele em todos os personagens.',
    },
    { type: 'seeAlso', pages: ['characters', 'character-modes', 'custom-attributes'] },
  ],
};
export default page;
