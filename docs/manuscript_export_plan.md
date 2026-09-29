# Manuscript: PDF no servidor, EPUB e profissionalização do export

## Status (2026-09-27)

Fases 1–4 implementadas. Pendências só manuais (abaixo).

- **Fase 1:** PDF e EPUB no servidor e no device pelo mesmo `renderManuscript`; `expo-print` removido. docx/md/txt/html/pdf byte-estáveis para as mesmas entradas (docx difere só no timestamp de `docProps/core.xml`).
- **Fase 2:** `ManuscriptExportScreen` (tela cheia, como o detalhe da galeria) substitui o modal; opções em `ManuscriptExportOptions` (presets, arco, formato, conteúdo, folha de rosto, diagramação, texto), condicionais por formato via `FORMAT_CAPABILITIES`; execução em `useManuscriptExport`.
- **Fase 3:** o publish reaproveita `ManuscriptExportOptions` sobre `SERVER_MANUSCRIPT_FORMATS`; a rota aceita `includeSceneNames/includeToc/resetSceneNumbers/style/arcId` (estilo validado pelo `ManuscriptStyleSchema`, arco validado contra a história). Os defaults do `ManuscriptOptionsSchema` passaram a ser os do export local (`includeLooseScenes`/`includeSceneNames` = false), e um export de arco sai com o título do arco também no servidor. `html` local incluído.
- **Fase 4:** `EXPO_PUBLIC_SERVERLESS=1` + `isServerless()` tiram do navigator servidores, amigos, publicar e `PackBrowse`, e escondem compartilhar pack, a seção de colaboração e o passo "servidores" do tour da seleção de histórias. `app.config.js` aplica `experiments.baseUrl` só quando `KERES_WEB_BASE_URL` é definido: `build` (desktop) segue na raiz, `build:pages` gera `dist-pages` sob o subpath; `pages.yml` copia para `apps/site/dist/client`.
- **Achado do spike (12):** o Pages não envia COOP/COEP e o web expo-sqlite exige `SharedArrayBuffer` — o boot travava em "Loading application...". Solução: `public/coi-sw.js` (service worker que reaplica os headers) registrado por `crossOriginIsolation.ts` antes do boot, só no build serverless; a primeira visita recarrega uma vez. Verificado num servidor estático sem headers sob `/Keres/client`: isolado, boot até a seleção de histórias, drawer sem itens de servidor, nenhum request fora da origem.

Gates manuais pendentes:

- Abrir o EPUB em dois leitores reais e o PDF no Adobe/Word (sem epubcheck no CI).
- Primeiro deploy do Pages: confirmar o isolamento via service worker no Safari (suporte a COOP/COEP injetado por worker é o ponto mais frágil) e no Firefox.

## Goal

- A API passa a compilar PDF (renderer puro-TypeScript) para publicar manuscritos no showcase, como qualquer outro formato.
- Unificar o pipeline PDF em puro-TS: o nativo migra do `expo-print` para o renderer compartilhado, e o `expo-print` é removido.
- Novo formato EPUB, disponível no export local e no publish.
- Profissionalizar o export (presets por destino, tipografia essencial, front matter gerado) dentro do que compensa agora.
- Recortar o restante da wishlist (avaliação anterior + notas pessoais) em "nesta proposta" vs. "futuro", com motivo.

## Success Criteria

- Publicar uma versão com manuscrito `pdf` compila no servidor e baixa no showcase; idem para `epub`.
- Export local de PDF usa o renderer puro-TS em todas as plataformas; `expo-print` removido das dependências e sem imports restantes.
- O EPUB abre sem erros em ao menos dois leitores reais (ex.: Apple Books/Calibre) com title page, navegação e links internos de escolhas funcionando.
- Export vira tela própria com presets (ebook, paperback, submission) e opções que aparecem/somem conforme o formato.
- Nenhuma migração de schema; docx/md/txt/html byte-estáveis para as mesmas entradas (PDF nativo muda de motor por decisão — novo baseline).
- `locales:audit`, typecheck e suites focadas verdes.

## Current state (grounding)

