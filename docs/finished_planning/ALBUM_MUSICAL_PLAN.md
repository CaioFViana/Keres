# Música nas cenas — plano (v4)

> Música é algo que uma **cena** tem, como a cena de uma HQ tem páginas de Sketch (`ScenePage`).
> Serve à história: trilha, canção de taverna, hino, ninar, ambiente de mesa. O coração da
> ferramenta é escrever uma canção (letra, cifras, melodia) e **ouvir um esboço**: uma voz sintética
> cantarolando as notas. Publicar é secundário. **Peso de execução é requisito**, não detalhe: ver
> "Orçamento de performance".
>
> Levantamento sem alterar código. Fatos do repo conferidos em out/2026; o que não foi conferido
> está marcado.

## Estado da implementação (out/2026)

Fases 1, 2, 3a e 3b feitas; da fase 4 só a folha de música. Tudo em commits não assinados, com testes.

| Parte | Estado | Onde |
|---|---|---|
| Fase 1: `SceneMusic` (vínculo com mídia da Galeria), role, deixa, achados de integridade | feita | `SceneMusicScreen`, `useSceneMusic` |
| Fase 2: `Song` (lead sheet ChordPro, seções, transpor com desfazer, contagem de sílabas, tradução, importar/exportar ChordPro), `sections` no vínculo, busca global na letra, Galeria dona de `Song`, publicação (adendo ou após a cena; roteiro como letra Fountain), Story Analysis (alvo apagado, seção sumida, canção inteira por seção sumida, rótulo repetido, tradução que não casa, canção sem uso), aviso do export de canções impressas inteiras, exemplo em Alice | feita | `SongEditorScreen`, `musicChecks.ts`, `songPrint.ts` |
| Fase 3a: melodia (subconjunto fechado de ABC, uma por seção com herança), alinhamento com as sílabas, teclado de 2 oitavas, voz sintética (cantarolar, "ah", "lá"), WAV em fatias com cache por hash (20 MB), karaokê, MIDI e ABC | feita | `melody.ts`, `timeline.ts`, `voice.ts`, `SongAudioService.ts`, `MelodyPanel.tsx` |
| Fase 3b: acompanhamento por acordes (violão, harpa, piano, violino; valsa, balada, marcha, ninar), sozinho quando não há melodia | feita | `accompaniment.ts`, `instruments.ts` |
| Fase 4: folha de música (CSV e Markdown) | feita | `cueSheet.ts`, `CueSheetService.ts` |
| Fase 4: pauta em Skia com Bravura; ligar a canção a quem a canta | **não feita** | depende de demanda (ver abaixo) |

**Spike (decisão 15), medido em bun, não em aparelho.** 30 s de melodia hummed:
- com JIT: ~6 ms; com o JIT desligado (`BUN_JSC_useJIT=0`, proxy de um interpretador): ~210 ms;
- com acompanhamento (30 s, 120 notas de fundo): ~10 ms com JIT, 0,45–0,55 s sem JIT (violão, harpa,
  piano, violino);
- a régua é 2 s num aparelho intermediário; a margem é de ~4× sobre o proxy. **Hermes não foi
  medido** (não há VM do Hermes no repo, só o compilador) e o aparelho intermediário também não.

**Desvios do plano**
- Rota A (JS + `expo-audio`); a rota B (`react-native-audio-api`) não foi avaliada, porque a A passou.
- O preview não toca um "pequeno conjunto de players" para o teclado: usa um player só, que troca de
  arquivo a cada tecla (cada tom é um WAV curto em cache). Latência da tecla não medida.
- O cache descarta o mais antigo escrito (não o menos usado): o expo-file-system não expõe último
  acesso.
- `import()` dinâmico para carregar a síntese só ao tocar **não foi feito** (não conferi o suporte em
  Metro/Hermes); o módulo é pequeno e nada roda até apertar tocar.
- Karaokê: o relógio do player é lido a cada 120 ms; a linha só re-renderiza ao mudar.
- A duração da canção aparece no editor (medida pela melodia, ou estimada pelas cifras); a lista de
  canções mostra tom, andamento e compasso, não a duração. **Sugerir a duração da cena a partir da
  canção não foi feito.**

