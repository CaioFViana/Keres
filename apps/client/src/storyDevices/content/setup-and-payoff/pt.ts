import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'setup-and-payoff',
  title: 'Plantio e colheita',
  summary: 'Plante algo cedo para que um momento posterior funcione sem explicação.',
  keywords: ['plantio e colheita', 'plantio', 'retomada', 'setup and payoff', 'pagamento', 'eco'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um par: uma informação, objeto, habilidade ou frase introduzida de passagem, e um momento posterior que depende dela. A colheita parece merecida porque o público já tem a peça e a reconhece na velocidade da cena, e por isso soa como satisfação em vez de regra sendo explicada.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um clímax exige um conhecimento que o público ainda não tem.',
        'Você quer que uma batida emocional caiba numa linha, e não num parágrafo.',
        'Uma inversão cômica ou trágica precisa de referência compartilhada.',
        'Você está revisando e o final parece afirmado em vez de entregue.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'No capítulo dois ela ensina o irmão a assobiar mal. No capítulo dezenove, no escuro, um assobio ruim avisa que ele está vivo.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Plantar e esquecer de colher, deixando uma promessa solta.',
        'Colher sem ter plantado, o que equivale a pedir que o público aceite uma coincidência.',
        'Afastar tanto os dois que o público já não lembra do plantio.',
      ],
    },
    { type: 'seeAlso', pages: ['chekhovs-gun', 'foreshadowing', 'bookending', 'rule-of-three'] },
  ],
};
export default page;
