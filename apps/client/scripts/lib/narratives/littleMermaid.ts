import type { LocalizedNarrative, StoryNarrative } from './types';

const littleMermaidEn: StoryNarrative = {
  chapters: [
    {
      name: 'Daughter of the Sea',
      summary:
        'The youngest of six sisters wants the surface before she is allowed it, and once she has seen it she is told what wanting it will cost.',
    },
    {
      name: 'The Bargain',
      summary:
        'The Sea Witch states her terms in full and keeps them exactly. What she leaves out is not a lie - it is simply not asked.',
    },
    {
      name: 'Daughter of the Air',
      summary:
        'The prince marries the woman he believes saved him, and the little mermaid is offered one way out that requires her to take a life.',
    },
  ],
  scenes: [
    {
      name: 'The garden with the statue',
      summary:
        'Each of the six princesses has a plot of the palace garden to keep as she likes. The youngest plants hers round with nothing but red flowers and a marble boy sunk from some wreck, and keeps it exactly so.',
      location: 2,
    },
    {
      name: 'Fifteen, and the surface',
      summary:
        'On her fifteenth birthday she is finally allowed to rise. She surfaces beside a ship lit for a birthday of its own, and sees a prince who is close enough to watch and too far to speak to.',
      location: 0,
    },
    {
      name: 'A rescue in silence',
      summary:
        'The storm breaks the ship apart. She holds the prince above water all night and leaves him on the sand at the temple steps, then watches from the shallows as a girl from the temple finds him and is thanked for it.',
      location: 0,
    },
    {
      name: 'The price of a soul',
      summary:
        'Her grandmother explains what she has never had to explain before: mermaids live three hundred years and end as foam, and the only path to an immortal soul runs through a human who loves her above all others.',
      location: 1,
    },
    {
      name: 'Beyond the whirlpools',
      summary:
        'She swims past the boiling whirlpools and the polyp forest to the Sea Witch, who is neither surprised to see her nor pleased. The Witch knew she would come and has the price ready.',
      location: 3,
    },
    {
      name: 'Voice for legs',
      summary:
        'The terms are stated plainly: her tongue for the potion, legs that walk like knives, and no way back. If the prince marries another, she becomes foam on the first morning after. She agrees to all of it.',
      location: 3,
    },
    {
      name: 'Every step like knives',
      summary:
        'She wakes on the shore with legs and no voice, and the prince finds her there. She dances better than anyone at his court, and every step costs her exactly what she was told it would.',
      location: 4,
    },
    {
      name: 'A silent companion',
      summary:
        "She becomes the prince's favourite, sleeping on a cushion at his door. He tells her, kindly and often, about the temple girl who saved his life - to the one person who could correct him and cannot.",
      location: 4,
    },
    {
      name: 'The neighbouring princess',
      summary:
        "The prince is sent to meet a neighbouring king's daughter he has no intention of marrying. She turns out to be the girl from the temple steps, and he believes he has found his rescuer at last.",
      location: 4,
    },
    {
      name: 'A royal wedding',
      summary:
        "The wedding is held aboard ship, and the little mermaid carries the bride's train. She dances that night better than she ever has, knowing the terms and the hour, and says nothing because she cannot.",
      location: 4,
    },
    {
      name: "Her sisters' gift",
      summary:
        'Before dawn her sisters break the surface with their hair shorn off. They have traded it to the Witch for a knife: if she kills the prince before sunrise, the blood on her feet will make her a mermaid again.',
      location: 0,
    },
    {
      name: 'Foam and air',
      summary:
        'She stands over the sleeping prince with the knife, and throws it into the waves instead. She dissolves into foam at sunrise - and rises, not as nothing, but among the daughters of the air, with a soul to earn by her own work.',
      location: 0,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'The Sea',
      description:
        'Everything above the palace and below the sky. It is where the shipwreck happens, where the sisters surface, and where the story both begins and ends.',
    },
    {
      name: 'The Sea Kingdom',
      description:
        'The coral and amber palace of the Sea King, where six princesses are raised on stories of a surface none of them may see before fifteen.',
    },
    {
      name: 'The Palace Garden',
      description:
        'Six plots of garden, one for each princess. The youngest keeps hers bare of everything but red flowers and a marble boy salvaged from a wreck, which is the first sign of where she is looking.',
    },
    {
      name: "The Witch's Lair",
      description:
        'A house built of drowned bones past the boiling whirlpools and the polyp forest. Everyone who comes here comes knowing the price, because the Witch always says it first.',
    },
    {
      name: "The Prince's Palace",
      description:
        'The seaside castle where the prince lives, and where the little mermaid spends her days walking on knives among people who have no idea she is doing it.',
    },
  ],
  characters: [
    {
      name: 'The Little Mermaid',
      description:
        "The youngest of the Sea King's daughters, quieter and more dreaming than her sisters. She gives up the two things that make her herself - her voice and her form - and never once asks for either back.",
    },
    {
      name: 'The Sea King',
      description:
        'The widowed ruler of the undersea kingdom and father of six daughters, who keeps the rule about fifteen because his mother kept it before him.',
    },
    {
      name: 'The Grandmother',
      description:
        'The old queen, the only one below who has thought seriously about souls. She answers her granddaughter honestly, which is exactly what sets everything in motion.',
    },
    {
      name: 'The Sea Witch',
      description:
        'A sorceress beyond the whirlpools who states every term of a bargain out loud and keeps all of them. She is not cruel; she simply does not volunteer what nobody thinks to ask.',
    },
    {
      name: 'The Prince',
      description:
        'A prince pulled from a shipwreck who spends the story being kind to the wrong person for the right reasons. He never learns who actually saved him.',
    },
    {
      name: 'The Neighbouring Princess',
      description:
        'The girl from the temple steps, raised in a neighbouring kingdom. She did find the prince on the sand, and she believes what everyone believes, which makes her innocent of the whole misunderstanding.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 3],
    [1, 3],
    [4, 5, 10],
    [2, 6, 7, 8, 9, 11],
    [8, 9],
  ],
  relations: [
    { pair: [0, 1], type: 'Father and daughter' },
    { pair: [0, 2], type: 'Grandmother' },
    { pair: [1, 2], type: 'Mother and son' },
    { pair: [0, 3], type: 'A bargain struck' },
    { pair: [0, 4], type: 'Unspoken love' },
    { pair: [4, 5], type: 'Betrothed' },
    { pair: [0, 5], type: 'Mistaken for her' },
  ],
  items: [
    {
      name: "The Sea Witch's Potion",
      description:
        "A potion brewed with the Witch's own blood that turns a tail into legs. It works exactly as described, including the part about every step feeling like walking on knives.",
      category: 'Bargained object',
      initialState: "In the Witch's keeping",
      owner: 3,
      journey: [
        { scene: 5, state: 'Traded for her voice', owner: 0 },
        { scene: 6, state: 'Drunk on the shore at dawn', owner: 0 },
        { scene: 7, state: 'Nothing left of it', owner: null },
      ],
    },
    {
      name: 'The Enchanted Knife',
      description:
        'A knife the Witch will part with for the right price. Used before sunrise on the man the little mermaid loves, it would undo the bargain and give her back the sea.',
      category: 'Bargained object',
      initialState: "In the Witch's keeping",
      owner: 3,
      journey: [
        { scene: 4, state: 'Still unsold, among her things', owner: 3 },
        { scene: 10, state: "Bought with her sisters' hair", owner: 0 },
        { scene: 11, state: 'Thrown into the waves', owner: null },
      ],
    },
    {
      name: 'The Marble Statue',
      description:
        "A marble boy sunk from some wreck, standing in the youngest princess's garden long before she has any idea whose face she is looking at.",
      category: 'Keepsake',
      initialState: 'Standing among red flowers',
      owner: 0,
      journey: [
        { scene: 0, state: 'Set in her garden', owner: 0 },
        { scene: 2, state: 'Recognised in a living face', owner: 0 },
        { scene: 11, state: 'Left standing in the garden', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'The Price of a Soul',
      description:
        'Mermaids live three hundred years and then become foam on the water, with nothing after. A human soul is immortal, and a mermaid can only come by one if a human loves her more than father and mother and marries her - which no mermaid has ever managed.',
    },
    {
      title: 'Every Step Like Knives',
      description:
        'The potion gives real human legs, and every step taken on them feels like treading on knife blades. The pain never lessens and is never visible, so she is admired for her dancing by people who cannot tell what it is costing.',
    },
    {
      title: 'The Sea Witch Never Cheats',
      description:
        'Every bargain past the whirlpools is stated in full and kept to the letter. The Witch takes the voice she asked for and gives the legs she promised. What she never does is volunteer the consequence of the terms being met - and nobody has thought to ask.',
    },
  ],
  notes: [
    {
      title: 'Continuity: she cannot correct him',
      body: 'From the moment she drinks the potion she has no voice and cannot write. Every scene at court has to work as a scene where the one fact that would fix everything is physically unavailable to the only person who knows it.',
    },
    {
      title: 'Visual motif: the statue and the prince',
      body: 'The marble boy is in her garden before she ever sees a human face. Stage the first sight of the prince so the reader recognises the statue before she says anything about it.',
    },
    {
      title: 'Revision goal: nobody in this story is cruel',
      body: 'The Witch keeps her word, the prince is kind, the princess is innocent, the grandmother is honest. The tragedy has to come out of what each of them does not know, never out of malice.',
    },
  ],
  tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
  choiceLabel: 'Continue toward',
  triggers: { set: 'has_seen_the_surface', unset: 'still_has_her_voice' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 5 },
    { type: 'itemTake', item: 1, scene: 11 },
    { type: 'triggerSet', item: null, scene: 1 },
    { type: 'triggerUnset', item: null, scene: 5 },
  ],
};

const littleMermaidPt: StoryNarrative = {
  chapters: [
    {
      name: 'Filha do Mar',
      summary:
        'A mais nova de seis irmãs quer a superfície antes de ter permissão, e assim que a vê lhe explicam quanto vai custar querê-la.',
    },
    {
      name: 'O Trato',
      summary:
        'A Bruxa do Mar enuncia suas condições por inteiro e as cumpre à risca. O que ela omite não é mentira - é apenas o que ninguém pergunta.',
    },
    {
      name: 'Filha do Ar',
      summary:
        'O príncipe se casa com a mulher que acredita tê-lo salvado, e à pequena sereia é oferecida uma única saída, que exige dela tirar uma vida.',
    },
  ],
  scenes: [
    {
      name: 'O jardim com a estátua',
      summary:
        'Cada uma das seis princesas tem um canteiro do jardim do palácio para cuidar como quiser. A mais nova planta o dela apenas com flores vermelhas em volta de um menino de mármore vindo de algum naufrágio, e o mantém exatamente assim.',
      location: 2,
    },
    {
      name: 'Quinze anos, e a superfície',
      summary:
        'No seu décimo quinto aniversário ela enfim pode subir. Emerge ao lado de um navio iluminado por um aniversário seu, e vê um príncipe perto o bastante para observar e longe demais para falar.',
      location: 0,
    },
    {
      name: 'Um resgate em silêncio',
      summary:
        "A tempestade despedaça o navio. Ela sustenta o príncipe acima d'água a noite inteira e o deixa na areia junto aos degraus do templo, e então assiste da rebentação enquanto uma moça do templo o encontra e é agradecida por isso.",
      location: 0,
    },
    {
      name: 'O preço de uma alma',
      summary:
        'A avó explica o que nunca precisou explicar antes: sereias vivem trezentos anos e terminam em espuma, e o único caminho para uma alma imortal passa por um humano que a ame acima de todos.',
      location: 1,
    },
    {
      name: 'Além dos redemoinhos',
      summary:
        'Ela atravessa os redemoinhos ferventes e a floresta de pólipos até a Bruxa do Mar, que não se surpreende ao vê-la nem se alegra. A Bruxa sabia que ela viria e já tem o preço pronto.',
      location: 3,
    },
    {
      name: 'A voz pelas pernas',
      summary:
        'As condições são ditas com todas as letras: a língua pela poção, pernas que caminham como facas, e nenhum caminho de volta. Se o príncipe se casar com outra, ela vira espuma na primeira manhã seguinte. Ela aceita tudo.',
      location: 3,
    },
    {
      name: 'Cada passo como facas',
      summary:
        'Ela acorda na praia com pernas e sem voz, e o príncipe a encontra ali. Dança melhor que qualquer pessoa da corte dele, e cada passo lhe custa exatamente o que lhe disseram que custaria.',
      location: 4,
    },
    {
      name: 'Uma companhia muda',
      summary:
        'Ela se torna a favorita do príncipe, dormindo numa almofada à porta dele. Ele lhe fala, com gentileza e com frequência, sobre a moça do templo que lhe salvou a vida - à única pessoa que poderia corrigi-lo e não pode.',
      location: 4,
    },
    {
      name: 'A princesa vizinha',
      summary:
        'O príncipe é mandado conhecer a filha de um rei vizinho com quem não pretende se casar. Ela acaba sendo a moça dos degraus do templo, e ele acredita ter enfim encontrado quem o salvou.',
      location: 4,
    },
    {
      name: 'Um casamento real',
      summary:
        'O casamento é celebrado a bordo, e a pequena sereia carrega a cauda do vestido da noiva. Dança naquela noite melhor do que jamais dançou, sabendo das condições e da hora, e nada diz porque não pode.',
      location: 4,
    },
    {
      name: 'O presente das irmãs',
      summary:
        'Antes do amanhecer as irmãs rompem a superfície com os cabelos cortados rente. Trocaram-nos com a Bruxa por uma faca: se ela matar o príncipe antes do nascer do sol, o sangue em seus pés a fará sereia de novo.',
      location: 0,
    },
    {
      name: 'Espuma e ar',
      summary:
        'Ela fica de pé sobre o príncipe adormecido com a faca, e a atira nas ondas. Dissolve-se em espuma ao nascer do sol - e sobe, não como nada, mas entre as filhas do ar, com uma alma a conquistar pelo próprio esforço.',
      location: 0,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'O Mar',
      description:
        'Tudo o que está acima do palácio e abaixo do céu. É onde acontece o naufrágio, onde as irmãs emergem, e onde a história começa e termina.',
    },
    {
      name: 'O Reino do Mar',
      description:
        'O palácio de coral e âmbar do Rei do Mar, onde seis princesas são criadas ouvindo histórias de uma superfície que nenhuma delas pode ver antes dos quinze.',
    },
    {
      name: 'O Jardim do Palácio',
      description:
        'Seis canteiros de jardim, um para cada princesa. A mais nova mantém o dela sem nada além de flores vermelhas e um menino de mármore recolhido de um naufrágio, que é o primeiro sinal de para onde ela está olhando.',
    },
    {
      name: 'O Covil da Bruxa',
      description:
        'Uma casa feita de ossos de afogados, passados os redemoinhos ferventes e a floresta de pólipos. Todo mundo que vem aqui vem sabendo o preço, porque a Bruxa sempre o diz primeiro.',
    },
    {
      name: 'O Palácio do Príncipe',
      description:
        'O castelo à beira-mar onde o príncipe vive, e onde a pequena sereia passa os dias caminhando sobre facas em meio a gente que não faz a menor ideia disso.',
    },
  ],
  characters: [
    {
      name: 'A Pequena Sereia',
      description:
        'A mais nova das filhas do Rei do Mar, mais calada e mais sonhadora que as irmãs. Abre mão das duas coisas que a fazem ser ela mesma - a voz e a forma - e nem uma vez pede qualquer uma de volta.',
    },
    {
      name: 'O Rei do Mar',
      description:
        'O soberano viúvo do reino submarino e pai de seis filhas, que mantém a regra dos quinze anos porque sua mãe a manteve antes dele.',
    },
    {
      name: 'A Avó',
      description:
        'A velha rainha, a única lá embaixo que pensou a sério sobre almas. Responde à neta com honestidade, e é exatamente isso que põe tudo em movimento.',
    },
    {
      name: 'A Bruxa do Mar',
      description:
        'Uma feiticeira além dos redemoinhos que enuncia em voz alta cada condição de um trato e cumpre todas elas. Não é cruel; apenas não oferece espontaneamente o que ninguém pensa em perguntar.',
    },
    {
      name: 'O Príncipe',
      description:
        'Um príncipe tirado de um naufrágio que passa a história sendo gentil com a pessoa errada pelos motivos certos. Nunca fica sabendo quem de fato o salvou.',
    },
    {
      name: 'A Princesa Vizinha',
      description:
        'A moça dos degraus do templo, criada num reino vizinho. Ela de fato encontrou o príncipe na areia, e acredita no que todos acreditam, o que a deixa inocente do mal-entendido inteiro.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 3],
    [1, 3],
    [4, 5, 10],
    [2, 6, 7, 8, 9, 11],
    [8, 9],
  ],
  relations: [
    { pair: [0, 1], type: 'Pai e filha' },
    { pair: [0, 2], type: 'Avó' },
    { pair: [1, 2], type: 'Mãe e filho' },
    { pair: [0, 3], type: 'Um trato firmado' },
    { pair: [0, 4], type: 'Amor não dito' },
    { pair: [4, 5], type: 'Prometidos' },
    { pair: [0, 5], type: 'Confundida com ela' },
  ],
  items: [
    {
      name: 'A Poção da Bruxa do Mar',
      description:
        'Uma poção preparada com o próprio sangue da Bruxa, que transforma uma cauda em pernas. Funciona exatamente como descrito, inclusive na parte em que cada passo é como pisar em facas.',
      category: 'Objeto de barganha',
      initialState: 'Sob a guarda da Bruxa',
      owner: 3,
      journey: [
        { scene: 5, state: 'Trocada pela voz dela', owner: 0 },
        { scene: 6, state: 'Bebida na praia ao amanhecer', owner: 0 },
        { scene: 7, state: 'Nada resta dela', owner: null },
      ],
    },
    {
      name: 'A Faca Encantada',
      description:
        'Uma faca de que a Bruxa se desfaz pelo preço certo. Usada antes do nascer do sol sobre o homem que a pequena sereia ama, desfaria o trato e lhe devolveria o mar.',
      category: 'Objeto de barganha',
      initialState: 'Sob a guarda da Bruxa',
      owner: 3,
      journey: [
        { scene: 4, state: 'Ainda não vendida, entre as coisas dela', owner: 3 },
        { scene: 10, state: 'Comprada com o cabelo das irmãs', owner: 0 },
        { scene: 11, state: 'Atirada nas ondas', owner: null },
      ],
    },
    {
      name: 'A Estátua de Mármore',
      description:
        'Um menino de mármore vindo de algum naufrágio, de pé no jardim da princesa mais nova muito antes de ela ter qualquer ideia de que rosto está olhando.',
      category: 'Lembrança',
      initialState: 'De pé entre flores vermelhas',
      owner: 0,
      journey: [
        { scene: 0, state: 'Posta em seu jardim', owner: 0 },
        { scene: 2, state: 'Reconhecida num rosto vivo', owner: 0 },
        { scene: 11, state: 'Deixada de pé no jardim', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'O Preço de uma Alma',
      description:
        'Sereias vivem trezentos anos e depois viram espuma sobre a água, sem nada depois. A alma humana é imortal, e uma sereia só pode obter uma se um humano a amar mais que ao pai e à mãe e se casar com ela - o que sereia nenhuma jamais conseguiu.',
    },
    {
      title: 'Cada Passo Como Facas',
      description:
        'A poção dá pernas humanas de verdade, e cada passo dado sobre elas é como pisar em lâminas. A dor nunca diminui e nunca é visível, então ela é admirada pela dança por gente que não tem como perceber o que aquilo lhe custa.',
    },
    {
      title: 'A Bruxa do Mar Nunca Trapaceia',
      description:
        'Todo trato além dos redemoinhos é enunciado por inteiro e cumprido à risca. A Bruxa toma a voz que pediu e dá as pernas que prometeu. O que ela nunca faz é oferecer espontaneamente a consequência de as condições serem cumpridas - e ninguém pensou em perguntar.',
    },
  ],
  notes: [
    {
      title: 'Continuidade: ela não pode corrigi-lo',
      body: 'Do instante em que bebe a poção ela não tem voz e não sabe escrever. Toda cena na corte precisa funcionar como uma cena em que o único fato que resolveria tudo está fisicamente indisponível para a única pessoa que o conhece.',
    },
    {
      title: 'Motivo visual: a estátua e o príncipe',
      body: 'O menino de mármore está no jardim dela antes de ela sequer ver um rosto humano. Encenar a primeira visão do príncipe de modo que o leitor reconheça a estátua antes que ela diga qualquer coisa.',
    },
    {
      title: 'Meta de revisão: ninguém nesta história é cruel',
      body: 'A Bruxa cumpre a palavra, o príncipe é gentil, a princesa é inocente, a avó é honesta. A tragédia precisa nascer do que cada um deles não sabe, nunca de maldade.',
    },
  ],
  tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
  choiceLabel: 'Continuar em direção a',
  triggers: { set: 'viu_a_superficie', unset: 'ainda_tem_a_voz' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 5 },
    { type: 'itemTake', item: 1, scene: 11 },
    { type: 'triggerSet', item: null, scene: 1 },
    { type: 'triggerUnset', item: null, scene: 5 },
  ],
};

export const littleMermaid: LocalizedNarrative = { en: littleMermaidEn, pt: littleMermaidPt };
