import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'vocabulary',
  title: 'Vocabulário',
  summary: 'Renomeie os conceitos centrais de uma história sem alterar seus dados ou estrutura.',
  keywords: [
    'termos',
    'renomear',
    'personagem',
    'cena',
    'item',
    'regra do mundo',
    'escolha',
    'gramática',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Vocabulário permite que uma história use seus próprios nomes para conceitos centrais. Uma história em quadrinhos pode chamar Personagens de “Heróis”, Cenas de “Páginas”, Itens de “Artefatos” e Escolhas de “Decisões”. Os tipos de entidade, ids, sincronização, exportações e packs continuam os mesmos.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Uma história em quadrinhos pode nomear Personagens como “Heróis”, Cenas como “Páginas”, Itens como “Artefatos” e Escolhas como “Decisões”, mantendo todos os recursos normais do Keres.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Personalização', 'Vocabulário'] },
    {
      type: 'steps',
      items: [
        'Escolha o idioma no qual você quer escrever o vocabulário.',
        'Para cada conceito, informe singular e plural, ou deixe os dois vazios para manter a nomenclatura normal do Keres.',
        'Em português, escolha o gênero gramatical para que as mensagens ao redor concordem com o termo.',
        'Salve o vocabulário. Os rótulos das telas relacionadas, busca, histórico de atividades e controles passam a usá-lo imediatamente.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'language',
          label: 'Idioma do vocabulário',
          whatToWrite:
            'Escolha Português ou Inglês, de acordo com o idioma em que você está nomeando os conceitos da história.',
          note: 'Quando a interface estiver no outro idioma, o Keres usa seus termos traduzidos normais em vez de misturar idiomas.',
        },
        {
          key: 'singular',
          label: 'Singular',
          whatToWrite: 'Uma instância do conceito, como “Artefato” ou “Decisão”.',
        },
        {
          key: 'plural',
          label: 'Plural',
          whatToWrite: 'Várias instâncias do conceito, como “Artefatos” ou “Decisões”.',
          note: 'Singular e plural devem ser preenchidos juntos.',
        },
        {
          key: 'gender',
          label: 'Gênero',
          whatToWrite: 'Em português, escolha masculino, feminino ou neutro.',
          note: 'Ele só controla a concordância no texto português ao redor; não muda o nome que você escreveu.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que pode ser renomeado' },
    {
      type: 'table',
      headers: ['Conceito', 'Exemplos'],
      rows: [
        ['Personagem', 'Herói, detetive, personagem-jogador'],
        ['Local', 'Cenário, reino, lugar'],
        ['Capítulo e Evento', 'Episódio, edição, período histórico'],
        ['Cena', 'Página, batida, encontro'],
        ['Item', 'Artefato, carta, recurso'],
        ['Regra do Mundo', 'Entrada de lore, regra do cânone'],
        ['Escolha', 'Decisão, opção, ramificação'],
      ],
    },
    {
      type: 'paragraph',
      text: 'Jornada de Item deriva de Item. Se Item vira “Artefato”, o Keres diz “Jornada de Artefato” sem pedir que você mantenha um segundo nome.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Os termos escolhidos aparecem nas listas, formulários, detalhes, busca, histórico de atividades e controles relacionados. Jornada de Item deriva seu nome visível de Item.',
    },
    { type: 'heading', level: 3, text: 'O que não faz' },
    {
      type: 'list',
      items: [
        'Não renomeia os tipos de entidade armazenados, alvos de atributos customizados, URLs ou operações de sincronização.',
        'Não traduz automaticamente seu vocabulário para o outro idioma.',
        'Não renomeia um conceito globalmente em todas as histórias; o vocabulário pertence apenas à história atual.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Você pode alterar ou limpar o vocabulário depois com segurança. Deixar um par vazio restaura o termo padrão do Keres para aquele conceito; nenhum conteúdo da história é convertido ou perdido.',
    },
    { type: 'seeAlso', pages: ['custom-attributes', 'items', 'choices', 'world-rules'] },
  ],
};

export default page;
