import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'sensory-grounding',
  title: 'Ancoragem sensorial',
  summary: 'Fixe a cena com detalhe físico específico, sobretudo dos sentidos que esquecemos.',
  keywords: [
    'ancoragem sensorial',
    'cinco sentidos',
    'cheiro',
    'textura',
    'imersao',
    'detalhe',
    'sensory grounding',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Colocar o público dentro de um momento por meio de sensação concreta. Visão e som chegam por padrão; cheiro, temperatura, textura e gosto é que convencem, porque são os detalhes que um resumo nunca carrega.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma cena parece acontecer num palco vazio.',
        'A emoção precisa de corpo: medo, luto e desejo são físicos antes de serem verbais.',
        'Você está estabelecendo um lugar ao qual a obra vai voltar.',
        'Um trecho longo de diálogo perdeu a localização.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A sala de espera não está tensa: cheira a café solúvel e desinfetante, e a cadeira ainda está quente de quem saiu antes dela.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Catalogar os cinco sentidos por obrigação, o que soa como exercício.',
        'Escolher o detalhe genérico; é o específico que faz o trabalho.',
        'Ancorar cenas que deveriam correr, e matar a velocidade delas.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['show-dont-tell', 'iceberg-theory', 'pacing', 'motif-and-leitmotif'],
    },
  ],
};
export default page;