- `compileStoryManuscript` (shared) compila para `CompiledBlock[]` e despacha por formato, teto de 15 MB. Enum: `docx/md/txt/html`; PDF é client-only (`ManuscriptFormatSchema` dixit).
- PDF tem dois caminhos: nativo via `expo-print` sobre o HTML; web via renderer puro-TS (`manuscriptPdf.ts` + `manuscriptPdfLayout.ts`, Times/WinAnsi, A4, ToC com números reais de página).
- Modelo de documento: só parágrafos + 4 marcas inline (bold/italic/underline/strike). Sem listas, tabelas, notas, imagens, cores. O editor degrada o resto para parágrafo (`enrichedHtml.ts`).
- Export local: modal com formato + 4 switches + arco; já há precedente de opção condicional (`index` some para `txt`).
- Publish: client envia opções, servidor compila da própria cópia; showcase exibe `format.toUpperCase()` genericamente.
- JSZip já é dependência do shared e já roda no device (zip de histórias), com `generateAsync({ type: 'uint8array' })`.

## Viability evaluation

Legenda: INCLUIR (nesta proposta) · FUTURO (fora, com motivo).

- **PDF no servidor — INCLUIR (fase 1).** O renderer puro-TS não tem imports de plataforma e já é usado pelo client web; o servidor pode chamá-lo direto. Trabalho: literal `pdf` no enum + `FORMAT_META` + `renderBytes` + schema da rota + `SERVER_MANUSCRIPT_FORMATS`. Limites declarados: WinAnsi (sem CJK/emoji no corpo), Times/A4 fixos. Custo P.
- **Unificar o PDF nativo (trocar expo-print pelo puro-TS) + remover expo-print — INCLUIR (fase 1).** Pipeline único: `manuscriptExport.ts` chama `buildManuscriptPdf` em toda plataforma; remove dep do `package.json`, import, mock no teste e comentários obsoletos ("PDF stays client-only"). O PDF nativo muda de motor por decisão. Custo P.
- **EPUB — INCLUIR (fase 1).** Renderer novo (~porte do DOCX) + a mesma fiação mecânica do item acima + UTI iOS + 1 chave de tradução. Reusa escape/spans/links do renderer HTML e `manuscriptTocEntries()` para o nav. Regras críticas: `mimetype` como primeira entrada com conteúdo exato `application/epub+zip`, demais arquivos DEFLATE; JSZip suporta override de compressão por arquivo. Metadados exigem `identifier`/`author` novos nas opções (ver decisão). Sem capa/imagens na v1 (modelo não tem). Custo M.
- **Front/back matter persistido (dedicatória, epígrafe, sobre o autor) — FUTURO.** Exige campos novos em Story + sync + migrações + UI de edição. Caro e invasivo; não compensa antes dos formatos.
- **Title page + copyright gerados — INCLUIR (fase 2).** Automáticos a partir de título/autor/data (os metadados do EPUB já trazem autor): 1 XHTML no EPUB, blocos iniciais no PDF/DOCX. Custo P–M.
- **Numeração (romanos, por extenso, sem número) — INCLUIR (fase 2).** Transformação de apresentação pura no renderer; por extenso exige listas en+pt no shared (pequeno). Sem tocar modelo. Custo P–M.
- **Partes e override por capítulo — FUTURO.** Partes = nível novo de hierarquia (modelo + UI + ordenação + compiler). Override = campo novo com sync. Caro; o tipo `event` (sem número) já cobre prólogo/epílogo.
- **Separador de cena configurável (`#`, `***`, linha) — INCLUIR (fase 2).** Só texto entre cenas; trivial em todos os renderers. Custo P.
- **Tipografia via stylesheet/opções no EPUB/HTML/DOCX (fonte, corpo, entrelinha, recuo-vs-bloco) — INCLUIR (fase 2).** CSS no EPUB, parâmetros na lib `docx`. Custo M.
- **Mesmos knobs no PDF puro-TS — PARCIAL: só corpo/espaçamento/recuo (consts viram opções, reflow é automático).** Fonte ≠ Times exige nova tabela AFM ou embedding (projeto à parte); justificação/hifenização/viúvas-órfãs/capitulares no layouter manual são delicados e frágeis. PDF segue "layout fixo do Keres" fora esses três. Custo P para o incluído.
- **Geometria 6"x9" no PDF puro-TS — INCLUIR (fase 2).** `PAGE_WIDTH/HEIGHT/MARGIN` viram opções; ToC assume A4 hoje e precisa parametrizar junto. Custo P–M.
- **Fonte Unicode embarcada no PDF (fase 3) — FUTURO (primeira da fila, com listas).** WinAnsi é parede de spec (~218 latinos); CJK/árabe/emoji exigem fonte embarcada. Desenho: `pdf-lib` + `@pdf-lib/fontkit` (MIT, testada em React Native) com as bordas injetando bytes (`buildManuscriptPdf(..., { fontBytes })`) — shared segue TS puro. Plumbing precedented dos dois lados: TTF via Metro + `expo-asset` (cf. `useEdgeFont.web.ts`), URI→bytes via `expo-file-system`, servidor via `resourceRoot` + `cpSync` no packager (Docker herda de graça). Roboto não serve (sans, sem itálico, sem CJK): shippar família serifada OFL com 4 faces; subsetting obrigatório para CJK não inflar o PDF. **Restrição histórica (relato): tentativa anterior com lib de PDF quebrou o carregamento do app** — a integração precisa ser isolada do startup (módulo separado, import dinâmico só no momento do export), com smoke test de boot nativo no gate. Custo M–G.
- **Running heads, foliação romana/arábica, primeira-página-diferente — FUTURO.** Médios individualmente, mas somem com trim/bleed num projeto "print-ready" separado. EPUB torna isso menos urgente (reflowable não tem páginas).
- **Presets por destino (submission/Shunn, paperback, ebook) — INCLUIR (fase 2, mecanismo).** Preset = pacote de defaults sobre as opções existentes, com override manual. Barato como mecanismo; não cria capacidade nova, só empacota os knobs acima. Submission acende DOCX/PDF Times-12-duplo; paperback acende PDF 6x9; ebook acende EPUB.
- **Filtros por tag/status — pipeline JÁ SUPORTA (input é lista explícita); UI de seleção — FUTURO.** Nada a fazer no compiler.
- **Smart quotes, espaços duplos, placeholders (`<$autor>`, data) — INCLUIR (fase 2).** Funções puras + flags; placeholders com mapa do caller. Atenção: smart quotes por locale (pt «» vs “”). Custo P–M.
- **Notas de rodapé/fim, imagens com legenda, tabelas, epígrafes como blocos — FUTURO.** Nada disso mora no modelo atual; cada um exige sintaxe + modelo + serialização + editor + N renderers (imagem no PDF manual = embedding JPEG/PNG). Caro em cadeia.
- **Listas no modelo — FUTURO (primeira da fila quando o modelo crescer).** É a extensão mais barata (novo kind + `- `/`1.` + toolbar), mas a proposta atual já é grande; entra numa fase 3 com o editor.
- **Cor de fonte — FORA (não compensa).** Marca com valor (não booleana) muda o tipo `ManuscriptMark`, exige sintaxe proprietária de storage e tem utilidade marginal em manuscrito.
- **Export vira tela própria + opções condicionais por formato — INCLUIR (fase 2).** Pré-requisito UX de tudo acima; modal já tem scroll limitado. O compiler ignora o inaplicável (precedente: texto puro não lê `ManuscriptRenderOptions`). Custo M.

