# Fluxo de telas do Keres

> Atualizado a partir da versão original (notas de planejamento pré-implementação). O fluxo real de navegação vive em `apps/client/src/navigation/` - este documento resume o que está lá, não o contrário; se divergirem no futuro, o código manda.

Telas no React Navigation funcionam via stack (e, no caso do sistema principal, um drawer por cima de vários stacks aninhados) - mantenha isso em mente.

`AppNavigator.tsx` é a raiz e alterna entre três stacks, conforme o estado do app: `ColdInstallStack`, `StorySelectionStack` e `MainSystemStack`.

## Stack 1 - Cold Install

- Tela de boas-vindas / configuração inicial (`ColdInstallScreen`).
  - Campo para nome de usuário local.
  - Por trás dos panos o sistema inicializa o banco de dados local populando as tabelas necessárias (`ClientSettings`, etc.).
  - Feito isso, segue para a Seleção de Histórias.

## Stack 2 - Story Selection (`StorySelectionStack`)

- Tela principal quando não há Cold Install pendente (`StorySelectionScreen`): lista todas as histórias do usuário e a qual servidor cada uma está vinculada (ou nenhum, se offline-only).
- CRUD de história (`StoryFormScreen`): criação permite definir todos os campos, incluindo `type` (`linear`/`branching`); edição restringe alguns.
- CRUD de servidor (`ServerRegistrationScreen`/`ServerManagementScreen`): cadastro de um servidor Keres remoto (login/senha) ao qual histórias podem ser enviadas/vinculadas.
- Gestão de amizades (`FriendshipListScreen`, `FriendshipFormScreen`, `FriendDetailScreen`) e perfil do usuário (`MyProfileScreen`, `ChangePasswordScreen`) - relevante para colaboração entre usuários de um mesmo servidor.
- Configurações gerais do app (`AppSettingsScreen`): tema (claro/escuro) e idioma.
- Importação/exportação de histórias via JSON (`ImportExportScreen`).
- Histórias de exemplo prontas para importar (`examplestories/ExampleStoriesScreen`).

## Stack 3 - Main System (`MainSystemStack`, drawer)

Drawer unificado dá acesso a todos os módulos do sistema, com uma tela por entidade. Ordem real dos itens do drawer:

1. **Painel Principal** (`MainDashboard`) - o rótulo do drawer é substituído dinamicamente pelo título da própria história atual, em vez do texto fixo "Painel Principal".
2. **Busca Global** (`GlobalSearch`) - campo de busca único que pesquisa por texto em **qualquer** tabela, em **qualquer** campo pesquisável (nativo ou atributo customizado), com resultados agrupados por tipo de entidade; tocar num resultado navega direto para o detalhe daquela entidade (`utils/entityNavigation.ts`).
3. **Personagens** (`CharactersStack`)
4. **Capítulos** (`ChaptersStack`) - estrutura principal da narrativa: expandir um capítulo mostra suas cenas. Histórias lineares usam a ordem de cena; histórias branching usam colunas por camada. Detalhes e formulários de cena pertencem a esta mesma pilha.
5. **Escolhas** (`ChoicesStack`) - **oculto no drawer se a história for `linear`**. Inclui um mapa/grafo da história (`ChoiceViewScreen`).
6. **Locais** (`LocationsStack`) - inclui uma visualização em grafo das relações entre locais (`LocationGraphScreen`).
7. **Itens** (`ItemsStack`)
8. **Trajetórias de Item** (`ItemJourneysStack`) - histórico de mudanças de estado/posse de um item ao longo das cenas.
9. **Etiquetas** (`TagsStack`)
10. **Regras do Mundo** (`WorldRulesStack`)
11. **Notas** (`NotesStack`)
12. **Galeria** (`GalleryStack`)
13. **Relações de Personagens** (`CharacterRelationsStack`) - inclui um grafo de relações (`CharacterRelationGraphScreen`).
14. **Atributos Customizados** (`StorySchemaStack`) - onde o usuário define campos customizados por tipo de entidade (ver `project_plan.md`, seção "Story Schema Fields").
15. **Sugestões** (`Suggestions`) - armazenamento por história de valores livres; não é um catálogo padrão de preenchimento (ver `project_plan.md`).
16. **Status** (`StatsDrawer`) - só visível quando `Story.statSystem` está ligado; reúne lista, escadas, comparação e ranking de status.
17. **Comentários** (`CommentsStack`) - lista centralizada dos comentários feitos em campos de entidades da história.
18. **Logs de Operação** (`OperationLogStack`) - histórico auditável de criações/edições/exclusões sincronizadas.
19. **Análise da História** (`StoryAnalysis`) - relatório de problemas estruturais que o autor dificilmente notaria sozinho (cenas órfãs, escolhas quebradas etc.); recarrega ao focar.
20. **Configurações da História** (`StorySettings`)
21. **Dispositivos de Trama** (`StoryDevicesDrawer`) - visível quando a opção correspondente das configurações do app está ligada.
22. **Ajuda** (`HelpDrawer`) - abre o catálogo de ajuda sem sair da história.
23. **Seleção de Histórias** (`StorySelection`) - item "voltar": reseta a pilha raiz de volta à lista de histórias, sem ficar empilhado no histórico de navegação.

