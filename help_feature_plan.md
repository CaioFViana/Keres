# Plano de implementação — Drawer "Ajuda" (Help)

> Documento de planejamento. Nada aqui foi implementado ainda. Alvo: `apps/client`, drawer novo
> em `apps/client/src/navigation/StorySelectionStack.tsx`, mais um corpo de conteúdo de ajuda
> versionado no repositório.
>
> **Público-alvo do conteúdo: o usuário final — um escritor, não um desenvolvedor.** Nomes de
> arquivo, de tabela, de campo do banco e de componente aparecem *neste plano* apenas para
> localizar o que precisa ser explicado; **nenhum deles aparece no texto da ajuda**.

## 1. Objetivo

Adicionar um drawer **Ajuda** no menu principal que dá acesso a um catálogo de páginas cobrindo
tudo que o usuário vê e faz no Keres:

- cada **tela** que o usuário alcança (menu principal e menu da história — a tela de instalação
  inicial não precisa, é só a porta de entrada);
- cada **campo que o usuário preenche ou lê na tela**, explicado em linguagem comum: o que
  escrever ali, quando faz sentido preencher, e o que muda em outros lugares por causa dele;
- cada **recurso transversal**: etiquetas, notas, galeria, atributos customizados, sugestões,
  favoritos, busca, **comentários** e **veja também**;
- **servidores, conta, amizades, colaboração e limites de conta**;
- **sincronização** entre dispositivos, histórico de atividade e o que fazer quando aparece um
  conflito;
- **histórias ramificadas**: escolhas, condições, efeitos e o estado do leitor.

**Critério de qualidade:** alguém que nunca leu o código — e que não sabe o que é um "ULID", uma
"FK polimórfica" ou um "tombstone" — deve conseguir responder, depois de ler a página: *o que é
isso, para que serve, como eu faço, e o que isso afeta*.

## 2. Princípios editoriais

Estas regras valem para todo o conteúdo e são o que separa este plano da primeira versão dele.

1. **Vocabulário da interface, não do código.** A página fala em "Etiquetas", "Atributos
   Customizados", "Ordem", "Anotações extras" — exatamente os rótulos que aparecem na tela, no
   idioma do usuário. Nunca `TagRelation`, `StorySchemaField`, `index`, `extraNotes`.
2. **Nada de mecânica interna.** Não entram: ULID, hash de mídia, `version`, `isDeleted`/
   `deletedAt`, tabelas de junção, "polimórfico", Drizzle, SQLite, JWT, Zod, nomes de rota. O
   usuário não vê esses campos e não pode agir sobre eles.
3. **Toda página responde quatro perguntas, nesta ordem:** *O que é* → *Para que serve (com um
   exemplo narrativo concreto)* → *Como fazer (passo a passo, pelo caminho real da interface)* →
   *O que isso afeta em outros lugares*.
4. **Página é por tarefa, não por tabela.** "Trajetória de itens" é uma página; "AttributeValue"
   não é uma página. Entidades que o usuário nunca enxerga como uma coisa separada (valores de
   atributo, relações de etiqueta/nota/galeria, favoritos como registro, permissões) são
   explicadas *dentro* da página do recurso que as usa.
5. **Exemplo antes de definição** sempre que a definição sozinha for abstrata. `Duração` e
   `Intervalo` de uma cena, por exemplo, só ficam claros com uma linha do tempo de exemplo.
6. **Só o que é acionável.** Se o usuário não pode ver nem mudar aquilo, não vai para a ajuda —
   vai para `docs/`, que é onde a documentação técnica já vive.
7. **Sem promessa de comportamento não verificado.** Todo texto é escrito lendo a tela e o
   serviço que a alimenta; onde o comportamento for condicional (ex.: converter história
   ramificada em linear), a condição é dita explicitamente.

### 2.1 Como os campos são explicados

A tabela de campos de cada página tem três colunas visíveis:

| Campo (rótulo da tela) | O que escrever aqui | Observação |
| --- | --- | --- |
| Título | O nome pelo qual você reconhece a história. Único campo obrigatório. | Aparece na lista de histórias e nas buscas. |
| Autor | Quem assina a história. Texto livre. | Independente da sua conta — use para creditar o autor original de uma adaptação. |