## Approach (key decisions)

1. **Pipeline PDF único em puro-TS em toda plataforma; `expo-print` removido.** Servidor, web e nativo chamam `buildManuscriptPdf`. Sem dependência nova; a remoção do `expo-print` (dep + import + mock + comentários) faz parte da fase 1.
2. **EPUB3 montado à mão sobre JSZip no shared** (zip: `mimetype` STORED primeiro, `container.xml`, OPF, nav, 1 XHTML por capítulo, CSS). Sem lib de EPUB: o conteúdo é XHTML simples e o controle do pacote evita dependência nova — o mesmo motivo pelo qual o parser é minimalista e dependency-free (risco de compat Hermes, ver `parseManuscriptMarkdown.ts`).
3. **Metadados via opções:** `identifier`/`author` opcionais em `ManuscriptOptionsInput`; default: autor = `Story.author` (editável na tela de export), identifier derivado do título quando o caller não enviar.
4. **Presets são defaults, não formatos:** `preset` resolve um `ManuscriptOptions`+estilo completo; usuário sobrescreve campo a campo.
5. **Zero migração de schema** nas fases 1–2. Tudo é opção de export ou saída gerada.
6. **Opções condicionais por formato (leitura confirmada):** opções exclusivas de certos formatos somem quando o formato selecionado é incompatível (ex.: corpo de fonte some para TXT/MD); o compiler ignora o inaplicável.

