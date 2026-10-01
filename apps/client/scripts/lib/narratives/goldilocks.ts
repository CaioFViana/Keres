import type { LocalizedNarrative, StoryNarrative } from './types';

const goldilocksEn: StoryNarrative = {
  chapters: [
    {
      name: 'Lost in the Woods',
      summary:
        'Goldilocks is told where not to go, goes there, and finds a house whose owners have never had a reason to lock anything.',
    },
    {
      name: 'Three of Everything',
      summary:
        'Every object in the house belongs to exactly one of the bears. Goldilocks works through all three sizes of each, and breaks the smallest of them.',
    },
    {
      name: 'The Bears Come Home',
      summary:
        'The bears find the evidence in the order Goldilocks left it, room by room, until the last thing they find is her.',
    },
  ],
  scenes: [
    {
      name: 'Told not to wander',
      summary:
        'Her mother sends Goldilocks on an errand and names the one path she is to keep to. The warning is specific, which is how the reader knows it will be ignored.',
      body: "'Take the mill path, stay on the mill path, and come straight home,' her mother says, which is three instructions wearing the coat of one. Goldilocks nods the way children nod at warnings: completely, and without a single attachment to the content.\n\nThe errand is small and the day is large, and the forest on either side of the mill path is doing its best to look interesting. Warnings this specific have a way of becoming itineraries in reverse.",
      location: 0,
    },
    {
      name: 'The path that was wrong',
      summary:
        'A woodcutter gives her directions that would have been right yesterday. By the time the trees close in behind her, Goldilocks can no longer say which way she came.',
      body: 'The woodcutter she meets means well, which is the trouble with him. His directions would have been exactly right yesterday, before the storm took down the marked oak - today they lead Goldilocks one fork past the mill path and into trees she has never seen.\n\nShe walks until the path gives up pretending to be a path, and then she turns around, and the trees have closed in behind her the way water closes behind a stone. She cannot say which way she came. She can only, reasonably enough, keep going.',
      location: 0,
    },
    {
      name: 'A house among the trees',
      summary:
        'A small house stands in a clearing with its door pushed to and nobody in sight. There is smoke in the chimney and something cooling on the table, which means whoever lives here has only just stepped out.',
      body: 'The house appears the way clearings appear: all at once, and politely, as if it had been waiting for someone to need it. The door stands pushed to. Nobody answers her halloo, though the chimney smokes and something on the table steams.\n\nWhoever lives here has only just stepped out - that is the inviting arithmetic of it. A house with cooling food is a house mid-sentence, and Goldilocks has always found it very hard not to finish sentences other people started.',
      location: 0,
    },
    {
      name: 'Nobody answers',
      summary:
        'Goldilocks knocks twice, waits, and lets herself in. Nothing in the house resists her, and she takes the absence of a lock for the absence of an owner.',
      body: 'She knocks twice, counts to ten twice, and pushes the door open on a room that offers no objection. Nothing resists her: no lock, no dog, no voice from upstairs. The house receives her the way water receives a foot.\n\nIt does not occur to her that an unlocked door is not an invitation. She takes the absence of a lock for the absence of an owner, steps inside, and closes the door behind her - politely, the way one closes a door at home.',
      location: 1,
    },
    {
      name: 'Three bowls of porridge',
      summary:
        'Three bowls sit cooling on the kitchen table in three sizes. The largest is too hot and the middle one too cold; the smallest is exactly right, so she finishes it.',
      body: 'Three bowls cool on the kitchen table in three sizes, and Goldilocks - who has walked further than breakfast intended - tastes the largest first. Too hot. The middle one: stone cold, and grey in a way porridge should never be.\n\nThe smallest is exactly right: warm, salted, the correct thickness, in a bowl her hands fit around. She finishes it without meaning to finish it, the way one finishes exactly-right things, and sets the spoon down neatly, as if neatness settled the account.',
      location: 2,
    },
    {
      name: 'Three chairs',
      summary:
        'Three chairs stand by the fire. The big one is too hard and the middle one too soft, and Goldilocks keeps testing rather than stopping at the first that would have done.',
      body: 'Three chairs stand by the fire, and a tired girl with a full stomach has never yet resisted a chair. The big one is too hard - sitting in it is a carpentry lesson. The middle one is too soft, and swallows her to the elbows.\n\nA sensible person would stop here. Goldilocks is not testing chairs anymore; she is testing the pattern, and the pattern says the third one will be exactly right. The pattern has been right twice today. This is how the pattern keeps its victims confident.',
      location: 3,
    },
    {
      name: 'The smallest chair breaks',
      summary:
        'The third chair fits her exactly and gives way under her. It is the first thing she cannot put back the way she found it, and she leaves the pieces where they fall.',
      body: 'The third chair fits her exactly - the height, the angle, the small of her back - and then, with a crack like a knuckle popping, it gives way under her. She lands on the floorboards holding one carved armrest, staring at it.\n\nIt is the first thing she cannot put back the way she found it. A tasted bowl can be rinsed; a sat-in chair can be straightened. A broken chair is broken in a way that stays broken. She leaves the pieces where they fall, arranged - pointlessly, guiltily - in a row.',
      location: 3,
    },
    {
      name: 'Three beds',
      summary:
        "Upstairs there are three beds, and the same test runs a third time. She falls asleep in the smallest of them, in a stranger's house, with the door still unlatched behind her.",
      body: 'Upstairs there are three beds, and Goldilocks climbs them in order, because the day has a shape now and she is following it. The first is too lumpy, the second too high, and the third - small, low, smelling of clean straw - is exactly right.\n\nShe falls asleep in minutes, in the house of strangers, with the door still unlatched behind her. It is the sleep of someone who has made every wrong decision available and is, for the moment, entirely comfortable with all of them.',
      location: 4,
    },
    {
      name: 'Someone has been at my porridge',
      summary:
        'The three bears come home to a kitchen that has been used. Two bowls have been stirred and set down again; the third has been emptied, and Baby Bear is the one who says so.',
      body: "The bears come home to a kitchen that has been used, and stand in the doorway reading it like a letter. Two bowls stirred and set down again. One bowl empty to the glaze, a spoon laid beside it with terrible neatness.\n\n'Someone has been at my porridge,' says Papa Bear, and Mama Bear says it after him, and then Baby Bear lifts his empty bowl in both paws and says it smallest and last - and his is the one that lands, because his bowl is the empty one.",
      location: 2,
    },
    {
      name: 'Someone has been sitting in my chair',
      summary:
        'Two chairs have been moved. The third is in pieces on the floor, and the discovery stops being an annoyance and becomes a loss the moment its owner sees it.',
      body: "Two chairs have been moved, which is an annoyance. The third is in pieces on the floor, arranged in a row that explains nothing, and the discovery stops being an annoyance the moment Baby Bear sees it.\n\n'Someone has been sitting in my chair,' he says, very quietly, holding the carved armrest the way one holds a hurt hand. Papa Bear puts a paw on his shoulder. There is nothing useful to say about a broken chair, so nobody says anything at all.",
      location: 3,
    },
    {
      name: 'Someone is sleeping in my bed',
      summary:
        'Two beds are rumpled. In the third there is a girl, still asleep, and the three bears stand looking at her with no idea at all what they are supposed to do next.',
      body: "Two beds are rumpled. In the third there is a girl - golden-haired, deeply asleep, one arm flung out the way sleeping children fling arms - and the three bears stand at the foot of the bed looking at her.\n\n'Someone is sleeping in my bed,' whispers Baby Bear, because somebody has to say it, and it is his bed. None of them has any idea what to do next. It is, all three agree later, the strangest moment of their lives, and none of them wants to be the one to end it.",
      location: 4,
    },
    {
      name: 'Out through the window',
      summary:
        'Goldilocks wakes to three bears at the foot of the bed and is out of the window before anyone speaks. Nobody chases her; the bears are as frightened as she is, and they are the ones left with the mess.',
      body: 'Goldilocks wakes to three bears at the foot of the bed. There is a half-second - enormous, silent - in which everyone in the room understands everything. Then she is out of the window before anyone speaks, the way squirrels leave.\n\nNobody chases her. The bears are as frightened as she is - Papa Bear says so at supper, and nobody contradicts him - and they are the ones left with the mess: the bowl, the chair, the rumpled beds, and a story they will tell for years.',
      location: 0,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'The Forest',
      description:
        'Dense woods with one path through them and a great many ways off it. Everyone who lives here knows the way; Goldilocks is the only person in the story who does not.',
    },
    {
      name: "The Three Bears' House",
      description:
        'A small house in a clearing, furnished throughout in three sizes. The door has no lock, because in all the years the bears have lived here nobody has ever come to it.',
    },
    {
      name: 'The Kitchen',
      description:
        'Where the porridge is made and set out to cool in three bowls, during the half-hour the bears spend walking so that it will be cool enough to eat.',
    },
    {
      name: 'The Sitting Room',
      description:
        'The room by the fire with the three chairs - the only room in the house where something ends up broken.',
    },
    {
      name: 'The Upstairs Bedroom',
      description:
        'The room under the roof with three beds side by side, where the smallest is short enough for a child and long enough for Goldilocks.',
    },
  ],
  characters: [
    {
      name: 'Goldilocks',
      description:
        'A curious girl who loses her way on an errand and treats an empty house as an invitation. She is not malicious; she simply never once asks whether she is allowed.',
    },
    {
      name: 'Papa Bear',
      description:
        'The largest of the three bears, owner of the big bowl, the hard chair and the long bed. He speaks first at every discovery, and loudest.',
    },
    {
      name: 'Mama Bear',
      description:
        'The middle bear, owner of the middle bowl, the soft chair and the middle bed. She notices the state of a room before she notices what is missing from it.',
    },
    {
      name: 'Baby Bear',
      description:
        'The smallest of the three bears, and the only one who actually loses anything: his porridge, his chair, and finally the sight of a stranger in his bed.',
    },
    {
      name: 'The Woodcutter',
      description:
        'A woodcutter working the far side of the forest, who gives Goldilocks directions in good faith and never learns what they cost her.',
    },
    {
      name: "Goldilocks's Mother",
      description:
        'The one person in the story who states a rule out loud, right at the beginning, and is not present for a single moment of what follows.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 10, 11],
    [8, 9, 10, 11],
    [8, 9, 10, 11],
    [8, 9, 10, 11],
    [1],
    [0],
  ],
  relations: [
    { pair: [1, 2], type: 'Married' },
    { pair: [1, 3], type: 'Father and son' },
    { pair: [2, 3], type: 'Mother and son' },
    { pair: [0, 5], type: 'Mother and daughter' },
    { pair: [0, 4], type: 'Gave her directions' },
    { pair: [0, 3], type: 'Took what was his' },
    { pair: [0, 1], type: 'Woke to find her' },
  ],
  items: [
    {
      name: "Baby Bear's Bowl of Porridge",
      description:
        'The smallest of the three bowls left cooling on the table, made to a size nobody else in the house would want. It is the only one that is exactly right, and the only one that ends up empty.',
      category: 'Household object',
      initialState: 'Cooling on the table',
      owner: 3,
      journey: [
        { scene: 4, state: 'Eaten to the bottom', owner: 0 },
        { scene: 8, state: 'Found empty', owner: 3 },
        { scene: 11, state: 'Still empty when she goes', owner: 3 },
      ],
    },
    {
      name: "Baby Bear's Chair",
      description:
        'The smallest of the three chairs by the fire, built for someone the size of its owner. It is the one thing in the house Goldilocks cannot put back as she found it.',
      category: 'Household object',
      initialState: 'By the fire, whole',
      owner: 3,
      journey: [
        { scene: 5, state: 'Sat in', owner: 0 },
        { scene: 6, state: 'Broken through the seat', owner: null },
        { scene: 9, state: 'Found in pieces', owner: 3 },
      ],
    },
    {
      name: "Baby Bear's Bed",
      description:
        'The smallest of the three beds under the roof, short enough for its owner and, as it turns out, exactly long enough for a lost girl.',
      category: 'Household object',
      initialState: 'Made, and empty',
      owner: 3,
      journey: [
        { scene: 7, state: 'Slept in', owner: 0 },
        { scene: 10, state: 'Found occupied', owner: 3 },
        { scene: 11, state: 'Empty again, and unmade', owner: 3 },
      ],
    },
  ],
  worldRules: [
    {
      title: 'Curiosity Without Permission',
      description:
        'Walking in uninvited and trying what is not yours is never punished in this story, and never excused either. Goldilocks loses nothing at all; the bears are left with an empty bowl and a broken chair, and that asymmetry is the whole of the lesson.',
    },
    {
      title: 'Three of Everything',
      description:
        'The house is furnished in three sizes and every object in it belongs to exactly one bear. Nothing here is communal or anonymous, which is why each discovery has a specific owner to be wronged by it.',
    },
    {
      title: 'The House Was Never Locked',
      description:
        'Nobody in the forest locks a door, because nobody in the forest has ever needed to. What Goldilocks does is only possible because the bears live somewhere that has never required the precaution, and that is why their reaction is fright rather than anger.',
    },
  ],
  notes: [
    {
      title: 'Continuity: the half-hour of porridge',
      body: 'The bears are only out walking because the porridge is too hot. The whole story fits inside the time it takes to cool, and no scene should imply they were gone longer than that.',
    },
    {
      title: 'Visual motif: three, then one',
      body: 'Every discovery is staged the same way - big, middle, small - and lands on the smallest. Keep the rhythm identical across porridge, chairs and beds so that the last one carries the weight.',
    },
    {
      title: 'Revision goal: nobody is a villain',
      body: 'Goldilocks is not a thief and the bears are not monsters. Every scene should be readable as an accident between people who never expected to meet.',
    },
  ],
  tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
  choiceLabel: 'Continue toward',
  triggers: { set: 'entered_uninvited', unset: 'still_on_the_path' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 4 },
    { type: 'itemTake', item: 1, scene: 6 },
    { type: 'triggerSet', item: null, scene: 3 },
    { type: 'triggerUnset', item: null, scene: 1 },
  ],
};

