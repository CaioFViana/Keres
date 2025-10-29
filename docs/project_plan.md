# Keres - Story Organizer Project Plan

Um projeto offline-first para organização de histórias (solo ou colaborativa), com sincronização inteligente entre dispositivos locais e servidor remoto. O objetivo é fornecer uma ferramenta robusta e intuitiva para escritores, permitindo que organizem todos os aspectos de suas narrativas, desde personagens e locais até a estrutura de cenas e regras do mundo. O sistema será projetado para ser acessível e fácil de usar, com foco na organização eficiente do conteúdo da história.

Backend com **Elysia (Bun)** + **Zod** para rotas/validação, **Drizzle ORM** para persistência, **ULID** como identificadores. Frontend (React Native/Expo para mobile, Tauri + React para desktop) terá suporte a SQLite local em um modelo offline-first com engine de sincronização.

---

## 📂 Estrutura de Repositório

```
story-organizer/
├── apps/
│ ├── api/ # API Elysia (Bun)
│ │ ├── src/
│ │ │ ├── index.ts # bootstrap Elysia app
│ │ │ ├── routes/ # rotas agrupadas por recurso
│ │ │ ├── schemas/ # validações Zod
│ │ │ ├── db/ # config Drizzle
│ │ │ └── modules/ # controllers/use-cases
│ ├── client/ # frontend (React Native + Expo)
│
├── packages/
│ ├── shared/ # tipos, utils, contratos zod
│ ├── db/ # schema drizzle + migrations
│ └── config/ # configuração comum
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🗄️ Estrutura de Dados

*   **Atualizações Recentes:** A tabela `Story` agora inclui um campo `type` para diferenciar entre histórias lineares e ramificadas. Uma nova tabela `Choices` foi adicionada para suportar a mecânica de histórias "Escolha Sua Aventura".

### Usuários
Para permitir múltiplos logins. Cada usuário pode ter quantas histórias desejar, sem que as tabelas de outras histórias interfiram (Ex: "raças" de uma história não devem aparecer em outra).

```ts
users
- id (ulid, pk)
- username (text, unique)
- password_hash (text)
- password_salt (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### Story
A tabela principal. Armazena os dados gerais da história.

```ts
story
- id (ulid, pk)
- user_id (ulid, fk → users.id)
- type (text) # 'linear' | 'branching' (default: 'linear')
- title (text)
- summary (text) # Como a sinopse de um livro
- genre (text) # Gênero da história (o software terá sugestões)
- language (text) # Idioma padrão do sistema
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Characters
Nenhuma história existe sem personagens.

```ts
characters
- id (ulid, pk)
- story_id (ulid, fk)
- name (text)
- gender (text)
- race (text)
- subrace (text) # Personalizado, a tabela virá vazia
- personality (text) # Texto longo
- motivation (text) # Seu objetivo pessoal
- qualities (text) # Nenhuma personagem é inútil
- weaknesses (text) # Nenhuma personagem é perfeita
- biography (text) # Desde antes de aparecerem na história
- planned_timeline (text) # Para a jornada deles nesta história
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Gallery
Para usar imagens para ilustrar elementos da história. Haverá múltiplas versões (personagens, notas, locais, etc.), mas com estrutura de tabela herdável.

```ts
gallery
- id (ulid, pk)
- story_id (ulid, fk)
- owner_id (ulid) # ID do personagem/nota/local
- is_file (bool) # Sempre será true nesta faze. um dia talvez permitiremos URL (salvo em image_path). Mas não tão cedo.
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Chapters
Uma coleção de cenas. Não significa ordem cronológica, mas sim "ordem de exibição".

```ts
chapters
- id (ulid, pk)
- story_id (ulid, fk)
- name (text) # Nome/identificador do capítulo
- index (int) # Para ordem
- summary (text)
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Scenes
Unidades narrativas fundamentais.

```ts
scenes
- id (ulid, pk)
- chapter_id (ulid, fk)
- location_id (ulid, fk → locations.id)
- name (text) # Nome/identificador da cena
- index (int) # Para ordem
- summary (text)
- gap (interval/int) # Quanto tempo se passou desde a última cena no universo? Permite planejar saltos no tempo.
- gapType (enum) # Qual a unidade de medida do tempo?
- duration (interval/int) # Quanto tempo esta cena deve durar no universo?
- durationType (enum) # Qual a unidade de medida do tempo?
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Locations
Informações gerais sobre um local.

```ts
locations
- id (ulid, pk)
- story_id (ulid, fk)
- name (text)
- description (text)
- climate (text) # Opcional para mundos ficcionais
- culture (text) # Opcional para mundos ficcionais
- politics (text) # Opcional para mundos ficcionais
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Relational Tables

#### Character X Scene
Lista quem estava onde e quando.

```ts
character_scenes
- character_id (ulid, fk)
- scene_id (ulid, fk)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Character X Character
Relações fixas. Como "irmãos", "Mestre/Escravo", "Mãe/Filha"...

```ts
character_relations
- id (ulid, pk)
- char_id_1 (ulid)
- char_id_2 (ulid)
- relation_type (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### Choices
Representa as escolhas em histórias ramificadas (CYOA).

```ts
choices
- id (ulid, pk)
- scene_id (ulid, fk)
- next_scene_id (ulid, fk)
- text (text)
- is_implicit (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### World Rules
Por exemplo, quem pode fazer o quê? Qual é a relação de poder?

Ex: Mana é necessária para lançar feitiços.
Ex: Com cristais elementais, podemos carregar máquinas para lançar os mesmos feitiços daquele elemento.
Ex: Ninguém pode usar o elemento luz. Exceto nosso protagonista. É o que o torna especial.

```ts
world_rules
- id (ulid, pk)
- story_id (ulid, fk)
- title (text)
- description (text)
- affected_characters (relational table maybe?) # Considerar uma tabela relacional para personagens afetados
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Notes
Qualquer autor deve ser capaz de escrever livremente, sem muita organização ou vinculação a algo. O sistema permitirá ancorar a algo, mas não o forçará.

```ts
notes
- id (ulid, pk)
- story_id (ulid, fk)
- title (text)
- body (text) # Pode ser um texto MUITO longo
- gallery_id (ulid, fk → gallery.id, nullable) # Imagem da galeria
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Tags
Enquanto alguns enumeradores agem como tags, nem tudo se encaixa nisso. Aplicamos tags a tudo com uma tabela relacional?

```ts
tags
- id (ulid, pk)
- story_id (ulid, fk)
- name (text)
- color (text)
- is_favorite (boolean) # Indica se o objeto é favorito
- extra_notes (text) # Notas adicionais sobre o objeto
- created_at (timestamp)
- updated_at (timestamp)
```

### Listas Customizáveis (Enumeradores)
Para campos que requerem listas de valores pré-definidos (como gêneros literários, raças, gêneros de personagens, tipos de relação, etc.), o sistema oferecerá um mecanismo de listas customizáveis. O objetivo é fornecer sugestões padrão, mas permitir total flexibilidade para o usuário adaptar ou criar suas próprias entradas.

**Características:**
- **Sugestões Padrão:** O sistema virá com listas de sugestões comuns (ex: gêneros literários populares, raças de fantasia comuns, gêneros de personagens básicos).
- **Customização pelo Usuário:** O usuário poderá adicionar, editar ou remover qualquer entrada dessas listas. As alterações são persistentes e específicas do usuário.
- **Escopo:**
    - **Global (por usuário):** Listas como "Gêneros Literários" ou "Tipos de Relação" podem ser gerenciadas globalmente pelo usuário, aplicando-se a todas as suas histórias.
    - **Por História:** Para elementos mais específicos de um universo narrativo (ex: raças e sub-raças personalizadas, gêneros de personagens únicos para aquela história), as listas podem ser customizadas por história.

**Exemplos de Uso:**
- **Gêneros Literários:** O usuário pode adicionar "Fantasia Urbana" ou remover "Romance Histórico" das sugestões.
- **Gêneros de Personagens:** Além de "Masculino" e "Feminino", o usuário pode adicionar "Não-binário" ou "Agênero", ou até mesmo termos específicos do seu mundo como "Elfo-do-Bosque".
- **Raças/Sub-raças:** O sistema pode sugerir "Elfo", "Anão", "Humano", mas o usuário pode adicionar "Draconiano" ou "Meio-Orc", e sub-raças como "Elfo da Floresta" ou "Anão da Montanha".
- **Tipos de Relação:** Além de "Irmão", "Mãe", "Amigo", o usuário pode adicionar "Mentor", "Rival", "Mestre/Aprendiz".

**Estrutura da Tabela `suggestions`:**
Esta tabela gerenciará todas as entradas das listas customizáveis.

```ts
suggestions
- id (ulid, pk)
- user_id (ulid, fk → users.id) # Para associar a sugestão a um usuário específico
- scope (enum: "global" | "story") # Define se a sugestão é global do usuário ou específica de uma história
- story_id (ulid, nullable) # Se o escopo for "story", FK para a história à qual a sugestão pertence
- type (text) # Categoria da sugestão (ex: "genre", "character_gender", "race", "relation_type")
- value (text) # O valor da sugestão (ex: "Fantasia", "Não-binário", "Elfo da Floresta", "Mentor")n- is_default (boolean) # Indica se a sugestão é padrão do sistema ou criada pelo usuário
- created_at (timestamp)
- updated_at (timestamp)
```
### Gráfico de Relações entre Entidades

```mermaid
graph LR
    users --> story
    users --> suggestions

    story --> characters
    story --> gallery
    story --> chapters
    story --> locations
    story --> world_rules
    story --> notes
    story --> tags
    story -- when story specific --> suggestions

    chapters --> scenes
    locations -- occurs on--> scenes

    scenes -- source --> choices
    choices -- target (next_scene_id) --> scenes

    characters --> character_scenes
    character_scenes --> scenes

    tags -- via relational table --> chapters/scenes/characters/locations
    characters --> character_relations
    character_relations --> characters

    notes -- can have --> gallery
```

## 🔗 Fluxo de Arquitetura

- **API** (`apps/api`)
  - Elysia (Bun) expõe rotas REST/JSON.
  - Zod valida inputs/outputs.
  - Drizzle manipula DB.
  - ULID gera IDs.
  - Engine de Sincronização (op-based replication)

- **Frontend** (`apps/client`)
  - Desenvolvido com React Native, Expo e React Native Web para uma base de código unificada.
  - Opera de forma offline-first com SQLite local.
  - Sincroniza automaticamente com a API remota via o engine de sincronização.

### Configuração de Ambiente

O Keres adota uma abordagem offline-first, onde a configuração de ambiente para o banco de dados é adaptada para suportar tanto o uso local (SQLite) quanto a conexão com um servidor remoto (PostgreSQL).

#### Variável `DATABASE_URL`

A string de conexão para o banco de dados é a principal forma de configurar a persistência.

*   **Para uso local (offline-first):** O cliente usará um banco de dados SQLite local, tipicamente um arquivo no sistema de arquivos do usuário (ex: `file:./data/keres.sqlite`).
*   **Para conexão ao servidor:** O servidor se conectará a um banco de dados PostgreSQL (ex: `postgres://user:password@localhost:5432/keres_db`).

#### Variável `JWT_SECRET`

O segredo usado para assinar e verificar JSON Web Tokens (JWTs) é configurável:

*   **Para o servidor:** Recomenda-se um segredo forte e aleatório, gerenciado com segurança.
*   **Para o cliente (offline-first):** Pode ser um segredo fixo ou gerado na primeira execução, usado para verificações de tokens locais.

#### Exemplo de Arquivos `.env`

Você pode usar arquivos `.env` para gerenciar essas variáveis de ambiente.

**`.env` para o Servidor:**

```dotenv
DATABASE_URL=postgres://seu_usuario:sua_senha@seu_host_db:5432/seu_db_nome
JWT_SECRET=seu_segredo_jwt_forte_para_online
```

**`.env` para o Cliente (Offline-First):**

```dotenv
DATABASE_URL=file:./data/keres.sqlite # Caminho para o arquivo SQLite local
JWT_SECRET=segredo_jwt_fixo_para_offline # Ou gerado dinamicamente
```

---

## 🏗️ Próximos Passos

- Definir migrations no `packages/db` (Drizzle).
- Criar contratos Zod no `packages/shared`.
- Implementar rotas CRUD base (users, stories, characters).
- Desenvolver o engine de sincronização.
- Criar app desktop com SQLite integrado (Tauri/Electron).