## Steps

Fase 1 — formatos no servidor e EPUB:

1. PDF no servidor: enum, `FORMAT_META`, `renderBytes`, schema da rota de publish, `SERVER_MANUSCRIPT_FORMATS`; teste de publish com `pdf` + contrato de bytes (`%PDF`).
2. Migrar o PDF nativo para `buildManuscriptPdf` e remover o `expo-print`: `manuscriptExport.ts` sem ramificação por plataforma, dep fora do `package.json`, mock fora de `manuscriptExport.test.ts`, comentários "PDF stays client-only" atualizados.
3. `manuscriptEpub.ts`: pacotes OPF/nav/XHTML/CSS, índice bookmark→arquivo para links entre capítulos, metadados; fiação idêntica à do PDF + UTI de EPUB no share sheet iOS + `export_manuscript_format_epub` en/pt.
4. Testes EPUB: estrutura do ZIP (mimetype primeiro/STORED, `container.xml`, manifesto⊇spine), XHTML bem-formado, nav = ToC, round-trip choice→alvo.
5. Atualizar os dois testes que fixam listas de formatos + help `manuscript` (formatos disponíveis).

Fase 2 — tela e profissionalização:

6. Nova tela de export (a partir do ManuscriptScreen) com seções por formato e condicionais; modal sai de cena; testes de tela.
7. Presets ebook/paperback/submission como defaults + overrides; opções: numeração, separador de cena, smart quotes, placeholders, recuo-vs-bloco, corpo/espaçamento, geometria 6x9 (PDF), title page/copyright gerados.
8. Auditoria de byte-estabilidade: mesmos inputs em docx/md/txt/html geram bytes idênticos (adicionar guardas aos testes de renderer); PDF nativo ganha novo baseline.

## Validation Plan

- `bun run locales:audit` (repo root) após cada chave nova.
- Shared: `bun run test -- --maxWorkers=2 test/manuscript` (vitest, limite de workers obrigatório).
- Client: `bun run test -- test/screens/narrative-elements/scenes test/components/manuscript` (script já embute `--maxWorkers=2`).
- API: publish round-trip com `pdf` e `epub` (teste de integração existente estendido) + download público servindo MIME/extensão certos.
- `grep -r expo-print apps/client` vazio (fora lockfile); `manuscriptExport.test.ts` sem mock de `Print`, cobrindo PDF puro-TS em nativo e web.
- Typecheck dos três pacotes + `typecheck:scripts`; biome nos arquivos tocados.
- Manual (maior risco, não automatizável aqui): abrir o EPUB em 2 leitores reais e o PDF (servidor e nativo, agora o mesmo motor) no Adobe/Word; sem epubcheck no CI, essa abertura manual é o gate de aceitação da fase 1.
- Compat: showcase antigo exibe `EPUB`/`PDF` genericamente; rollbacks = revert (sem migração).

## Verificação Showcase/manuscript (2026-09-26, sem código)

Leitura estática do fluxo publicar → compilar no servidor → oferecer download no showcase. Conclusão: **funciona de ponta a ponta** para `docx/md/txt/html`; os gaps abaixo viram tarefas na Fase 3.

Confirmado funcionando:

- Client envia só opções (`PublishManuscriptSection` + `usePublishManuscript` → `PublicationApiService.publish`); nenhum byte sai do device.
- Servidor valida (`ManuscriptRequestSchema`), compila da própria cópia (`StoryPublicationService.compileManuscript` sobre `compileStoryManuscript`), grava blob irmão `.manuscript.{ext}` no mesmo driver de media (S3 herda de graça) e registra `manuscriptFormat/manuscriptByteSize` na versão.
- Showcase exibe um botão por versão com manuscrito (`Manuscript (FORMATO · tamanho)`, newest + antigas) e baixa via `manuscript/download-url` → `manuscript/download`, com link simples no público e token de 60s no protegido; MIME, `slug-label-manuscript.ext` e `immutable` corretos.
- Cobertura existente: API (`publicManuscript.integration.test.ts`: metadados, download, 404s, round-trip com token) + admin (`showcasePages.test.tsx`: sem botão quando ausente, um botão por versão, download pelo botão, falha reportada; `showcaseApi.test.ts`: link com unlock token).
- `manuscriptPdf.ts` confirmado livre de imports de plataforma (só `manuscriptPdfLayout` + tipos): a premissa da fase 1 (servidor chamar o renderer direto) é válida.

