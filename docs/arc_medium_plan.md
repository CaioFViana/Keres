# Arco como obra: medium, páginas de cena, roteiro e lançamento por Arco

**Status:** proposta em revisão; decisões do usuário de 2026-10-06 incorporadas. Itens marcados **[aberto]** esperam
resposta.
**Modelo mental (não mudar):** a História é o universo (mundo, calendário, vocabulário base, permissões, sync). O Arco é
a obra dentro dele: livro, filme, edição, temporada. **Não existe cânone compartilhado entre Histórias** (sync e
permissão cruzados) e linear/ramificado não se mistura (a forma é da História; se houver demanda, vira outra decisão).

## Decisões congeladas

1. **Lançamento por Arco** publica só manuscrito e leitor, sem zip. O zip é só da História inteira (universo).
2. **Tier:** `maxPublishedArcs` (arcos com ao menos uma versão no ar, por história; apagar a última versão libera a
   vaga; `null` = ilimitado). O teto diário de publicações continua valendo em separado.
3. **`ScenePage` com texto por página.** `Scene.body` fica livre. A UI diz que Keres é esboço: não publica com qualidade
   final de HQ/animação (Sketch não é, nem deve ser, ferramenta profissional).
4. **Roteiro:** `Scene.body` em Fountain; cabeçalho de cena gerado de Location + hora **só se o body não começar por um
   cabeçalho**, com indicador/botão explícito. Sem hora de calendário, o cabeçalho sai sem hora; o texto do usuário vence.
5. **Campanha é um medium** com pack de conveniência e template de crônica; a captura rápida só aparece nele.
6. **Packs nunca são obrigatórios**, só conveniência. Um pack pode marcar o Arco padrão com um medium e avisar o que ligou.
7. **Cada Arco tem seu medium; cada Arco pode ter seu vocabulário.** O medium fornece termos padrão amigáveis.
8. **`ScenePage` conta nos limites de entidade do tier;** o que conta é revisado antes da release.
9. **Mídia removida:** a página sobrevive com "mídia removida" e fica fora do manuscrito; a UI oferece substituir por
   outra mídia (Sketch ou Galeria). Nunca apagar o texto da página em cascata.
10. **Capa por Arco e por História** (`coverGalleryId`, opcional) em qualquer medium.
11. **Autor por Arco** (`StoryArc.author`, anulável; cai para `Story.author`, depois para o `@handle` do usuário).
12. **Cenas avulsas:** `includeLooseScenes` já existe (default `false`). Com `false` nenhuma cena sem capítulo entra num
    lançamento de Arco; com `true` entram em **todos** os Arcos. Confirmar no teste de isolamento e avisar ao publicar.
13. **Fontes:** lista curada de fontes livres (OFL), fixadas e embutidas no PDF; padrão continua o de hoje. Sem upload de
    fonte do usuário (licença, peso). DOCX/EPUB/HTML só nomeiam a fonte; o leitor precisa tê-la.
14. **Busca nas listas:** filtro do arco ativo + "+N resultados fora deste arco" (toque para ver). Busca global
    continua sem filtro, com etiqueta de arco.

## 1. Medium no Arco

- `StoryArc.medium`: `generic` (default) | `screenplay` | `comic` | `storyboard` | `campaign`. Nome distinto de
  `Story.type` (`linear | branching`).
- **Perfil de saída, nunca regra de dados:** escolhe termos padrão, template de compilação, preset de páginas e atalhos
  de UI. Todas as entidades seguem disponíveis em qualquer medium. Trocar de medium não migra dado (páginas e textos
  persistem, só deixam de ser compilados/exibidos se o medium novo não os usa).
- Sem default de medium na História. Arco novo começa `generic` (ou copia o medium do arco ativo ao criar).
- **Formulário de criação de História** ganha o campo "tipo da obra" (medium) que já cria o Arco padrão com ele. Packs
  podem preenchê-lo.
- Entra em export/import de pacote (`storyExportMigrations`), sync, clone, packs, snapshot de publicação.