Sem coluna de "tipo" nem de "obrigatório/opcional" como jargão: obrigatoriedade entra em prosa na
própria descrição, porque é assim que a tela comunica (asterisco/validação).

**Campos que nunca entram na ajuda:** identificadores internos, vínculo com a história, marcas de
exclusão, contadores de sincronização e o campo de versão. **Campos de sistema que entram, porque
o usuário os vê:** data de criação e data da última alteração (aparecem em telas de detalhe e no
histórico de atividade) — explicados uma vez, em `activity-log`, e referenciados por link.

## 3. Decisões de arquitetura (e por quê)

### 3.1 Onde o drawer vive

O drawer entra em `StorySelectionStack` (menu principal, fora de uma história), pelo mesmo
raciocínio já documentado em comentário no arquivo para `ImportExport`/`ExampleStories`: ajuda
não depende de história aberta e precisa ser alcançável antes de existir qualquer história.

**Também no `MainSystemStack`** (menu da história), como último item — porque metade do catálogo
descreve telas que só existem lá dentro, e mandar o usuário sair da história para ler sobre a
história é atrito desnecessário. Ambos apontam para o mesmo navegador de ajuda. Isso sobe da
"fase 2 opcional" da versão anterior para o escopo mínimo.

### 3.2 Conteúdo: blocos estruturados, não Markdown

O cliente não tem renderizador de Markdown nas dependências (`apps/client/package.json`), e
adicionar um traz peso e risco de incompatibilidade com React Native Web/Expo 54 sem ganho:
precisamos de *links internos entre páginas* e de *tabelas de campos*, que Markdown resolveria
mal em RN.

Decisão: conteúdo como **árvore de blocos tipada** em TypeScript (`HelpBlock[]`), renderizada por
um componente próprio. Links entre páginas viram dados validáveis em teste, a tabela de campos
fica visualmente consistente em todas as páginas, e link quebrado vira erro de typecheck.

### 3.3 Conteúdo fora do `locales/*.json`

`src/locales/en.json` e `pt.json` já têm ~64 KB / ~69 KB de chaves de UI e são auditados por
`scripts/verify-translations.ts`. Despejar dezenas de páginas de prosa ali polui a auditoria e o
diff de toda mudança de UI.

Decisão: conteúdo em `src/help/content/<pageId>/<lang>.ts`, com um **registry gerado** por
script, exatamente o padrão já usado por `src/exampleStories/`. Só os rótulos de navegação
(título do drawer, busca, "não encontrado") ficam nos locales.

Idiomas na v1: **pt** e **en**. O idioma segue o escolhido em Configurações; o fallback para `en`
existe só para não quebrar a tela caso uma tradução falte.

## 4. Estrutura de arquivos

```
apps/client/
├── scripts/
│   └── generate-help-index.js            # varre help/content, escreve generated/registry.ts
└── src/
    ├── help/
    │   ├── types.ts                      # HelpBlock, HelpPage, HelpSection, HelpPageId
    │   ├── catalog.ts                    # seções + ordem + ícones + pageIds (fonte da ordem)
    │   ├── fieldSources.ts               # §8: quais campos de tela cada página deve cobrir
    │   ├── content/
    │   │   ├── what-is-keres/{pt,en}.ts
    │   │   ├── characters/{pt,en}.ts
    │   │   └── ...                       # uma pasta por página (§5)
    │   └── generated/
    │       └── registry.ts               # auto-gerado, não editar
    ├── components/features/help/
    │   ├── HelpBlockRenderer/
    │   ├── HelpFieldTable/
    │   └── HelpSearchBar/
    ├── screens/help/
    │   ├── HelpIndexScreen.tsx
    │   └── HelpPageScreen.tsx
    └── navigation/                       # + HelpDrawer nos dois stacks
```

## 5. Modelo de dados do conteúdo

