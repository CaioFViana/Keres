<div align="center">
  <img src="apps/client/assets/images/icon_keres.png" alt="Keres" width="112" />
  <h1>Keres</h1>
  <p><strong>Organize universos, conecte narrativas e escreva em qualquer lugar.</strong></p>
  <p>Uma plataforma offline-first para planejamento de histórias, disponível em mobile, web e desktop, com sincronização opcional entre dispositivos.</p>
  <p><a href="https://caiofviana.github.io/Keres/">Landing page</a></p>
  <p><strong>Português</strong> · <a href="README.en.md">English</a></p>

  <a href="https://bun.sh/"><img src="https://img.shields.io/badge/Bun-1.2.19-14151A?logo=bun" alt="Bun 1.2.19" /></a>
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo-54-000020?logo=expo" alt="Expo 54" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&amp;logoColor=white" alt="PostgreSQL 16" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&amp;logoColor=white" alt="Docker ready" /></a>
</div>

## Visão geral

O Keres reúne personagens, locais, capítulos, cenas, escolhas, itens, regras de mundo, notas, mídias e relações em um único espaço. O cliente mantém cada história em um banco SQLite local e continua funcionando sem conexão. Quando um servidor é configurado, o mecanismo de sincronização replica as alterações para a API e trata conflitos de versão.

| Componente | Tecnologia | Responsabilidade |
| --- | --- | --- |
| `apps/client` | React Native, Expo, SQLite | Aplicação principal para Android, iOS e web |
| `apps/desktop` | Electron | Distribuição desktop do mesmo cliente web |
| `apps/api` | Bun, Elysia, Drizzle, PostgreSQL | Autenticação, sincronização, colaboração e mídia |
| `apps/admin` | React, Vite | Painel administrativo servido pela própria API em `/admin` |
| `apps/site` | React, Vite | Landing pública publicada no GitHub Pages |
| `packages/shared` | TypeScript, Zod | Entidades, contratos e metadados compartilhados |

```mermaid
flowchart LR
    C["Cliente Keres<br/>mobile · web · desktop"]
    L[("SQLite local<br/>offline-first")]
    A["API Keres<br/>Bun + Elysia"]
    P[("PostgreSQL")]
    M[("Arquivos de mídia")]
    D["Painel admin<br/>/admin"]

    C <--> L
    C <-- "HTTPS + WebSocket" --> A
    A <--> P
    A <--> M
    A --> D
```

## Ajuda no aplicativo

O drawer **Ajuda** está disponível tanto no menu principal quanto no menu de uma história. Ele reúne páginas em português e inglês sobre cada recurso do Keres, com busca local, caminhos pela interface e explicações dos campos visíveis. Os ícones `?` nos cabeçalhos levam diretamente à página de ajuda da tela atual.

## Início rápido

### Requisitos

