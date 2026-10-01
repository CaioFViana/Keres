import type { LocalizedNarrative, StoryNarrative } from './types';

const beautyEn: StoryNarrative = {
  chapters: [
    {
      name: 'A Promise of Return',
      summary:
        'A ruined merchant takes one rose he was not offered, and the debt he incurs is paid by the daughter who asked for it.',
    },
    {
      name: 'The Same Question Every Night',
      summary:
        'Beauty is given everything in the castle except the one thing she asks for, and refuses the one thing she is asked, every night, for as long as she stays.',
    },
    {
      name: 'Ten Days, and One Late',
      summary:
        'Her sisters keep her past the term on purpose. What she does with the mirror decides which of two endings the Fairy allows.',
    },
  ],
  scenes: [
    {
      name: 'One rose, and nothing else',
      summary:
        'The merchant, leaving on the rumour of a recovered ship, asks his three daughters what they want brought back. Two ask for gowns and jewels. Beauty asks for a rose, thinking she is asking for nothing.',
      body: 'The rumour of a recovered ship sends the merchant off with more hope than luggage, and before he goes he asks his three daughters what he should bring back. The elder two answer at length: gowns, jewels, fabrics with names he has to write down.\n\nBeauty asks for a rose. There are roses in every garden between here and the port, and she knows it, and that is rather the point - she is asking for nothing, politely, so that her father can spend what little he has on her sisters. It is the most expensive rose in the history of requests.',
      location: 4,
    },
    {
      name: 'Lost in the forest',
      summary:
        'The ship is gone and so is the last of the money. Snow closes the road home, and the merchant follows a light through the trees to a castle where the doors open, the fire is lit, and there is not a soul to thank.',
      body: 'There is no ship. There are debts where the ship was supposed to be, and by the time the merchant turns for home the snow has closed the road behind him. He rides in circles until the circles narrow to a light between the trees.\n\nThe castle opens its doors before he knocks. The fire is lit, the table is laid, the stable takes his horse - and there is not a soul to thank for any of it. He eats, apologising to the empty chairs, and sleeps in a bed that has clearly been waiting for him.',
      location: 0,
    },
    {
      name: 'The stolen rose and the terms',
      summary:
        'Leaving at dawn, he cuts one rose from the garden for Beauty, and the Beast is there before the stem is down. The terms are his life, or a daughter who comes in his place and comes willingly.',
      body: "At dawn he walks the garden to thank it, the way one thanks a host who never appeared, and there - the only roses blooming in all that snow - he remembers Beauty. One rose. He has barely closed his hand on the stem when the voice stops him.\n\n'You eat my food, you sleep in my bed, and you steal my roses,' says the Beast, reasonably, the way one lists items on a bill. The terms are simple: the merchant's life, or a daughter who comes in his place - willingly, and within the month. The Beast does not raise his voice. He does not need to.",
      location: 2,
    },
    {
      name: 'Beauty takes his place',
      summary:
        "Beauty hears the whole of it and goes, over her father's refusal, because the promise names her and she will not have it paid by anyone else. The Beast meets her at the door and asks whether she came of her own will.",
      body: "Beauty hears the whole of it without interrupting, which her father finds worse than tears. The promise names her - her rose, her father, her debt - and she will not have it paid by anyone else. Her father refuses. She goes anyway, because some refusals are only grief wearing a coat.\n\nThe Beast meets her at the castle door, enormous in the lamplight, and asks the only question that matters: did she come of her own will? 'Yes,' Beauty says, and means it, and the door closes behind her with a sound like a book shutting.",
      location: 1,
    },
    {
      name: 'Dinner at the long table',
      summary:
        'She dines alone and the Beast sits at the far end and talks to her, badly. Everything she says she would like appears before she has finished saying it, which makes the one thing she cannot have very conspicuous.',
      body: 'She dines alone every evening, if dining with a silent Beast at the far end of a very long table counts as alone. He talks to her, badly - short sentences, long pauses, questions he answers himself. She answers anyway, out of politeness, and then out of something else.\n\nWhatever she mentions appears: books, music, oranges in winter, each arriving before she has finished naming it. It is generous, and eerie, and it makes the one thing she cannot have - the road home, her father, the world outside - sit at the table like an empty chair.',
      location: 1,
    },
    {
      name: 'The library he opens for her',
      summary:
        'The Beast gives her a library she could not read through in a lifetime, and does not follow her into it. It is the first thing he offers that she wanted before he offered it.',
      body: 'The library door has been locked since she arrived, and one morning it stands open. Inside: more books than she could read in three lifetimes, ladders on rails, a window seat worn smooth by nobody. The Beast does not follow her in. He only stands in the corridor, in case.\n\nIt is the first thing he has offered that she wanted before he offered it - not food, not comfort, not compensation, but the thing itself. She takes down a book at random and reads the first page standing up. Behind her, very quietly, the door stays open.',
      location: 1,
    },
    {
      name: 'The same question every night',
      summary:
        'Every night at the end of dinner he asks her to marry him, and every night she says no, and every night he accepts it and wishes her goodnight. Neither of them ever pretends the question is not going to be asked again.',
      body: 'Every night, when the plates are cleared, he asks her to marry him. Every night she says no. Every night he bows his great head, wishes her goodnight, and goes - and neither of them pretends, ever, that the question will not be asked again tomorrow.\n\nIt becomes a kind of clock between them, this question: wound nightly, never answered, always on time. Beauty stops dreading it, then stops minding it, and then one night catches herself answering gently - and lies awake afterwards, wondering what gentleness means.',
      location: 1,
    },
    {
      name: 'Leave to depart',
      summary:
        'She asks to see her father, and the Beast gives her a ring that carries her home and back, and a mirror that shows her anything she wishes to see. He asks only that she return in ten days, and warns her plainly that he will not survive her not doing so.',
      body: "'My father is ill,' she says - the mirror has shown her, and the mirror does not lie kindly - 'and I must see him.' The Beast is quiet for a long time. Then he gives her a ring that will carry her home and back, and the mirror to keep, and ten days.\n\n'Return in ten days,' he says plainly. 'I will not survive it if you do not.' It is not a threat. Threats are what people say to get their way; this is what people say when they have run out of ways. Beauty promises, and means it, and the ring turns cold on her finger.",
      location: 2,
    },
    {
      name: "Her sisters' envy",
      summary:
        'Her sisters find her well dressed, well fed and well treated, and cannot bear it. They weep and cling and beg her to stay one more day, and then another, and count them carefully.',
      body: 'Her sisters find her well dressed, well fed, and - worst of all - content, and it curdles something in them. They weep on her shoulder. They cling to her sleeves. They beg her to stay one more day, and then another, counting each one the way misers count coins.\n\nBeauty knows what they are doing. She knows it the way one knows rain is coming - by the pressure, by the smell, by the small darkening. And still she stays, because they are her sisters, and because saying no to family has always been harder for her than saying no to a Beast.',
      location: 4,
    },
    {
      name: 'A vision in the mirror',
      summary:
        'On the eleventh day Beauty looks into the mirror and sees the Beast lying by the fountain in his garden, not moving. She turns the ring that same moment, without finishing the sentence she was speaking.',
      body: 'On the eleventh day - one day past the promise, the arithmetic simple and terrible - Beauty lifts the mirror. The Beast lies by the fountain in his garden, in the snow among his roses, not moving. Not moving at all.\n\nShe turns the ring in the middle of a sentence, without finishing it, without packing, without goodbye. Their voices follow her halfway home and fall behind, the way voices do when they were never really holding anyone.',
      location: 3,
    },
    {
      name: 'A merciful ending',
      summary:
        'Beauty says she loves him and the curse breaks. Out of kindness she asks the Fairy to spare her sisters, and the Fairy grants it - and says, to the room, that a mercy nobody earned is still a mercy given.',
      body: "'I love you,' Beauty says to the still shape by the fountain, 'and I am sorry, and please.' It is not elegant. Love, arriving late and out of breath, rarely is. The curse breaks like ice going out on a river - all at once, and loud.\n\nFor her sisters she asks mercy, though nobody in the room can name what they did to earn it. The Fairy grants it. 'A mercy nobody earned,' she says to the room, 'is still a mercy given.' The sisters weep. Whether from gratitude or habit, the story does not say.",
      location: 1,
    },
    {
      name: 'A just ending',
      summary:
        'Beauty says she loves him and the curse breaks. The Fairy judges the sisters by what they did, and leaves them as statues at the castle gate to watch a happiness they tried to prevent, until they can admit their own part in it.',
      body: 'She says she loves him to the still shape by the fountain, kneeling in the snow among the roses, and the curse breaks like ice going out on a river - all at once, and loud. It is not elegant. Love, arriving late and out of breath, rarely is.\n\nThe Fairy judges the sisters by what they did - the tears counted, the days stolen, the arithmetic of envy - and sets them as statues at the castle gate. There they will stand, watching a happiness they tried to prevent, until they can admit their own part in it. Stone, the Fairy notes, is patient.',
      location: 2,
    },
  ],
  startScene: 0,
  finishScenes: [10, 11],
  locations: [
    {
      name: 'The Forest',
      description:
        'The wood between the port road and the castle, where the snow closes in and the only light for a day in any direction is one that should not be there.',
    },
    {
      name: "The Beast's Castle",
      description:
        'An enchanted castle where every wish is granted before it is finished being spoken, and where the two things Beauty wants - to see her father, and to see the Beast as he was - are the only two it cannot supply.',
    },
    {
      name: 'The Enchanted Garden',
      description:
        'The rose garden and the fountain, where the Beast goes when he wants to be alone and where everything in this story that matters is either taken, given, or nearly lost.',
    },
    {
      name: 'The Road Home',
      description:
        'The road the merchant could not travel in the snow, and that the ring makes unnecessary. It is still there, and it is still ten days long, which is the whole point of the term.',
    },
    {
      name: "The Merchant's House",
      description:
        'The modest house the family moved to when the ships were lost, where two daughters have never stopped resenting the move and the third has never mentioned it.',
    },
  ],
  characters: [
    {
      name: 'Beauty',
      description:
        "A merchant's youngest daughter, an avid reader with a generous nature, who asks for the smallest thing anyone asks for and pays the largest price for it. She goes to the castle because the promise has her name in it.",
    },
    {
      name: 'The Beast',
      description:
        'A prince turned into a beast by a fairy, who may only be freed by being loved of his own free will - which is why he asks the same question every night and accepts the same answer every night.',
    },
    {
      name: 'The Merchant',
      description:
        'A merchant who lost his fortune at sea and his way in the forest on the same journey. He takes one rose without asking and spends the rest of the story trying to keep his daughter from paying for it.',
    },
    {
      name: 'The Elder Sister',
      description:
        "Beauty's sister, who cannot forgive her for being content with less. She is the one who counts the days aloud and pretends she is not counting.",
    },
    {
      name: 'The Second Sister',
      description:
        'The other sister, just as proud and just as envious, and readier to say out loud what the elder only arranges.',
    },
    {
      name: 'The Fairy',
      description:
        'The fairy who laid the curse and has watched in silence ever since to see whether it works. She appears once, at the end, and what she does then depends entirely on what Beauty asks her for.',
    },
  ],
  presence: [
    [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [2, 3, 4, 5, 6, 7, 9, 10, 11],
    [0, 1, 2, 7, 8],
    [0, 8, 10, 11],
    [0, 8, 10, 11],
    [10, 11],
  ],
  relations: [
    { pair: [0, 1], type: 'In love, in time' },
    { pair: [0, 2], type: 'Father and daughter' },
    { pair: [2, 3], type: 'Father and daughter' },
    { pair: [2, 4], type: 'Father and daughter' },
    { pair: [0, 3], type: 'Sisters' },
    { pair: [0, 4], type: 'Sisters' },
    { pair: [3, 4], type: 'Sisters and allies' },
    { pair: [1, 5], type: 'Cursed by her' },
    { pair: [0, 5], type: 'Watched in secret' },
  ],
  items: [
    {
      name: 'The Enchanted Rose',
      description:
        'The only gift Beauty asked her father to bring her, and the only thing in the garden the Beast had not already decided to give away. Everything in the story follows from one stem being cut without asking.',
      category: 'Enchanted object',
      initialState: 'Growing in the garden',
      owner: null,
      journey: [
        { scene: 0, state: 'Asked for, as the smallest thing', owner: null },
        { scene: 2, state: 'Cut without permission', owner: 2 },
        { scene: 3, state: 'Carried into the castle', owner: 0 },
      ],
    },
    {
      name: 'The Magic Ring',
      description:
        'A ring that carries whoever turns it between the castle and the house at once. It removes every obstacle to Beauty leaving, which is exactly what makes her staying away a decision.',
      category: 'Enchanted object',
      initialState: "In the Beast's keeping",
      owner: 1,
      journey: [
        { scene: 7, state: 'Given, with a term of ten days', owner: 0 },
        { scene: 8, state: "Worn at her father's house", owner: 0 },
        { scene: 9, state: 'Turned, mid-sentence', owner: 0 },
      ],
    },
    {
      name: 'The Magic Mirror',
      description:
        'A mirror that shows whoever holds it any place or person they wish to see. The Beast gives Beauty the means to check on him at any moment, and never once asks her to use it.',
      category: 'Enchanted object',
      initialState: "In the Beast's keeping",
      owner: 1,
      journey: [
        { scene: 7, state: 'Given alongside the ring', owner: 0 },
        { scene: 8, state: 'Left unused in her room', owner: 0 },
        { scene: 9, state: 'Shows the Beast by the fountain', owner: 0 },
      ],
    },
  ],
  worldRules: [
    {
      title: 'A Promise of Return',
      description:
        'The Beast can only be freed by being loved of his own free will, which makes force useless to him. When he lets Beauty go he is not being generous - a Beauty who could not leave could not choose to stay, and a stay that is not chosen is worth nothing against the curse.',
    },
    {
      title: "The Beast's Enchanted Gifts",
      description:
        'A ring that carries its wearer between the two houses instantly, and a mirror that shows any place or person. Between them they remove every practical reason Beauty could have for being late, so that being late can only ever be a choice.',
    },
    {
      title: 'Nothing Is Taken Without Consent',
      description:
        'The Beast asks his question every night and accepts the answer every night. He does not hold Beauty by force; he holds her by a promise her father made and she chose to keep - which is a different thing, and the whole point of the curse.',
    },
  ],
  notes: [
    {
      title: 'Continuity: the term is ten days',
      body: "The ring makes the journey instant, so the ten days are never about travel. Every scene at her father's house has to make clear that she could be back in a heartbeat and is not going.",
    },
    {
      title: 'Visual motif: given before it is asked for',
      body: 'The castle answers wishes before they are finished. Use it to make the two things it cannot give - her father, and his old face - land harder every time.',
    },
    {
      title: 'Revision goal: the endings differ in one word',
      body: 'Both endings break the curse. What splits them is whether Beauty asks the Fairy for mercy or leaves her to judge. Keep everything before the split identical so the difference is entirely hers.',
    },
  ],
  tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
  choiceLabel: 'Continue toward',
  triggers: { set: 'the_beast_asked_again', unset: 'promise_still_unbroken' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 0 },
    { type: 'itemTake', item: 1, scene: 9 },
    { type: 'triggerSet', item: null, scene: 6 },
    { type: 'triggerUnset', item: null, scene: 0 },
  ],
};