### Resolução de termos (vocabulário)

Precedência, do mais específico ao mais geral: **vocabulário do Arco > vocabulário da História > termos padrão do medium
> padrão do app.** Um termo escolhido explicitamente pelo usuário nunca é sobrescrito por um padrão.

- `StoryArc.vocabulary` (anulável; guarda só os termos que o usuário sobrescreveu). Dentro de um Arco, a tela de
  vocabulário edita o vocabulário **desse Arco**; fora de Arco ("Todos"), edita o da História. Termo sem sobrescrita
  herda (vivo) da História e, abaixo, do medium. Não há "copiar de outro Arco": o medium já traz termos amigáveis.
  Cada termo e a tela inteira têm "restaurar" (remove as sobrescritas do Arco).

### Modo "Todos os arcos"

Não existe medium único nesse modo (decidido):

- Listas e menus usam termos da História (vocabulário da História, senão padrão do app); sem termos de medium.
- Telas de um item (cena, capítulo) adaptam ao **arco do próprio item** (cena → capítulo → arco): uma cena de HQ abre com
  páginas, uma de roteiro abre com cabeçalho de roteiro, mesmo em "Todos". Cena avulsa (sem capítulo) usa o arco ativo
  ou, em "Todos", `generic`.
- Atalhos que dependem de um medium (captura rápida de sessão, exportação Fountain) só aparecem quando há um Arco
  ativo desse medium.
- Novo capítulo em "Todos" cai no Arco padrão (comportamento atual).

## 2. Lançamento por Arco

- `story_publications.arcId` (nullable; versões antigas = história inteira). Unicidade de label e retenção (5) por
  `(storyId, arcId)`.
- Versão de Arco: `packageIncluded = false`, manuscrito e/ou leitor com `arcId` (o compilador já isola por Arco e corta
  arestas de gamebook para fora do arco). Recusar (400) versão de Arco com `packageIncluded = true`.
- Showcase: a página da História lista Arcos como obras (capa, nome, autor, versões, leitor). Zip só na versão universo.
  O snapshot da publicação guarda título, autor, capa e medium do Arco como estavam.
- Tier: `maxPublishedArcs` (coluna, migração PG/SQLite, página Tiers do admin, schema público do tier, testes de paridade).
- Onboarding: "A história é o universo; cada Arco é uma obra dentro dele" no dashboard, na criação de História e na
  ajuda; conferir se o termo Arco é renomeável pelo vocabulário.

## 3. Capas

- `StoryArc.coverGalleryId` opcional, escolhida da Galeria. Usada no showcase, na capa do manuscrito e no seletor de Arco.
- `Story.coverGalleryId` opcional para o universo (página da História no showcase e versão universo). O Arco sem capa
  própria não herda a da História no manuscrito.

## 4. Busca e Arco

- Ver decisão 14. Pendente: ler o comportamento atual da busca dentro das listas antes de implementar.

## 5. Location interior/exterior

- `Location.setting`: `interior | exterior | both | none` (anulável). Migração, sync, schemas, import/export, packs.
- Usado só pelo roteiro (`INT.`, `EXT.`, `INT./EXT.`); `none`/nulo não gera prefixo.

## 6. Roteiro (Fountain)

- `Scene.body` = texto Fountain. Modo roteiro mostra acima do body: local, interior/exterior, elenco, hora.
- Exportação Fountain: folha de rosto (`Title` do Arco, `Author` pela decisão 11, `Contact` vazio), capítulo → `#`,
  resumo da cena → `=`, cabeçalho gerado (decisão 4), ênfase → `*`, `**`, `_`, comentários → `[[ ]]` (opcional),
  numeração `#n#` (opcional), `===` onde o usuário marcar.
- Importação Fountain: divide em cenas nos cabeçalhos; **sugere** (não cria sozinho) locais e personagens por nome.
- PDF no padrão da indústria; FDX depois, se houver demanda.
- Indicador explícito na UI: "Cabeçalho gerado a partir do local; escreva um cabeçalho no início do texto para
  substituí-lo".