Deltas publish vs. export local (viram tarefas):

- A rota de publish **não aceita `arcId`** (o schema compartilhado aceita; o modal local tem seletor de arco): publish com recorte de arco é impossível hoje.
- `compileStoryManuscript` **não expõe** `includeSceneNames/includeToc/resetSceneNumbers`: o showcase sempre sai com nomes de cena ON e sem índice, enquanto o export local defaulta tudo OFF — o documento do showcase tem shape diferente do export default local.
- Matriz assimétrica: local = `docx/pdf/md/txt` (sem `html`); servidor = `docx/md/txt/html` (sem `pdf`). PDF/EPUB no servidor já estão na fase 1; `html` local segue fora do plano.
- Labels no idioma do publisher, `routeId` obrigatório no branching (client defaulta a primeira rota) e 409 fora de sync: OK, sem tarefa.

## Steps (cont.)

Fase 3 — paridade publish/showcase (gaps da verificação acima):

9. Aceitar `arcId` no publish: `ManuscriptRequestSchema` (rota) + `usePublishManuscript.buildOptions`/`PublishManuscriptSection` (seletor reaproveitando o padrão do modal) + validação de pertencimento no `parseManuscriptOptions`; teste de publish com arco.
10. **Decidido (2026-09-27):** o publish oferece as mesmas opções do export local. A tela de export da fase 2 é uma tela modal cheia (como o detalhe da galeria), e o publish reaproveita as mesmas interfaces/seções de opções; o servidor passa a aceitar `includeSceneNames/includeToc/resetSceneNumbers` (e demais opções da fase 2) com os mesmos defaults do export local. Teste de publish cobrindo o shape.
11. **Decidido (2026-09-27): INCLUIR** `html` no export local (`MANUSCRIPT_EXPORT_FORMATS`); atualizar o help `manuscript` conforme a matriz final.

Fase 4 — client serverless/offline + GitHub Pages em `/Keres/client` (análise 2026-09-26, sem código):

Veredito: **viável, esforço P–M, sem tocar a sync engine.** Boot é local-first (`ColdInstall` local; `SyncInitializer` com zero servidores = no-op, story sem `serverId` → `deactivateStory`; `restoreHostedCookieSession` retorna null sem `meta[keres-hosted]`; inalcançável é caminho normal via `isOfflineError`, log silencioso). Precedente de hide pronto: `PublishStory` some por altura quando `!hasServers` (`StorySelectionStack` + `useHasRegisteredServer`).

12. Spike de base path (P): `experiments.baseUrl: "/Keres/client"` no `app.json` + `expo export -p web`, servir sob subpath e confirmar que `/_expo/*`, favicon, wasm (wa-sqlite, CanvasKit/Skia) e `expo-asset` resolvem. Hoje o `dist` usa paths absolutos e quebra em qualquer subpath. Fonte: seção GitHub Pages de <https://docs.expo.dev/guides/publishing-websites/>.
13. Flag serverless + gates de UI (M): ex. `EXPO_PUBLIC_SERVERLESS=1` (precedente: `EXPO_PUBLIC_SQLITE_WEB_SMOKE_TEST`) com helper central `isServerless()`; esconder `ServerManagementDrawer` e `FriendshipDrawer` (100% servidor), `PackBrowse` (manter `PackList` local; share já avisa `packs_share_no_server`), `SharePackModal`, linking de story a servidor (`StoryCollaborationSection`); guard em navegação direta; strings condicionais (`story.serverId`, `last_server_synced_log` somem sozinhas; `SyncConflictBanner` fica em 0). Testes: drawer sem itens de servidor + boot limpo sem chamadas de rede.
14. Workflow Pages compondo landing + client (P–M): `pages.yml` hoje publica só `apps/site/dist` com `VITE_BASE=/Keres/`; buildar também o client com baseUrl e copiar `apps/client/dist` → `apps/site/dist/client` num único artefato. `.nojekyll` já é emitido pelo plugin do site (cobre `_expo`); sem 404-fallback pro client (sem deep-link: `NavigationContainer` sem `linking`).
15. Verificar desktop (P): Electron serve `CLIENT_DIST` via `app://` (`apps/desktop/src/paths.ts`) — dist com baseUrl pode quebrar; provável necessidade de exports separados por alvo (raiz pro desktop, subpath pro Pages) ou ajuste no resolver. Não quebrar `desktop:package`/`capture:screens`.

