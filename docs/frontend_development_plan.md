# Plano de Desenvolvimento do Frontend Keres

Este documento detalha o plano de desenvolvimento para o frontend do aplicativo Keres, abrangendo tecnologias, modos de operação, interação com a API e funcionalidades principais.

## 1. Tecnologias Principais

O frontend do Keres será desenvolvido utilizando:

*   **React Native:** Para a base de código principal, permitindo o desenvolvimento de aplicativos móveis nativos.
*   **Expo:** Para simplificar o desenvolvimento, build e deploy de aplicativos React Native, incluindo a versão web.
*   **React Native Web:** Para permitir que a mesma base de código React Native seja compilada e executada como uma aplicação web, garantindo uma experiência unificada em diferentes plataformas.

## 2. Integração Monorepo

O frontend reside no diretório `apps/client` dentro da estrutura monorepo do Keres. Isso facilita o compartilhamento de código (como schemas Zod e tipos definidos em `packages/shared`) e a orquestração de builds via Turborepo.

## 3. Modos de Experiência do Usuário (UX Híbrida)

O Keres oferecerá uma experiência de usuário híbrida, com modos Online e Offline, conforme detalhado em `docs/offline_strategy.md`.

### 3.1. Modo Online

*   O aplicativo se conectará a um backend remoto (API Hono) para todas as operações de dados.
*   Permitirá acesso a dados compartilhados e, futuramente, funcionalidades de colaboração.

### 3.2. Modo Offline

*   O aplicativo se conectará a um backend local, utilizando um banco de dados SQLite local e independente.
*   **Desktop (via Electron):** O `apps/api` será empacotado junto com o frontend Electron, operando como um serviço local que se conecta ao SQLite.
*   **Mobile:** O aplicativo móvel provavelmente interagirá diretamente com um banco de dados SQLite local (via bibliotecas React Native específicas para SQLite), sem a necessidade de empacotar o backend Hono completo no dispositivo móvel.

### 3.3. Isolamento de Dados e Sincronização Manual

*   Os dados nos modos online e offline serão **completamente isolados**, sem sincronização automática.
*   A transferência de dados entre os modos será feita manualmente através de funcionalidades de **exportação e importação JSON** de histórias completas.

## 4. Estruturas de História Dinâmicas

O frontend adaptará sua interface com base no `type` da entidade `Story` (`'linear'` ou `'branching'`), conforme descrito em `docs/dynamic_story_structure.md` e `docs/choice_mechanics.md`.

### 4.1. UI de História Linear

*   A interface de usuário existente para criação/edição de capítulos e cenas será preservada.
*   O campo `index` continuará a guiar a ordem de exibição e navegação implícita.
*   Escolhas implícitas (gerenciadas pelo backend) não serão expostas ou editáveis diretamente na UI.

### 4.2. UI de História Ramificada (Interactive Fiction/CYOA)

*   Uma nova interface de usuário será ativada quando `Story.type` for `'branching'`.
*   Esta UI permitirá que os usuários definam explicitamente as escolhas para cada cena (texto da escolha e a cena de destino).
*   Uma ferramenta de visualização em grafo poderá ser implementada para exibir cenas como nós e escolhas explícitas como arestas direcionadas, representando visualmente a narrativa ramificada.

## 5. Interação com a API (Baseado nas Rotas Existentes)

O frontend consumirá a API Hono (`apps/api`) para todas as operações de dados. As principais funcionalidades da API que o frontend irá interagir incluem:

### 5.1. Autenticação e Usuários

*   **`POST /users/register`**: Registro de novos usuários.
*   **`POST /users/login`**: Autenticação de usuários e obtenção de tokens.
*   **`POST /users/refresh-token`**: Atualização de tokens de acesso.
*   **`GET /users/profile/:id`**: Obtenção do perfil do usuário.

### 5.2. Gerenciamento de Histórias

*   **`POST /stories`**: Criar nova história.
*   **`GET /stories/all`**: Obter todas as histórias de um usuário.
*   **`GET /stories/:id`**: Obter uma história por ID.
*   **`PUT /stories/:id`**: Atualizar uma história por ID.
*   **`PATCH /stories/:id`**: Atualização parcial de uma história.
*   **`DELETE /stories/:id`**: Excluir uma história.

### 5.3. Gerenciamento de Capítulos

*   **`POST /chapters`**: Criar novo capítulo.
*   **`GET /chapters/:id`**: Obter capítulo por ID.
*   **`GET /chapters/story/:storyId`**: Obter capítulos por ID da história.
*   **`PUT /chapters/:id`**: Atualizar capítulo por ID.
*   **`PATCH /chapters/:id`**: Atualização parcial de capítulo.
*   **`DELETE /chapters/:id`**: Excluir capítulo.
*   **`POST /chapters/bulk-delete`**: Exclusão em massa de capítulos.

