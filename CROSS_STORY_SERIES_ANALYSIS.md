# Séries, arcos e crossovers entre Histórias

**Status:** análise técnica e de produto; não é plano de implementação.

## Decisão de escopo

**Canon compartilhado não entra no produto.** Uma entidade única, editável e usada por várias Histórias criaria uma nova raiz de propriedade e transformaria Keres num produto de gestão de universos compartilhados. Não é o problema que se quer resolver agora.

As direções a avaliar são:

| Opção | Ideia central | Resultado | Viabilidade |
| --- | --- | --- | --- |
| **A. Série + ligações** | Histórias independentes entram numa Série e podem se referenciar explicitamente. | Crossovers entre obras, preservando isolamento. | Média/alta |
| **B. Arcos numa História** | Uma História abriga vários Arcos; por exemplo, cada livro ou jogo é um Arco. | Série no mesmo mundo, com dados e customização comuns. | Média |
| **C. História derivada** | Uma História filha é um overlay sobre uma História de origem. | Isolamento narrativo com base comum. | Baixa |
| **D. Arcos + referências externas** | B para a série principal, A para menções e crossovers pontuais. | Melhor cobertura sem canon vivo. | Média, em duas etapas |

A recomendação é **D, entregue em duas fases**: primeiro Arcos dentro de uma História; depois `Series`, `StoryLink` e `CrossStoryEntityReference` apenas onde obras realmente independentes precisarem se conectar. A implementação de Arcos não deve virar uma alteração cosmética em capítulos: precisa ser um escopo narrativo explícito, mas opcional e compatível com todo conteúdo existente.

## Estado atual de Keres

`Story` é a fronteira de propriedade do sistema, não apenas um agrupamento visual.

- Quase todas as tabelas carregam `storyId`.
- A sincronização opera por História, com cursor, log de operações e controle de versão próprios.
- O servidor rejeita uma operação que tente editar uma entidade pertencente a outra História.
- Relações polimórficas, como See also, validam no servidor que todos os destinos pertencem à mesma História.
- Permissões (`owner`, `writer`, `reader`) são concedidas por História.
- Exportação/importação trata uma História como pacote fechado e remapeia IDs internos.
- Boards e mapas de locais são documentos JSON de uma História; seus IDs internos também são remapeados na importação.
- Navegação, pesquisa, backlinks, comentários, favoritos e pickers recebem ou consultam um `storyId` explícito.

Essa rigidez previne que edição, exclusão, operação offline ou conflito de uma obra afete outra por acidente. `FEATURE_LANDSCAPE.md` já registra que História é a unidade de posse e que hoje canon entre livros ou campanhas requer cópia/importação.

## Comparação com concorrentes citados

| Produto | Fronteira de dados | Suporte relevante | Limite para Keres |
| --- | --- | --- | --- |
| Plottr | Projeto com livros | Series View editorial; personagens podem ser vinculados a livros. | A Series View é manual; não preenche dados dos livros automaticamente. |
| Dabble | Projeto com vários livros | Documentos, personagens e plots podem ser compartilhados ou filtrados por livro. | Equivale a trazer o conceito de livro/arco para dentro de uma mesma raiz. |
| World Anvil | Mundo | Obras e campanhas usam o mesmo mundo como contexto comum. | É uma raiz de universo, o que esta decisão exclui. |
| Keres atual | História | Sync, permissões e entidades isoladas. | Ainda não há uma subdivisão narrativa nem referências entre Histórias. |

### Plottr

Plottr oferece uma `Series View` para continuidade, eventos entre livros e foreshadowing. A documentação esclarece que a visão de série **não** é preenchida automaticamente pelos livros. É uma boa referência para `Series`: camada editorial manual, sem inferir cronologia das timelines internas. Personagens podem ser vinculados a livros para filtro e organização.

Fontes oficiais:

