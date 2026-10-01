import type { LocalizedNarrative, StoryNarrative } from './types';

const princessKaguyaEn: StoryNarrative = {
  chapters: [
    {
      name: 'The Tale of the Bamboo Cutter',
      summary:
        'An old couple with no children find one inside a bamboo stalk, and the grove keeps paying for her upkeep as fast as she grows.',
    },
    {
      name: 'Five Impossible Treasures',
      summary:
        'Kaguya-hime never refuses anyone. She asks each of five nobles for a thing that does not exist, and four of them come back lying.',
    },
    {
      name: 'The Fifteenth Night',
      summary:
        'The Emperor cannot be put off with an impossible task, and the Moon cannot be put off at all. Everything Kaguya-hime leaves behind turns out to be worthless to the people who wanted her.',
    },
  ],
  scenes: [
    {
      name: 'A child in the bamboo',
      summary:
        'Cutting bamboo as he has every day of his life, Taketori no Okina finds one stalk shining from the inside. Within it sits a child no taller than his hand, and he carries her home in his palms.',
      body: 'Taketori no Okina has cut bamboo every day of his life, and bamboo has never once surprised him - until the morning one stalk shines from the inside, lit like a lantern with no flame in it. He splits it open with hands that have suddenly forgotten their trade.\n\nWithin sits a child no taller than his hand, shining a little herself, looking up at him with complete composure. He carries her home in his palms, walking the way one walks with a full cup, and does not tell his wife until she is standing in the doorway seeing it.',
      location: 3,
    },
    {
      name: 'Growing like bamboo in spring',
      summary:
        'The child reaches full womanhood in three months. Neither the old man nor his wife asks why; they have wanted a daughter for forty years and are not inclined to interrogate one.',
      body: 'The child grows the way bamboo grows: visibly, overnight, an inch while you look away. In three months she is a grown woman, graceful and grave, with manners no one taught her and a gaze that seems to measure distances nobody else can see.\n\nNeither the old man nor his wife asks why. They have wanted a daughter for forty years, and wanting teaches its own etiquette: you do not interrogate a gift. They name her their daughter in everything but the asking, and she lets them, gently.',
      location: 1,
    },
    {
      name: 'Gold in every stalk',
      summary:
        'From the day he finds her, every stalk the old man cuts has gold inside it. The household becomes wealthy without anyone deciding to become wealthy, which is the first hint that she is being provided for from elsewhere.',
      body: 'From the day he finds her, every stalk the old man cuts has gold inside it - not gold like a prize, but gold like a salary, regular and sufficient. The household becomes wealthy the way rivers become wide: without anyone deciding it.\n\nThe old man tells himself it is luck, and his wife tells herself it is reward, and neither of them says what both of them notice: that the gold pays for exactly the life the girl requires. It is the first hint that she is being provided for from elsewhere - and the politest.',
      location: 3,
    },
    {
      name: 'The name Kaguya-hime',
      summary:
        'A naming feast lasts three days, and she is given the name Shining Princess of the Supple Bamboo. Word of her beauty leaves the house with the guests and does not stop travelling.',
      body: 'The naming feast lasts three days, with music and sake and more guests than the house was built to hold. She is given the name Kaguya-hime - Shining Princess of the Supple Bamboo - and the name fits her the way light fits a lamp.\n\nWord of her beauty leaves the house with the guests, riding in every palanquin and told at every gate, and does not stop travelling. By winter it has reached the capital. By spring it has reached everyone. Beauty, announced this thoroughly, is a kind of weather.',
      location: 1,
    },
    {
      name: 'Five suitors at the gate',
      summary:
        'Five nobles camp outside the house and refuse to leave. Kaguya-hime does not want any of them and will not say so, because a refusal would fall on the old man who has to live with these families.',
      body: 'Five nobles arrive and camp outside the house and refuse to leave: princes and ministers and counsellors, each certain he is the exception. They send poems. They send gifts. They send each other pointed looks over the fence.\n\nKaguya-hime does not want any of them, and will not say so - not from kindness to the suitors, but from care for the old man, who must go on living beside these families after the refusals. So she smiles, and thanks them for the poems, and sets about refusing them all without refusing a single one.',
      location: 0,
    },
    {
      name: 'The stone bowl and the jewelled branch',
      summary:
        'She sets each suitor a treasure to fetch. Prince Ishitsukuri sends for an ordinary bowl from a temple outside the city; Prince Kuramochi has a branch made by six jewellers and tells a long story about sailing to Mount Horai.',
      body: 'To each suitor she names a treasure: to Prince Ishitsukuri, the stone bowl of the Buddha; to Prince Kuramochi, the jewelled branch of Mount Horai. Impossible objects, politely requested. The suitors bow and depart, and the house enjoys its first quiet week in months.\n\nIshitsukuri sends to a temple outside the city for an ordinary bowl and presents it with a straight face. Kuramochi hires six jewellers to make a branch, then tells a long story about sailing to Horai - storms, monsters, two years at sea - that would be magnificent if a single word of it were true.',
      location: 2,
    },
    {
      name: 'The fire-rat robe and the dragon jewel',
      summary:
        "Minister Abe pays a fortune for a robe that burns in the first flame it meets. Counselor Otomo puts to sea after a jewel from a dragon's neck, is nearly drowned by a storm, and comes home swearing he was the injured party.",
      body: 'Minister Abe pays a fortune to a merchant for a robe of fire-rat skin, guaranteed against all flame. Kaguya-hime holds it to a candle. It burns - immediately, thoroughly, expensively - and the minister, the old couple agree later, burns nearly as well.\n\nCounselor Otomo actually puts to sea after a jewel from the neck of a dragon, which is more than the others attempted and exactly as wise. A storm nearly drowns him, and he comes home soaked and furious, swearing he was the injured party - as if the sea had owed him the jewel and defaulted.',
      location: 2,
    },
    {
      name: "The swallow's shell",
      summary:
        "Counselor Isonokami climbs to a swallow's nest for a shell that is not there and falls. The jewellers arrive that same week demanding payment for the branch, and every one of the five stories comes apart at once.",
      body: 'Counselor Isonokami climbs to a swallow nest for a shell that is not there - swallows keep no shells, as anyone could have told him - and falls, and is carried home in a state that ends his suit more finally than any refusal.\n\nThat same week the six jewellers arrive demanding payment for the branch, with the bill itemised and witnessed. The voyage, the bowl, the robe, the storm, the nest: every one of the five stories comes apart at once, like five knots in the same rope, pulled together.',
      location: 0,
    },
    {
      name: "The Emperor's courtship",
      summary:
        'The Emperor of Japan hears the reports and comes himself. He is the one man who cannot be sent after an impossible object, and Kaguya-hime tells him plainly that she is not of this country - which he takes for modesty.',
      body: "The Emperor of Japan hears the reports and comes himself - past the gate, into the house, with the ease of a man for whom all doors are already open. He is the one man who cannot be sent after an impossible object. There is nowhere to send him that he does not already own.\n\n'I am not of this country,' Kaguya-hime tells him plainly, meaning it literally, meaning the Moon. He takes it for modesty - the loveliest modesty he has ever heard - and loves her the more for it. She watches him misunderstand her, and grieves in advance, and says nothing further.",
      location: 0,
    },
    {
      name: 'A secret from the Moon',
      summary:
        'As the fifteenth night of the eighth month approaches she cannot stop weeping. She finally tells the old couple where she is from and that her people are coming for her, and that nothing anyone does can stop it.',
      body: 'As the fifteenth night of the eighth month approaches, she cannot stop weeping. She weeps at her sewing, at her meals, on the moonlit veranda where she sits watching the Moon the way one watches a road.\n\nAt last she tells the old couple everything: where she is from, that her people are coming for her on the fifteenth night, and that nothing anyone does - no soldiers, no prayers, no locked doors - can stop it. They hold her hands and weep with her, and the Moon goes on rising, punctual and pitiless.',
      location: 2,
    },
    {
      name: 'The robe of feathers',
      summary:
        "Two thousand of the Emperor's soldiers surround the house. A shining retinue descends anyway, the soldiers cannot lift their arms, and Kaguya-hime leaves a letter and a vial before the robe is placed on her shoulders and she forgets them all.",
      body: 'Two thousand soldiers of the Emperor surround the house on the appointed night, armed and earnest and entirely beside the point. A shining retinue descends from the sky anyway, and the soldiers find they cannot lift their arms, and stand like a field of statues holding sticks.\n\nKaguya-hime leaves a letter and a small vial for the Emperor, and embraces the old couple one last time. Then the robe of feathers is placed on her shoulders - and the forgetting comes with it, the way sleep comes with lying down, and she rises without looking back, because she no longer remembers what looking back is for.',
      location: 1,
    },
    {
      name: 'The mountain of immortality',
      summary:
        'The Emperor reads the letter and refuses the elixir: eternity without her is the one thing he wants least. He sends both to be burned on the peak nearest the sky, and the smoke has not stopped rising from Mount Fuji since.',
      body: 'The Emperor reads the letter, and holds the vial of the elixir of immortality for a long time without opening it. Eternity without her, he understands, is the one thing he wants least - an endless reign of the fifteenth night, forever.\n\nHe sends both - the letter and the vial - to be burned on the peak nearest the sky, where the smoke can climb closest to where she went. And the smoke has not stopped rising from Mount Fuji since, which is either a legend or a fact, and either way is true.',
      location: 4,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'The Capital and Its Provinces',
      description:
        'The realm the Emperor governs and the roads that carry rumour through it. Everything in the story that goes wrong for a suitor happens somewhere out here, out of sight of the house.',
    },
    {
      name: "The Bamboo Cutter's House",
      description:
        'A small house that becomes a rich one within a season, without anybody in it changing how they live. It is where Kaguya-hime is raised and where the Moon comes to collect her.',
    },
    {
      name: 'The Moonlit Veranda',
      description:
        'The veranda where Kaguya-hime receives visitors from behind a screen, and where, in the last months, she sits looking up at the moon until whoever is with her has to ask what is wrong.',
    },
    {
      name: 'The Bamboo Grove',
      description:
        'The grove the old man has worked all his life. One stalk in it once held a child, and for as long as she stays, every stalk he cuts holds gold.',
    },
    {
      name: 'Mount Fuji',
      description:
        'The peak nearest the heavens, chosen as the closest place to the Moon. What is burned here does not finish burning.',
    },
  ],
  characters: [
    {
      name: 'Kaguya-hime',
      description:
        'A radiant girl found as an infant inside a glowing bamboo stalk, grown to womanhood in three months. She refuses everyone without ever saying no, and keeps where she came from to herself until keeping it is no longer possible.',
    },
    {
      name: 'Taketori no Okina',
      description:
        'An elderly bamboo cutter who finds Kaguya-hime in the grove and raises her as his own. He is the only person who tries to bargain with the Moon, and the only one who never once asks her for anything.',
    },
    {
      name: "The Bamboo Cutter's Wife",
      description:
        'The old woman who raises Kaguya-hime beside her husband. She notices her daughter watching the moon months before anyone asks about it, and says nothing until she is told.',
    },
    {
      name: 'The Emperor',
      description:
        'The ruler of Japan, drawn by the reports and unable to be sent away on an errand. He is refused as gently as it is possible to refuse a sovereign, and he takes it better than any of the five nobles.',
    },
    {
      name: 'Prince Ishitsukuri',
      description:
        "Asked for the Buddha's stone begging bowl from India. He buys an ordinary bowl from a temple outside the capital and is caught the moment it fails to glow.",
    },
    {
      name: 'Prince Kuramochi',
      description:
        'Asked for a jewelled branch from Mount Horai. He commissions one from six craftsmen, invents a sea voyage to explain it, and is undone when the craftsmen come to the house asking to be paid.',
    },
    {
      name: 'Minister Abe no Miemasa',
      description:
        'Asked for a robe woven from the fur of the fire-rat, which cannot burn. He pays an enormous sum for one from a Chinese merchant, and it goes up at the first touch of flame.',
    },
    {
      name: 'Counselor Otomo no Miyuki',
      description:
        "Asked for the five-coloured jewel from a dragon's neck. He sails after it, is caught by a storm that nearly kills him, and returns telling everyone that Kaguya-hime tried to have him drowned.",
    },
    {
      name: 'Counselor Isonokami no Marotari',
      description:
        'Asked for the cowrie shell a swallow is said to bear. He has himself hauled up to a nest, finds nothing, and falls - the only suitor whose failure costs him more than his pride.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 1, 2, 3, 4, 8, 9, 10, 11],
    [0, 1, 3, 9, 10, 11],
    [8, 10, 11],
    [4, 5],
    [4, 5],
    [4, 6],
    [4, 6],
    [4, 7],
  ],
  relations: [
    { pair: [0, 1], type: 'Foster father' },
    { pair: [0, 2], type: 'Foster mother' },
    { pair: [1, 2], type: 'Married' },
    { pair: [0, 3], type: 'Courted, and refused' },
    { pair: [1, 3], type: 'Petitioned him for protection' },
    { pair: [0, 4], type: 'Suitor' },
    { pair: [0, 5], type: 'Suitor' },
    { pair: [0, 6], type: 'Suitor' },
    { pair: [0, 7], type: 'Suitor' },
    { pair: [0, 8], type: 'Suitor' },
  ],
  items: [
    {
      name: 'The Elixir of Immortality',
      description:
        "A vial of the Moon people's elixir, left behind as a parting kindness. It grants eternal life to a man who has just been given the only reason he would not want one.",
      category: 'Celestial object',
      initialState: "In the Moon retinue's keeping",
      owner: null,
      journey: [
        { scene: 9, state: "Spoken of, as the Moon's parting gift", owner: null },
        { scene: 10, state: 'Left behind beside the letter', owner: null },
        { scene: 11, state: 'Burned on the summit', owner: 3 },
      ],
    },
    {
      name: "Kaguya-hime's Farewell Letter",
      description:
        'The last thing she writes as herself, addressed to the Emperor, before the Robe of Feathers takes every attachment she has with it.',
      category: 'Celestial object',
      initialState: 'Unwritten',
      owner: 0,
      journey: [
        { scene: 9, state: 'Begun in secret', owner: 0 },
        { scene: 10, state: 'Left for the Emperor', owner: 3 },
        { scene: 11, state: 'Read, then burned', owner: 3 },
      ],
    },
    {
      name: 'The Jewelled Branch of Horai',
      description:
        'A branch of silver and gold and white jade, made over three years by six of the finest craftsmen in the capital, and presented as though it had been picked on a mountain that may not exist.',
      category: 'Forged treasure',
      initialState: 'Commissioned, not yet made',
      owner: 5,
      journey: [
        { scene: 4, state: 'Ordered from six craftsmen', owner: 5 },
        { scene: 5, state: 'Presented as brought from Horai', owner: 0 },
        { scene: 7, state: 'Exposed when the craftsmen ask to be paid', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'The Robe of Feathers',
      description:
        'Whoever puts on the celestial Robe of Feathers forgets every earthly attachment at once - love, grief, obligation, the people who raised them. It is not a punishment. It is simply what returning to the Moon requires, and Kaguya-hime asks to finish her letter before it is placed on her.',
    },
    {
      title: 'The Impossible Treasures',
      description:
        'Kaguya-hime never refuses a suitor. She sets each one a task that cannot be completed, so that every refusal is his failure rather than her rejection - which lets four of the five keep their standing by lying about it, and is exactly why the fifth is the one who gets hurt.',
    },
    {
      title: 'Nothing of the Moon Stays',
      description:
        'What comes from the Moon returns to it, and what it leaves behind is worth nothing to whoever keeps it. Gold fills the bamboo only while she is here; the elixir offers a man forever, on the one morning forever has stopped being worth having.',
    },
  ],
  notes: [
    {
      title: 'Continuity: the gold stops',
      body: 'The bamboo yields gold only for as long as Kaguya-hime is in the house. Nothing says so out loud, but no scene after her departure may show the old man wealthy.',
    },
    {
      title: 'Visual motif: light from inside',
      body: 'The stalk glows, the child glows, the retinue descends glowing, and the mountain smokes. Every turning point in the story is lit from within the thing itself.',
    },
    {
      title: 'Revision goal: she never says no',
      body: 'Kaguya-hime declines five nobles and an emperor without once refusing anyone. Keep every rejection phrased as a condition, so the failure always belongs to the man who accepted it.',
    },
  ],
  tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
  choiceLabel: 'Continue toward',
  triggers: { set: 'moon_secret_told', unset: 'suitors_still_hoping' },
  effects: [
    { type: 'itemGrant', item: 1, scene: 10 },
    { type: 'itemTake', item: 2, scene: 7 },
    { type: 'triggerSet', item: null, scene: 9 },
    { type: 'triggerUnset', item: null, scene: 7 },
  ],
};

const princessKaguyaPt: StoryNarrative = {
  chapters: [
    {
      name: 'O Conto do Cortador de Bambu',
      summary:
        'Um casal de velhos sem filhos encontra uma criança dentro de um talo de bambu, e o bambuzal passa a pagar pelo sustento dela na mesma velocidade em que ela cresce.',
    },
    {
      name: 'Cinco Tesouros Impossíveis',
      summary:
        'Kaguya-hime nunca recusa ninguém. Pede a cada um de cinco nobres uma coisa que não existe, e quatro deles voltam mentindo.',
    },
    {
      name: 'A Décima Quinta Noite',
      summary:
        'O Imperador não pode ser adiado com uma tarefa impossível, e a Lua não pode ser adiada de forma alguma. Tudo o que Kaguya-hime deixa para trás acaba não valendo nada para quem a queria.',
    },
  ],
  scenes: [
    {
      name: 'Uma criança no bambu',
      summary:
        'Cortando bambu como em todos os dias de sua vida, Taketori no Okina encontra um talo brilhando por dentro. Dentro dele há uma criança não maior que sua mão, e ele a leva para casa nas palmas.',
      body: 'Taketori no Okina corta bambu todos os dias de sua vida, e o bambu jamais o surpreendeu - até a manhã em que um talo brilha por dentro, aceso como um lampião sem chama. Ele o abre com mãos que de repente esqueceram o ofício.\n\nDentro há uma criança não maior que sua mão, brilhando um pouco ela mesma, olhando para ele com total compostura. Ele a leva para casa nas palmas, andando como se anda com uma xícara cheia, e nada conta à esposa até que ela está na porta vendo com os próprios olhos.',
      location: 3,
    },
    {
      name: 'Crescendo como bambu na primavera',
      summary:
        'A criança chega à idade adulta em três meses. Nem o velho nem a esposa perguntam por quê; querem uma filha há quarenta anos e não estão inclinados a interrogar uma.',
      body: 'A criança cresce como bambu cresce: visivelmente, de noite, um palmo enquanto se desvia o olhar. Em três meses é uma mulher feita, graciosa e grave, com maneiras que ninguém lhe ensinou e um olhar que parece medir distâncias que mais ninguém vê.\n\nNem o velho nem a esposa perguntam por quê. Querem uma filha há quarenta anos, e o querer ensina sua própria etiqueta: não se interroga um presente. Eles a tratam como filha em tudo menos no perguntar, e ela deixa, gentilmente.',
      location: 1,
    },
    {
      name: 'Ouro em cada talo',
      summary:
        'Desde o dia em que a encontra, todo talo que o velho corta tem ouro dentro. A casa enriquece sem que ninguém tenha decidido enriquecer, e é o primeiro indício de que ela é sustentada de outro lugar.',
      body: 'Desde o dia em que a encontra, todo talo que o velho corta tem ouro dentro - não ouro como prêmio, mas ouro como salário, regular e suficiente. A casa enriquece como rios alargam: sem que ninguém decida.\n\nO velho diz a si mesmo que é sorte, e a esposa diz a si mesma que é recompensa, e nenhum dos dois diz o que ambos notam: que o ouro paga exatamente a vida de que a menina precisa. É o primeiro indício de que ela é sustentada de outro lugar - e o mais educado.',
      location: 3,
    },
    {
      name: 'O nome Kaguya-hime',
      summary:
        'A festa de nomeação dura três dias, e ela recebe o nome de Princesa Radiante do Bambu Flexível. A notícia de sua beleza sai da casa com os convidados e não para mais de viajar.',
      body: 'A festa de nomeação dura três dias, com música e saquê e mais convidados do que a casa foi feita para conter. Ela recebe o nome de Kaguya-hime - Princesa Radiante do Bambu Flexível - e o nome lhe serve como a luz serve ao lampião.\n\nA notícia de sua beleza sai da casa com os convidados, viajando em cada palanquim e contada em cada portão, e não para mais de viajar. No inverno chega à capital. Na primavera chega a todos. A beleza, anunciada com tal afinco, é uma espécie de clima.',
      location: 1,
    },
    {
      name: 'Cinco pretendentes no portão',
      summary:
        'Cinco nobres acampam diante da casa e se recusam a ir embora. Kaguya-hime não quer nenhum deles e não vai dizê-lo, porque a recusa recairia sobre o velho, que precisa conviver com essas famílias.',
      body: 'Cinco nobres chegam e acampam diante da casa e se recusam a ir embora: príncipes e ministros e conselheiros, cada um certo de ser a exceção. Mandam poemas. Mandam presentes. Mandam uns aos outros olhares pontudos por cima da cerca.\n\nKaguya-hime não quer nenhum deles, e não vai dizê-lo - não por bondade com os pretendentes, mas por cuidado com o velho, que precisa continuar vivendo ao lado dessas famílias depois das recusas. Então sorri, agradece os poemas, e trata de recusar todos sem recusar um único.',
      location: 0,
    },
    {
      name: 'A tigela de pedra e o ramo enjoiado',
      summary:
        'Ela impõe a cada pretendente um tesouro a buscar. O príncipe Ishitsukuri manda vir uma tigela comum de um templo fora da capital; o príncipe Kuramochi encomenda um ramo a seis joalheiros e conta uma longa história sobre navegar até o Monte Horai.',
      body: 'A cada pretendente ela impõe um tesouro: ao príncipe Ishitsukuri, a tigela de pedra do Buda; ao príncipe Kuramochi, o ramo enjoiado do Monte Horai. Objetos impossíveis, pedidos educadamente. Os pretendentes se curvam e partem, e a casa desfruta sua primeira semana quieta em meses.\n\nIshitsukuri manda vir de um templo fora da capital uma tigela comum e a apresenta com cara séria. Kuramochi contrata seis joalheiros para fazer um ramo, e então conta uma longa história sobre navegar até Horai - tempestades, monstros, dois anos no mar - que seria magnífica se uma palavra dela fosse verdade.',
      location: 2,
    },
    {
      name: 'O manto de rato-de-fogo e a joia do dragão',
      summary:
        'O ministro Abe paga uma fortuna por um manto que queima na primeira chama que encontra. O conselheiro Otomo faz-se ao mar atrás de uma joia do pescoço de um dragão, quase se afoga numa tempestade e volta jurando que a vítima foi ele.',
      body: 'O ministro Abe paga uma fortuna a um mercador por um manto de pele de rato-de-fogo, garantido contra toda chama. Kaguya-hime o segura junto a uma vela. Ele queima - de imediato, por completo, caramente - e o rosto do ministro, concordarão os velhos depois, queima quase tão bem.\n\nO conselheiro Otomo de fato se faz ao mar atrás de uma joia do pescoço de um dragão, o que é mais do que os outros tentaram e exatamente tão sensato. Uma tempestade quase o afoga, e ele volta encharcado e furioso, jurando que a vítima foi ele - como se o mar lhe devesse a joia e tivesse dado o calote.',
      location: 2,
    },
    {
      name: 'A concha da andorinha',
      summary:
        'O conselheiro Isonokami sobe até um ninho de andorinha atrás de uma concha que não está lá, e cai. Os joalheiros chegam naquela mesma semana cobrando o pagamento do ramo, e as cinco histórias desmoronam de uma vez.',
      body: 'O conselheiro Isonokami sobe até um ninho de andorinha atrás de uma concha que não está lá - andorinhas não guardam conchas, como qualquer um poderia ter lhe dito - e cai, e é levado para casa num estado que encerra sua corte mais definitivamente que qualquer recusa.\n\nNaquela mesma semana os seis joalheiros chegam cobrando o pagamento do ramo, com a conta detalhada e testemunhada. A viagem de Kuramochi, a tigela de Ishitsukuri, o manto de Abe, a tempestade de Otomo, o ninho de Isonokami: as cinco histórias desmoronam de uma vez, como cinco nós na mesma corda, puxados juntos.',
      location: 0,
    },
    {
      name: 'A corte do Imperador',
      summary:
        'O Imperador do Japão ouve os relatos e vem pessoalmente. É o único homem que não pode ser mandado atrás de um objeto impossível, e Kaguya-hime lhe diz com todas as letras que não é deste país - o que ele toma por modéstia.',
      body: 'O Imperador do Japão ouve os relatos e vem pessoalmente - portão adentro, casa adentro, com o desembaraço de um homem para quem todas as portas já estão abertas. É o único homem que não pode ser mandado atrás de um objeto impossível. Não há para onde mandá-lo que ele já não possua.\n\n- Não sou deste país - diz-lhe Kaguya-hime com todas as letras, querendo dizer literalmente, querendo dizer a Lua. Ele toma por modéstia - a mais linda modéstia que já ouviu - e a ama ainda mais por isso. Ela o observa entendê-la mal, e sofre de antemão, e nada mais diz.',
      location: 0,
    },
    {
      name: 'Um segredo da Lua',
      summary:
        'Com a aproximação da décima quinta noite do oitavo mês, ela não consegue parar de chorar. Enfim conta ao casal de velhos de onde veio, que seu povo virá buscá-la, e que nada que alguém faça poderá impedir.',
      body: 'Com a aproximação da décima quinta noite do oitavo mês, ela não consegue parar de chorar. Chora na costura, nas refeições, na varanda ao luar onde se senta observando a Lua como se observa uma estrada.\n\nEnfim conta tudo ao casal de velhos: de onde veio, que seu povo virá buscá-la na décima quinta noite, e que nada que alguém faça - nem soldados, nem preces, nem portas trancadas - poderá impedir. Eles seguram suas mãos e choram com ela, e a Lua segue nascendo, pontual e impiedosa.',
      location: 2,
    },
    {
      name: 'O manto de plumas',
      summary:
        'Dois mil soldados do Imperador cercam a casa. Uma comitiva luminosa desce assim mesmo, os soldados não conseguem erguer os braços, e Kaguya-hime deixa uma carta e um frasco antes que o manto lhe seja posto sobre os ombros e ela esqueça todos eles.',
      body: 'Dois mil soldados do Imperador cercam a casa na noite marcada, armados e sérios e inteiramente fora de questão. Uma comitiva luminosa desce do céu assim mesmo, e os soldados descobrem que não conseguem erguer os braços, e ficam como um campo de estátuas segurando gravetos.\n\nKaguya-hime deixa uma carta e um pequeno frasco para o Imperador, e abraça o casal de velhos uma última vez. Então o manto de plumas lhe é posto sobre os ombros - e o esquecimento vem com ele, como o sono vem com o deitar, e ela sobe sem olhar para trás, porque já não lembra para que serve olhar para trás.',
      location: 1,
    },
    {
      name: 'A montanha da imortalidade',
      summary:
        'O Imperador lê a carta e recusa o elixir: a eternidade sem ela é a última coisa que quer. Manda queimar ambos no pico mais próximo do céu, e a fumaça não parou de subir do Monte Fuji desde então.',
      body: 'O Imperador lê a carta, e segura o frasco do elixir da imortalidade por um longo tempo sem abri-lo. A eternidade sem ela, ele entende, é a última coisa que quer - um reinado sem fim da décima quinta noite, para sempre.\n\nEle manda ambos - a carta e o frasco - serem queimados no pico mais próximo do céu, onde a fumaça pode subir para o mais perto de onde ela foi. E a fumaça não parou de subir do Monte Fuji desde então, o que é ou uma lenda ou um fato, e de todo jeito é verdade.',
      location: 4,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'A Capital e Suas Províncias',
      description:
        'O território que o Imperador governa e as estradas que levam o boato por ele. Tudo o que dá errado para um pretendente acontece em algum ponto daqui de fora, longe da vista da casa.',
    },
    {
      name: 'A Casa do Cortador de Bambu',
      description:
        'Uma casa pequena que se torna rica em uma estação, sem que ninguém lá dentro mude o próprio modo de viver. É onde Kaguya-hime é criada e onde a Lua vem buscá-la.',
    },
    {
      name: 'A Varanda ao Luar',
      description:
        'A varanda onde Kaguya-hime recebe visitas por trás de um biombo e onde, nos últimos meses, fica olhando para a lua até que quem esteja com ela precise perguntar o que há.',
    },
    {
      name: 'O Bambuzal',
      description:
        'O bambuzal em que o velho trabalha a vida inteira. Um talo dali abrigou uma criança, e enquanto ela ficar, todo talo que ele cortar terá ouro.',
    },
    {
      name: 'O Monte Fuji',
      description:
        'O pico mais próximo dos céus, escolhido como o lugar mais perto da Lua. O que se queima aqui não termina de queimar.',
    },
  ],
  characters: [
    {
      name: 'Kaguya-hime',
      description:
        'Uma menina radiante encontrada ainda bebê dentro de um talo de bambu luminoso, adulta em três meses. Recusa todo mundo sem nunca dizer não, e guarda para si de onde veio até que guardar deixe de ser possível.',
    },
    {
      name: 'Taketori no Okina',
      description:
        'Um velho cortador de bambu que encontra Kaguya-hime no bambuzal e a cria como filha. É a única pessoa que tenta negociar com a Lua, e a única que nunca lhe pede nada.',
    },
    {
      name: 'A Esposa do Cortador de Bambu',
      description:
        'A velha que cria Kaguya-hime ao lado do marido. Nota a filha olhando para a lua meses antes de alguém perguntar, e nada diz até que lhe contem.',
    },
    {
      name: 'O Imperador',
      description:
        'O soberano do Japão, atraído pelos relatos e impossível de ser mandado a um mandado qualquer. É recusado do modo mais gentil com que se pode recusar um soberano, e leva melhor que qualquer um dos cinco nobres.',
    },
    {
      name: 'Príncipe Ishitsukuri',
      description:
        'Encarregado de trazer a tigela de pedra de Buda, vinda da Índia. Compra uma tigela comum num templo fora da capital e é desmascarado no instante em que ela não brilha.',
    },
    {
      name: 'Príncipe Kuramochi',
      description:
        'Encarregado de trazer um ramo enjoiado do Monte Horai. Encomenda um a seis artesãos, inventa uma viagem marítima para explicá-lo, e se desmonta quando os artesãos aparecem na casa pedindo para receber.',
    },
    {
      name: 'Ministro Abe no Miemasa',
      description:
        'Encarregado de trazer um manto tecido com pelo do rato-de-fogo, que não queima. Paga uma soma enorme por um a um mercador chinês, e ele se desfaz ao primeiro toque de chama.',
    },
    {
      name: 'Conselheiro Otomo no Miyuki',
      description:
        'Encarregado de trazer a joia de cinco cores do pescoço de um dragão. Sai em busca dela pelo mar, é apanhado por uma tempestade que quase o mata, e volta dizendo a todos que Kaguya-hime tentou afogá-lo.',
    },
    {
      name: 'Conselheiro Isonokami no Marotari',
      description:
        'Encarregado de trazer a concha que se diz nascer de uma andorinha. Manda içar-se até um ninho, não encontra nada e cai - o único pretendente cujo fracasso lhe custa mais que o orgulho.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 1, 2, 3, 4, 8, 9, 10, 11],
    [0, 1, 3, 9, 10, 11],
    [8, 10, 11],
    [4, 5],
    [4, 5],
    [4, 6],
    [4, 6],
    [4, 7],
  ],
  relations: [
    { pair: [0, 1], type: 'Pai adotivo' },
    { pair: [0, 2], type: 'Mãe adotiva' },
    { pair: [1, 2], type: 'Casados' },
    { pair: [0, 3], type: 'Cortejada, e recusou' },
    { pair: [1, 3], type: 'Pediu-lhe proteção' },
    { pair: [0, 4], type: 'Pretendente' },
    { pair: [0, 5], type: 'Pretendente' },
    { pair: [0, 6], type: 'Pretendente' },
    { pair: [0, 7], type: 'Pretendente' },
    { pair: [0, 8], type: 'Pretendente' },
  ],
  items: [
    {
      name: 'O Elixir da Imortalidade',
      description:
        'Um frasco do elixir do povo da Lua, deixado como gentileza de despedida. Concede vida eterna a um homem que acaba de receber o único motivo para não querer uma.',
      category: 'Objeto celeste',
      initialState: 'Sob a guarda da comitiva da Lua',
      owner: null,
      journey: [
        { scene: 9, state: 'Mencionado, como presente de despedida da Lua', owner: null },
        { scene: 10, state: 'Deixado ao lado da carta', owner: null },
        { scene: 11, state: 'Queimado no cume', owner: 3 },
      ],
    },
    {
      name: 'A Carta de Despedida de Kaguya-hime',
      description:
        'A última coisa que ela escreve sendo ela mesma, endereçada ao Imperador, antes que o Manto de Plumas leve embora todo apego que ela tem.',
      category: 'Objeto celeste',
      initialState: 'Por escrever',
      owner: 0,
      journey: [
        { scene: 9, state: 'Começada em segredo', owner: 0 },
        { scene: 10, state: 'Deixada para o Imperador', owner: 3 },
        { scene: 11, state: 'Lida, e depois queimada', owner: 3 },
      ],
    },
    {
      name: 'O Ramo Enjoiado de Horai',
      description:
        'Um ramo de prata, ouro e jade branco, feito ao longo de três anos por seis dos melhores artesãos da capital, e apresentado como se tivesse sido colhido numa montanha que talvez não exista.',
      category: 'Tesouro forjado',
      initialState: 'Encomendado, ainda por fazer',
      owner: 5,
      journey: [
        { scene: 4, state: 'Encomendado a seis artesãos', owner: 5 },
        { scene: 5, state: 'Apresentado como trazido de Horai', owner: 0 },
        { scene: 7, state: 'Desmascarado quando os artesãos vêm cobrar', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'O Manto de Plumas',
      description:
        'Quem veste o celeste Manto de Plumas esquece de imediato todo apego terreno - amor, luto, obrigação, as pessoas que o criaram. Não é castigo. É apenas o que voltar à Lua exige, e Kaguya-hime pede para terminar a carta antes que o ponham sobre ela.',
    },
    {
      title: 'Os Tesouros Impossíveis',
      description:
        'Kaguya-hime nunca recusa um pretendente. Impõe a cada um uma tarefa que não pode ser cumprida, de modo que toda recusa seja fracasso dele e não rejeição dela - o que permite a quatro dos cinco preservarem a posição mentindo, e é exatamente por isso que o quinto é o único que se machuca.',
    },
    {
      title: 'Nada da Lua Permanece',
      description:
        'O que vem da Lua volta para ela, e o que ela deixa não vale nada para quem fica. O ouro enche o bambu apenas enquanto ela está aqui; o elixir oferece a um homem o para sempre, justo na manhã em que o para sempre deixou de valer a pena.',
    },
  ],
  notes: [
    {
      title: 'Continuidade: o ouro acaba',
      body: 'O bambu só dá ouro enquanto Kaguya-hime está na casa. Nada diz isso em voz alta, mas nenhuma cena depois da partida dela pode mostrar o velho rico.',
    },
    {
      title: 'Motivo visual: luz vinda de dentro',
      body: 'O talo brilha, a criança brilha, a comitiva desce brilhando, e a montanha fumega. Todo ponto de virada da história é iluminado de dentro da própria coisa.',
    },
    {
      title: 'Meta de revisão: ela nunca diz não',
      body: 'Kaguya-hime declina cinco nobres e um imperador sem recusar ninguém uma única vez. Manter toda rejeição formulada como condição, para que o fracasso pertença sempre ao homem que a aceitou.',
    },
  ],
  tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
  choiceLabel: 'Continuar em direção a',
  triggers: { set: 'segredo_da_lua_contado', unset: 'pretendentes_ainda_esperancosos' },
  effects: [
    { type: 'itemGrant', item: 1, scene: 10 },
    { type: 'itemTake', item: 2, scene: 7 },
    { type: 'triggerSet', item: null, scene: 9 },
    { type: 'triggerUnset', item: null, scene: 7 },
  ],
};

export const princessKaguya: LocalizedNarrative = {
  en: princessKaguyaEn,
  pt: princessKaguyaPt,
};