```ts
// src/help/types.ts
export type HelpPageId = GeneratedHelpPageId; // union literal gerado — ver §7.1

export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'steps'; items: string[] }                    // "como fazer", numerado
  | { type: 'path'; segments: string[] }                  // "Menu › Amigos › Detalhe do amigo"
  | { type: 'callout'; tone: 'info' | 'warning'; text: string }
  | { type: 'example'; title?: string; text: string }     // exemplo narrativo concreto
  | { type: 'fields'; rows: HelpFieldRow[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'faq'; items: { question: string; answer: string }[] }
  | { type: 'seeAlso'; pages: HelpPageId[] };

export interface HelpFieldRow {
  /** Chave técnica — NUNCA renderizada. Existe só para o teste de cobertura (§8). */
  key: string;
  /** Rótulo exatamente como aparece na tela, já no idioma da página. */
  label: string;
  /** O que escrever ali, em linguagem comum. Obrigatoriedade entra aqui, em prosa. */
  whatToWrite: string;
  /** Efeito em outras telas, quando houver. */
  note?: string;
}

export interface HelpPage {
  id: HelpPageId;
  title: string;      // linguagem natural: "Personagens", não "entity-character"
  summary: string;    // 1 linha, usada no índice e na busca
  keywords: string[]; // como o usuário procuraria: "ficha", "protagonista", "elenco"
  blocks: HelpBlock[];
}
```

Regras aplicadas por teste (§8):

- toda página com tabela de campos cobre 100% dos campos **visíveis na tela** correspondente;
- todo `seeAlso` aponta para uma página existente;
- toda página do catálogo existe em **pt** e **en**;
- nenhum texto de conteúdo contém termos da lista negra de jargão (§8, terceiro teste).

## 6. Catálogo de páginas

Ordem e agrupamento abaixo é a fonte de verdade para `catalog.ts`. O `pageId` é interno; o que o
usuário lê é o **Título**.

### 1. Comece por aqui (`start`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `what-is-keres` | O que é o Keres | Para quem serve, funciona sem internet, o que ele **não** é (não é um editor de texto: ele organiza o universo, você escreve o texto onde quiser). |
| `first-story` | Criando sua primeira história | Do nome de usuário local até uma história aberta, em passos. Sugere começar por uma história de exemplo. |
| `how-keres-organizes` | Como o Keres organiza uma história | Mapa mental: história → capítulos → cenas; personagens, locais e itens que atravessam as cenas; etiquetas, notas, comentários e "veja também" como camadas de anotação por cima de tudo. É a página que dá sentido ao resto. |
| `getting-around` | Navegando pelo app | Os dois menus (o do app e o da história), como voltar, drawer redimensionável, diferença entre tela larga e celular. |
| `lists-and-search` | Listas, busca e filtros | Toda lista funciona igual: buscar, filtrar por etiqueta, ordenar, ver só favoritos, e a Busca Avançada campo a campo. Inclui a Busca Global da história. |
| `using-this-help` | Como usar esta ajuda | Índice, busca da ajuda, "veja também", e o que fazer se não achou. |

### 2. Suas histórias (`stories`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `story-list` | A lista de histórias | Cartões de resumo, a qual servidor cada história está ligada (ou nenhum), abrir, favoritar, excluir. |
| `create-story` | Criando e editando uma história | Todos os campos do formulário: Título, Tipo, Descrição, Gênero, Idioma, Autor, Tema, Anotações extras, Favorita. |
| `story-type` | Linear ou ramificada? | O que muda na prática (o menu Escolhas só existe em ramificada), como escolher, **como converter depois** e o que impede a conversão de ramificada para linear — a tela lista os capítulos incompatíveis antes de perguntar qualquer coisa. |
| `story-settings` | Configurações da história | O que só existe aqui e não no formulário de criação, e por quê: converter o tipo, colaboradores, enviar para um servidor, comentários de leitores, normalizar tempo das cenas, comportamento dos favoritos. |
| `story-dashboard` | O painel da história | Os cartões de resumo, o que cada número conta, atalhos. |
| `story-analysis` | Análise da história | Cada aviso que a análise pode mostrar (cena órfã, escolha quebrada, etc.), o que significa e como corrigir. Uma entrada por diagnóstico. |
| `import-export` | Importar e exportar | Exportar como backup, importar cria uma história nova, o que vai junto (e o que não vai), arquivos de versões antigas. |
| `example-stories` | Histórias de exemplo | Catálogo, escolher idioma, instalar gera uma cópia sua e independente. |

### 3. Os elementos da história (`elements`)

Uma página por elemento, cada uma com: o que é, exemplo, **tabela de campos da tela**, como se
relaciona com os outros elementos, e o que acontece ao excluir.