- [Timeline — Series View](https://docs.plottr.com/article/65-timeline-series-view)
- [Characters — Linking Books and Tag](https://docs.plottr.com/article/86-characters-linking-books-and-tag)
- [Characters — Overview](https://docs.plottr.com/article/80-characters-overview)

### Dabble

Dabble é a referência mais próxima da opção B: um projeto pode conter vários livros, com conteúdo filtrável por livro. O filtro muda visibilidade e contexto, não exige uma nova raiz de dados. Já conteúdo em projetos diferentes precisa ser movido ou copiado, não ligado de forma viva.

Isso favorece Arcos como contexto interno de uma História e relações explícitas para obras externas, sem uma entidade canônica compartilhada.

Fontes oficiais:

- [Filter a project by book](https://www.dabblewriter.com/docs/manuscript-structure/filter-by-book)
- [Move work between projects](https://www.dabblewriter.com/docs/managing-projects/move-work-between-projects)

### World Anvil

World Anvil concentra artigos, mapas, cronologias e personagens num `World`; romances e campanhas são usos desse mesmo mundo. É forte para consistência de universo, mas requer precisamente a raiz de canon/universo que foi descartada para Keres.

Fonte oficial: [Workflow para ficção serial](https://www.worldanvil.com/learn/workflows/serial-fiction-workflow).

Nas fontes oficiais consultadas, Scrivener, articy:draft e Twine não apresentam um modelo equivalente de série compartilhada. Kanka se aproxima mais de World Anvil: a campanha é a fronteira.

## A. Série e ligações entre Histórias

```text
Series
 ├─ História A
 ├─ História B
 └─ História C

História A ── StoryLink ──> História B
Personagem A ── CrossStoryEntityReference ──> Personagem B
```

`Series` responde à organização editorial. `StoryLink` descreve relações entre obras. `CrossStoryEntityReference` conecta duas entidades distintas, sem afirmar que são a mesma linha de dados.

### Modelagem

```ts
Series {
  id: string
  ownerUserId: string
  title: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
}

SeriesMember {
  id: string
  seriesId: string
  storyId: string
  order: number
  label: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
}

StoryLink {
  id: string
  sourceStoryId: string
  targetStoryId: string
  kind: 'crossover' | 'sequel' | 'prequel' | 'adaptation' | 'shared_setting' | 'other'
  direction: 'directed' | 'bidirectional'
  label: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
}

CrossStoryEntityReference {
  id: string
  sourceStoryId: string
  sourceEntityType: string
  sourceEntityId: string
  targetStoryId: string
  targetEntityType: string
  targetEntityId: string
  relationType: 'appears_in' | 'same_person' | 'adapted_from' | 'mentions' | 'other'
  note: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
}
```

### Regras essenciais

1. Origem e destino existem, estão ativos e pertencem aos respectivos `storyId`.
2. O autor precisa de escrita na origem e leitura no destino; revelar nome, ícone ou descrição do destino exige essa mesma leitura.
3. A referência não compartilha estado, atributos, imagens, relações, permissões ou operações de sync.
4. Relações bidirecionais precisam ser normalizadas para impedir duplicatas.
5. Se acesso ao destino for revogado, a origem mostra referência indisponível sem vazar dados privados.
6. Navegação deve levar explicitamente `targetStoryId`, preservando a História de origem para retorno.

Uma Série não altera vocabulário, tipo linear/branching, calendários, permissões nem sync das Histórias participantes. Uma timeline de Série é editorial e manual, não calculada das cenas.

## B. Arcos dentro de uma História

```text
História
 ├─ Arco padrão
 ├─ Arco: Livro I
 ├─ Arco: Livro II
 └─ Arco: Jogo derivado
```

Um Arco não é somente uma coleção de capítulos. Ele é um contexto narrativo opcional para indexar e filtrar capítulos e, quando desejado, cenas, plots, anchors, personagens e outras entidades. Assim, uma História passa a comportar uma série inteira que compartilha World, calendário, vocabulário, atributos personalizados, permissões, arquivos e sync.

Isso não faz `World` virar canon e não inverte “História” e “Arco”: a História continua sendo a unidade técnica e de propriedade. O Arco é uma dimensão editorial interna, análoga ao livro de um projeto no Dabble, sem autonomia de dados.

### Modelo mínimo compatível

```ts
StoryArc {
  id: string
  storyId: string
  title: string
  description: string | null
  order: number
  color: string | null
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
}
```

Todas as Histórias existentes recebem, por migração, **um Arco padrão**. Ele pode ficar invisível enquanto for o único Arco; por isso, o comportamento atual não muda para quem não usa a funcionalidade.

Para entidades já existentes, usar inicialmente uma associação opcional e explícita, em vez de tornar `arcId` obrigatório em todas as tabelas de uma vez:

```ts
ArcEntityMembership {
  id: string
  storyId: string
  arcId: string
  entityType: string
  entityId: string
  role: 'primary' | 'appears_in' | 'contextual'
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
}
```

Esse desenho permite que personagem, local ou regra do mundo apareça em mais de um Arco sem copiar a entidade. Para itens cuja pertença é naturalmente singular — sobretudo capítulos e talvez cenas — pode existir depois um `primaryArcId` materializado, mantendo a associação como fonte de verdade para participações secundárias.

### Consequências de produto a explicar no momento de criar Arcos

- Arcos compartilham World, calendários, atributos personalizados, configurações, arquivos, permissões e o espaço de sync da História.
- Eles podem ter ordenação, capa/cores, notas e um contexto de timeline próprio, mas não uma configuração independente de calendário.
- A tela pode alternar entre “todos os Arcos” (a super timeline atual) e um Arco específico.
- Entidades sem associação explícita continuam visíveis em todos os Arcos, até que uma política de visibilidade seja escolhida. Isso preserva o comportamento existente.
- Criar Arcos é uma decisão organizacional com filtros e contextos; não cria uma História independente e não serve para esconder dados de colaboradores da mesma História.

### Sequência segura de adoção

1. Criar `StoryArc` e um Arco padrão para cada História, sem mudar consultas existentes.
2. Adicionar seletor de Arco e filtros a capítulos, cenas e timeline; sem limitar dados ainda não associados.
3. Adicionar `ArcEntityMembership` aos tipos em que contexto separado tem valor: personagens, cenas, plots, anchors, capítulos e localizações.
4. Só depois decidir políticas de filtro para boards, mapas, regras de mundo, comentários, backlinks, auto-links e busca.

Isso evita quebrar compatibilidade e impede a pior alternativa: acrescentar `arcId` obrigatório indiscriminadamente, fazendo entidades antigas desaparecerem de telas ou sincronizações.

## C. História derivada como overlay

```text
História de origem
 ├─ World, calendário, vocabulário e personalização
 └─ entidades-base
       ▲
       │ overlay seletivo
História derivada
 ├─ conteúdo próprio
 └─ exceções locais
```

Uma História derivada reutilizaria elementos da origem sem ter World ou personalização própria. Aparentemente resolve “mesmo mundo, narrativa isolada”, mas cada leitura passa a precisar compor base, overlay, exclusões, substituições e permissões. Isso alcança quase toda a complexidade de um canon compartilhado, acrescida de herança e conflitos.

Questões obrigatórias incluem: qual versão da origem é lida offline; como uma exclusão na origem afeta a filha; como exportar a filha; como o sync resolve edição concorrente; como cancelar uma herança; e se colaboradores da filha podem visualizar tudo que é herdado. Sem uma resposta rigorosa, o recurso introduz vazamento de dados e corrupção semântica.

**Conclusão:** não recomendada. Só deve ser reavaliada se Arcos e referências externas comprovadamente não atenderem a um caso central, mensurável e recorrente.

## D. Estratégia combinada recomendada

| Necessidade | Capacidade indicada |
| --- | --- |
| Vários livros, jogos ou fases no mesmo universo e com mesma equipe | Uma História com Arcos |
| Ordem, capa, descrição e notas de uma coleção de Histórias independentes | `Series` + `SeriesMember` |
| Prequel, sequência, adaptação ou universo compartilhado entre Histórias | `StoryLink` |
| Personagens, locais ou outras entidades de obras diferentes que precisam ser mencionados/relacionados | `CrossStoryEntityReference` |
| Mesma entidade viva, editada uma vez em várias Histórias | Fora de escopo; não é canon compartilhado |

Na prática, B entrega a maior parte do caso “minha série” de maneira simples. A completa o caso em que obras devem continuar independentes. A referência externa é um vínculo semântico, não uma dependência de dados: uma entidade pode representar a mesma personagem em outra obra, mas mantém atributos e evolução próprios.

## Localização na interface

### Arcos: Customização para administrar, contexto para trabalhar

**Sim: `Story menu → Customização → Arcos` é o lugar correto para editar Arcos.** A área já reúne tudo que configura a História uma vez e depois orienta o trabalho diário: vocabulário, calendários, atributos, sugestões e stats. Arcos têm a mesma natureza de estrutura editorial da História, e não devem disputar espaço com as listas diárias no drawer principal.

A tela `Arcos` deve explicar antes de criar o segundo Arco que todos continuam compartilhando World, calendários, atributos personalizados, arquivos, permissões e sync. Ela oferece:

- lista ordenável de Arcos, com título, cor/capa opcional e contagens de conteúdo;
- criar, editar, reordenar e arquivar/excluir um Arco;
- proteção do Arco padrão: não pode ser excluído enquanto ainda houver conteúdo sem destino;
- opção de mover ou manter associações ao apagar um Arco;
- explicação visível de que Arcos não são Histórias separadas e não isolam colaboradores.

Mas **não** se deve obrigar o autor a voltar a Customização para trocar de contexto. Depois que houver mais de um Arco, o drawer ganha, logo abaixo da História ativa, um item do mesmo tamanho e linguagem dos demais itens: ícone do Arco ativo + `Todos os arcos` ou o nome curto do Arco. Seu toque abre um modal de seleção de Arco; não há rótulo longo como “Visualizando”. O ícone e o tema efetivo tornam o contexto reconhecível mesmo quando o título for truncado. No primeiro Arco, esse item permanece oculto. O modo `Todos os arcos` preserva a super timeline e a experiência existente.

Em detalhes e formulários, uma seção discreta `Arcos` permite definir a participação da entidade (`principal`, `aparece em`, `contextual`). Ela não deve ser exibida ou exigida para entidades que continuam globais à História.

### Séries: biblioteca de Histórias para administrar

Séries não devem ficar dentro de `Customização`: elas administram **várias** Histórias e podem existir antes de uma delas estar selecionada. O lugar primário é a tela de seleção de Histórias, como uma área ou rota `Séries`/`Coleções` acessível pelo cabeçalho e, se fizer sentido, pelo drawer desse contexto.

Essa área lista Séries, permite criar e ordenar membros e abre uma Série como coleção. Em cada card e formulário de História, uma linha secundária como `Séries: Crônicas de ...` pode abrir o gerenciador ou a ação `Adicionar à Série`, desde que o usuário tenha a autorização adequada. Essa é uma entrada contextual conveniente, não uma segunda tela de edição.

`StoryLink` é editado na página de detalhes/configurações da História, em uma seção `Relações com outras Histórias`. `CrossStoryEntityReference` é editado na entidade de origem, em uma seção `Conexões` ou como extensão explícita de `See also`; ambos precisam identificar visualmente a História de destino e seu estado de acesso.

### Aparência: tema padrão da História e sobrescrita opcional do Arco

O tema é outra indicação forte de contexto e deve seguir esta resolução, sem criar um canon ou configuração independente:

```text
tema efetivo = tema sobrescrito do Arco ativo
              ?? tema padrão da História
              ?? tema padrão da aplicação
```

`Story.theme` continua sendo o tema padrão. `StoryArc.themeOverride` é opcional (`null` significa **usar o tema da História**) e `StoryArc.icon` identifica o Arco no drawer. Assim, uma História pode permanecer inteiramente com seu tema normal, enquanto `A chama eterna` usa um ícone de labareda e, se o autor desejar, uma sobrescrita escarlate; `O gelo invencível` pode herdar o tema ou sobrescrever para twilight. O ícone do Arco integra o próprio seletor global e preserva reconhecimento quando o título for truncado.

O campo `theme` deve sair do formulário geral de `Story settings` e da criação de História. Em `Story menu → Customização`, uma entrada `Aparência` abre uma tela curta, dedicada, que apresenta o tema padrão da História, os Arcos que o sobrescrevem e a ação para escolher o tema. A criação pode começar no padrão; personalização é uma decisão posterior e rara. O mesmo seletor é reutilizado no formulário de Arco, com as opções claras `Herdar o tema da História` e `Sobrescrever`.

O seletor precisa ser um `ThemePickerModal` reutilizável, não um `SingleSelectPill` que grava ou aplica estado global diretamente. Enquanto aberto, ele pode mostrar uma prévia temporária; ao confirmar, devolve a escolha ao formulário, que a persiste no seu Save. Ao cancelar, fechar, voltar ou abandonar o formulário, deve restaurar o tema efetivo previamente salvo. Depois de salvar ou trocar de Arco, o provedor de tema reaplica `resolveTheme(story.theme, activeArc.themeOverride)`.

Essa separação corrige o comportamento atual: o formulário de Story chama `setTheme` assim que o campo muda, mas não tem um ciclo de cancelamento/restauração; por isso, sair sem salvar deixa a prévia visível. A prévia deve ser estado efêmero de interface, nunca a fonte de verdade do tema ativo.

## O que não deve entrar nesta iniciativa

- Entidade canônica/global ou `storyId` opcional nas tabelas existentes.
- Auto-links ou backlinks globais por nome, que são ambíguos e podem vazar conteúdo privado.
- Pins externos em Boards e destinos externos em mapas de locais na primeira versão. Eles exigem `targetStoryId`, novas regras de importação e UI de acesso indisponível.
- Timeline universal inferida: calendários, datas e ordem narrativa continuam pertencendo à História. A timeline de Série é manual.
- Sync automático de cópias, que exigiria origem, diff, merge, versões e resolução de conflitos por entidade.
- Herança/overlay de História derivada, salvo reavaliação baseada em evidência de produto.

## Ciclo de vida e validação obrigatórios

| Evento | Arco | Ligação entre Histórias |
| --- | --- | --- |
| Criar | Escrita na História; ordenar no mesmo `storyId`. | Escrita na origem e leitura no destino; pode exigir aceite futuro. |
| Atualizar | Versionado e sincronizado como entidade da História. | Versionado; validar os dois lados no servidor. |
| Excluir | Soft-delete; associações são preservadas ou removidas conforme política. | Soft-delete somente da relação, nunca do destino. |
| Permissão revogada | Não se aplica fora da própria História. | Ocultar dados e impedir navegação ao destino. |
| Sync offline | Um único `storyId`; comportamento atual. | Revalidar origem, destino e permissões na chegada ao servidor. |
| Exportar/importar | Remapear `arcId` e memberships dentro do pacote. | Não remapear cegamente IDs externos; preservar como indisponível, remover ou converter em texto conforme regra explícita. |
| Excluir destino | Não se aplica. | Exibir destino excluído/indisponível sem corromper origem. |

## Cobertura de testes mínima

- Schemas compartilhados e validação de API para `StoryArc`, memberships, `Series`, `StoryLink` e referências externas.
- Migração de História antiga para Arco padrão, com a UI e as consultas mantendo o comportamento atual.
- Sync de criação, atualização, exclusão, reenvio e conflitos para os novos registros.
- Filtros de Arco em timeline, capítulos, cenas, plots, anchors e personagens, incluindo itens sem associação.
- Matriz de permissões para ligações: owner/writer/reader, revogação de leitura e destino removido.
- Exportação, importação e duplicação de Arcos e referências externas.
- Navegação entre Histórias e retorno à origem.
- Garantia de que busca, auto-links e backlinks não revelem conteúdo de outro `storyId`.

## Recomendação final

Não criar canon compartilhado e não alterar a fronteira de propriedade de `Story`.

Implementar primeiro **Arcos**, invisíveis e neutros em Histórias que não os usam, para que uma única História acomode uma série com World, calendário e personalização comuns. Em seguida, quando existirem obras que precisam permanecer independentes, introduzir **Séries, ligações entre Histórias e referências externas de entidades**. Essa composição cobre séries e crossovers sem sacrificar o modelo de sync, permissões e importação que Keres já protege.
