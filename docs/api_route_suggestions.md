# Keres API - Rotas Atuais e Sugestões de Melhoria

Este documento mapeia as rotas API atualmente inferidas com base na documentação do projeto e sugere melhorias para otimizar a interação com dados relacionados e operações em lote, além de outras boas práticas de design de API.

## Rotas Atuais (Inferidas - CRUD Padrão)

Com base na implementação CRUD completa para todas as entidades, as seguintes rotas RESTful padrão são assumidas para cada `[entidade]` (ex: `users`, `stories`, `characters`, `scenes`, `choices`, `character_moments`, etc.):

*   **`GET /[entidade]`**: Lista todas as entidades (com suporte a paginação/filtragem, se implementado).
*   **`GET /[entidade]/:id`**: Recupera uma entidade específica pelo seu ID.
*   **`POST /[entidade]`**: Cria uma nova entidade.
*   **`PUT /[entidade]/:id`**: Atualiza uma entidade existente pelo seu ID.
*   **`DELETE /[entidade]/:id`**: Deleta uma entidade pelo seu ID.

## Sugestões de Melhoria para Rotas API

As rotas CRUD padrão são a base, mas para melhorar a eficiência e a experiência do desenvolvedor frontend (reduzindo o número de requisições e a complexidade do cliente), sugerimos as seguintes categorias de melhorias:

### 1. Rotas Otimizadas para Consulta de Dados Relacionados

Estas rotas visam permitir a recuperação de dados relacionados em uma única requisição, minimizando a necessidade de múltiplas chamadas à API.

#### 1.1. Recursos Aninhados (Nested Resources)

Para relações diretas de pai-filho, onde o filho sempre pertence a um pai específico. **(Nota: Grande parte dessas rotas já está implementada.)**

*   **`GET /stories/:storyId/characters`**: Recupera todos os personagens de uma história específica.
*   **`GET /stories/:storyId/chapters`**: Recupera todos os capítulos de uma história específica.
*   **`GET /chapters/:chapterId/scenes`**: Recupera todas as cenas de um capítulo específico.
*   **`GET /scenes/:sceneId/moments`**: Recupera todos os momentos de uma cena específica.
*   **`GET /scenes/:sceneId/choices`**: Recupera todas as escolhas que se originam de uma cena específica.
*   **`GET /characters/:characterId/relations`**: Recupera todas as relações de um personagem específico.

#### 1.2. Inclusão de Dados Relacionados (Query Parameters)

Permite que o cliente solicite a inclusão de dados de entidades relacionadas diretamente na resposta da entidade principal.

*   **`GET /characters/:id?include=moments,relations`**: Recupera os detalhes de um personagem, incluindo os momentos em que ele participa e suas relações com outros personagens.
*   **`GET /stories/:id?include=characters,chapters,locations`**: Recupera os detalhes de uma história, incluindo seus personagens, capítulos e locais.
*   **`GET /scenes/:id?include=moments,choices`**: Recupera os detalhes de uma cena, incluindo seus momentos e as escolhas que dela partem.

#### 1.3. Consultas Específicas de Relação (para Many-to-Many)

Para facilitar a consulta de relações many-to-many sem a necessidade de consultar a tabela de junção diretamente.

*   **`GET /characters/:characterId/moments`**: Recupera todos os momentos em que um personagem específico está envolvido.
*   **`GET /moments/:momentId/characters`**: Recupera todos os personagens envolvidos em um momento específico.

### 2. Rotas para Operações em Lote (Batch Operations)

Estas rotas permitem a criação, atualização ou exclusão de múltiplas entidades em uma única requisição, ou a execução de operações transacionais que envolvem várias entidades.

#### 2.1. Criação/Atualização em Lote

*   **`POST /moments/batch`**: Cria múltiplos momentos em uma única requisição (útil para adicionar vários momentos a uma cena de uma vez). O corpo da requisição seria um array de objetos `Moment`.
*   **`PUT /characters/batch`**: Atualiza múltiplos personagens em uma única requisição (útil para reordenar ou aplicar uma mudança em massa). O corpo da requisição seria um array de objetos `Character` com seus IDs.

#### 2.2. Operações Transacionais/Compostas

Para operações que logicamente criam ou modificam várias entidades de forma atômica.

*   **`POST /scenes/with-choices`**: Cria uma nova cena e, opcionalmente, um conjunto inicial de escolhas que partem dela, em uma única operação transacional. O corpo da requisição conteria os dados da cena e um array de dados para as escolhas.
*   **`POST /stories/import`**: Uma rota dedicada para importar uma história completa a partir de um JSON, como discutido na estratégia offline.

### 3. Rotas para Gerenciamento de Listas e Consultas Avançadas

Estas rotas aprimoram a capacidade de filtrar, ordenar e buscar dados de forma mais flexível e poderosa.

#### 3.1. Filtragem, Ordenação e Paginação

*   **`GET /[entidade]?filter[field]=value&sort_by=field&order=asc/desc&page=X&limit=Y`**: Permite filtrar resultados por campos específicos, ordenar por um campo em ordem crescente/decrescente e paginar os resultados.
    *   Ex: `GET /characters?filter[gender]=female&sort_by=name&order=asc&page=1&limit=20`
    *   Ex: `GET /stories?filter[is_favorite]=true&sort_by=updated_at&order=desc`

#### 3.2. Busca Global

*   **`GET /search?query=keyword&scope=entity1,entity2`**: Um endpoint unificado para buscar uma palavra-chave em múltiplos campos ou tipos de entidades.
    *   Ex: `GET /search?query=dragão&scope=characters,notes,world_rules`

### 4. Rotas para Otimização de Operações

Estas rotas oferecem maior granularidade e eficiência na manipulação de dados.

#### 4.1. Atualizações Parciais (PATCH)

*   **`PATCH /[entidade]/:id`**: Permite atualizar apenas os campos específicos de uma entidade, sem a necessidade de enviar o objeto completo.
    *   Ex: `PATCH /characters/:id` com `{ "is_favorite": true }`

#### 4.2. Deleção em Lote (Bulk Delete)

*   **`DELETE /[entidade]?ids=id1,id2,id3`**: Deleta múltiplas entidades especificadas por seus IDs em uma única requisição.
*   **`POST /[entidade]/bulk-delete`**: Uma alternativa para deleção em lote, enviando os IDs no corpo da requisição (útil para muitos IDs ou quando `DELETE` com corpo não é suportado).

### 5. Considerações de Design e Manutenção da API

Estas são boas práticas que, embora não sejam rotas em si, são cruciais para a profissionalização e longevidade da API.

#### 5.1. Versionamento da API

*   **URL Versioning (Recomendado para Keres):** `api/v1/stories`, `api/v2/stories`.
*   **Header Versioning:** `Accept: application/vnd.keres.v1+json`.
*   Permite a evolução da API sem quebrar clientes existentes.

#### 5.2. Padronização de Erros

*   Garantir respostas de erro consistentes e informativas, utilizando códigos de status HTTP apropriados (4xx para erros do cliente, 5xx para erros do servidor) e um formato de corpo de erro padronizado (ex: JSON com `code`, `message`, `details`).

#### 5.3. Webhooks/Notificações em Tempo Real (Consideração Futura)

*   Para funcionalidades colaborativas ou integrações com sistemas externos, a API poderia notificar sobre eventos (webhooks) ou fornecer atualizações em tempo real (WebSockets).

Essas sugestões visam aprimorar a usabilidade da API, tornando-a mais expressiva, eficiente e preparada para o desenvolvimento do frontend e para o futuro do projeto Keres.