- [Bun 1.2.19](https://bun.sh/) — versão usada no pipeline de release e na geração do lockfile.
- [Node.js 20 ou superior](https://nodejs.org/) — usado por scripts auxiliares do cliente Expo.
- [Docker com Compose](https://docs.docker.com/compose/) — necessário para o PostgreSQL local e para os fluxos em contêiner.
- Para desenvolvimento nativo: Android Studio/JDK 17 no Android; macOS/Xcode no iOS.

Instale todo o monorepo a partir da raiz:

```bash
bun install --frozen-lockfile
```

### Desenvolvimento local

1. Configure `apps/api/.env` com valores exclusivos para o ambiente local:

   ```dotenv
   DATABASE_URL=postgresql://user:password@localhost:5432/keres_db
   JWT_SECRET=troque-por-um-segredo-com-pelo-menos-32-caracteres
   JWT_SECRET_REFRESH=troque-por-outro-segredo-com-pelo-menos-32-caracteres
   ROOT_ADMIN_USERNAME=root
   ROOT_ADMIN_PASSWORD=troque-por-uma-senha-com-8-ou-mais-caracteres
   ```

   `ROOT_ADMIN_*` é opcional. Quando definido, o usuário é criado ou reconciliado como administrador em toda inicialização; a senha configurada também é reaplicada.

2. Inicie somente o PostgreSQL:

   ```bash
   docker compose -f apps/api/docker-compose.yml up -d db
   ```

3. Em um terminal, compile o painel e inicie a API:

   ```bash
   bun run build:admin
   bun run start:api
   ```

   As migrations do PostgreSQL são aplicadas automaticamente antes de a API aceitar conexões.

4. Em outro terminal, inicie o cliente:

   ```bash
   cd apps/client
   bun run start
   ```

Depois de iniciar, escolha o destino no terminal do Expo. No Keres, cadastre a URL do servidor de acordo com o dispositivo:

| Destino | URL da API local |
| --- | --- |
| Navegador ou iOS Simulator | `http://localhost:3000` |
| Android Emulator padrão | `http://10.0.2.2:3000` |
| Dispositivo físico | `http://IP-DA-SUA-MAQUINA:3000` |

Em um dispositivo físico, computador e aparelho precisam estar na mesma rede e a porta 3000 deve ser permitida pelo firewall local.

Serviços disponíveis:

- API e Swagger: `http://localhost:3000/swagger`
- Health check: `http://localhost:3000/kerescheck`
- Painel administrativo compilado: `http://localhost:3000/admin`
- Cliente web (mesmo origin, COOP/COEP): `http://localhost:3000/app` — precisa de `bun run --cwd apps/client export:web`
- Painel administrativo com hot reload: execute `bun run dev` em `apps/admin` e abra `http://localhost:5173/admin/`

### Stack Docker local

Para construir a imagem a partir do checkout atual e subir API + PostgreSQL:

```bash
bun run docker:up
docker compose -f apps/api/docker-compose.yml logs -f api
```

O ambiente fica em `http://localhost:3000`. Banco e mídias usam volumes nomeados e sobrevivem à recriação dos contêineres. Para encerrar sem apagar os dados:

```bash
bun run docker:down
```

Não acrescente `--volumes` ao comando de encerramento se pretende preservar banco e uploads.

## Outros fluxos de desenvolvimento

```bash
# Cliente web
cd apps/client && bun run web

# Export web estático
cd apps/client && bun run export:web

# Electron em modo local
bun run desktop:start

# Gerar um pacote Electron para o sistema atual
bun run desktop:package

# Verificações do cliente
cd apps/client && bun run lint
cd apps/client && bun run locales:audit
```

Consulte o [guia específico do cliente](apps/client/README.md) para builds nativas, banco local e solução de problemas do Expo.

## Keres Server (sem Docker)

Para um PC em casa sincronizar com o telemóvel **sem** PostgreSQL nem Compose, a API também corre em SQLite. O pacote **Keres Server** é essa API mais um assistente em linha de comando (português/inglês). Não substitui a imagem Docker: Postgres em produção continua no GHCR.

### Download (utilizadores)

Cada tag `v*.*.*` anexa os zips à [GitHub Release](https://github.com/caiofviana/keres/releases) correspondente, junto com o cliente desktop, o Android e a imagem Docker. Escolha o ficheiro do seu sistema:

| Sistema | Ficheiro |
| --- | --- |
| Windows x64 | `Keres-Server-windows-x64-<versão>.zip` |
| Linux x64 | `Keres-Server-linux-x64-<versão>.zip` |
| macOS Apple Silicon | `Keres-Server-macos-arm64-<versão>.zip` |

Descompacte, execute `keres-server` / `keres-server.exe`. Não é preciso Bun, Node nem Docker. O zip contém o executável, o addon nativo do libSQL, as migrações, o painel `/admin` e um `README.md` (instruções e cópia de segurança). O compile da Bun não embute o `.node` do libSQL, por isso não é um único ficheiro.

Na primeira execução o assistente pergunta banco (SQLite por omissão), mídia local ou S3, porta e se escuta só neste computador ou na rede local. Os dados ficam **fora** da pasta do zip (atualizar o executável não apaga o banco):

| Sistema | Pasta |
| --- | --- |
| Windows | `%APPDATA%\KeresServer` |
| macOS | `~/Library/Application Support/KeresServer` |
| Linux | `~/.local/share/keres-server` |

Enquanto corre, o CLI imprime os IPv4 atuais da LAN (`http://192.168.x.x:<porta>`) e volta a listá-los se o router mudar o endereço. Não há DNS local.

### Cópia de segurança (deve ser feita)

O zip traz um `README.md` (português e inglês) ao lado do executável. **Faça uma cópia no mínimo uma vez por mês:** pare o servidor (`Ctrl+C`), na pasta do programa corra `keres-server --backup`, volte a iniciar. Cada cópia vai para uma pasta com data e hora (`KeresServer-backups\…`). Guarde essa pasta noutro disco.

Se o pior acontecer: pare o servidor, esvazie a pasta de dados e copie para lá o conteúdo da pasta datada. O README do zip detalha os ficheiros. Quem usa PostgreSQL ou S3 fora desta máquina trata esse backup como operador.

### Desenvolvimento

```bash
bun run start:launcher
bun run package:server
```

`package:server` gera a mesma pasta e o mesmo zip que a release. `start:api` e o Compose **não** passam pelo assistente: leem `.env` como hoje.

## Deploy da API

Releases versionadas publicam a API e o painel admin no GitHub Container Registry:

```bash
docker pull ghcr.io/caiofviana/keres:latest
```

Para produção, prefira uma tag imutável, como `1.2.3`, em vez de `latest`. O arquivo `apps/api/docker-compose.deploy.yml` usa a imagem publicada, mantém PostgreSQL e mídias em volumes persistentes e expõe a API apenas em `127.0.0.1:3000` por padrão.

### 1. Prepare o servidor

Instale Docker Engine com o plugin Compose. Copie `apps/api/docker-compose.deploy.yml` para um diretório próprio do serviço e crie, no mesmo diretório, um arquivo `.env`:

```dotenv
KERES_IMAGE_TAG=latest
KERES_BIND_ADDRESS=127.0.0.1
KERES_PORT=3000
SERVER_VERSION=1.0.0

POSTGRES_DB=keres
POSTGRES_USER=keres
POSTGRES_PASSWORD=gere-uma-senha-aleatoria-longa-sem-caracteres-de-url

JWT_SECRET=gere-um-segredo-aleatorio-com-pelo-menos-32-caracteres
JWT_SECRET_REFRESH=gere-outro-segredo-independente-com-pelo-menos-32-caracteres
ROOT_ADMIN_USERNAME=root
ROOT_ADMIN_PASSWORD=gere-uma-senha-administrativa-forte
MEDIA_MAX_BYTES=52428800
```

Use valores aleatórios independentes e mantenha esse arquivo fora do controle de versão. Para gerar segredos adequados, pode-se usar `openssl rand -hex 32`. Como a senha do PostgreSQL compõe uma URL, use uma senha alfanumérica longa ou codifique corretamente caracteres reservados.

Se o pacote GHCR estiver privado, autentique o host com um Personal Access Token que tenha `read:packages`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u SEU_USUARIO --password-stdin
```

Pacotes públicos não exigem login.

### 2. Suba e valide

No diretório que contém o Compose e o `.env`:

```bash
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f api
```

Valide localmente no servidor:

```bash
curl --fail http://127.0.0.1:3000/kerescheck
```

Na primeira inicialização, a API espera o PostgreSQL ficar saudável, aplica as migrations e só então começa a servir tráfego.

### 3. Publique com HTTPS

Coloque Caddy, Nginx, Traefik ou o proxy da sua plataforma à frente de `127.0.0.1:3000` e termine TLS nele. Encaminhe o host completo, preserve os caminhos e habilite upgrade de WebSocket para `/ws`. Não publique a porta 5432 do PostgreSQL.

Configure no cliente a URL HTTPS pública, sem sufixos como `/swagger` ou `/admin` — por exemplo, `https://keres.example.com`.

### Atualizações, rollback e backup

```bash
# Atualizar para a tag definida em .env
docker compose pull api
docker compose up -d api

# Acompanhar a inicialização e as migrations
docker compose logs -f api
```

Para rollback, altere `KERES_IMAGE_TAG` para uma versão anterior compatível e repita os comandos. Backup deste deploy Compose é responsabilidade de quem opera o host (a API aceita qualquer Postgres que lhe apontem; não corre `pg_dump` sozinha). Antes de qualquer atualização, copie o PostgreSQL **e** o volume de mídia; histórias sincronizadas e uploads são conjuntos distintos. Um dump lógico:

```bash
docker compose exec -T db pg_dump -U keres -d keres -Fc > keres.dump
```

Adapte usuário e banco caso tenha mudado os valores padrão. Guarde também uma cópia consistente do volume `media_storage` e teste periodicamente o processo de restauração.

## Releases

O workflow `.github/workflows/release.yml` roda somente para tags semânticas no formato `v*.*.*`:

```bash
git tag v1.2.3
git push origin v1.2.3
```

Uma release publica:

- imagem Docker `ghcr.io/caiofviana/keres:1.2.3` e `:latest`;
- `Keres-Server-windows-x64-<versão>.zip`, `Keres-Server-linux-x64-<versão>.zip` e `Keres-Server-macos-arm64-<versão>.zip` (API caseira, sem Docker);
- instalador e executável portátil para Windows;
- DMG para macOS;
- AppImage e Flatpak para Linux;
- APK e AAB assinados para Android.

## Landing (GitHub Pages)

A página pública do projeto vive em `apps/site` e é publicada em [caiofviana.github.io/Keres](https://caiofviana.github.io/Keres/). Não é a vitrine de histórias de um servidor (isso é o Showcase, servido pela API): é a landing do produto, em português e inglês.

```bash
bun run dev:site      # http://localhost:5175
bun run build:site
```

O workflow `.github/workflows/pages.yml` constrói e publica a cada push em `master` (a branch padrão). O environment `github-pages` recusa outras branches. Na primeira vez, em Settings → Pages, escolha **GitHub Actions** como origem.

## Documentação técnica

- [Estrutura real do monorepo](docs/file_structure.md)
- [Plano e arquitetura do projeto](docs/project_plan.md)
- [Fluxo de telas](docs/screen_flow.md)
- [Mecânicas de escolhas](docs/choice_mechanics.md)
- [Sistema de status e gráfico radar](docs/stat_system.md)
- [Sincronização e resolução de conflitos](docs/conflict_resolution_client_strategy.md)

## Segurança operacional

- Nunca reutilize os segredos de desenvolvimento em produção.
- Mantenha a API atrás de HTTPS; tokens e credenciais não devem trafegar em HTTP público.
- Restrinja acesso a `/admin` no proxy quando o painel não precisar ser público.
- Faça backup de `db_data` e `media_storage`; remover volumes destrói dados persistidos. No Keres Server, siga o `README.md` do zip (cópia mensal da pasta de dados, servidor parado).
- Fixe uma tag de imagem em produção e valide migrations e logs antes de descartar backups.