## 7. Layout de PDF e estimativa de páginas

- O PDF de hoje usa fontes embutidas (fontkit, subconjunto, matrizes fixadas em `pdfFonts.manifest.json`). Fontes novas
  entram no manifesto com sha256, como as atuais.
- **Segundo layout, "screenplay"**, ao lado do atual (o de prosa não muda): Courier Prime (OFL, métrica de Courier),
  12 pt, 10 cpi, 6 lpi, margens E 1,5" / D 1" / T 1" / B 1"; recuos a partir da borda: cena/ação 1,5", diálogo 2,5",
  parentético 3,1", personagem 3,7"; número de página no canto superior direito a partir da página 2; nome de
  personagem não fica sozinho no pé; `(MORE)`/`(CONT'D)`. Objetivo: o PDF ser o roteiro real quando viável de forma
  simples; comparar com Highland/Final Draft é verificação de qualidade, não bloqueio.
- **Genérico:** preset de manuscrito clássico (12 pt, espaçamento duplo, margens 1") com a fonte do layout de prosa.
- Estimativa de páginas usa o **mesmo motor** do PDF; o cartão "Como estimamos" mostra papel (Letter/A4), fonte, tamanho,
  espaçamento, margens e recuos. DOCX reflui no Word e pode divergir.

## 8. Limite de tamanho do manuscrito (revisão do sistema)

Hoje `MAX_MANUSCRIPT_BYTES` (50 MB) só é checado **depois** de compilar (`compileStoryManuscript.ts`, `storyReader.ts`),
então o usuário só descobre o estouro no fim. Imagens de página tornam isso crítico. Revisão proposta (fase própria,
antes de `ScenePage`):

- **Estimar antes:** imagens de página são redimensionadas **antes** de compilar (tamanho conhecido), texto tem cota
  conservadora por formato e há um overhead fixo por formato. Mostrar a estimativa e a margem na tela de exportar/publicar.
- **Abortar cedo:** o escritor de PDF já libera por página; somar bytes enquanto escreve e parar no limite, em vez de
  terminar e jogar fora.
- **Orçamento por página** (resolução máxima e qualidade por preset), com aviso ao se aproximar do teto.
- Reavaliar o teto (separado entre texto e imagem? vinculado ao tier/storage?) e o inchaço do leitor HTML
  autossuficiente (imagens em base64).

## 9. Páginas de cena (HQ e storyboard)

- Nova entidade `ScenePage`: `id, storyId, sceneId, position, sketchId | galleryId (exatamente um), fit, text`, mais
  campos padrão de sync. `fit`: `contain` (centralizado) | `cover` (corte centralizado).
- Texto por página: balões numerados no desenho; `text` diz o que cada balão contém. `Scene.body` livre.
- Tamanho de página vem do Arco (presets: A5, comic US, B5/mangá, 16:9). Termos Página/Quadro/Plano vêm do medium
  (decisão 7), sobrescritíveis.
- Snapshot: página com Sketch usa o PNG da Galeria (`coverGalleryId` do sketch); se o desenho mudou desde o snapshot
  (`updatedAt`/hash), o cliente **regera antes de publicar/exportar**. Servidor só consome o que o cliente enviou.
- Compilação: imagem da página seguida do `text` dela (DOCX/PDF/EPUB/HTML), sujeita ao §8.
- Decisão 9 para mídia removida.
- Lifecycle obrigatório: create, update, delete (tombstone), reorder (disputa a ordem inteira), sync/OCC, conflito,
  export/import, clone, conversão linear/ramificado, limites de entidade do tier (decisão 8).
- Aviso na UI e na ajuda: Keres é esboço; HQ/animação em qualidade final exige ferramenta profissional.

## 10. Campanha

- Medium `campaign`. Pack `campaign` (EN+PT) é conveniência: ao criar a história marca o Arco padrão como campanha,
  avisa os módulos ligados e semeia vocabulário (Capítulo → Sessão), atributo DATE de data real, tags (NPC, facção,
  missão) e seções de mundo. Tudo editável/removível; sem o pack o medium funciona igual.
- Sessão = capítulo; o que aconteceu = **lista de cenas** (pode ser curta).
- Template de compilação "crônica": sessão por sessão, "a história até agora", "anteriormente".
- **Captura rápida** (tela só no medium campanha, com Arco ativo): "Nova sessão" pede **só a data real** (hoje por
  padrão), sugere o próximo número e abre direto no texto, com a primeira cena criada e botão "+ cena". Elenco presente
  marcável por cena. Data in-world não é perguntada (segue atributos/timeline ou quem registra resolve). Sem dado novo;
  rascunho guardado se a tela fechar sem salvar.
- Limitação a registrar na ajuda: sem visibilidade por campo/entidade; leitores veem tudo.

## Ordem

1. `medium`, `vocabulary`, `cover`, `author` no Arco + campo no formulário de História + onboarding de Arco.
2. Lançamento por Arco + `maxPublishedArcs`.
3. `Location.setting` + modo roteiro + exportação Fountain.
4. Revisão do limite de tamanho (§8) e layout de PDF "screenplay" + estimativa de páginas + seletor de fontes.
5. `ScenePage` + compilação de HQ/storyboard.
6. Medium campanha: pack, template de crônica e captura rápida.
7. Importação Fountain; FDX se houver demanda.
8. Por fase: ajuda e dicas (EN+PT), `feature_inventory.md`, `FEATURE_LANDSCAPE.md`, matriz de exemplos.

## Verificação

Teste de ciclo de vida com banco real e integração de API por entidade nova/coluna nova; paridade PG/SQLite nas
migrações; teste de isolamento por Arco na publicação (versão de Arco nunca contém zip nem conteúdo de outro Arco,
inclusive com `includeLooseScenes`).

## Estado da implementação (out/2026)

Feito, por fase: **1** medium, vocabulário, capa e autor no Arco, campo na História, onboarding; **2** lançamento por
Arco e `maxPublishedArcs`; **3** `Location.intExt`, modo roteiro, Fountain (exportação e importação); **4** sistema de
tamanho (estimar antes, abortar cedo), layout de PDF de roteiro, estimativa de páginas (roteiro e prosa); **5**
`ScenePage` com compilação de imagens (HTML, EPUB, DOCX, PDF e leitor), `Sketch.coverSourceHash`, `Arco.pageFormat`;
**6** campanha (pack, preset "crônica", "Nova sessão"); **7** importação Fountain.

Desvios e pendências, ditos para não parecerem esquecimento:

- **Pack e medium:** o schema de pack não carrega medium, então o pack `campaign` não marca o Arco (o medium é escolhido
  no formulário da História) e não "avisa o que ligou". É só conveniência de conteúdo (data real, tags, notas).
- **Nova sessão:** pede só a data e abre a primeira cena; "+ cena" é o da lista de elementos. Sem elenco marcável nela e
  sem rascunho guardado. Sem o campo `session_date` (pack), a data vai no resumo do capítulo.
- **Mídia removida (decisão 9):** a página fica de fora do manuscrito, sem número; a exportação diz quantas ficaram.
- **DOCX:** não recorta; uma página com `cover` aparece inteira, dentro do quadro.
- **Publicação:** o servidor só lê o que o cliente mandou. Um Sketch alterado é redesenhado no cliente antes de publicar,
  e esse snapshot novo precisa sincronizar antes de uma nova tentativa.
- **Busca (decisão 14):** "+N fora deste arco" em Personagens, Locais e Itens; a lista de Elementos Narrativos ainda não.
- **Fontes (decisão 13):** não implementado (exige fontes OFL com sha256 no manifesto, matrizes e verificação visual).
- **Cabeçalho de roteiro com hora:** não implementado; o cabeçalho sai sem hora, como a decisão 4 prevê sem calendário.
- **FDX:** só se houver demanda.
- Sem verificação em aparelho: snapshots de Sketch (Skia) e PDFs com imagens foram cobertos por testes, não vistos.
