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
      location: 0,
    },
    {
      name: 'The path that was wrong',
      summary:
        'A woodcutter gives her directions that would have been right yesterday. By the time the trees close in behind her, Goldilocks can no longer say which way she came.',
      location: 0,
    },
    {
      name: 'A house among the trees',
      summary:
        'A small house stands in a clearing with its door pushed to and nobody in sight. There is smoke in the chimney and something cooling on the table, which means whoever lives here has only just stepped out.',
      location: 0,
    },
    {
      name: 'Nobody answers',
      summary:
        'Goldilocks knocks twice, waits, and lets herself in. Nothing in the house resists her, and she takes the absence of a lock for the absence of an owner.',
      location: 1,
    },
    {
      name: 'Three bowls of porridge',
      summary:
        'Three bowls sit cooling on the kitchen table in three sizes. The largest is too hot and the middle one too cold; the smallest is exactly right, so she finishes it.',
      location: 2,
    },
    {
      name: 'Three chairs',
      summary:
        'Three chairs stand by the fire. The big one is too hard and the middle one too soft, and Goldilocks keeps testing rather than stopping at the first that would have done.',
      location: 3,
    },
    {
      name: 'The smallest chair breaks',
      summary:
        'The third chair fits her exactly and gives way under her. It is the first thing she cannot put back the way she found it, and she leaves the pieces where they fall.',
      location: 3,
    },
    {
      name: 'Three beds',
      summary:
        "Upstairs there are three beds, and the same test runs a third time. She falls asleep in the smallest of them, in a stranger's house, with the door still unlatched behind her.",
      location: 4,
    },
    {
      name: 'Someone has been at my porridge',
      summary:
        'The three bears come home to a kitchen that has been used. Two bowls have been stirred and set down again; the third has been emptied, and Baby Bear is the one who says so.',
      location: 2,
    },
    {
      name: 'Someone has been sitting in my chair',
      summary:
        'Two chairs have been moved. The third is in pieces on the floor, and the discovery stops being an annoyance and becomes a loss the moment its owner sees it.',
      location: 3,
    },
    {
      name: 'Someone is sleeping in my bed',
      summary:
        'Two beds are rumpled. In the third there is a girl, still asleep, and the three bears stand looking at her with no idea at all what they are supposed to do next.',
      location: 4,
    },
    {
      name: 'Out through the window',
      summary:
        'Goldilocks wakes to three bears at the foot of the bed and is out of the window before anyone speaks. Nobody chases her; the bears are as frightened as she is, and they are the ones left with the mess.',
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
      location: 0,
    },
    {
      name: 'O caminho errado',
      summary:
        'Um lenhador lhe dá indicações que teriam valido ontem. Quando as árvores se fecham atrás dela, Cachinhos já não sabe dizer por onde veio.',
      location: 0,
    },
    {
      name: 'Uma casa entre as árvores',
      summary:
        'Uma casinha aparece numa clareira, com a porta encostada e ninguém à vista. Há fumaça na chaminé e algo esfriando sobre a mesa, o que significa que quem mora ali acabou de sair.',
      location: 0,
    },
    {
      name: 'Ninguém atende',
      summary:
        'Cachinhos bate duas vezes, espera e entra. Nada na casa lhe oferece resistência, e ela toma a ausência de tranca pela ausência de dono.',
      location: 1,
    },
    {
      name: 'Três tigelas de mingau',
      summary:
        'Três tigelas esfriam sobre a mesa da cozinha, em três tamanhos. A maior está quente demais e a do meio, fria demais; a menor está exatamente boa, então ela a termina.',
      location: 2,
    },
    {
      name: 'Três cadeiras',
      summary:
        'Três cadeiras estão junto à lareira. A grande é dura demais e a do meio, mole demais, e Cachinhos continua testando em vez de parar na primeira que já teria servido.',
      location: 3,
    },
    {
      name: 'A cadeira menor quebra',
      summary:
        'A terceira cadeira serve exatamente e cede sob ela. É a primeira coisa que ela não consegue devolver ao estado em que encontrou, e deixa os pedaços onde caem.',
      location: 3,
    },
    {
      name: 'Três camas',
      summary:
        'Lá em cima há três camas, e o mesmo teste se repete pela terceira vez. Ela adormece na menor delas, na casa de estranhos, com a porta ainda destrancada às suas costas.',
      location: 4,
    },
    {
      name: 'Alguém mexeu no meu mingau',
      summary:
        'Os três ursos voltam para uma cozinha que foi usada. Duas tigelas foram mexidas e recolocadas; a terceira está vazia, e é o Ursinho quem diz isso em voz alta.',
      location: 2,
    },
    {
      name: 'Alguém sentou na minha cadeira',
      summary:
        'Duas cadeiras foram movidas. A terceira está em pedaços no chão, e a descoberta deixa de ser um aborrecimento e vira uma perda no instante em que o dono a vê.',
      location: 3,
    },
    {
      name: 'Alguém está dormindo na minha cama',
      summary:
        'Duas camas estão amassadas. Na terceira há uma menina, ainda dormindo, e os três ursos ficam olhando para ela sem a menor ideia do que deveriam fazer em seguida.',
      location: 4,
    },
    {
      name: 'Pela janela afora',
      summary:
        'Cachinhos acorda com três ursos ao pé da cama e some pela janela antes que alguém fale. Ninguém a persegue; os ursos estão tão assustados quanto ela, e são eles que ficam com a bagunça.',
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