**Os instrumentos são matemática, não amostras, e nunca foram ouvidos.** A primeira versão tinha
violino sem harmônicos acima do 6º, piano com 3 parciais e cordas dedilhadas apagando acima do 6º (medido);
soava como flauta/órgão. A segunda (cordas de Karplus-Strong com martelo e desafinação de unísono para o
piano, serra band-limited com ressonâncias de corpo e ponte para o violino) tem harmônicos até o 8º-10º
medidos, mas isso só prova que não faltam harmônicos, não que soe como violino. Som de verdade pede
amostras (PCM cru + créditos), que não entraram. O arquivo **MIDI** leva o acompanhamento num canal
próprio com o programa General MIDI do instrumento (violão de nylon 24, harpa 46, piano 0, cordas 48), para
o tocador usar os sons dele.

**Não verificado** (só em aparelho ou na web): qualidade e naturalidade da voz e dos instrumentos
(ouvidos não testados; verifiquei afinação e espectro por medida), latência do teclado, modo silencioso
do iOS, `expo-audio` com `blob:` na web, tamanho real do cache em aparelho.

## Decidido

1. **Publicação:** adendo "Canções" no fim **ou** a letra no fim da cena em que é cantada; o escritor
   escolhe (ver "Publicação").
2. **Nomes:** `Song` (a canção) e `SceneMusic` (o vínculo da cena).
3. **Música em todo medium**, inclusive `generic` (livro): o romancista liga canções a cenas porque o
   livro publica a letra no fim da cena ou do volume. Sem porta escondida por medium.
4. **Conta no tier**, como `ScenePage`.
5. **Voz sintética cantarolando a melodia** é o preview e é central (fase 3).
6. **Gravar áudio na Galeria:** fora deste plano.
7. **Trecho cantado:** `SceneMusic.sections` — cada cena diz quais seções da canção aparecem nela.
8. **Segunda letra** (idioma fictício e tradução): coluna própria em `Song` (ver "Modelo").
9. **Sem melodia, cada acorde dura um compasso**; com melodia, o acorde começa na nota da sílaba onde
   foi escrito.
10. **Um andamento e um compasso por canção.** Quem precisa de mais está fora do alvo do Keres.
11. **Transpor reescreve** cifras e melodia de verdade, com desfazer.
12. **Segunda letra = `lyricsTranslation`** (no banco, `lyrics_translation`): a letra no idioma do
    leitor. `lyrics` é a cantada, em idioma fictício ou não.
13. **O adendo imprime a canção inteira**, mesmo que as cenas só usem uma seção.
14. **Seção órfã** (renomeada ou apagada): se sobra alguma das `sections` do vínculo, imprime-se o que
    sobra; se não sobra nenhuma, imprime-se **a canção inteira**. **Quem avisa é a Story Analysis**
    (ver "Story Analysis"), não uma validação própria da tela; o export também diz quantas canções
    saíram inteiras por esse motivo.
15. **Régua do spike:** 30 s de melodia renderizados em até 2 s num aparelho intermediário.
16. **Tabela `scene_music`**, no singular.
17. **Melodia por seção, com herança** (fase 3a). Pesquisado: a forma **estrófica** (a mesma melodia
    para todas as estrofes) é a de hinos, baladas e muitas canções pop ("Amazing Grace"); a
    **verso–refrão** repete o refrão e deixa os versos variarem; a **through-composed** escreve música
    nova a cada estrofe. O padrão ABC guarda **uma melodia** e põe várias estrofes embaixo dela
    (linhas `w:`). Nosso modelo cobre as três: a seção sem melodia própria usa a da anterior do mesmo
    tipo (verso→verso), e qualquer seção pode ter a sua. Na tela isso aparece como "usa a melodia do
    Verso 1", sem jargão, com um toque para escrever uma própria.

## Premissas

1. **Música é da cena, não do arco.** O medium só muda o vocabulário (`ARC_MEDIUM_TERMS`: roteiro
   "Música/Deixa", campanha "Ambiente", HQ e storyboard "Trilha") e o padrão de publicação. `ARC_MEDIUMS`
   hoje: `generic, screenplay, comic, storyboard, campaign`. Nenhum medium novo.
