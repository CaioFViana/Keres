# Cliente Keres

**Português** · [English](README.en.md)

Aplicação offline-first do Keres, construída com React Native e Expo. A mesma base atende Android, iOS e web; o export web também é empacotado pelo Electron em `apps/desktop`.

## Como o cliente funciona

- Cada história é armazenada localmente com Drizzle ORM sobre `expo-sqlite`.
- No navegador e no Electron, o SQLite usa WASM/OPFS; no mobile, usa o banco nativo do dispositivo.
- O uso local não depende da API.
- Ao cadastrar um servidor, o cliente autentica o usuário e sincroniza operações, mídias e conflitos.
- Migrations e índices de histórias de exemplo são preparados automaticamente antes de `bun run start`.

## Preparação

Execute a instalação uma vez, preferencialmente na raiz do monorepo para respeitar workspaces, patches e o lockfile:

```bash
bun install --frozen-lockfile
cd apps/client
```

Requisitos por destino:

| Destino | Requisitos adicionais |
| --- | --- |
| Web | Navegador moderno com suporte a OPFS |
| Android | Android Studio, Android SDK, JDK 17 e emulador ou aparelho com depuração USB |
| iOS | macOS, Xcode e CocoaPods |
| Expo Go | Aplicativo Expo Go compatível com SDK 54; alguns módulos nativos podem exigir development build |

## Executar em desenvolvimento

Inicie o Metro/Expo:

```bash
bun run start
```

Atalhos úteis:

```bash
bun run android      # compila e executa o projeto Android nativo
bun run ios          # compila e executa o projeto iOS nativo (somente macOS)
bunx expo start --clear   # limpa o cache do Metro
```

`android` e `ios` usam development builds nativos (`expo run:*`), não apenas o sandbox do Expo Go.

## Conectar a uma API

O endereço do servidor é cadastrado dentro do próprio Keres. Informe apenas a origem da API, sem `/swagger`, `/admin` ou outra rota:

| Ambiente do cliente | Servidor local |
| --- | --- |
| Web ou iOS Simulator | `http://localhost:3000` |
| Android Emulator padrão | `http://10.0.2.2:3000` |
| Aparelho físico | `http://IP-DA-MAQUINA:3000` |
| Produção | `https://keres.example.com` |

Em aparelho físico, a API precisa escutar em uma interface acessível pela rede e o firewall deve permitir a conexão. Em produção, use sempre HTTPS.

Veja o [README principal](../../README.md) para iniciar a API, o PostgreSQL e o painel administrativo.

## Banco local e conteúdo gerado

O comando de início executa dois preparos antes do Expo:

1. gera o índice das migrations SQLite;
2. gera o índice das histórias de exemplo.

Comandos manuais disponíveis:

```bash
bun run db:generate
bun run --cwd apps/client prestart
```

Depois de alterar o schema local, gere a migration, revise o SQL produzido e reinicie o Expo. O `prestart` reescreve os quatro índices gerados (migrations, histórias de exemplo, ajuda e recursos literários) e roda sozinho antes de `start` e de `build`.

## Qualidade

Antes de abrir uma alteração no cliente:

```bash
bun run lint
bun run locales:audit
```

O auditor de traduções verifica a paridade entre os catálogos `en` e `pt`. A variante `bun run locales:audit:force` força a verificação completa quando necessário.

## Builds

### Export web

```bash
bun run client:build
```

O resultado é gravado em `apps/client/dist`. Ele é estático, mas o suporte SQLite/OPFS requer cabeçalhos de isolamento entre origens (`Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy`) no servidor web. O wrapper Electron já configura esse ambiente.

### Desktop

A partir da raiz do monorepo:

```bash
bun run desktop:start
bun run desktop:package
```

O primeiro comando gera o cliente web e abre o Electron; o segundo produz o pacote para a plataforma atual. Builds de release por sistema operacional são gerados pelo workflow de tags.

### Android e iOS para distribuição

O repositório gera APK e AAB Android assinados no workflow `.github/workflows/release.yml`. O projeto nativo `android/` é recriado por `expo prebuild`, recebe a versão da tag e usa os segredos de assinatura configurados no GitHub Actions.

Não há build iOS de release automatizado no momento: ele exige identificador definitivo, conta Apple Developer, certificados e provisioning profiles.

## Solução de problemas

- **Alterações de schema não aparecem:** execute `bunx expo start --clear` e confirme que o índice de migrations foi regenerado.
- **Android não alcança `localhost`:** use `10.0.2.2` no emulador ou o IP da máquina em um aparelho real.
- **SQLite web falha ao iniciar:** confirme suporte a OPFS e os cabeçalhos COOP/COEP no host; teste também sem modo privado.
- **Dependências ou patches inconsistentes:** remova apenas artefatos gerados necessários e execute novamente `bun install --frozen-lockfile` na raiz. Não regenere o lockfile sem intenção.
- **Módulo nativo indisponível no Expo Go:** use `bun run android`/`bun run ios` para criar um development build.

## Referências internas

- [Fluxo de telas](../../docs/screen_flow.md)
- [Estrutura do projeto](../../docs/file_structure.md)
- [Sincronização e resolução de conflitos](../../docs/conflict_resolution_client_strategy.md)
- [Mecânicas de escolhas](../../docs/choice_mechanics.md)