## Fase 5 — bugs do manuscrito e leitor online (2026-09-28)

Ordem: os dois bugs primeiro, o leitor depois.

**Bug A — manuscrito de história branching (entendimento errado desde a fase 1).** Hoje um manuscrito branching é _uma rota_ (`compileRouteManuscript`: só os passos da rota, na ordem dela; o publish e a tela de export usam a primeira rota por padrão; sem rota, nada é enviado). O esperado é o livro-jogo clássico: **todas as cenas alcançáveis** nos formatos normais (pdf/epub/docx/md/txt/html), cada escolha apontando para a cena de destino ("vá para 23").

- **Decidido (2026-09-28):** a ordem das cenas é uma opção na tela de export/publish entre (B) busca a partir de `isStart`, numerada na ordem de aparição, e (C) numeração embaralhada (livro-jogo clássico, com semente para o resultado ser reproduzível). Cenas inalcançáveis ficam no livro, depois das alcançáveis (a detecção não é perfeita; melhor um falso positivo), sem apêndice; no filtro de arco, a escolha cujo destino saiu do arco permanece e termina com "fim deste trecho".
- **Feito (2026-09-28):** `compileGamebookManuscript` (shared) substitui `compileRouteManuscript`; a rota saiu do manuscrito (`routeId` some do `ManuscriptOptionsSchema`; a rota HTTP ainda o aceita e ignora, para clientes antigos). A alcançabilidade parte de **todas** as cenas `isStart`: histórias branching podem ter vários inícios e fins (só as lineares são limitadas a um — `SceneService.takeStartFinishSync`). Com mais de um início o livro abre numa página "Escolha por onde começar", com um "Começar — ver N" para cada um; sem nenhum `isStart`, começa na primeira cena por índice. Nomes de cena desligados = só números ("ver 12"; página N no PDF). Opção `sceneOrder` (`discovery` | `shuffled`, semente `shuffleSeed`, padrão = id do primeiro início) no export e no publish. Um início só fica sempre como cena 1, também no embaralhado; vários se espalham. Seletor de rota removido do publish e do export (a tela de leitura do manuscrito continua lendo uma rota).
- Não medido ainda: livro-jogo de uma história grande em PDF real e a ordem `shuffled` num leitor de EPUB (gate manual).
- Tirar o seletor de rota do export local e do publish (a rota deixa de ser entrada do manuscrito); revisar `compileStoryManuscript`, `useManuscriptExport`, `usePublishManuscript`, `ManuscriptOptionsSchema.routeId`, o help e os testes que fixam o comportamento atual.

**Bug B — PDF grande demais (medido em 2026-09-28).** Bytes por formato, mesma história linear:

| texto | txt | html | docx | epub | pdf |
|---|---|---|---|---|---|
| 4,5 K (8 cenas) | 4,8 K | 7 K | 10 K | 3 K | 55 K |
| 137 K (50 cenas) | 142 K | 150 K | 13 K | 5 K | 1,46 M |
| 1,3 M (300 cenas) | 1,36 M | 1,41 M | 28 K | 20 K | 13,8 M |