2. **Mesmo molde de `ScenePage`:** o vínculo aponta para **uma de duas coisas** — uma `Song` feita aqui
   ou um item da Galeria (áudio ou link). Se o alvo some em outro aparelho, o vínculo sobrevive com sua
   nota e mostra "removida" (decisão 9 do plano do Arco).
3. **Lógica em `packages/shared`**, TS puro, testada em vitest, para client e API.
4. **Nada de terceiros publicado.** Referências da Galeria nunca saem; letras só saem de uma `Song`.

## Modelo

### `SceneMusic` (vínculo, uma linha por música da cena)
`id, storyId, sceneId, rank, songId | null, galleryId | null (exatamente um), role, cue, sections |
null, createdAt…`
- `rank` ordena como as páginas (`rules/rank.ts`).
- `cue`: texto livre — "entra quando ela abre a porta", "corta no grito". É a nota de deixa.
- `songId` e `sections` nascem **já na fase 1**, nulos, para a fase 2 não migrar.
- `role` e `sections` abaixo.

### `role`: os personagens ouvem essa música?
- **`in-world`** — existe dentro da história: a canção de taverna, o hino, a cantiga de ninar. A letra
  pode aparecer no texto, porque é parte do que acontece.
- **`score`** — existe para quem conta a história, não para quem vive nela: trilha de HQ, tema de
  animação, música de mesa durante o combate. Nunca entra no texto.
- Publicação: só `in-world` imprime letra. Roteiro: `in-world` cantada vira linha `~` do Fountain
  (imprime); `score` vira nota `[[ ]]` (não imprime).
- A mesma canção pode ter os dois papéis (cantada pelo bardo numa cena, trilha no funeral), por isso
  o papel fica no **vínculo**.
- Padrão: `in-world` quando o alvo é uma `Song` com letra, `score` quando é referência da Galeria. Dois
  valores bastam; "ambiente de mesa" é `score` com rótulo do medium `campaign`.

### `sections`: o trecho que a cena canta
- Lista de rótulos de seção (JSON); `null` = a canção inteira.
- Os rótulos vêm dos marcadores da letra: `{start_of_verse: Verso 1}`, `{start_of_chorus: Refrão}`.
  O editor **numera e exige rótulo único** dentro da canção (dois "Verso" viram "Verso 1" e "Verso 2").
- Letra sem marcadores = uma seção implícita; `sections` fica nulo.
- Renomear ou apagar uma seção deixa a referência órfã. Exemplo: a cena 9 canta o "Refrão"; depois o
  escritor renomeia o rótulo para "Coro" na letra, e o vínculo continua dizendo "Refrão", que não
  existe mais. Regra (decisão 14): se alguma das seções do vínculo ainda existe, imprime-se só ela; se
  nenhuma existe, imprime-se **a canção inteira**. O aviso vem da Story Analysis.
- `{chorus}` (recall do ChordPro, "repete o refrão aqui") imprime só o rótulo entre parênteses, não o
  texto de novo.

### Nomes no código e no banco
Padrão do repositório (conferido em `sketches.ts` e `storyArcs.ts`): propriedade em camelCase no TS
(`coverSourceHash`, `pageFormat`) e coluna em snake_case no banco (`cover_source_hash`,
`page_format`); tabela no plural snake_case (`sketches`, `scene_pages`). Logo: `Song.lyricsTranslation`
↔ coluna `lyrics_translation`; tabela `songs`; o vínculo vira `scene_music` (singular: "music" não tem
plural em inglês), com colunas `scene_id`, `song_id`, `gallery_id`, `role`, `cue`, `sections`, `rank`.

### `Song` (a canção; uma linha com colunas separadas)
`id, storyId, title, notes, lyrics, lyricsTranslation, melody, key, tempo, meter, createdAt…`
- Colunas **separadas**, não um `content` JSON como o Sketch: o `update` do sync é parcial (o Sketch
  usa `PartialSketchSchema`), então letra e melodia editadas em aparelhos diferentes não se atropelam
  por inteiro (não conferi se o conflito é decidido por campo ou pela versão da linha). E texto em
  coluna entra na **busca global** (`searchField`, como o Sketch faz com nome e descrição).