| pageId | Título |
| --- | --- |
| `characters` | Personagens |
| `character-relationships` | Relações entre personagens (inclui o grafo de relações) |
| `chapters` | Capítulos |
| `scenes` | Cenas (inclui quem participa da cena) |
| `scene-timing` | Tempo e ritmo das cenas — Intervalo, Duração e "normalizar tempo" com exemplo de linha do tempo |
| `locations` | Locais |
| `location-map` | Mapa de locais — "contém" (hierárquico) vs. "conectado a" (caminho entre dois) |
| `items` | Itens |
| `item-journeys` | Trajetória de um item — onde ele mudou de estado ou de dono, cena a cena |
| `world-rules` | Regras do mundo |
| `notes` | Notas — soltas ou ancoradas a um elemento |
| `tags` | Etiquetas |
| `gallery` | Galeria — importar imagem/áudio/vídeo, reaproveitar a mesma mídia em vários elementos |
| `favorites` | Favoritos — como marcar e o que muda numa história compartilhada |

Pontos que exigem redação cuidadosa (hoje não são óbvios na tela):

- **Personagem:** a diferença entre *Biografia* (o que já aconteceu) e *Linha do tempo planejada*
  (o que você pretende que aconteça); *Qualidades* vs. *Fraquezas* vs. *Personalidade*.
- **Capítulo:** *Ordem* é ordem de leitura, não cronologia do mundo — embora você possa usá-la
  como cronologia se a história for contada em ordem.
- **Cena:** *Cena inicial* e *Cena final*, e o efeito disso no mapa e na análise; Local
  obrigatório; *Intervalo* (tempo desde a cena anterior) vs. *Duração* (tempo que a cena dura),
  cada um com sua unidade — de horas a eras.
- **Item / Trajetória:** *Estado inicial* vs. o estado registrado em cada parada da trajetória;
  dono atual vs. mudança de dono numa cena.
- **Galeria:** a mesma mídia importada uma vez pode ilustrar vários elementos; excluir o vínculo
  não é o mesmo que excluir a mídia.
- **Favoritos:** o que *global*, *individual* e *individual público* significam quando mais de uma
  pessoa trabalha na história.

### 4. Histórias ramificadas (`branching`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `branching-basics` | Como funcionam as histórias ramificadas | Leitor escolhe, a história desvia; o que passa a existir no app. |
| `choices` | Escolhas | Cena de origem → texto da escolha → cena de destino; notas da escolha. |
| `story-map` | O mapa da história | Ler o grafo, achar becos sem saída e trechos inalcançáveis. |
| `choice-conditions` | Condições para uma escolha aparecer | Grupos de condição, "todas" (E) vs. "qualquer uma" (OU), condição que **bloqueia** vs. condição que **habilita**, e os três tipos: visitas a uma cena, ter/não ter um item, marcador ligado/desligado. |
| `effects` | Efeitos de uma cena ou escolha | Dar item, tirar item, ligar marcador, desligar marcador — editados dentro da própria cena/escolha. Enfatizar que é principalmente para a análise de história, mas também usada como anotações para o mesmo. |
| `story-state` | Inventário e marcadores | O "estado do leitor": o que ele carrega e o que já aconteceu; como efeitos escrevem esse estado e condições o leem. Página que amarra as duas anteriores. |

### 5. Anotar e conectar (`annotate`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `comments` | Comentários | Comentar um campo específico de um elemento, o trecho citado, os cinco níveis de criticidade e o que cada um sugere, ver todos os comentários da história num lugar só, comentários de leitores em história compartilhada. |
| `see-also` | Veja também | Vínculo livre e mútuo entre dois elementos quaisquer; quando usar isto em vez de etiqueta ou nota. |
| `custom-attributes` | Atributos customizados | Criar campos próprios por tipo de elemento; os tipos disponíveis (texto, texto longo, número, sim/não, data, sugestão); obrigatório, valor padrão e ordem; onde o campo passa a aparecer (formulário, detalhe, busca avançada, busca global); o nome do campo é editável, a identificação dele não. |
| `suggestions` | Listas de sugestões | Campos que sugerem valores já usados na história (gênero do personagem, raça, tipo de relação...); como a lista cresce; como editar a lista. |