### 5.4. Gerenciamento de Cenas

*   **`POST /scenes`**: Criar nova cena.
*   **`GET /scenes/:id`**: Obter cena por ID.
*   **`GET /scenes/chapter/:chapterId`**: Obter cenas por ID do capítulo.
*   **`GET /scenes/location/:locationId`**: Obter cenas por ID do local.
*   **`PUT /scenes/:id`**: Atualizar cena por ID.
*   **`PATCH /scenes/:id`**: Atualização parcial de cena.
*   **`DELETE /scenes/:id`**: Excluir cena.
*   **`POST /scenes/bulk-delete`**: Exclusão em massa de cenas.

### 5.5. Gerenciamento de Momentos

*   **`POST /moments`**: Criar novo momento.
*   **`POST /moments/batch`**: Criar múltiplos momentos.
*   **`GET /moments/:id`**: Obter momento por ID.
*   **`GET /moments/scene/:sceneId`**: Obter momentos por ID da cena.
*   **`PUT /moments/:id`**: Atualizar momento por ID.
*   **`PUT /moments/batch`**: Atualizar múltiplos momentos.
*   **`PATCH /moments/:id`**: Atualização parcial de momento.
*   **`DELETE /moments/:id`**: Excluir momento.
*   **`POST /moments/bulk-delete`**: Exclusão em massa de momentos.

### 5.6. Gerenciamento de Personagens

*   **`POST /characters`**: Criar novo personagem.
*   **`POST /characters/batch`**: Criar múltiplos personagens.
*   **`GET /characters/:id`**: Obter personagem por ID.
*   **`GET /characters/story/:storyId`**: Obter personagens por ID da história.
*   **`PUT /characters/:id`**: Atualizar personagem por ID.
*   **`PATCH /characters/:id`**: Atualização parcial de personagem.
*   **`PUT /characters/batch`**: Atualizar múltiplos personagens.
*   **`DELETE /characters/:id`**: Excluir personagem.
*   **`POST /characters/bulk-delete`**: Exclusão em massa de personagens.

### 5.7. Gerenciamento de Locais

*   **`POST /locations`**: Criar novo local.
*   **`GET /locations/:id`**: Obter local por ID.
*   **`GET /locations/story/:storyId`**: Obter locais por ID da história.
*   **`PUT /locations/:id`**: Atualizar local por ID.
*   **`PATCH /locations/:id`**: Atualização parcial de local.
*   **`DELETE /locations/:id`**: Excluir local.
*   **`POST /locations/bulk-delete`**: Exclusão em massa de locais.

### 5.8. Gerenciamento de Escolhas

*   **`POST /choices`**: Criar nova escolha.
*   **`GET /choices/:id`**: Obter escolha por ID.
*   **`GET /choices/by-scene/:sceneId`**: Obter escolhas por ID da cena.
*   **`PUT /choices/:id`**: Atualizar escolha por ID.
*   **`PATCH /choices/:id`**: Atualização parcial de escolha.
*   **`DELETE /choices/:id`**: Excluir escolha.
*   **`POST /choices/bulk-delete`**: Exclusão em massa de escolhas.

### 5.9. Gerenciamento de Galeria

*   **`POST /gallery`**: Criar novo item de galeria (suporta `multipart/form-data`).
*   **`GET /gallery/:id`**: Obter item de galeria por ID.
*   **`GET /gallery/images/:id`**: Servir arquivo de imagem da galeria por ID.
*   **`GET /gallery/owner/:ownerId`**: Obter itens de galeria por ID do proprietário.
*   **`GET /gallery/story/:storyId`**: Obter itens de galeria por ID da história.
*   **`PUT /gallery/:id`**: Atualizar item de galeria por ID (suporta `multipart/form-data`).
*   **`PATCH /gallery/:id`**: Atualização parcial de item de galeria.
*   **`DELETE /gallery/:id`**: Excluir item de galeria.
*   **`POST /gallery/bulk-delete`**: Exclusão em massa de itens de galeria.

### 5.10. Gerenciamento de Notas

*   **`POST /notes`**: Criar nova nota.
*   **`GET /notes/:id`**: Obter nota por ID.
*   **`GET /notes/story/:storyId`**: Obter notas por ID da história.
*   **`PUT /notes/:id`**: Atualizar nota por ID.
*   **`PATCH /notes/:id`**: Atualização parcial de nota.
*   **`DELETE /notes/:id`**: Excluir nota.
*   **`POST /notes/bulk-delete`**: Exclusão em massa de notas.

### 5.11. Gerenciamento de Tags