- `lyrics`: **o que se canta**, em subconjunto de **ChordPro** — `[G]Noite des[Em]ceu`,
  `{start_of_chorus: Refrão}`, `{key: G}`, `{tempo: 90}`, `{time: 3/4}`; sílabas com hífen onde a
  contagem importa. Em idioma fictício, é a letra fictícia. A melodia, o karaokê e a contagem de
  sílabas seguem esta coluna.
- `lyricsTranslation`: opcional, a letra no idioma do leitor, **sem cifras**, com os mesmos marcadores
  de seção (um aviso se não casarem). Só se publica; não toca.
- `melody`: notas como texto (subconjunto no estilo ABC; formato fechado na fase 3), reservada no
  esquema desde a fase 2.
- `notes` (ficha): função narrativa, quem canta, cultura, métrica e rima.
- **Tetos** (calibrados em letras reais, abaixo): letra 16 KB (com cifras), tradução 16 KB, ficha 8 KB,
  melodia 8 KB. Validador estrito antes do push, esquema versionado.

  Medidas em canções de domínio público (Wikisource, texto sem marcação, em bytes):
  | Canção | Tamanho | Observação |
  |---|---|---|
  | Danny Boy (Weatherly) | ~0,9 KB | 21 linhas |
  | Auld Lang Syne (Burns) | ~1,3 KB | verso e refrão |
  | Robin Hood and the Monk (Child 119) | ~11,3 KB | 369 linhas, a balada narrativa longa; o texto
  inclui algumas linhas editoriais, então é limite superior |

  Cifras somam cerca de 25% (uma cifra de ~4,5 bytes a cada ~5 sílabas, estimativa minha): a balada
  mais longa dá ~14 KB com cifras. Canções de hoje (letra de rap longa) ficam em 5–7 KB. Por isso 16 KB
  cobre o pior caso real com folga pequena e o teto de 32 KB que eu propusera era exagero. A melodia
  conta em **bytes**, não em notas: ~6 bytes por nota em texto, 8 KB ≈ 1.300 notas. Não medi partituras;
  a estimativa de notas vem de uma nota por sílaba (hino de 4 linhas ≈ 28 notas por estrofe; canção
  pop com verso, refrão e ponte ≈ 200 notas distintas, 400–550 se tudo fosse escrito por extenso).
  **Custo de síntese depende do tempo tocado, não do que está guardado**, e o teto de preview já o
  limita.
- **Galeria:** `GALLERY_OWNER_ENTITIES` ganha `'Song'` (hoje: `Character, Location, Note, Scene, Item,
  WorldRule`; o tipo faz o compilador apontar todo `case` que falta). Dá referência de escuta (link),
  partitura escaneada ou desenhada num Sketch e áudio de referência.

## Fases

Cada fase se paga sozinha e testa a demanda da seguinte.

### Fase 1 — Música da cena por referência (sem `Song`, sem áudio gerado)
- `SceneMusic` só com `galleryId` (áudio ou link) + `role` + `cue`.
- `SceneMusicEntry` na cena, ao lado de `ScenePagesEntry`, em **todo medium**; em `generic` a linha é
  discreta ("Música" e a contagem). Tela cheia no molde de `ScenePagesScreen`.
- Fountain: a deixa vira nota `[[MÚSICA: título — deixa]]`. HQ/storyboard: texto junto da página.
- Story Analysis: os dois achados de integridade da fase 1 (alvo apagado; ponteiro duplo ou vazio).
- Custo: **uma** entidade nova (ver "Custo").
- Pergunta que responde: escritores anotam música por cena? Se não, para aqui.

### Fase 2 — `Song`: letra com cifras
- Entidade `Song`, biblioteca (ao lado da lista de Sketches), `SceneMusic.songId` e `sections`, `Song`
  como dono da Galeria, busca global na letra.
- Editor de lead sheet **em texto**: cifra sobre a sílaba, seções, **transpor**, contagem de sílabas por
  verso (heurística PT/EN rotulada como estimativa; idioma fictício = hifenização manual), seletor de
  seções na tela do vínculo, campo de tradução.
- Importar/exportar ChordPro. Duração estimada (compassos × batidas ÷ BPM), que pode sugerir a duração
  da cena (o roteiro já tem `duration`).