- docx/epub são zip (deflate; o texto repetitivo do teste comprime demais, mas o overhead fixo é ~9 K e ~2 K). html/md/txt ficam em ~1,05× o texto. O overhead fixo de estilos/cabeçalhos é pequeno em todos os formatos (pdf 1,2 K: fontes base-14 não embutidas).
- **O PDF é ~10× o texto.** Causa: `manuscriptPdf.ts` emite um `BT /F1 11 Tf 0.07 g 1 0 0 1 x y Tm (palavra) Tj ET` por _palavra_ (~60 bytes/palavra) e os content streams não têm `/Filter /FlateDecode`. Medido: streams de 36 K viram 3,4 K com deflate.
- Consequência: um romance de ~240 mil palavras em PDF já bate o teto de 15 MB (`MAX_MANUSCRIPT_BYTES`), embora o texto tenha 1,3 MB.
- **Feito (2026-09-28), parte 1:** cada linha vira um único objeto de texto (uma string por troca de fonte, com o espaço na fonte da palavra seguinte, o mesmo avanço que o layout contava). 300 cenas × 800 palavras: 13,8 M → 2,3 M; 50 × 500: 1,46 M → 250 K. Baseline do PDF no snapshot atualizado; testes de contrato de tamanho e de troca de fonte adicionados. Restam ~1,7× o texto.
- **Feito (2026-09-29), parte 3 - memória:** o layout guardava todas as linhas do livro (~20× o texto vivo; um PDF de 43 MB chegava a 4,2 GB de pico de RSS). Agora `iterateRuns` entrega as linhas por bloco e `paginateStream` entrega cada página assim que enche: cada página vira bytes na hora e as linhas que a formaram são descartadas; só ficam os bytes das páginas prontas (~ o tamanho do arquivo), as âncoras e o índice. Mesmo PDF de 43 MB: **454 MB de pico (era 4,2 GB) e 4,7 s (era 7,0 s)**; 12,9 MB: 322 MB (era 1,4 GB). Saída **idêntica byte a byte** à versão anterior em 72 livros (linear e livro-jogo, com e sem índice, escolhas, 6x9, bloco, corpo/entrelinha), comparada antes de apagar o código antigo; o hash do snapshot e os testes de PDF seguem iguais. No servidor, `createExclusiveGate` serializa as compilações de manuscrito e leitor (um livro por vez), para publishes simultâneos não multiplicarem a memória.
- **Opcional, parte 2:** comprimir os streams (ver abaixo) ainda cortaria cerca de metade; `pako` já está no lockfile via jszip, mas seria dependência direta nova e os testes leriam o conteúdo inflado. Só se o tamanho voltar a incomodar.
- Proposta original: comprimir os streams (dependência pura-JS pequena, ex. `fflate`, ou o deflate que o JSZip já traz; validar Hermes e o boot nativo) e, opcionalmente, agrupar as palavras de uma linha num só `BT` com `TJ`. Depois reavaliar o teto: com o PDF comprimido, 15 MB fica ~10× mais folgado.
- Teste: contrato de tamanho (PDF de N cenas ≤ k × texto) e abertura em leitor real.

**Leitor online no showcase** (só depois dos bugs; decisões de 2026-09-28):

- Opção no publish "publicar a leitura em showcase", independente do anexo de manuscrito e com as mesmas opções (sem rota); o servidor compila um HTML autocontido da própria cópia; o showcase ganha "Ler online" por versão.
- Linear: página estática (base `manuscriptHtml`). Branching: mini motor JS embutido — uma cena por vez sobre o motor de `storySimulation` (visitas, inventário, gatilhos; efeitos da escolha e da cena), grafo inteiro a partir de `isStart`, sem rota; teste de paridade com o motor compartilhado.
- Escolhas indisponíveis aparecem desabilitadas, sem o motivo; só o inventário é visível, gatilhos ficam internos.
- Segurança: servido com CSP (`default-src 'none'`, script/estilo inline) dentro de `<iframe sandbox="allow-scripts">` sem `allow-same-origin`; o texto já é escapado.
- Progresso e lista de saves (slot automático + manuais com nome, data, cena, passos; carregar/apagar/recomeçar): o iframe não tem `localStorage`, então pede/grava no showcase (página pai) por `postMessage` com formato fixo; chave por história + versão publicada. "Ler online" abre uma rota do showcase (`/showcase/story/:id/read/:versão`: dentro do router o caminho é `/story/:id/read/:versão`, e o `basename="/showcase"` de produção, mais o fallback `/showcase/*` da API, cuidam do prefixo; todo link do showcase é `<Link>`, nunca caminho solto); não há leitura avulsa fora do showcase.
- Teto de tamanho: o mesmo `MAX_MANUSCRIPT_BYTES`, agora 50 MB (o PDF encolheu ~6× e o teto subiu de 15 para 50 MB por decisão de 2026-09-29; a memória do PDF está tratada em "Bug B, parte 3" abaixo).
- Migração na API (`readerByteSize` na versão publicada).