const goldilocksPt: StoryNarrative = {
  chapters: [
    {
      name: 'Perdida na Mata',
      summary:
        'Cachinhos Dourados ouve por onde não deve ir, vai exatamente por ali, e encontra uma casa cujos donos nunca tiveram motivo para trancar nada.',
    },
    {
      name: 'Três de Cada Coisa',
      summary:
        'Cada objeto da casa pertence a exatamente um dos ursos. Cachinhos experimenta os três tamanhos de cada um, e quebra o menor deles.',
    },
    {
      name: 'Os Ursos Voltam para Casa',
      summary:
        'Os ursos encontram os vestígios na ordem em que Cachinhos os deixou, cômodo por cômodo, até que a última coisa que encontram é ela.',
    },
  ],
  scenes: [
    {
      name: 'Avisada para não se afastar',
      summary:
        'A mãe manda Cachinhos Dourados fazer um mandado e nomeia o único caminho de que ela não deve sair. O aviso é específico, e é assim que o leitor sabe que será ignorado.',
      body: '- Vá pelo caminho do moinho, fique no caminho do moinho e volte direto para casa - diz a mãe, o que são três instruções vestindo o casaco de uma. Cachinhos assente como crianças assentem a avisos: por completo, e sem nenhum apego ao conteúdo.\n\nO mandado é pequeno e o dia é grande, e a mata de cada lado do caminho do moinho se esforça para parecer interessante. Avisos tão específicos têm um jeito de virar itinerários ao contrário.',
      location: 0,
    },
    {
      name: 'O caminho errado',
      summary:
        'Um lenhador lhe dá indicações que teriam valido ontem. Quando as árvores se fecham atrás dela, Cachinhos já não sabe dizer por onde veio.',
      body: 'O lenhador que ela encontra é bem-intencionado, que é o problema dele. As indicações dele teriam sido exatamente certas ontem, antes que a tempestade derrubasse o carvalho marcado - hoje levam Cachinhos uma bifurcação além do caminho do moinho, para árvores que ela nunca viu.\n\nEla anda até o caminho desistir de fingir que é caminho, e então se vira, e as árvores se fecharam atrás dela como a água se fecha atrás de uma pedra. Ela não sabe dizer por onde veio. Só pode, com bastante razão, continuar indo.',
      location: 0,
    },
    {
      name: 'Uma casa entre as árvores',
      summary:
        'Uma casinha aparece numa clareira, com a porta encostada e ninguém à vista. Há fumaça na chaminé e algo esfriando sobre a mesa, o que significa que quem mora ali acabou de sair.',
      body: 'A casa aparece como clareiras aparecem: de uma vez, e educadamente, como se estivesse esperando alguém precisar dela. A porta está encostada. Ninguém responde ao seu chamado, embora a chaminé solte fumaça e algo sobre a mesa solte vapor.\n\nQuem mora aqui acabou de sair - essa é a aritmética convidativa da coisa. Uma casa com comida esfriando é uma casa no meio da frase, e Cachinhos sempre achou muito difícil não terminar a frase dos outros.',
      location: 0,
    },
    {
      name: 'Ninguém atende',
      summary:
        'Cachinhos bate duas vezes, espera e entra. Nada na casa lhe oferece resistência, e ela toma a ausência de tranca pela ausência de dono.',
      body: 'Ela bate duas vezes, conta até dez duas vezes, e empurra a porta para um cômodo que não oferece objeção. Nada lhe resiste: nem tranca, nem cachorro, nem voz lá de cima. A casa a recebe como a água recebe um pé.\n\nNão lhe ocorre que uma porta destrancada não é um convite. Ela toma a ausência de tranca pela ausência de dono, entra, e fecha a porta atrás de si - educadamente, como se fecha uma porta em casa.',
      location: 1,
    },
    {
      name: 'Três tigelas de mingau',
      summary:
        'Três tigelas esfriam sobre a mesa da cozinha, em três tamanhos. A maior está quente demais e a do meio, fria demais; a menor está exatamente boa, então ela a termina.',
      body: 'Três tigelas esfriam sobre a mesa da cozinha em três tamanhos, e Cachinhos - que andou mais do que o café da manhã previa - prova primeiro a maior. Quente demais. A do meio: fria feito pedra, e cinzenta de um jeito que mingau nenhum deveria ser.\n\nA menor está exatamente boa: morna, salgada, na espessura certa, numa tigela que cabe nas suas mãos. Ela a termina sem querer terminar, como se termina as coisas exatamente boas, e pousa a colher com capricho, como se o capricho quitasse a conta.',
      location: 2,
    },
    {
      name: 'Três cadeiras',
      summary:
        'Três cadeiras estão junto à lareira. A grande é dura demais e a do meio, mole demais, e Cachinhos continua testando em vez de parar na primeira que já teria servido.',
      body: 'Três cadeiras estão junto à lareira, e uma menina cansada de barriga cheia jamais resistiu a uma cadeira. A grande é dura demais - sentar nela é uma aula de marcenaria. A do meio é mole demais, e a engole até os cotovelos.\n\nUma pessoa sensata pararia aqui. Cachinhos já não está testando cadeiras; está testando o padrão, e o padrão diz que a terceira será exatamente boa. O padrão acertou duas vezes hoje. É assim que o padrão mantém suas vítimas confiantes.',
      location: 3,
    },
    {
      name: 'A cadeira menor quebra',
      summary:
        'A terceira cadeira serve exatamente e cede sob ela. É a primeira coisa que ela não consegue devolver ao estado em que encontrou, e deixa os pedaços onde caem.',
      body: 'A terceira cadeira serve exatamente - a altura, o ângulo, o vão das costas - e então, com um estalo de junta estalando, cede sob ela. Ela aterrissa no assoalho segurando um braço entalhado, olhando para ele.\n\nÉ a primeira coisa que ela não consegue devolver ao estado em que encontrou. Uma tigela provada pode ser lavada; uma cadeira usada pode ser endireitada. Uma cadeira quebrada fica quebrada de um jeito que continua quebrado. Ela deixa os pedaços onde caem, arrumados - inutilmente, culpadamente - em fila.',
      location: 3,
    },
    {
      name: 'Três camas',
      summary:
        'Lá em cima há três camas, e o mesmo teste se repete pela terceira vez. Ela adormece na menor delas, na casa de estranhos, com a porta ainda destrancada às suas costas.',
      body: 'Lá em cima há três camas, e Cachinhos as escala em ordem, porque o dia já tem um formato e ela o está seguindo. A primeira é encaroçada demais, a segunda alta demais, e a terceira - pequena, baixa, cheirando a palha limpa - está exatamente boa.\n\nEla adormece em minutos, na casa de estranhos, com a porta ainda destrancada às suas costas. É o sono de quem tomou todas as decisões erradas disponíveis e está, por enquanto, inteiramente em paz com todas elas.',
      location: 4,
    },
    {
      name: 'Alguém mexeu no meu mingau',
      summary:
        'Os três ursos voltam para uma cozinha que foi usada. Duas tigelas foram mexidas e recolocadas; a terceira está vazia, e é o Ursinho quem diz isso em voz alta.',
      body: 'Os ursos voltam para uma cozinha que foi usada, e param na porta lendo-a como uma carta. Duas tigelas mexidas e recolocadas. Uma tigela vazia até o verniz, uma colher pousada ao lado com um capricho terrível.\n\n- Alguém mexeu no meu mingau - diz o Papai Urso, e a Mamãe Ursa repete depois dele, e então o Ursinho ergue a tigela vazia nas duas patas e diz por último e mais baixinho - e é o dele que pesa, porque a tigela vazia é a dele.',
      location: 2,
    },
    {
      name: 'Alguém sentou na minha cadeira',
      summary:
        'Duas cadeiras foram movidas. A terceira está em pedaços no chão, e a descoberta deixa de ser um aborrecimento e vira uma perda no instante em que o dono a vê.',
      body: 'Duas cadeiras foram movidas, o que é um aborrecimento. A terceira está em pedaços no chão, arrumados numa fila que nada explica, e a descoberta deixa de ser um aborrecimento no instante em que o Ursinho a vê.\n\n- Alguém sentou na minha cadeira - ele diz, bem quieto, segurando o braço entalhado como se segura uma mão machucada. O Papai Urso pousa uma pata no ombro dele. Não há nada de útil a dizer sobre uma cadeira quebrada, então ninguém diz nada.',
      location: 3,
    },
    {
      name: 'Alguém está dormindo na minha cama',
      summary:
        'Duas camas estão amassadas. Na terceira há uma menina, ainda dormindo, e os três ursos ficam olhando para ela sem a menor ideia do que deveriam fazer em seguida.',
      body: 'Duas camas estão amassadas. Na terceira há uma menina - de cabelos dourados, profundamente adormecida, um braço jogado como crianças dormindo jogam braços - e os três ursos ficam ao pé da cama olhando para ela.\n\n- Alguém está dormindo na minha cama - sussurra o Ursinho, porque alguém tem que dizer, e a cama é dele. Nenhum deles tem ideia do que fazer em seguida. É, os três concordarão depois, o momento mais estranho de suas vidas, e nenhum quer ser quem vai encerrá-lo.',
      location: 4,
    },
    {
      name: 'Pela janela afora',
      summary:
        'Cachinhos acorda com três ursos ao pé da cama e some pela janela antes que alguém fale. Ninguém a persegue; os ursos estão tão assustados quanto ela, e são eles que ficam com a bagunça.',
      body: 'Cachinhos acorda com três ursos ao pé da cama. Há meio segundo - enorme, silencioso - em que todos no quarto entendem tudo. Então ela some pela janela antes que alguém fale, como esquilos partem.\n\nNinguém a persegue. Os ursos estão tão assustados quanto ela - o Papai Urso diz isso no jantar, e ninguém o contradiz - e são eles que ficam com a bagunça: a tigela, a cadeira, as camas amassadas, e uma história que contarão por anos.',
      location: 0,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'A Mata',
      description:
        'Mata fechada, com um caminho atravessando-a e um sem-número de maneiras de sair dele. Todo mundo que vive ali sabe o caminho; Cachinhos é a única pessoa da história que não sabe.',
    },
    {
      name: 'A Casa dos Três Ursos',
      description:
        'Uma casinha numa clareira, mobiliada de ponta a ponta em três tamanhos. A porta não tem tranca, porque em todos os anos em que os ursos vivem ali nunca ninguém bateu nela.',
    },
    {
      name: 'A Cozinha',
      description:
        'Onde o mingau é feito e posto para esfriar em três tigelas, durante a meia hora que os ursos passam caminhando para que dê para comer.',
    },
    {
      name: 'A Sala',
      description:
        'O cômodo junto à lareira, com as três cadeiras - o único da casa onde alguma coisa acaba quebrada.',
    },
    {
      name: 'O Quarto de Cima',
      description:
        'O cômodo sob o telhado, com três camas lado a lado, onde a menor é curta o bastante para uma criança e comprida o bastante para Cachinhos.',
    },
  ],
  characters: [
    {
      name: 'Cachinhos Dourados',
      description:
        'Uma menina curiosa que se perde num mandado e trata uma casa vazia como um convite. Não é maldosa; apenas não pergunta uma única vez se pode.',
    },
    {
      name: 'Papai Urso',
      description:
        'O maior dos três ursos, dono da tigela grande, da cadeira dura e da cama comprida. Fala primeiro em cada descoberta, e mais alto.',
    },
    {
      name: 'Mamãe Ursa',
      description:
        'A ursa do meio, dona da tigela do meio, da cadeira macia e da cama do meio. Nota o estado de um cômodo antes de notar o que falta nele.',
    },
    {
      name: 'Ursinho',
      description:
        'O menor dos três ursos, e o único que de fato perde alguma coisa: seu mingau, sua cadeira e, por fim, a visão de uma estranha em sua cama.',
    },
    {
      name: 'O Lenhador',
      description:
        'Um lenhador que trabalha do outro lado da mata e dá indicações a Cachinhos de boa-fé, sem nunca saber o que elas lhe custaram.',
    },
    {
      name: 'A Mãe de Cachinhos',
      description:
        'A única pessoa da história que enuncia uma regra em voz alta, logo no começo, e não está presente em um único momento do que se segue.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 10, 11],
    [8, 9, 10, 11],
    [8, 9, 10, 11],
    [8, 9, 10, 11],
    [1],
    [0],
  ],
  relations: [
    { pair: [1, 2], type: 'Casados' },
    { pair: [1, 3], type: 'Pai e filho' },
    { pair: [2, 3], type: 'Mãe e filho' },
    { pair: [0, 5], type: 'Mãe e filha' },
    { pair: [0, 4], type: 'Deu-lhe as indicações' },
    { pair: [0, 3], type: 'Tomou o que era dele' },
    { pair: [0, 1], type: 'Acordou e a encontrou' },
  ],
  items: [
    {
      name: 'A Tigela de Mingau do Ursinho',
      description:
        'A menor das três tigelas postas para esfriar sobre a mesa, feita num tamanho que mais ninguém da casa quereria. É a única que está exatamente boa, e a única que acaba vazia.',
      category: 'Objeto doméstico',
      initialState: 'Esfriando sobre a mesa',
      owner: 3,
      journey: [
        { scene: 4, state: 'Comida até o fundo', owner: 0 },
        { scene: 8, state: 'Encontrada vazia', owner: 3 },
        { scene: 11, state: 'Ainda vazia quando ela some', owner: 3 },
      ],
    },
    {
      name: 'A Cadeira do Ursinho',
      description:
        'A menor das três cadeiras junto à lareira, feita para alguém do tamanho de seu dono. É a única coisa da casa que Cachinhos não consegue devolver como encontrou.',
      category: 'Objeto doméstico',
      initialState: 'Junto à lareira, inteira',
      owner: 3,
      journey: [
        { scene: 5, state: 'Sentada nela', owner: 0 },
        { scene: 6, state: 'Quebrada pelo assento', owner: null },
        { scene: 9, state: 'Encontrada em pedaços', owner: 3 },
      ],
    },
    {
      name: 'A Cama do Ursinho',
      description:
        'A menor das três camas sob o telhado, curta o bastante para seu dono e, como se vê, exatamente comprida o bastante para uma menina perdida.',
      category: 'Objeto doméstico',
      initialState: 'Arrumada, e vazia',
      owner: 3,
      journey: [
        { scene: 7, state: 'Dormida', owner: 0 },
        { scene: 10, state: 'Encontrada ocupada', owner: 3 },
        { scene: 11, state: 'Vazia de novo, e desarrumada', owner: 3 },
      ],
    },
  ],
  worldRules: [
    {
      title: 'Curiosidade Sem Permissão',
      description:
        'Entrar sem convite e experimentar o que não é seu nunca é punido nesta história, e nunca é desculpado tampouco. Cachinhos não perde absolutamente nada; os ursos ficam com uma tigela vazia e uma cadeira quebrada, e essa assimetria é toda a lição.',
    },
    {
      title: 'Três de Cada Coisa',
      description:
        'A casa é mobiliada em três tamanhos e cada objeto pertence a exatamente um urso. Nada ali é comum ou anônimo, e é por isso que cada descoberta tem um dono específico a ser lesado por ela.',
    },
    {
      title: 'A Casa Nunca Esteve Trancada',
      description:
        'Ninguém na mata tranca porta, porque ninguém na mata jamais precisou. O que Cachinhos faz só é possível porque os ursos vivem num lugar que nunca exigiu a precaução, e é por isso que a reação deles é susto, e não raiva.',
    },
  ],
  notes: [
    {
      title: 'Continuidade: a meia hora do mingau',
      body: 'Os ursos só estão fora porque o mingau está quente demais. A história inteira cabe no tempo que ele leva para esfriar, e nenhuma cena deve sugerir que ficaram fora mais tempo que isso.',
    },
    {
      title: 'Motivo visual: três, depois um',
      body: 'Toda descoberta é encenada do mesmo jeito - grande, médio, pequeno - e recai sobre o menor. Manter o ritmo idêntico entre mingau, cadeiras e camas para que o último carregue o peso.',
    },
    {
      title: 'Meta de revisão: ninguém é vilão',
      body: 'Cachinhos não é ladra e os ursos não são monstros. Toda cena deve poder ser lida como um acidente entre pessoas que nunca esperaram se encontrar.',
    },
  ],
  tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
  choiceLabel: 'Continuar em direção a',
  triggers: { set: 'entrou_sem_convite', unset: 'ainda_no_caminho' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 4 },
    { type: 'itemTake', item: 1, scene: 6 },
    { type: 'triggerSet', item: null, scene: 3 },
    { type: 'triggerUnset', item: null, scene: 1 },
  ],
};

export const goldilocks: LocalizedNarrative = { en: goldilocksEn, pt: goldilocksPt };