- Publicação (abaixo). Achados de música na Story Analysis (tabela acima). Uma `Song` de exemplo num
  dos exemplos de história.

### Fase 3 — Melodia e o preview cantarolado
**3a. Melodia + voz.**
- **Modelo:** eventos tipo MIDI (altura, início, duração), uma voz só. A melodia não é presa à letra
  por posição: a letra mostra as notas alinhadas por ordem e **avisa quando a contagem não bate**
  (silabificação nunca é perfeita). Pausas e ligaduras são eventos.
- **Melodia por seção, com reaproveitamento.** Canção estrófica (balada de 78 estrofes, hino de 4
  versos) repete a mesma melodia: guarda-se a melodia **uma vez por seção**, e a seção seguinte do
  mesmo tipo (verso depois de verso) herda a anterior quando não tem a sua. O que se guarda é o que
  foi escrito, não o que é tocado; 78 estrofes não custam 78 melodias, e o aviso de contagem roda por
  estrofe.
- **Entrada:** teclado de 1 a 2 oitavas deslizável que toca o tom; **uma nota por sílaba** com seletor
  de duração; tocar a nota existente a edita. Alternativa: digitar em texto.
- **Voz:** síntese fonte–filtro, **monofônica** — pulso glotal, 3 formantes, vibrato com entrada
  atrasada, portamento curto, envelope. Timbres: **cantarolar** ("mm", o que soa mais crível), "ah",
  "lá". `expo-speech` descartado: não afina por nota.
- **Preview:** a melodia toca com a letra seguindo (karaokê) e clique opcional (misturado no WAV, não
  agendado em tempo real). Teclado com tons curtos pré-renderizados.
- **Rota técnica**, a decidir pelo spike de medida:
  - **A.** Síntese em JS, render offline para WAV, toca por `expo-audio`. Sem módulo nativo.
  - **B.** `react-native-audio-api` (Software Mansion; API Web Audio em C++, serve RN e web). Não
    confirmei licença, suporte a Expo 57 nem `OfflineAudioContext`; é módulo nativo, pede build de
    desenvolvimento.
  - Web e modo silencioso do iOS testados à parte nas duas.
- **Export:** o mesmo modelo de eventos escreve MIDI padrão (`.mid`) e ABC.

**3b. Acompanhamento por acordes.** Das cifras gera harpa, violão, violino e piano numa levada (valsa,
balada, marcha, ninar): voicing por instrumento e padrão por levada, que pedem desenho próprio. Harpa e
violão por Karplus-Strong, violino e piano procedurais; piano por amostra só se o procedural soar
inaceitável (precisa de WAV/PCM cru — decodificar MP3/OGG em JS não é viável — e créditos). **A banda
inteira só entra se o spike da 3a passar com folga**, porque várias vozes multiplicam o custo.

### Fase 4 — Opcional
Pauta em Skia, Bravura, folha de música (cue sheet: cena, deixa, papel, referência, tom/BPM, duração,
letra) para um compositor, ligar a canção a quem a canta.

## Publicação

- `includeSongs` (padrão desligado) e `songsPlacement`:
  - **`appendix`** — adendo "Canções" no fim (`songsHeading`), como as cenas soltas
    (`looseHeading`, `includeLooseScenes`). Cada canção **inteira, uma vez**, na ordem da primeira
    cena em que é `in-world`, só de cenas incluídas (respeita arco e filtros).
  - **`after-scene`** — a letra logo após o texto da cena, em itálico, **só as `sections` do vínculo**.
    Sem âncora no meio do texto: o corpo da cena não tem ponto de inserção.
- Só `in-world` imprime. Uma canção só `score` não sai, mesmo com letra.
- **Idioma:** `songLanguage`: `sung` (padrão), `translation` ou `both`. `both` põe a letra cantada e,
  logo abaixo, a tradução, seção por seção (os marcadores casam as duas). Sem tradução, `both` e
  `translation` caem em `sung`.
- **`songRepeat`** (só `after-scene`): `first-only` (padrão) ou `every`. Cada **seção** de uma canção só
  é impressa na primeira vez que aparece no livro; nas outras cenas, o que já saiu vira só o título
  (`♪ Cantiga de ninar`). Com `every`, imprime sempre. Isso evita a cantiga inteira três vezes, e
  deixa a cena 2 imprimir o verso e a cena 9 o refrão sem conflito.
