import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'songs',
  title: 'Canções',
  summary:
    'Escreva as canções da sua história como cifras: a letra com seus acordes, em seções, e uma tradução se for cantada em outra língua. Uma cena pode cantar a canção toda ou só o refrão. Você também pode escrever a melodia e ouvi-la cantarolada.',
  keywords: [
    'canção',
    'cancao',
    'canções',
    'cancoes',
    'música',
    'musica',
    'letra',
    'cifra',
    'cifras',
    'acordes',
    'chordpro',
    'verso',
    'refrão',
    'refrao',
    'ponte',
    'seção',
    'secao',
    'transpor',
    'sílabas',
    'silabas',
    'andamento',
    'tom',
    'compasso',
    'tradução',
    'traducao',
    'melodia',
    'hino',
    'cantiga',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma canção é uma música com palavras: uma canção de taverna, um hino, uma cantiga de ninar. Você escreve a letra como uma cifra — as palavras, com os acordes entre colchetes logo antes da sílaba em que caem — e marca as seções: versos, refrão, ponte. Ela é guardada como texto simples num formato comum (ChordPro), então lê-se sem o app e qualquer outra ferramenta que conheça o formato abre.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O bardo canta “A Canção do Lampião” na cena da taverna, e só o refrão na cena do funeral. Você escreve a canção uma vez; cada cena diz quais seções canta. Ao publicar, a letra pode ir no fim da cena ou num adendo de canções.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra as Canções pela Galeria e adicione uma canção com seu título.',
        'Escreva a letra. Ponha o acorde entre colchetes antes da sílaba em que cai: [G]A noite des[Em]ce.',
        'Acrescente os versos e o refrão com os botões acima da letra. Cada seção recebe um nome; duas seções não podem ter o mesmo.',
        'Passe para Cifra para ver os acordes sobre as palavras, e conte as sílabas se quiser conferir a métrica.',
        'Numa cena, abra sua música, adicione a canção e escolha quais seções a cena canta.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Título',
          whatToWrite: 'Como a canção se chama.',
          note: 'Obrigatório.',
        },
        {
          key: 'lyrics',
          label: 'Letra',
          whatToWrite:
            'O que se canta, com os acordes entre colchetes e as seções marcadas: {start_of_verse: Verso 1} … {end_of_verse}, {start_of_chorus: Refrão} … {end_of_chorus}. Um ponto médio (·) entre sílabas as marca com exatidão para o contador e nunca é impresso.',
          note: 'Na língua em que a canção é cantada, inclusive uma inventada. Até 16.000 caracteres.',
        },
        {
          key: 'lyricsTranslation',
          label: 'Tradução',
          whatToWrite:
            'Para uma canção cantada em outra língua: as mesmas palavras na sua, sob as mesmas marcas de seção, sem acordes.',
          note: 'Opcional. Só é lida, nunca cantada. Ao publicar você escolhe imprimir as palavras cantadas, a tradução ou as duas.',
        },
        {
          key: 'melody',
          label: 'Melodia',
          whatToWrite:
            'As notas da melodia, em notação ABC: C D E2 z, letra minúscula para a oitava acima, ^ para sustenido, _ para bemol, /2 para metade da duração, z para pausa. P:Verso 1 começa a melodia de uma seção.',
          note: 'Opcional. Uma nota para cada sílaba, na ordem. Uma seção sem melodia própria canta a da seção do mesmo tipo antes dela, então uma balada de muitos versos se escreve uma vez. Até 8.000 caracteres.',
        },
        {
          key: 'notes',
          label: 'Notas',
          whatToWrite:
            'Para que serve a canção: quem a canta, a cultura de onde vem, sua métrica e rima.',
          note: 'Opcional. Nunca publicada.',
        },
        {
          key: 'key',
          label: 'Tom',
          whatToWrite: 'O tom em que os acordes estão escritos: G, Em, Bb.',
          note: 'Opcional. Transpor o move junto com os acordes.',
        },
        {
          key: 'tempo',
          label: 'Andamento',
          whatToWrite: 'Batidas por minuto, de 20 a 300.',
          note: 'Opcional. Define quanto tempo se diz que a canção dura.',
        },
        {
          key: 'meter',
          label: 'Compasso',
          whatToWrite: 'Batidas por compasso e a nota que vale uma: 4/4, 3/4, 6/8.',
          note: 'Opcional. Uma canção tem um andamento e um compasso.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Seções' },
    {
      type: 'paragraph',
      text: 'Uma cena nomeia as seções que canta pelos rótulos. Se você renomear ou apagar uma seção depois, a cena imprime o que ainda existe; se nada do que ela nomeou sobrou, imprime a canção inteira, e a Análise da História avisa. Duas seções com o mesmo nome não se distinguem, então o editor oferece numerá-las.',
    },
    { type: 'heading', level: 2, text: 'A melodia, e ouvi-la' },
    {
      type: 'paragraph',
      text: 'Na aba Melodia você toca as notas num teclado ou as escreve como texto. O botão grande cantarola a melodia com uma voz sintética (um cantarolar, “ah” ou “lá”) enquanto a letra acompanha linha a linha; dá para somar um metrônomo, ou um instrumento — violão, harpa, piano ou violino — que toca as cifras da letra numa levada própria (valsa, balada, marcha, cantiga de ninar). Sem melodia, o instrumento toca só as cifras, um compasso para cada. Para cada seção, o painel diz quantas notas há para as sílabas; as sílabas são só estimadas, então uma diferença é um aviso, não um erro.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'O som é feito no seu aparelho quando você toca, e guardado para a próxima vez. É um rascunho para ouvir a melodia, não uma gravação: não canta palavras. Você também pode tirar a melodia em arquivo MIDI ou ABC (com a letra sob as notas).',
    },
    { type: 'heading', level: 2, text: 'Mudar de tom' },
    {
      type: 'paragraph',
      text: 'Transpor move todos os acordes, o tom e as notas da melodia, um semitom por vez. As palavras nunca são tocadas.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Escreva letras suas. Para a canção de outra pessoa, guarde um link na Galeria: uma letra colada aqui pode ir parar na sua história publicada.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Uma canção pertence à história, e as cenas que a cantam apontam para ela. Apagá-la não perde essas notas: as cenas a mostram como removida até você escolher outra. Cada canção conta para o limite de itens do seu plano. As canções vão com a história quando você a exporta, e dá para exportar uma canção como arquivo ChordPro.',
    },
  ],
};
export default page;
