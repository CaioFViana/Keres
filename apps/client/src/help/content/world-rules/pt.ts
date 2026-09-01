import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'world-rules',
  title: 'Mundo e peças do mundo',
  summary: 'Organize regras, criaturas, flora, mitologia, povos e conhecimentos do seu universo.',
  keywords: ['mundo', 'bestiário', 'herbário', 'mitologia', 'criatura', 'continuidade'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma peça do mundo registra algo importante para o universo da história. Ela pode ser uma regra natural, criatura, planta, divindade, cultura ou conhecimento.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplos',
      text: '“Teleporte só funciona entre espelhos marcados” é uma Regra. “Corça-de-brasa” pode ficar no Bestiário. “Lírio de cinza” pertence ao Herbário.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Mundo.',
        'Escolha Todas as peças ou uma seção, como Bestiário ou Mitologia.',
        'Crie uma peça, informe Título e escolha a Seção.',
        'Use Tipo para classificá-la dentro da seção e preencha os demais campos que fizerem sentido.',
        'Use Conteúdo e relações do mundo para conectá-la a locais, outras peças ou entidades da história.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Título',
          whatToWrite: 'O nome curto da peça. Preencha para salvar.',
          note: 'Aparece nas listas e buscas.',
        },
        {
          key: 'section',
          label: 'Seção',
          whatToWrite:
            'O grupo fixo: Regras, Bestiário, Herbário, Mitologia, Povos e culturas, Conhecimento ou Outros.',
          note: 'Organiza o drawer Mundo; use Todas as peças para pesquisar todos os grupos.',
        },
        {
          key: 'type',
          label: 'Tipo',
          whatToWrite: 'Uma classificação livre, como criatura, fungo, divindade, cultura ou era.',
          note: 'As sugestões de Tipo são separadas por Seção.',
        },
        {
          key: 'description',
          label: 'Descrição',
          whatToWrite: 'O que a peça é, como funciona ou por que é importante.',
          note: 'É o texto principal para consulta e comentários.',
        },
        {
          key: 'category',
          label: 'Categoria',
          whatToWrite: 'Uma classificação complementar, se ela ajudar no seu universo.',
          note: 'É opcional e reutiliza sugestões da história.',
        },
        {
          key: 'behavior',
          label: 'Comportamento',
          whatToWrite: 'Como a criatura, povo, sistema ou conceito age.',
          note: 'Opcional; deixe vazio quando não fizer sentido.',
        },
        {
          key: 'usability',
          label: 'Usabilidade',
          whatToWrite: 'Como pode ser usado, explorado ou aplicado.',
          note: 'Opcional; é útil para recursos, flora, magia e tecnologia.',
        },
        {
          key: 'danger',
          label: 'Perigo',
          whatToWrite: 'O risco, custo ou ameaça que apresenta.',
          note: 'Opcional; não pressupõe que toda peça seja perigosa.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Ative para destacar uma peça importante.',
          note: 'Entra no filtro de favoritos.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Exceções, ideias ou lembretes.',
          note: 'Ficam nos detalhes da peça.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Uma peça não bloqueia automaticamente ações no aplicativo; ela é uma referência conectável a cenas, notas, locais, personagens e outras peças. Os campos Entity dos atributos personalizados também podem apontar para uma peça do mundo.',
    },
    { type: 'seeAlso', pages: ['scenes', 'notes', 'see-also'] },
  ],
};
export default page;