### 6. Preferências (`preferences`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `app-settings` | Configurações do aplicativo | Tema claro/escuro, idioma, nome de usuário local vs nome de servidor. — e a diferença entre o tema do app e o *Tema* (assunto) de uma história. |

### 7. Conta, servidores e amigos (`accounts`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `what-is-a-server` | O que é um servidor Keres | Para que serve (sincronizar entre aparelhos e escrever junto), história local vs. ligada a servidor, você pode simplesmente não usar servidor nenhum. |
| `add-server` | Cadastrando um servidor | Endereço do servidor (o endereço da API, sem sufixos), criar conta, entrar, vários servidores ao mesmo tempo. |
| `your-profile` | Seu perfil | Nome de exibição, sua `@tag` (é por ela que amigos te encontram), cor e ícone do avatar, bio. |
| `change-password` | Trocando a senha | Passo a passo e o que acontece nos outros aparelhos. |
| `friends` | Amigos | Enviar, aceitar, recusar e desfazer; o que o outro lado vê; por que amizade é pré-requisito para colaborar. |
| `collaborators` | Escrevendo junto | Dono, escritor e leitor: o que cada papel pode fazer; adicionar/remover colaborador; liberar comentários de leitores. |
| `account-limits` | Limites da conta | O servidor pode limitar número de histórias, de elementos e espaço de mídia; o que você vê ao atingir o limite; por que um cadastro pode ser recusado. |

### 8. Sincronização (`sync`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `sync-basics` | Como a sincronização funciona | Trabalhar offline e sincronizar depois; o que é enviado; enviar uma história local para um servidor; mídias vão junto (e ocupam espaço da sua conta). |
| `sync-conflicts` | Quando aparece um conflito | O que é um conflito, a janela de resolução campo a campo, manter o meu/manter o do servidor, aceitar exclusão, adiar — e o que cada botão faz de fato. |
| `activity-log` | Histórico de atividade | O que gera registro, como ler a lista e o detalhe, o que "criado em" e "atualizado em" significam, por que o histórico de uma história offline não guarda tudo. |

### 9. Ajuda e soluções (`support`)

| pageId | Título | Conteúdo |
| --- | --- | --- |
| `troubleshooting` | Resolvendo problemas | Não conecta no servidor, sessão expirada, importação recusada, mídia que não abre, história sumida da lista. Formato: sintoma → causa provável → o que fazer. |
| `data-and-backup` | Seus dados e backup | Onde os dados ficam, o que sai do aparelho e o que não sai, backup por exportação, o que acontece ao desinstalar. |
| `glossary` | Glossário | Só os termos que aparecem **na interface** (cena, capítulo, escolha, marcador, etiqueta, colaborador, sincronizar...), cada um com link para a página completa. |
| `faq` | Perguntas frequentes | Bloco `faq`, cada resposta curta com link para a página detalhada. |

**Total: 53 páginas** (contra 78 na versão anterior — as 25 removidas eram páginas de tabela
interna, relação de junção e mecânica de sincronização que o usuário nunca vê; o conteúdo útil
delas foi absorvido pelas páginas de recurso).

## 7. Implementação

### 7.1 Registry gerado

`scripts/generate-help-index.js`, espelho de `generate-example-stories-index.js`:

- varre `src/help/content/<pageId>/<lang>.ts`;
- escreve `src/help/generated/registry.ts` com um `import` estático por arquivo e um mapa
  `Record<HelpPageId, Record<string, HelpPage>>`;
- exporta `export type GeneratedHelpPageId = 'what-is-keres' | ...`, tornando link quebrado um
  erro de typecheck;
- entra no `prestart` e no `export:web` do `apps/client/package.json`, junto dos outros dois
  geradores; script avulso `help:generate`.

### 7.2 Navegação

Em `StorySelectionStack.tsx` **e** `MainSystemStack.tsx`:

```ts
export type HelpStackParamList = {
  HelpIndex: undefined;
  HelpPage: { pageId: string };
};
```

- `HelpStackNavigator` no formato de `FriendshipStackNavigator` (`headerShown: false`, header do
  drawer), extraído para um módulo compartilhado já que os dois stacks o usam;