- `songChords` (desligado): cifras junto da letra, para caderno de canções.
- **Roteiro (Fountain):** `in-world` cantada → linhas `~`; `score` → nota `[[ ]]`. A importação do
  Keres já mantém `~` e descarta notas (as notas não voltam).
- **HQ/storyboard:** título e deixa saem no texto da página/quadro.
- **Leitor publicado:** só letra, sem áudio nem referência. O tamanho das canções entra na estimativa
  de tamanho do manuscrito (`estimateManuscriptBytes`), que já aborta cedo.

## Story Analysis

O módulo (`apps/client/src/utils/storyAnalysis/`) separa **integridade** (referência para algo que não
existe; verdadeira em qualquer obra, sempre ligada) de **opinião** (atrás de `completenessChecks`,
desligada por padrão; ver `docs/finished_planning/story_analysis_toggle_plan.md`). A seção órfã é
integridade, e o resto da música se divide do mesmo jeito. Novo arquivo `musicChecks.ts`, categoria
`'music'`, chaves `analysis_*` com texto EN/PT, achados ancorados na **cena** (já navegável) para não
exigir tela nova.

| Achado | Gravidade | Tipo | Fase |
|---|---|---|---|
| Vínculo aponta para `Song` ou item da Galeria **apagado** (mídia removida) | aviso | integridade | 1 |
| Vínculo com `songId` e `galleryId` ao mesmo tempo, ou nenhum dos dois (o servidor recusa; pacote de fora pode trazer) | erro | integridade | 1 |
| `sections` cita rótulo que **não existe mais** na letra (parcial: imprime o que resta) | aviso | integridade | 2 |
| Todas as `sections` do vínculo sumiram (**imprime a canção inteira**) | aviso | integridade | 2 |
| Rótulo de seção **repetido** na letra (as `sections` ficam ambíguas) | aviso | integridade | 2 |
| `lyricsTranslation` com seções que **não casam** com `lyrics` | aviso | integridade | 2 |
| Canção que nenhuma cena usa (`analysis_song_unused`) | aviso | **opinião** (entra em `COMPLETENESS_FINDING_KEYS`) | 2 |

Fora da Story Analysis, de propósito: contagem de sílabas contra a melodia e notas a mais ou a menos
são **opinião sobre um rascunho** e ficam no editor, onde o escritor está olhando para elas.

**Custo.** O caminho barato roda a cada mudança da história (selo do painel) e precisa ser O(vínculos):
- Entram só os dados do vínculo e, **apenas das canções com `sections` num vínculo**, a lista de rótulos
  extraída da letra por um extrator simples de marcadores (`{start_of_*: rótulo}`), em cache por versão
  da canção. A Story Analysis nunca analisa melodia nem estima sílabas.
- Nada de ler a letra de canções sem vínculo com `sections`; o achado "repetido" e o de tradução só
  roda para as mesmas canções.
- Os dois achados de fase 1 não leem letra nenhuma.
- O extrator é o mesmo do editor e do manuscrito (uma regra só para "qual seção é qual").

**Contas a pagar:** categoria nova no tipo e na tela da análise, mensagens EN/PT, e testes no molde de
`storyAnalysisChecks.test.ts`.

## Orçamento de performance

Princípio: **nada roda sem o usuário pedir** e **nada pesa onde ele não está usando música**. Os
números são metas a validar no spike, não medições.

**Fora da tela de música**
- A cena só paga uma consulta leve (títulos e contagem de `SceneMusic`); nada de ler letra ou melodia.
- A lista de canções mostra título e duração em cache; não analisa a letra.
- O módulo de música e o de síntese **não carregam na abertura do app**: só ao abrir a tela e ao tocar
  (carregamento sob demanda; conferir o suporte a `import()` dinâmico na configuração de Metro/Hermes).

**Editor de lead sheet**
- Cada linha é poucos `Text`: o segmento "cifra + texto até a próxima cifra" vira uma pilha; o resto da
  linha é um `Text` só. **Nunca uma pilha por sílaba.**