*   **`POST /tags`**: Criar nova tag.
*   **`GET /tags/:id`**: Obter tag por ID.
*   **`GET /tags/story/:storyId`**: Obter tags por ID da história.
*   **`PUT /tags/:id`**: Atualizar tag por ID.
*   **`PATCH /tags/:id`**: Atualização parcial de tag.
*   **`DELETE /tags/:id`**: Excluir tag.
*   **`POST /tags/add`**: Adicionar tag a uma entidade.
*   **`POST /tags/remove`**: Remover tag de uma entidade.
*   **`POST /tags/bulk-delete`**: Exclusão em massa de tags.

### 5.12. Gerenciamento de Regras do Mundo

*   **`POST /world-rules`**: Criar nova regra do mundo.
*   **`GET /world-rules/:id`**: Obter regra do mundo por ID.
*   **`GET /world-rules/story/:storyId`**: Obter regras do mundo por ID da história.
*   **`PUT /world-rules/:id`**: Atualizar regra do mundo por ID.
*   **`PATCH /world-rules/:id`**: Atualização parcial de regra do mundo.
*   **`DELETE /world-rules/:id`**: Excluir regra do mundo.
*   **`POST /world-rules/bulk-delete`**: Exclusão em massa de regras do mundo.

### 5.13. Gerenciamento de Sugestões (Listas Customizáveis)

*   **`POST /suggestions`**: Criar nova sugestão.
*   **`POST /suggestions/batch`**: Criar múltiplas sugestões.
*   **`GET /suggestions/:id`**: Obter sugestão por ID.
*   **`GET /suggestions/user/:userId`**: Obter sugestões por ID do usuário.
*   **`GET /suggestions/story/:storyId`**: Obter sugestões por ID da história.
*   **`GET /suggestions/type/:type`**: Obter sugestões por tipo.
*   **`GET /suggestions/user/:userId/type/:type`**: Obter sugestões por ID do usuário e tipo.
*   **`GET /suggestions/story/:storyId/type/:type`**: Obter sugestões por ID da história e tipo.
*   **`PUT /suggestions/:id`**: Atualizar sugestão por ID.
*   **`PATCH /suggestions/:id`**: Atualização parcial de sugestão.
*   **`PUT /suggestions/batch`**: Atualizar múltiplas sugestões.
*   **`DELETE /suggestions/:id`**: Excluir sugestão.
*   **`POST /suggestions/bulk-delete`**: Exclusão em massa de sugestões.

### 5.14. Outras Funcionalidades

*   **`POST /character-moments`**: Criar associação entre personagem e momento.
*   **`POST /character-moments/batch`**: Criar múltiplas associações.
*   **`PUT /character-moments/batch`**: Atualizar múltiplas associações.
*   **`GET /character-moments/character/:characterId`**: Obter momentos de personagem por ID do personagem.
*   **`GET /character-moments/moment/:momentId`**: Obter momentos de personagem por ID do momento.
*   **`DELETE /character-moments/:characterId/:momentId`**: Excluir associação.
*   **`POST /character-moments/bulk-delete`**: Exclusão em massa de associações.

*   **`POST /character-relations`**: Criar nova relação entre personagens.
*   **`POST /character-relations/batch`**: Criar múltiplas relações.
*   **`PUT /character-relations/batch`**: Atualizar múltiplas relações.
*   **`GET /character-relations/:id`**: Obter relação por ID.
*   **`GET /character-relations/character/:charId`**: Obter relações por ID do personagem.
*   **`PUT /character-relations/:id`**: Atualizar relação por ID.
*   **`DELETE /character-relations/:id`**: Excluir relação.
*   **`POST /character-relations/bulk-delete`**: Exclusão em massa de relações.

*   **`GET /search`**: Pesquisa global em entidades.

## 6. Fluxo de Trabalho de Desenvolvimento

Para desenvolver o frontend, você pode usar os seguintes comandos na raiz do projeto:

*   **`bun run dev`**: Inicia os servidores de desenvolvimento para a API e o cliente (web).
*   **`bun --cwd apps/client start`**: Inicia o servidor de desenvolvimento do Expo para o cliente (web, Android, iOS).
*   **`bun --cwd apps/client android`**: Inicia o aplicativo Android no emulador/dispositivo.
*   **`bun --cwd apps/client ios`**: Inicia o aplicativo iOS no simulador/dispositivo.
*   **`bun --cwd apps/client web`**: Inicia o aplicativo web no navegador.

## 7. Considerações Futuras

*   **Colaboração em Tempo Real:** Implementar funcionalidades de colaboração em tempo real para escrita conjunta.
*   **Ferramentas de Visualização Avançadas:** Desenvolver ferramentas mais sofisticadas para visualização de narrativas ramificadas (gráficos interativos, etc.).
*   **Sincronização Automática:** Embora a estratégia inicial seja de isolamento, uma sincronização mais avançada (com resolução de conflitos) pode ser considerada no futuro.