- `<Drawer.Screen name="HelpDrawer" ...>` com `listeners.drawerItemPress` resetando para
  `HelpIndex`, como os demais drawers;
- posição: último item, depois de Configurações (no menu principal) e depois de Seleção de
  Histórias (no menu da história);
- `title`/`drawerLabel`: `t('help_title')`.

### 7.3 `HelpIndexScreen`

- Seções na ordem do §6, com o `summary` de cada página e ícone por seção; a seção "Comece por
  aqui" aberta, as demais recolhidas.
- **Barra de busca fixa no topo** (§7.3.1).
- `setDocumentTitle` no foco, como as demais telas.

#### 7.3.1 Busca da ajuda (`HelpSearchBar`)

Decidido: a ajuda **não** entra na Busca Global (que é escopada por uma história e misturaria
documentação com conteúdo narrativo). Em vez disso, a própria tela de ajuda tem busca própria —
é o caminho principal para quem chega com uma dúvida específica em vez de querer navegar o
índice.

- **Escopo:** título, resumo, palavras-chave e o texto renderizável de todos os blocos da página
  (parágrafos, listas, passos, exemplos, células das tabelas de campos, perguntas e respostas do
  bloco `faq`). Só o idioma ativo.
- **Índice em memória:** montado uma vez, na primeira renderização, a partir do registry — um
  registro por página com o texto já achatado e **normalizado** (minúsculas e sem acentos), para
  que "historia" ache "história". Não há I/O nem consulta ao banco: o conteúdo já está no bundle.
- **Comportamento:** debounce igual ao das listas de entidade; enquanto houver texto, a lista
  agrupada por seção dá lugar a uma **lista plana de resultados**; limpar o campo (botão ✕ ou
  campo vazio) volta ao índice, com as seções no estado em que estavam.
- **Resultado:** título da página, etiqueta da seção a que ela pertence e um trecho do texto que
  casou, com o termo em destaque. Tocar abre a página.
- **Ordenação:** casou no título > nas palavras-chave > no resumo > no corpo; empate resolvido
  pela ordem do catálogo, para o resultado ser estável.
- **Sem resultado:** mensagem com atalho para a página "Como usar esta ajuda" e para "Perguntas
  frequentes", em vez de uma tela vazia sem saída.
- Nada é persistido: a busca não guarda histórico nem sobrevive a sair da tela.

### 7.4 `HelpPageScreen`

- Recebe `pageId`, resolve o idioma ativo com fallback `en`.
- `HelpBlockRenderer` mapeia bloco → componente, usando `useTheme()`.
- `seeAlso` navega com `navigation.push`, permitindo voltar página a página.
- Estado de erro explícito para `pageId` desconhecido.

### 7.5 i18n

Chaves novas (só chrome de navegação): `help_title`, `help_index_title`,
`help_search_placeholder`, `help_search_clear`, `help_search_results_count`, `help_no_results`,
`help_no_results_hint`, `help_page_not_found`, `help_language_fallback_notice`,
`help_section_*` (9), `help_field_column_*` (3).
Rodar `bun run locales:audit` ao final.

## 8. Testes

- **Integridade do catálogo** (`src/help/__tests__/catalog.test.ts`): toda página do catálogo
  existe em `pt` e `en`; nenhuma pasta órfã em `content/`; todo `seeAlso` resolve; nenhum
  título/resumo vazio.
- **Cobertura de campos** (`src/help/__tests__/fieldCoverage.test.ts`) — mudou de fonte em relação
  à versão anterior. A referência **não** são as interfaces de `packages/shared/entities/` (que
  incluem campos invisíveis ao usuário), e sim `src/help/fieldSources.ts`, que declara, por
  página, quais campos de tela devem estar documentados. Esse arquivo é montado a partir de
  `entityFieldMetadata` (que já carrega os rótulos de UI e é o que alimenta a Busca Avançada),
  mais uma lista explícita de campos visíveis que faltam nele (ex.: cena inicial/final, ordem,
  intervalo e duração da cena). O teste falha nomeando o campo faltante.
  - Um segundo teste garante que **toda propriedade** de cada entidade em
    `packages/shared/entities/` esteja classificada em `fieldSources.ts` como *documentada* ou
    *invisível ao usuário*. Assim, um campo novo no modelo obriga uma decisão consciente em vez
    de sumir silenciosamente — sem forçar a documentar o que o usuário não vê.
