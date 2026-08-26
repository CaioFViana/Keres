import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'frame-story',
  title: 'Narrativa emoldurada',
  summary: 'Uma história contada dentro de outra, que tinge o modo como a lemos.',
  keywords: ['narrativa emoldurada', 'moldura', 'frame story', 'aninhada', 'narrador', 'epistolar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma situação externa, muitas vezes alguém contando ou lendo, contém a narrativa principal. A moldura fornece um narrador com motivos, uma plateia com reações, e uma distância que a obra pode explorar: estamos sempre cientes de que alguém escolheu contar daquele jeito.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Quem conta a história importa tanto quanto a história.',
        'Você quer licença embutida para lacunas, resumo e detalhe duvidoso.',
        'O material atravessa tempos, lugares ou registros muito diferentes.',
        'Você quer um final que caia na moldura, e não no relato.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma bombeira aposentada relata uma noite a um perito de seguros. Tudo o que vemos é a versão dela, e a última cena volta ao perito decidindo se registra aquilo.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Abrir a moldura e esquecer de fechá-la, o que soa como promessa abandonada.',
        'Uma moldura que não acrescenta nada além de atraso antes da história real.',
        'Aninhar tantas camadas que o público perde quem está falando.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['unreliable-narrator', 'bookending', 'point-of-view', 'in-media-res'],
    },
  ],
};
export default page;