**Feito (2026-09-29):**

- `shared/manuscript/reader`: `readerEngine.ts` (regras de leitura como string JS embutida; teste de paridade contra `storySimulation` com execuções aleatórias sementeadas), `readerApp.ts` (ponte, painéis, leitor ramificado e linear), `storyReader.ts` (`compileStoryReader`, `ReaderOptionsSchema`, rótulos da interface). Parte dos mesmos blocos do manuscrito (`presentedManuscriptOf`), então arco, nomes, tipografia, aspas e placeholders valem igual. Testado em DOM real (jsdom): fluxo de escolhas, itens, voltar, recomeçar, vários inícios, XSS, saves pela ponte.
- API: coluna `reader_byte_size` (migrações PG `0048` e SQLite `0035`), `reader` no corpo do publish (independente do manuscrito), blob `.reader.html` (poda, delete e unpublish junto da versão), `GET .../reader` com CSP `sandbox allow-scripts` + `default-src 'none'` (cache `private, no-store` em história protegida), `POST .../reader/url` (token de 60 s), `reader` nas versões públicas.
- Client: chave "Publicar a leitura online" ao lado do manuscrito (as opções são as mesmas; o formato só é perguntado quando há arquivo), `PublishReaderOptions`, textos da interface do leitor em en/pt.
- Showcase: botão "Ler online" por versão, rota `/showcase/story/:id/read/:versão` (prefixo travado por teste com `basename`) com o leitor num iframe `sandbox="allow-scripts"`, portão de senha reaproveitado, saves em `localStorage` por história + versão só depois de sanitizados (`readerBridge.ts`).
- Ressalvas conhecidas: os nomes dos gatilhos viajam no JSON da página (invisíveis na interface, mas não secretos para quem lê o fonte); o leitor não roda fora do showcase.
- Verificado num navegador real (Chromium do painel do app, 2026-09-29): o fluxo ramificado (escolha fechada até pegar a chave, item no inventário, gatilho bloqueando uma saída, trilha, voltar), o header `sandbox` (o `localStorage` da página dá `SecurityError`), a ponte num frame sandbox (`auto`, `manual` e `prefs` chegam ao pai; recarregar oferece "Continuar" e reproduz o inventário) e o leitor linear (índice, tema sépia, tamanho do texto). Limite do painel: nele, scripts de um iframe sandbox carregado por `src` não executam (o mesmo iframe por `srcdoc` sim), então a ponte foi provada com `srcdoc`; o gate manual restante é o showcase real em Chrome/Firefox/Safari.

## Risks / Open Questions

- Riscos: WinAnsi sem CJK/emoji no corpo do PDF puro-TS (declarar no help); PDF nativo muda de motor — bytes diferentes do expo-print por decisão (declarar no help/release notes); smart quotes divergem por locale; futura lib de PDF precisa provar boot intacto (histórico: tentativa anterior quebrou o carregamento do app).
- Riscos (fase 4): `experiments.baseUrl` é experimental e acopla o `dist` ao alvo (desktop × Pages); wasm do SQLite/Skia sob subpath precisa do spike 12 para confirmar; storage web (wa-sqlite + IndexedDB) é por origem — "instalação limpa" vale por perfil de navegador.
- Open questions: none no escopo original. (Q1 resolvida: autor vem de `Story.author`, editável. Q2 confirmada: opções condicionais por formato.)
- Open questions (fases 3–4), resolvidas em 2026-09-27: (a) `arcId` no publish entra com a paridade de opções (fase 3, reaproveitando a tela da fase 2); (b) serverless = flag de build `EXPO_PUBLIC_SERVERLESS=1` no mesmo `app.json`, com `isServerless()` central; (c) desktop e Pages com exports separados por alvo — aceito.

## Sources

- https://www.w3.org/TR/epub-33/
- https://stuk.github.io/jszip/documentation/api_jszip/file_data.html
- https://github.com/Hopding/pdf-lib
- https://docs.expo.dev/guides/publishing-websites/ (GitHub Pages: `experiments.baseUrl`, fase 4)