- **Jargão** (`src/help/__tests__/plainLanguage.test.ts`): varre o texto renderizável de todas as
  páginas e falha se encontrar termos da lista negra (`ULID`, `tombstone`, `polimórfic`, `FK`,
  `SQLite`, `Drizzle`, `JWT`, `endpoint`, `payload`, `schema` fora de "Atributos Customizados",
  nomes de arquivo `.tsx`/`.ts`, `isDeleted`, `deletedAt`, `storyId`, ...). É a defesa automática
  do princípio nº 2 do §2.
- **Busca da ajuda** (`src/help/__tests__/helpSearch.test.ts`): a função de busca é pura e testada
  fora da tela — casa sem acento e sem diferenciar maiúsculas, encontra por palavra-chave e por
  texto de bloco, respeita a ordenação do §7.3.1 e devolve vazio para termo inexistente.
- **Telas** (RNTL, com o padrão de mocks do cliente — `__esModule: true` e factory
  autossuficiente): índice renderiza seções, digitar filtra e troca o índice pela lista de
  resultados, limpar volta ao índice, tocar resultado navega, cada tipo de bloco renderiza,
  `pageId` inválido mostra erro.
- `bun run typecheck` e `bun run lint` em `apps/client`; `bun run test:report` para o agregado.

## 9. Fases de entrega

| Fase | Escopo | Resultado verificável |
| --- | --- | --- |
| 1 | `types.ts`, `catalog.ts` (53 entradas), `fieldSources.ts`, script gerador | `help:generate` roda, typecheck passa |
| 2 | Navegação nos dois stacks + índice + página + renderer + i18n chrome | Drawer aparece e navega, com conteúdo stub |
| 3 | Seções 1 e 2 — Comece por aqui, Suas histórias (14 páginas) | Um usuário novo consegue ir do zero à primeira história só com a ajuda |
| 4 | Seção 3 — Elementos da história (14 páginas) | Teste de cobertura de campos passa |
| 5 | Seções 4 e 5 — Ramificadas e Anotar/conectar (10 páginas) | Comentários e "Veja também" documentados pela primeira vez |
| 6 | Seções 6, 7 e 8 — Preferências, Conta/servidores, Sincronização (11 páginas) | — |
| 7 | Seção 9 — Suporte (4 páginas), com links para todas as anteriores | Catálogo completo, `locales:audit` limpo |
| 8 | Ajuda contextual: ícone `?` no header de cada tela abrindo a página correspondente | Mapa `screenName → pageId` coberto por teste |
| 9 | Atualizar `docs/screen_flow.md` e `docs/project_plan.md` e apontar a ajuda no `README.md` | Docs técnicos coerentes com o código |

## 10. Riscos e decisões em aberto

- **Volume de escrita.** 53 páginas × 2 idiomas continua sendo o grosso do esforço; a estrutura
  (fases 1–2) é pequena. Fases 3–7 são independentes e podem ser paralelizadas.
- **Envelhecimento.** Mitigado pelos testes de §8: campo novo no modelo quebra a suíte até alguém
  decidir se ele é visível ao usuário.
- **Tradução.** `pt` é a redação primária, `en` é tradução. O fallback evita bloquear a entrega de
  uma página enquanto a tradução não sai.
- **Capturas de tela.** Ficam **fora** da v1: uma imagem por tela em dois temas e dois idiomas
  envelhece a cada ajuste de UI e pesa no bundle. O bloco `path` ("Menu › Amigos › Detalhe")
  cobre a necessidade de localização sem esse custo. Reavaliar depois que o texto estiver pronto.
- **`docs/` desatualizado.** `screen_flow.md` não lista Comentários nem Sugestões no menu da
  história, e `project_plan.md` não descreve comentários, "veja também", efeitos, condições de
  escolha, favoritos nem permissões de colaboração. A ajuda será escrita a partir do **código e
  das telas**; a fase 9 corrige os docs.
- **Decidido:** páginas de ajuda **não** entram na Busca Global — ela é escopada por história e
  misturar documentação com conteúdo narrativo confunde os resultados. A necessidade é atendida
  pela barra de busca da própria tela de ajuda, especificada em §7.3.1.
