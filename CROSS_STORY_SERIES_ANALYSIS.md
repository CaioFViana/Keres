# Séries, canon e crossovers entre Histórias

**Status:** análise técnica e de produto; não é plano de implementação.

## Decisão resumida

Keres deve tratar três necessidades como capacidades diferentes:

1. **Série:** organização e leitura editorial de várias Histórias.
2. **Crossover:** uma História ou entidade referencia outra História ou entidade.
3. **Canon compartilhado:** uma entidade existe uma única vez e pode ser usada por várias Histórias.

Uma tela de coleção resolve somente a primeira. Começar pelo canon compartilhado seria uma mudança estrutural ampla e arriscada. A sequência recomendada é:

1. `Series` para agrupar Histórias;
2. `StoryLink` e referências externas explícitas para crossovers;
3. avaliar um `Canon` opcional, com entidades compartilhadas e usos locais, somente após validar a demanda.

## Estado atual de Keres

`Story` é a fronteira de propriedade do sistema, não apenas um agrupamento visual.

- Quase todas as tabelas carregam `storyId`.
- A sincronização opera por História, com cursor, log de operações e controle de versão próprios.
- O servidor rejeita uma operação que tente editar uma entidade pertencente a outra História.
- Relações polimórficas, como See also, validam no servidor que todos os destinos pertencem à mesma História.
- Permissões (`owner`, `writer`, `reader`) são concedidas por História.
- Exportação/importação trata uma História como pacote fechado e remapeia IDs internos.
- Boards e Mapas de locais são documentos JSON de uma História; seus IDs internos também são remapeados na importação.
- Navegação, pesquisa, backlinks, comentários, favoritos e pickers recebem ou consultam um `storyId` explícito.

Essa rigidez é uma propriedade útil: previne que uma edição, exclusão, operação offline ou conflito em uma obra afete outra por acidente.

O documento de produto já reconhece explicitamente esta fronteira: `FEATURE_LANDSCAPE.md` afirma que a História é a unidade de posse e que o canon compartilhado entre livros ou campanhas exige cópia/importação hoje.

## Comparação com os concorrentes citados

| Produto | Fronteira de dados | Suporte de série/canon | Limite relevante |
| --- | --- | --- | --- |
| Plottr | Projeto com livros | Series View, timeline/outline de série; personagens podem ser vinculados a livros | A Series View não é preenchida automaticamente a partir dos livros; é uma camada editorial paralela. |
| Dabble | Projeto com vários livros | Personagens, Notebook e plots compartilhados por padrão; itens podem ser associados a livros específicos | Projetos diferentes ainda exigem mover ou copiar conteúdo; não há referência viva entre projetos. |
| World Anvil | Mundo | Artigos, mapas, cronologias e personagens pertencem ao mesmo mundo; romances e campanhas usam o canon desse mundo | Resolve obras no mesmo cenário, não necessariamente um crossover entre mundos independentes. |
| Keres atual | História | Entidades, relações, sync, permissões e exportação são isolados por História | Não existe série, referência externa ou entidade canônica compartilhada. |

### Plottr

Plottr oferece uma `Series View` para registrar continuidade, eventos que atravessam livros e foreshadowing. A própria documentação esclarece que informações da série **não** são preenchidas automaticamente pelos nomes ou timelines dos livros. O modelo é útil como referência para uma primeira versão de `Series` em Keres: editorial, manual e honesto, sem inferir uma cronologia global.

Os personagens podem ser vinculados a livros para organização e filtro. Isso sugere uma entidade de projeto/serie acima dos livros, mas a documentação também registra que não há categorias de personagem por livro. Portanto, o modelo é compartilhado, porém com poucos overlays locais.

Fontes oficiais:

- [Timeline — Series View](https://docs.plottr.com/article/65-timeline-series-view)
- [Characters — Linking Books and Tag](https://docs.plottr.com/article/86-characters-linking-books-and-tag)
- [Characters — Overview](https://docs.plottr.com/article/80-characters-overview)

### Dabble

Dabble é a comparação arquitetônica mais próxima de um canon de série: um único projeto contém vários livros, enquanto personagens, lore, Notebook e plots podem permanecer compartilhados. Um documento pode pertencer a todos os livros ou somente a determinados livros; o filtro por livro altera a visibilidade, não a identidade ou o conteúdo do documento.

Isso corresponde a **entidade canônica + associação de uso em obra**. Ao mesmo tempo, documentos movidos entre projetos são transferidos ou copiados, não ligados dinamicamente. Esse limite reforça a distinção entre série interna e crossover externo.

Fontes oficiais:

- [Filter a project by book](https://www.dabblewriter.com/docs/manuscript-structure/filter-by-book)
- [Move work between projects](https://www.dabblewriter.com/docs/managing-projects/move-work-between-projects)
- [Séries e mundos compartilhados](https://www.dabblewriter.com/)

### World Anvil

World Anvil organiza o canon pelo `World`: artigos, mapas, cronologias e outros objetos pertencem ao mundo; romances, campanhas e serialização são usos narrativos dele. A documentação recomenda usar um único mundo quando obras e campanhas compartilham o mesmo cenário.

Esse é o modelo mais forte para consistência de universo, mas equivale a introduzir uma nova raiz de propriedade acima da obra. Keres hoje não tem um modo de “mundo neutro”: cada História precisa ter forma linear ou branching e possui seu próprio conjunto de entidades.

Fontes oficiais:

- [Workflow para ficção serial](https://www.worldanvil.com/learn/workflows/serial-fiction-workflow)
- [Organização e referências dentro de um mundo](https://www.worldanvil.com/features/search-explore)

### Concorrentes sem evidência de modelo de série compartilhada

Nas fontes oficiais consultadas, Scrivener, articy:draft e Twine não apresentam um modelo equivalente de canon compartilhado entre obras. Kanka organiza conteúdo dentro de uma campanha, o que se aproxima mais do modelo “um mundo/campanha é a fronteira” do que de uma série formada por obras independentes.

## Opções para Keres

### A. Série editorial, sem compartilhamento de entidades

```text
Series
 ├─ História A
 ├─ História B
 └─ História C
```

**Viabilidade:** alta.

Entrega ordenação, capa, descrição, notas de continuidade e uma visão editorial de alto nível. Pode ter uma timeline de série manual, como a do Plottr, sem afirmar que ela é derivada das timelines internas.

Não resolve, por si só, uma personagem ou local que aparece em mais de uma História.

### B. Crossover por relações externas

```text
História A ── crossover ──> História B
Personagem A ── aparece em ──> Personagem B
```

**Viabilidade:** média/alta, sem enfraquecer o isolamento atual.

Cada História continua dona de seus próprios registros. Uma referência externa declara uma conexão, mas não transforma as duas entidades em uma só. Isso comporta bem adaptações, linhas do tempo alternativas e personagens que mudam entre obras.

É a melhor primeira capacidade funcional de crossover.

### C. Canon compartilhado vivo

```text
Canon
 ├─ Personagem canônica
 ├─ Local canônico
 └─ Peça de mundo canônica

História A ── usa ──> Personagem canônica
História B ── usa ──> Personagem canônica
```

**Viabilidade:** baixa como primeira etapa; alto impacto em dados e infraestrutura.

Editar a entidade canônica deve decidir, explicitamente, o que é global e o que é local à obra. Por exemplo, biografia-base pode ser canônica, enquanto papel narrativo, estado, relações, tags e notas podem variar por História. Não é seguro simplesmente tornar `storyId` opcional nas tabelas existentes.

## Modelagem de dados recomendada

### Fase 1 — `Series` e membros

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
```

Regras:

- Uma História pode, inicialmente, pertencer a no máximo uma Série ou a várias Séries; a escolha precisa ser de produto. Recomenda-se permitir várias apenas se houver um caso concreto para coleções, spin-offs e universos compartilhados.
- O dono deve ter `owner` na História para inseri-la ou removê-la da Série.
- A timeline de Série é um documento editorial próprio; não é calculada automaticamente pelas cenas das Histórias.
- Séries não alteram vocabulário, tipo linear/branching, calendários, permissões ou sync das Histórias participantes.

### Fase 2 — ligações entre Histórias

```ts
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
```

Regras:

- Uma ligação é criada na História de origem e não muda a propriedade da História de destino.
- Para revelar título, descrição ou entidades do destino a leitores da origem, é necessário acesso de leitura ao destino ou aceite explícito do proprietário do destino.
- Se a permissão do destino for removida, a relação pode sobreviver como referência indisponível, sem copiar título ou dados privados.
- Duplicatas devem ser normalizadas para relações bidirecionais, como já ocorre em See also.

### Fase 3 — referência externa de entidade

```ts
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

Regras de validação no servidor:

1. A origem existe, está ativa e pertence a `sourceStoryId`.
2. O destino existe, está ativo e pertence a `targetStoryId`.
3. O autor possui autorização de escrita na origem e leitura no destino.
4. Os tipos são permitidos por uma lista compartilhada, inicialmente restrita a entidades com tela de detalhe navegável.
5. A referência não permite usar um ID sem seu `targetStoryId`.

Na interface, um clique deve abrir a História de destino de modo seguro e preservar a origem para retorno. Isso exige estender a navegação atual, que hoje recebe essencialmente `entityType` e `entityId` dentro da História ativa.

### Fase 4 — canon opcional

Somente se os casos de uso provarem necessidade de edição única em múltiplas obras:

```ts
Canon {
  id: string
  ownerUserId: string
  title: string
  description: string | null
}

CanonicalEntity {
  id: string
  canonId: string
  type: 'Character' | 'Location' | 'WorldRule'
  canonicalData: JSON
  version: number
}

CanonicalEntityUse {
  id: string
  canonicalEntityId: string
  storyId: string
  localData: JSON | null
  visibility: 'shared' | 'story_only'
  version: number
}
```

Esta forma deve começar com poucos tipos — Personagem, Local e Peça de Mundo são os candidatos naturais — e com schemas fortes por tipo. Um JSON genérico para todas as entidades perderia justamente a validação rígida que Keres construiu. `localData` precisa ser um overlay explicitamente tipado por entidade, não uma cópia opaca de toda a linha.

## O que não deve entrar nas primeiras fases

- **Auto-links globais:** nomes repetidos entre Histórias são ambíguos e podem vazar conteúdo privado.
- **Backlinks globais:** exigem índice multi-História, filtrado por permissão do leitor.
- **Pins externos em Boards:** o pin atual guarda um ID interno; ele precisaria ganhar `targetStoryId` e regras de importação próprias.
- **Mapas de locais externos:** nós, marcadores e destinos de mapas precisariam de referências qualificadas por História.
- **Timeline universal:** calendários, datas e ordens narrativas pertencem à História; uma cronologia de Série deve ser declarada, não inferida.
- **Sincronização automática de cópias:** isso cria necessidade de diff, merge, origem, versão e resolução de conflito em nível de entidade.

## Ciclo de vida obrigatório

Cada nova relação persistida precisa cobrir:

| Evento | Decisão necessária |
| --- | --- |
| Criar | Quais papéis podem criar e quando o destino precisa aceitar? |
| Atualizar | Relação é editável, direcional e versionada? |
| Excluir | Soft-delete da relação; não excluir a História ou entidade de destino. |
| Permissão revogada | Ocultar dados do destino, mantendo ou removendo a referência conforme a política escolhida. |
| Sync offline | Aceitar somente após validar ambos os lados e permissões no servidor; conflito explícito se o destino sumiu. |
| Exportar uma História | Preservar referência externa, removê-la ou transformar em texto? A regra deve ser explícita. |
| Importar/duplicar | IDs internos são remapeados; referências externas não podem apontar silenciosamente para IDs aleatórios. |
| Excluir destino | Mostrar destino excluído/indisponível; não corromper a origem. |
| Compartilhar História | Definir se o leitor pode ver apenas a ligação, também o título do destino, ou navegar até ele. |

## Cobertura de testes mínima

- Schema compartilhado para todos os novos documentos e tipos de referência.
- Migração local e servidor para as tabelas novas.
- Testes de integração de sync para criação, atualização, exclusão, reenvio e conflitos.
- Matriz de permissões: owner/writer/reader, acesso ao destino revogado e destinos de outro autor.
- Exportação, importação e duplicação com referências internas e externas.
- Navegação entre Histórias com retorno à origem.
- Garantia de que busca, auto-links e backlinks não revelem entidades sem permissão.
- Regressões para Board e Mapa de locais, caso referências externas sejam adicionadas a essas superfícies.

## Recomendação final

Não implementar “entidade compartilhada entre Histórias” diretamente nas tabelas atuais. O valor imediato está em uma Série editorial e em crossovers explícitos, que preservam a unidade de sync e de permissão de cada História.

Se a pesquisa com usuários confirmar que autores precisam manter uma biografia única, compartilhada e editável entre vários livros, criar então um `Canon` como nova raiz de propriedade. Esse caminho se aproxima do modelo de projeto do Dabble e do modelo de mundo do World Anvil, sem sacrificar a integridade atual de Keres.