- Linhas em lista virtualizada; cada linha em `React.memo`; análise do texto com debounce e só das
  linhas alteradas.
- Autosave com debounce (ocioso ~1–2 s e ao sair): **uma operação de sync por salvamento**, nunca por
  tecla. Letra e melodia nunca vão para o sync além do texto.
- Teclado de melodia com 25 teclas fixas; melodia limitada em bytes (8 KB), renderizada por linha em
  lista virtualizada.

**Síntese e preview**
- **Só ao tocar.** Sem render ao abrir, sem render em segundo plano.
- WAV 22,05 kHz, mono, 16 bits (≈ 2,6 MB/min), preview limitado a 60–90 s ou a um refrão.
- Laço interno em `Float32Array`/`Int16Array`, sem alocação por amostra; render **em fatias** que
  cedem a thread de JS entre uma e outra (RN não tem worker), com barra de progresso e cancelamento ao
  sair da tela.
- **Cache por hash** (melodia + andamento + timbre): se nada mudou, toca o arquivo; se mudou, renderiza
  de novo. Cache temporário com teto (proposta: 20 MB, descarta o mais antigo) e limpeza; nunca
  sincroniza.
- Tons do teclado renderizados na hora na primeira abertura do editor (25 × 0,5 s, centenas de
  milhares de amostras, pouco), mantidos em um pequeno conjunto de players e **liberados ao sair**.
- Karaokê: posição lida a ~4–10 Hz e só a linha atual re-renderiza; sem laço de animação a 60 Hz.
- **Critério do spike (decisão 15):** renderizar 30 s de melodia em no máximo 2 s num aparelho
  intermediário, sem travar a UI. Uma canção de 3 min passa do teto de preview: o preview toca uma
  **seção** à escolha (ou os primeiros 60–90 s). Se falhar: reduzir para 16 kHz, menos formantes, preview mais curto, ou rota B.
- Banda completa (3b) só com a 3a dentro da meta.

**Publicação**
- Texto puro; sem áudio. Custo igual ao de uma cena.

## Direito autoral

- Referência (Galeria) é do escritor para o escritor: nunca publicada.
- A letra de uma `Song` pode ser de terceiro; o app não sabe. Aviso no editor ("letras próprias; para
  canção alheia, guarde o link"), e `includeSongs` desligado por padrão. Vale também para ChordPro
  importado.
- Amostras (só 3b, se vierem): cada uma entra em `THIRD_PARTY_CREDITS`
  (`packages/shared/metadata/AppRelease.ts`; `appRelease.test.ts` falha se faltar). Salamander Piano V3
  é CC-BY 3.0 (Alexander Holm, com nota de subset), VSCO-2 CE é CC0, Bravura é SIL OFL. Amostra como
  dado não contamina o MPL-2.0 do app. Verovio é LGPL-3.0: descartado.

## Custo real de uma entidade nova (por experiência com `ScenePage`)

Cada uma (`SceneMusic`, depois `Song`) exige: entidade, esquema e handler em `shared`; handler da API
e migrações PG e SQLite; tabela e migração do client + `generate-indexes`; handler de sync; coleção
de export e importação de pacote; `cloneExampleStory` e os JSONs de exemplo; `tierCounting` (agora
contam); purga local da história; achados na Story Analysis; textos EN/PT; ajuda; vocabulário por medium; testes em cada camada.

## Questões em aberto

Nenhuma. Os dois pontos que restavam foram fechados (decisões 16 e 17).

## Riscos e notas (sem decisão pendente)

- **Verificação em aparelho e na web** (latência do teclado, qualidade da voz, modo silencioso do iOS,
  áudio na web) só se descobre lá; reservar tempo quando chegar à fase 3, como no plano do Arco.
- **Demanda não validada.** Nenhum concorrente de planejamento de história faz isto (World Anvil só
  embute música). Por isso a fase 1 é pequena e a 3 só vem depois de a 2 ter uso.
- **Estimativa de notas** não veio de partituras; vem de uma nota por sílaba. Vale conferir com
  melodias reais na fase 3.
- **Conflito de edição** na mesma `Song` em dois aparelhos: não conferi se é por campo ou por versão da
  linha; as colunas separadas ajudam nos dois casos.
