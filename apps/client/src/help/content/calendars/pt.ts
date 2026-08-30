import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'calendars',
  title: 'Calendários do seu mundo',
  summary: 'Dê à história meses, semanas e eras próprios, e veja as datas neles.',
  keywords: ['calendário', 'data', 'era', 'mês', 'semana', 'estação', 'lua', 'agenda', 'tempo'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um calendário descreve como o seu mundo conta o tempo: quantos meses tem um ano, o tamanho de cada um, quantos dias formam uma semana e a partir de quais eras os anos são contados. Você também pode dar a ele estações e luas.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Um calendário muda apenas como o tempo é lido. Ele nunca muda nada do que você já escreveu, então dá para criar, editar ou excluir a qualquer momento sem perder uma palavra.',
    },
    {
      type: 'paragraph',
      text: 'As cenas continuam registrando intervalo e duração exatamente como antes — um número e uma unidade, como "3 meses". O que o calendário decide é quanto tempo três meses seus realmente duram.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'paragraph',
      text: 'Duas coisas. Primeiro, o app deixa de adivinhar: sem calendário ele assume semana de sete dias e ano de cerca de 365, o que está errado para a maioria dos mundos inventados. Segundo, depois que você diz quando a história começa, a linha do tempo passa a rotular cada cena com uma data do seu calendário em vez de apenas informar quanto tempo se passou.',
    },
    {
      type: 'example',
      title: 'Um ano de dez meses',
      text: 'Seu mundo tem dez meses de trinta dias e uma semana de seis dias. Você registra isso como calendário e diz que a primeira cena acontece em 1 de Degelo, ano 3019 da Terceira Era. Daí em diante a linha do tempo mostra "14 de Colheita, 3019 T.E." ao lado de cada cena, e um intervalo de "2 meses" conta sessenta dias, não sessenta e um.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Personalização', 'Calendários'] },
    {
      type: 'steps',
      items: [
        'Abra Personalização no menu da história e escolha Calendários. Também dá para chegar lá pelas Configurações da história, ao lado da opção que ele substitui.',
        'Escolha Novo calendário e dê um nome a ele.',
        'Adicione os meses, cada um com nome e quantidade de dias. O ano tem o tamanho que a soma deles der — a tela mostra o total conforme você digita.',
        'Informe quantos dias tem a semana. Nomear os dias é opcional: deixe vazio ou nomeie todos.',
        'Abra as opções extras se o seu mundo também tiver relógio, eras, estações ou luas próprias. Tudo ali pode ficar como está.',
        'Salve. O primeiro calendário vira o principal automaticamente.',
        'De volta à tela de Calendários, preencha quando a história começa. Até fazer isso, a linha do tempo mostra o tempo decorrido mas nenhuma data.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'months',
          label: 'Meses',
          whatToWrite: 'Um nome e uma quantidade de dias para cada um, na ordem.',
          note: 'O nome pode ficar em branco; o mês passa a aparecer pelo número.',
        },
        {
          key: 'daysPerWeek',
          label: 'Dias na semana',
          whatToWrite: 'Quantos dias passam antes de o ciclo se repetir.',
        },
        {
          key: 'eras',
          label: 'Eras',
          whatToWrite: 'Um nome, uma sigla e o ano em que a era começa.',
          note: 'Os anos passam a ser contados a partir da era em que caem, como em "3019 T.E.".',
        },
        {
          key: 'seasons',
          label: 'Estações',
          whatToWrite: 'Um nome e o dia do ano em que começa.',
          note: 'Mostradas ao lado das datas. Nada na história é escrito em estações.',
        },
        {
          key: 'moons',
          label: 'Luas',
          whatToWrite: 'Quantos dias dura um ciclo completo e um dia em que a lua estava nova.',
          note: 'O app deduz todas as outras fases a partir desses dois números.',
        },
        {
          key: 'epoch',
          label: 'Quando a história começa',
          whatToWrite: 'A data da primeira cena, no calendário principal.',
          note: 'Deixe vazio e nenhuma data aparece. Nada mais deixa de funcionar.',
        },
      ],
    },
    { type: 'heading', level: 3, text: 'Mais de um calendário' },
    {
      type: 'paragraph',
      text: 'Uma história pode ter vários. Um deles é o principal: é nele que a linha do tempo e a agenda são desenhadas, e é ele que decide quanto vale um mês ou uma semana. Os outros são leituras alternativas do mesmo momento — úteis quando dois povos do seu mundo contam o tempo de formas diferentes.',
    },
    { type: 'heading', level: 3, text: 'A agenda' },
    {
      type: 'paragraph',
      text: 'Quando a história tem calendário e data de início, a agenda mostra um mês por vez com as cenas e os eventos que caem em cada dia. Os botões dela avançam para a próxima cena e para o próximo evento, e não para o próximo mês, porque uma história que atravessa séculos tem muitos meses vazios e nenhum deles vale a pena folhear.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A linha do tempo mede intervalos e durações com o calendário principal e rotula as linhas com datas. As telas de cena e de capítulo leem os tempos da mesma forma, inclusive com a opção de normalizar das Configurações da história. Os atributos personalizados ganham um tipo de campo para datas do seu calendário, mantido separado do campo de data comum para que a ficção histórica ainda possa registrar datas reais.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Renomear um mês depois de datar coisas muda como essas datas são escritas, não em que dia elas caem. Nada se move.',
    },
    { type: 'seeAlso', pages: ['scene-timing', 'story-settings', 'custom-attributes', 'chapters'] },
  ],
};
export default page;