### Padrão de telas por entidade (Personagens, Locais, Capítulos, Escolhas, Itens, Trajetórias de Item, Etiquetas, Regras do Mundo, Notas)

Cada entidade tem seu **próprio** conjunto de telas dedicadas:

- **Listagem** (`<Entidade>ListScreen`) - lista tipo contatos, com busca por texto (com debounce), filtro por tag, ordenação, filtro de favoritos, e um botão de **Busca Avançada** (`AdvancedSearchModal`) que expõe todos os campos pesquisáveis da entidade (nativos + atributos customizados da história, se houver). Implementada sobre o componente genérico `GenericFilterSortList`, que é reutilizado por todas as entidades - a genericidade está no *componente de lista*, não numa *tela* por trás dela.
  - Ao tocar num item, abre a tela de Detalhe daquela entidade com o `id` como parâmetro.
- **Detalhe** (`<Entidade>DetailScreen`) - exibe todos os campos da entidade, relações (tags, notas ancoradas, galeria vinculada, relações com outras entidades conforme o tipo), e um botão de edição (lápis) no cabeçalho que leva ao Formulário.
- **Formulário** (`<Entidade>FormScreen`) - criação e edição usam a mesma tela; inclui os campos customizados definidos em Atributos Customizados, quando aplicável.

Exceções ao padrão:
- **Locais** e **Escolhas** também têm uma tela de **grafo/mapa** (`LocationGraphScreen`, `ChoiceViewScreen`) para visualizar as relações/transições espacialmente.
- **Relações de Personagens** não tem Formulário próprio (a criação/edição de uma relação acontece a partir da tela de Detalhe de um Personagem) - tem Listagem e Grafo.
- **Galeria** não segue Lista→Detalhe→Formulário: é uma grade de mídia importada (`GalleryListScreen`, cards visuais em vez de linhas de lista) com uma tela de Detalhe por item (`GalleryDetailScreen`); a "criação" é o fluxo de importação de arquivos, não um formulário de campos.
- **Atributos Customizados** (Story Schema) tem Listagem e Formulário de campo, mas não "Detalhe" - o campo em si não tem uma visualização separada da edição.
- **Log de Operações** é somente leitura: tem Listagem e Detalhe, sem Formulário.
- **Comentários** são transversais: podem ser abertos junto de um campo no detalhe e também aparecem na lista centralizada; não possuem formulário de entidade próprio.
- **Status** é uma feature da história, não uma entidade comum: tem telas próprias de lista, formulário, escada, comparação e ranking; o detalhe/formulário do personagem concentra modos e valores.
- **Matriz de presença/jornada** é uma sobreposição global aberta pelos detalhes de Personagem ou Item. Ela compara presença de personagens ou jornadas de itens nas cenas de histórias lineares; não entra na pilha de navegação.
- **Cenas** não têm drawer ou listagem própria: aparecem aninhadas no capítulo, mas preservam Detalhe e Formulário dentro de `ChaptersStack`.

## Ajuda

O drawer **Ajuda** está disponível no menu principal e no menu de uma história. O índice é pesquisável e cada tela mapeada exibe um ícone de ajuda contextual que abre a página correspondente.