const beautyPt: StoryNarrative = {
  chapters: [
    {
      name: 'Uma Promessa de Retorno',
      summary:
        'Um mercador arruinado colhe uma rosa que não lhe foi oferecida, e a dívida que contrai é paga pela filha que a pediu.',
    },
    {
      name: 'A Mesma Pergunta Toda Noite',
      summary:
        'Bela recebe tudo no castelo, menos a única coisa que pede, e recusa a única coisa que lhe pedem, toda noite, por todo o tempo em que fica.',
    },
    {
      name: 'Dez Dias, e Um de Atraso',
      summary:
        'As irmãs a seguram além do prazo de propósito. O que ela faz com o espelho decide qual dos dois finais a Fada permite.',
    },
  ],
  scenes: [
    {
      name: 'Uma rosa, e mais nada',
      summary:
        'O mercador, partindo atrás do boato de um navio recuperado, pergunta às três filhas o que querem que ele traga. Duas pedem vestidos e joias. Bela pede uma rosa, achando que está pedindo nada.',
      body: 'O boato de um navio recuperado manda o mercador embora com mais esperança que bagagem, e antes de partir ele pergunta às três filhas o que deve trazer. As duas mais velhas respondem longamente: vestidos, joias, tecidos com nomes que ele precisa anotar.\n\nBela pede uma rosa. Há rosas em cada jardim entre aqui e o porto, e ela sabe disso, e é esse mesmo o ponto - ela está pedindo nada, educadamente, para que o pai gaste o pouco que tem com as irmãs. É a rosa mais cara da história dos pedidos.',
      location: 4,
    },
    {
      name: 'Perdido na floresta',
      summary:
        'O navio se foi, e com ele o último dinheiro. A neve fecha o caminho de volta, e o mercador segue uma luz entre as árvores até um castelo onde as portas se abrem, a lareira está acesa e não há uma alma a quem agradecer.',
      body: 'Não há navio. Há dívidas onde o navio devia estar, e quando o mercador se vira para casa a neve já fechou a estrada atrás dele. Ele cavalga em círculos até os círculos se estreitarem numa luz entre as árvores.\n\nO castelo abre as portas antes que ele bata. A lareira está acesa, a mesa está posta, o estábulo recebe seu cavalo - e não há uma alma a quem agradecer por nada disso. Ele come, pedindo desculpas às cadeiras vazias, e dorme numa cama que claramente esperava por ele.',
      location: 0,
    },
    {
      name: 'A rosa roubada e as condições',
      summary:
        'Partindo ao amanhecer, ele corta uma rosa do jardim para Bela, e a Fera está ali antes que o caule desça. As condições são a vida dele, ou uma filha que venha em seu lugar e venha por vontade própria.',
      body: 'Ao amanhecer ele percorre o jardim para agradecê-lo, como se agradece a um anfitrião que nunca apareceu, e ali - as únicas rosas floridas em meio a toda aquela neve - ele se lembra de Bela. Uma rosa. Mal fechou a mão no caule quando a voz o detém.\n\n- Você come da minha comida, dorme na minha cama e rouba minhas rosas - diz a Fera, comedida, como quem lê itens de uma conta. As condições são simples: a vida do mercador, ou uma filha que venha em seu lugar - por vontade própria, e dentro de um mês. A Fera não levanta a voz. Não precisa.',
      location: 2,
    },
    {
      name: 'Bela toma o lugar dele',
      summary:
        'Bela ouve tudo e vai, contra a recusa do pai, porque a promessa tem o nome dela e ela não vai deixar que outro a pague. A Fera a recebe à porta e pergunta se ela veio por vontade própria.',
      body: 'Bela ouve tudo sem interromper, o que o pai acha pior que lágrimas. A promessa tem o nome dela - a rosa dela, o pai dela, a dívida dela - e ela não vai deixar que outro a pague. O pai se recusa. Ela vai assim mesmo, porque certas recusas são só a tristeza vestindo um casaco.\n\nA Fera a recebe à porta do castelo, enorme à luz do lampião, e faz a única pergunta que importa: ela veio por vontade própria? - Sim - diz Bela, e é verdade, e a porta se fecha atrás dela com um som de livro que se fecha.',
      location: 1,
    },
    {
      name: 'O jantar na mesa comprida',
      summary:
        'Ela janta sozinha e a Fera senta na outra ponta e conversa com ela, mal. Tudo o que ela diz que gostaria aparece antes que termine de dizer, o que torna muito visível a única coisa que ela não pode ter.',
      body: 'Ela janta sozinha todas as noites, se jantar com uma Fera calada na outra ponta de uma mesa compridíssima conta como sozinha. Ele conversa com ela, mal - frases curtas, pausas longas, perguntas que ele mesmo responde. Ela responde assim mesmo, por educação, e depois por outra coisa.\n\nTudo o que ela menciona aparece: livros, música, laranjas no inverno, cada coisa chegando antes que ela termine de nomeá-la. É generoso, e é estranho, e faz a única coisa que ela não pode ter - a estrada de casa, o pai, o mundo lá fora - sentar-se à mesa como uma cadeira vazia.',
      location: 1,
    },
    {
      name: 'A biblioteca que ele lhe abre',
      summary:
        'A Fera lhe dá uma biblioteca que ela não leria numa vida inteira, e não a segue lá dentro. É a primeira coisa que ele oferece que ela já queria antes de ele oferecer.',
      body: 'A porta da biblioteca esteve trancada desde que ela chegou, e numa manhã aparece aberta. Lá dentro: mais livros do que ela leria em três vidas, escadas sobre trilhos, um banco de janela gasto e macio por ninguém. A Fera não a segue lá dentro. Fica só no corredor, por via das dúvidas.\n\nÉ a primeira coisa que ele oferece que ela já queria antes de ele oferecer - não comida, não conforto, não compensação, mas a coisa em si. Ela tira um livro da estante ao acaso e lê de pé a primeira página. Atrás dela, bem quieta, a porta continua aberta.',
      location: 1,
    },
    {
      name: 'A mesma pergunta toda noite',
      summary:
        'Toda noite, ao fim do jantar, ele pede que ela se case com ele; toda noite ela diz que não; e toda noite ele aceita e lhe deseja boa-noite. Nenhum dos dois finge, em momento algum, que a pergunta não voltará.',
      body: 'Toda noite, quando os pratos são retirados, ele pede que ela se case com ele. Toda noite ela diz que não. Toda noite ele curva a grande cabeça, lhe deseja boa-noite, e vai - e nenhum dos dois finge, jamais, que a pergunta não voltará amanhã.\n\nA pergunta vira uma espécie de relógio entre eles: dada corda toda noite, nunca respondida, sempre pontual. Bela deixa de temê-la, depois deixa de se importar, e então uma noite se pega respondendo com doçura - e fica acordada depois, pensando no que a doçura significa.',
      location: 1,
    },
    {
      name: 'Licença para partir',
      summary:
        'Ela pede para ver o pai, e a Fera lhe dá um anel que a leva para casa e de volta, e um espelho que mostra o que ela quiser ver. Pede apenas que ela volte em dez dias, e avisa com todas as letras que não sobreviverá se ela não voltar.',
      body: '- Meu pai está doente - ela diz - o espelho me mostrou, e o espelho não mente com gentileza - e preciso vê-lo. A Fera fica quieta por um longo tempo. Então lhe dá um anel que a levará para casa e de volta, e o espelho para ficar, e dez dias.\n\n- Volte em dez dias - ele diz, com todas as letras. - Não sobreviverei se você não voltar. Não é uma ameaça. Ameaças são o que se diz para conseguir o que se quer; isto é o que se diz quando acabaram os jeitos. Bela promete, e é verdade, e o anel esfria no seu dedo.',
      location: 2,
    },
    {
      name: 'A inveja das irmãs',
      summary:
        'As irmãs a encontram bem-vestida, bem-alimentada e bem-tratada, e não suportam. Choram, se agarram a ela e imploram que fique mais um dia, e depois mais outro, e contam cada um com cuidado.',
      body: 'As irmãs a encontram bem-vestida, bem-alimentada e - pior de tudo - contente, e algo nelas azeda. Choram no ombro dela. Agarram-se às suas mangas. Imploram que fique mais um dia, e depois mais outro, contando cada um como avarentos contam moedas.\n\nBela sabe o que elas estão fazendo. Sabe como se sabe que a chuva vem - pela pressão, pelo cheiro, pelo pequeno escurecer. E ainda assim fica, porque são suas irmãs, e porque dizer não à família sempre foi mais difícil para ela do que dizer não a uma Fera.',
      location: 4,
    },
    {
      name: 'Uma visão no espelho',
      summary:
        'No décimo primeiro dia Bela olha no espelho e vê a Fera caída junto à fonte do jardim, sem se mexer. Ela gira o anel naquele mesmo instante, sem terminar a frase que estava dizendo.',
      body: 'No décimo primeiro dia - um dia além da promessa, a aritmética simples e terrível - Bela ergue o espelho. A Fera jaz junto à fonte do jardim, na neve entre as rosas, sem se mexer. Sem se mexer nada.\n\nEla gira o anel no meio de uma frase, sem terminá-la, sem fazer as malas, sem despedida. As vozes das irmãs a seguem até metade do caminho de casa e ficam para trás, como ficam as vozes que nunca seguraram ninguém.',
      location: 3,
    },
    {
      name: 'Um final misericordioso',
      summary:
        'Bela diz que o ama e a maldição se rompe. Por bondade, pede à Fada que poupe as irmãs, e a Fada concede - e diz, diante de todos, que uma misericórdia que ninguém mereceu continua sendo uma misericórdia concedida.',
      body: '- Eu te amo - diz Bela à forma imóvel junto à fonte - e me perdoa, e por favor. Não é elegante. O amor, chegando tarde e sem fôlego, raramente é. A maldição se rompe como o gelo se rompe no rio - de uma vez, e alto.\n\nPelas irmãs ela pede misericórdia, embora ninguém na sala saiba dizer o que elas fizeram para merecê-la. A Fada concede. - Uma misericórdia que ninguém mereceu - diz ela à sala - continua sendo uma misericórdia concedida. As irmãs choram. Se de gratidão ou de hábito, a história não diz.',
      location: 1,
    },
    {
      name: 'Um final justo',
      summary:
        'Bela diz que o ama e a maldição se rompe. A Fada julga as irmãs pelo que fizeram e as deixa como estátuas no portão do castelo, para assistirem a uma felicidade que tentaram impedir, até que admitam a própria parte nela.',
      body: 'Ela diz que o ama à forma imóvel junto à fonte, ajoelhada na neve entre as rosas, e a maldição se rompe como o gelo se rompe no rio - de uma vez, e alto. Não é elegante. O amor, chegando tarde e sem fôlego, raramente é.\n\nA Fada julga as irmãs pelo que fizeram - as lágrimas contadas, os dias roubados, a aritmética da inveja - e as põe como estátuas no portão do castelo. Ali ficarão, assistindo a uma felicidade que tentaram impedir, até admitirem a própria parte nela. A pedra, nota a Fada, é paciente.',
      location: 2,
    },
  ],
  startScene: 0,
  finishScenes: [10, 11],
  locations: [
    {
      name: 'A Floresta',
      description:
        'A mata entre a estrada do porto e o castelo, onde a neve se fecha e a única luz num dia de caminhada em qualquer direção é uma que não deveria estar ali.',
    },
    {
      name: 'O Castelo da Fera',
      description:
        'Um castelo encantado onde todo desejo é atendido antes de terminar de ser dito, e onde as duas coisas que Bela quer - ver o pai, e ver a Fera como era - são as duas únicas que ele não consegue fornecer.',
    },
    {
      name: 'O Jardim Encantado',
      description:
        'O roseiral e a fonte, aonde a Fera vai quando quer ficar sozinha e onde tudo o que importa nesta história é tomado, dado ou quase perdido.',
    },
    {
      name: 'A Estrada de Casa',
      description:
        'A estrada que o mercador não conseguiu percorrer na neve, e que o anel torna desnecessária. Ela continua ali, e continua tendo dez dias de extensão, e é esse o sentido inteiro do prazo.',
    },
    {
      name: 'A Casa do Mercador',
      description:
        'A casa modesta para onde a família se mudou quando os navios se perderam, onde duas filhas nunca deixaram de se ressentir da mudança e a terceira nunca a mencionou.',
    },
  ],
  characters: [
    {
      name: 'Bela',
      description:
        'A filha mais nova de um mercador, leitora voraz e de índole generosa, que pede a menor coisa que alguém pede e paga o maior preço por ela. Vai ao castelo porque a promessa tem o nome dela.',
    },
    {
      name: 'A Fera',
      description:
        'Um príncipe transformado em fera por uma fada, que só pode ser libertado sendo amado por livre vontade - e é por isso que faz a mesma pergunta toda noite e aceita a mesma resposta toda noite.',
    },
    {
      name: 'O Mercador',
      description:
        'Um mercador que perdeu a fortuna no mar e o rumo na floresta na mesma viagem. Colhe uma rosa sem pedir e passa o resto da história tentando impedir que a filha pague por isso.',
    },
    {
      name: 'A Irmã Mais Velha',
      description:
        'Irmã de Bela, incapaz de perdoá-la por se contentar com menos. É ela quem conta os dias em voz alta fingindo que não está contando.',
    },
    {
      name: 'A Segunda Irmã',
      description:
        'A outra irmã, igualmente orgulhosa e igualmente invejosa, e mais pronta a dizer em voz alta o que a mais velha apenas arranja.',
    },
    {
      name: 'A Fada',
      description:
        'A fada que lançou a maldição e desde então observa em silêncio para ver se ela funciona. Aparece uma única vez, no fim, e o que faz então depende inteiramente do que Bela lhe pedir.',
    },
  ],
  presence: [
    [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [2, 3, 4, 5, 6, 7, 9, 10, 11],
    [0, 1, 2, 7, 8],
    [0, 8, 10, 11],
    [0, 8, 10, 11],
    [10, 11],
  ],
  relations: [
    { pair: [0, 1], type: 'Apaixonados, com o tempo' },
    { pair: [0, 2], type: 'Pai e filha' },
    { pair: [2, 3], type: 'Pai e filha' },
    { pair: [2, 4], type: 'Pai e filha' },
    { pair: [0, 3], type: 'Irmãs' },
    { pair: [0, 4], type: 'Irmãs' },
    { pair: [3, 4], type: 'Irmãs e cúmplices' },
    { pair: [1, 5], type: 'Amaldiçoado por ela' },
    { pair: [0, 5], type: 'Observada em segredo' },
  ],
  items: [
    {
      name: 'A Rosa Encantada',
      description:
        'O único presente que Bela pediu ao pai, e a única coisa do jardim que a Fera ainda não tinha decidido dar. Tudo na história decorre de um caule cortado sem pedir.',
      category: 'Objeto encantado',
      initialState: 'Crescendo no jardim',
      owner: null,
      journey: [
        { scene: 0, state: 'Pedida, como a menor das coisas', owner: null },
        { scene: 2, state: 'Cortada sem permissão', owner: 2 },
        { scene: 3, state: 'Levada para dentro do castelo', owner: 0 },
      ],
    },
    {
      name: 'O Anel Mágico',
      description:
        'Um anel que leva de imediato quem o gira entre o castelo e a casa. Remove todo obstáculo à saída de Bela, e é exatamente isso que faz de sua ausência uma decisão.',
      category: 'Objeto encantado',
      initialState: 'Sob a guarda da Fera',
      owner: 1,
      journey: [
        { scene: 7, state: 'Dado, com prazo de dez dias', owner: 0 },
        { scene: 8, state: 'Usado na casa do pai', owner: 0 },
        { scene: 9, state: 'Girado no meio de uma frase', owner: 0 },
      ],
    },
    {
      name: 'O Espelho Mágico',
      description:
        'Um espelho que mostra a quem o segura qualquer lugar ou pessoa que deseje ver. A Fera dá a Bela como conferi-lo a qualquer momento, e nem uma vez lhe pede que o use.',
      category: 'Objeto encantado',
      initialState: 'Sob a guarda da Fera',
      owner: 1,
      journey: [
        { scene: 7, state: 'Dado junto com o anel', owner: 0 },
        { scene: 8, state: 'Deixado sem uso no quarto dela', owner: 0 },
        { scene: 9, state: 'Mostra a Fera junto à fonte', owner: 0 },
      ],
    },
  ],
  worldRules: [
    {
      title: 'Uma Promessa de Retorno',
      description:
        'A Fera só pode ser libertada sendo amada por livre vontade, o que torna a força inútil para ele. Quando deixa Bela partir não está sendo generoso - uma Bela que não pudesse ir embora não poderia escolher ficar, e uma permanência que não é escolhida não vale nada contra a maldição.',
    },
    {
      title: 'Os Presentes Encantados da Fera',
      description:
        'Um anel que leva quem o usa entre as duas casas num instante, e um espelho que mostra qualquer lugar ou pessoa. Juntos, removem toda razão prática que Bela poderia ter para se atrasar, de modo que atrasar-se só possa ser uma escolha.',
    },
    {
      title: 'Nada É Tomado Sem Consentimento',
      description:
        'A Fera faz sua pergunta toda noite e aceita a resposta toda noite. Não segura Bela pela força; segura-a por uma promessa que o pai dela fez e que ela escolheu cumprir - o que é coisa diferente, e é o sentido inteiro da maldição.',
    },
  ],
  notes: [
    {
      title: 'Continuidade: o prazo é de dez dias',
      body: 'O anel torna a viagem instantânea, então os dez dias nunca são sobre deslocamento. Toda cena na casa do pai precisa deixar claro que ela poderia voltar num piscar de olhos e não está indo.',
    },
    {
      title: 'Motivo visual: dado antes de ser pedido',
      body: 'O castelo atende desejos antes de terminarem. Usar isso para que as duas coisas que ele não pode dar - o pai dela e o rosto antigo dele - pesem mais a cada vez.',
    },
    {
      title: 'Meta de revisão: os finais diferem numa palavra',
      body: 'Os dois finais rompem a maldição. O que os separa é se Bela pede misericórdia à Fada ou a deixa julgar. Manter tudo antes da bifurcação idêntico, para que a diferença seja inteiramente dela.',
    },
  ],
  tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
  choiceLabel: 'Continuar em direção a',
  triggers: { set: 'a_fera_perguntou_de_novo', unset: 'promessa_ainda_intacta' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 0 },
    { type: 'itemTake', item: 1, scene: 9 },
    { type: 'triggerSet', item: null, scene: 6 },
    { type: 'triggerUnset', item: null, scene: 0 },
  ],
};

export const beautyAndTheBeast: LocalizedNarrative = { en: beautyEn, pt: beautyPt };
