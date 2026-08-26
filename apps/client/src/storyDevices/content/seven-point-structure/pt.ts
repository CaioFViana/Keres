import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'seven-point-structure',
  title: 'Estrutura dos sete pontos',
  summary: 'Gancho, virada 1, pinch 1, ponto médio, pinch 2, virada 2, resolução.',
  keywords: [
    'sete pontos',
    'pinch point',
    'ponto medio',
    'virada',
    'seven point structure',
    'esqueleto',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma grade de trama construída de trás para frente. Você define primeiro a resolução, depois o gancho como oposto dela, depois as duas viradas que levam o personagem de uma à outra, com pinch points onde a força antagonista aplica pressão direta e um ponto médio onde o personagem para de reagir e passa a agir.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Você sabe o final e não acha o caminho até ele.',
        'O antagonista some por trechos longos e o meio fica frouxo.',
        'Você quer poucas batidas que sustentem peso, em vez de um esqueleto longo.',
        'Você planeja uma série e quer que cada parte gire no próprio eixo.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Gancho: uma tradutora que não confia em ninguém. Resolução: ela dá a palavra por um desconhecido em juízo. O ponto médio é onde ela para de se esconder e começa a investigar; os pinches são as duas vezes em que o outro lado prova que consegue alcançá-la.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Escrever pinch points como lembretes de que o vilão existe, em vez de custo real.',
        'Deixar o ponto médio ser um acontecimento em vez de uma troca de quem conduz.',
        'Projetar os sete pontos e nunca perguntar se o personagem os mereceu.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['three-act-structure', 'save-the-cat-beat-sheet', 'character-arc', 'ticking-clock'],
    },
  ],
};
export default page;
