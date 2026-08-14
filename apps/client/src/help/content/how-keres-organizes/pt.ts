import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'how-keres-organizes', title: 'Como o Keres organiza uma história', summary: 'Entenda como os elementos da narrativa se conectam dentro de uma história.', keywords: ['capítulos', 'cenas', 'personagens', 'organização'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    { type: 'paragraph', text: 'Uma história é o recipiente do seu projeto. Dentro dela, capítulos agrupam cenas; personagens, locais, itens e regras do mundo podem ser ligados a vários acontecimentos.' },
    { type: 'heading', level: 2, text: 'Para que serve' },
    { type: 'example', title: 'Exemplo', text: 'No capítulo “A viagem”, a cena “Partida da estação” acontece no local Estação Central, reúne Lia e Omar e usa a chave como item importante. Cada informação pode ser aberta e revista sem duplicar a descrição.' },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Capítulos ou Cenas'] },
    { type: 'steps', items: ['Crie capítulos para organizar a ordem de leitura.', 'Crie cenas e escolha o capítulo e o local de cada uma.', 'Cadastre personagens, locais, itens e regras quando precisar deles.', 'Nas telas de edição, use Etiquetas, Notas, Comentários e Veja também para acrescentar contexto e ligações.', 'Use as listas e a Busca Global para reencontrar informações da história aberta.'] },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    { type: 'paragraph', text: 'As relações aparecem nos detalhes, nas buscas e nos mapas. Em histórias ramificadas, cenas e escolhas também formam o mapa da história e podem ser verificadas pela análise.' },
    { type: 'seeAlso', pages: ['chapters', 'scenes', 'lists-and-search', 'see-also'] },
  ],
};
export default page;
