🧩 KERES — Stack Técnico e Diretrizes de Desenvolvimento

(versão otimizada para uso com IA local)

🧱 Visão Geral

O Keres é uma plataforma offline-first voltada à criação e gerenciamento de histórias fictícias, com sincronização inteligente entre dispositivos locais e servidor remoto.
O foco é oferecer uma experiência fluida, mesmo sem conexão, com sincronização eventual consistente e mínima perda de dados.

O sistema é composto por três camadas principais:

Servidor (API + Sync Engine) — leve, rápido e seguro.

Cliente (Mobile e Desktop) — executa offline, com banco local.

Core Compartilhado (TypeScript) — define modelos, esquemas, regras de sincronização e utilitários.

⚙️ Backend — API e Engine de Sincronização
Stack Principal

Runtime: 🟩 Bun
 — rápido, moderno, compatível com TypeScript nativo.

Framework: 🟩 Elysia
 — leve, tipado e integrado ao Bun.

ORM: 🟩 Drizzle ORM
 — usado tanto no servidor (PostgreSQL) quanto no cliente (SQLite).

Banco de dados: [🟩 PostgreSQL] — armazenamento central com JSONB e índices parciais.

Armazenamento de arquivos: [🟩 MinIO] — compatível com S3, usado para assets de usuários (imagens, backups, anexos).

Cache opcional: Redis (para jobs e sessões).

Autenticação: JWT com refresh tokens e autorização baseada em roles.

Sync Engine: Mecanismo proprietário baseado em op-based replication (operações incrementais + merge inteligente).

Características

100 % TypeScript.

Middleware modular (autenticação, log, compressão, CORS).

Schemas validados via Zod.

Rotas tipadas geradas automaticamente (OpenAPI + tRPC-like).

Suporte a jobs assíncronos (BullMQ ou cron interno do Bun).

Compatível com Cloudflare Workers e self-hosted.

🧠 Core Compartilhado
Objetivo

Fornecer uma base única para lógica de domínio, modelos e sincronização usada por cliente e servidor.

Componentes

/core/models/ — entidades do domínio (Story, Character, Scene, Location, etc.).

/core/schema/ — schemas Drizzle (PostgreSQL e SQLite).

/core/sync/ — motor de sincronização (diff, merge, conflict resolution).

/core/utils/ — funções utilitárias (UUID, hashing, datas, logs).

Tecnologias

TypeScript puro (sem dependências externas críticas).

Drizzle ORM + Zod schemas compartilhados.

Operações determinísticas e idempotentes (base do sync engine).

Suporte a migrações automáticas de schema no cliente.

📱 Cliente — Mobile, Desktop e Web
Objetivos

Executar offline (totalmente funcional sem internet).

Sincronizar automaticamente com o servidor quando disponível.

Interface moderna, rápida e multiplataforma.

🟢 Mobile

Framework: React Native (com Expo).

Banco local: SQLite via Drizzle ORM.

Sincronização: Core TS compartilhado com o servidor.

Armazenamento local: FS + SQLite + cache de assets.

Autenticação: JWT persistente + refresh automático.

UI: React Native Paper + Gesture Handler + Reanimated.

🟣 Desktop (Offline + Local-first)

Framework: Tauri + React.

Linguagem: TypeScript.

Banco local: SQLite (via Drizzle ORM).

Integração: Core TS idêntico ao mobile.

Acesso ao FS: APIs nativas do Tauri.

Vantagem: app nativo (sem Electron), leve e rápido (~10–20 MB).

🔵 Web (Online/Admin)

Framework: React (Vite ou Next.js).

Função: painel administrativo, visualização online, dashboards.

Banco: conectado diretamente à API (sem storage local).

Autenticação: JWT.

🧮 Sincronização (Offline-first)
Princípios

O cliente armazena dados localmente em SQLite.

As operações (inserts/updates/deletes) são registradas como “operations” (oplog).

O servidor mantém histórico incremental por usuário/org.

A sincronização é baseada em “diff de operações” (não apenas snapshot).

Conflitos são resolvidos via regras do domínio (merge preferencial ou interativo).

Todas as entidades têm:

{
  id: string;
  updated_at: number;
  deleted?: boolean;
  version: number;
}


→ usado para detecção de conflitos.

Fluxo Simplificado

O cliente gera operações e as armazena localmente.

Ao detectar conexão, envia o lote de operações (pushOps).

O servidor aplica, versiona e devolve diffs pendentes (pullOps).

O cliente aplica e marca as versões como sincronizadas.

🧰 Dev e Build
Ferramentas

Gerenciador de pacotes: Bun.

Monorepo: TurboRepo / Bun workspaces.

Linting: ESLint + Prettier.

Testes: Vitest + React Testing Library.

CI/CD: GitHub Actions (build, lint, deploy).

Containerização: Docker Compose (para DB, MinIO, servidor).

🧩 Estrutura sugerida do repositório
/keres
 ├─ /apps
 │   ├─ server/        → API Elysia + Bun
 │   ├─ mobile/        → React Native (Expo)
 │   ├─ desktop/       → React + Tauri
 │   ├─ web/           → React (admin)
 │
 ├─ /packages
 │   ├─ core/          → Modelos, schemas, sync engine
 │   ├─ ui/            → Componentes reutilizáveis
 │   ├─ config/        → Variáveis, tipos globais
 │
 ├─ docker-compose.yml → PostgreSQL, MinIO, Redis
 └─ README.md

🔐 Segurança

Tokens JWT curtos + refresh tokens.

Criptografia AES no storage local.

Hash de sincronização validado por chave pública.

Acesso restrito via roles e organization_id.

Auditoria mínima de operações (logs no servidor).

🎯 Diretrizes para a IA local (Gemini, Copilot, etc.)

Ao gerar ou adaptar código:

Preservar compatibilidade com TypeScript 5+ e Bun.

Evitar dependências Node-only (como Express, fs-extra, etc.).

Reutilizar código do /core/ sempre que possível.

Seguir o padrão Drizzle ORM para modelagem.

Priorizar sincronização baseada em operações (não snapshot).

Gerar código modular e testável (cada módulo isolado).

Evitar código bloqueante ou dependente de rede na camada local.

Usar Zod para validação de entrada/saída em rotas.

Usar async/await e tipagem explícita sempre.

Documentar tipos e retornos.

💡 Exemplo de integração entre camadas
// packages/core/models/story.ts
export interface Story {
  id: string;
  title: string;
  summary?: string;
  tags?: string[];
  updated_at: number;
  deleted?: boolean;
}

// apps/server/src/routes/story.ts (Elysia)
import { z } from "zod";
import { Story } from "@keres/core/models/story";

app.post("/story", ({ body }) => {
  const data = z.object({
    id: z.string().uuid(),
    title: z.string(),
    summary: z.string().optional(),
  }).parse(body);

  // salvar com Drizzle ORM
  db.insert(storyTable).values(data);
  return { success: true };
});

🧩 Conclusão

Keres é uma plataforma multiplataforma, offline-first e modular, construída inteiramente com TypeScript, Drizzle, Bun e Elysia, com foco em performance, sincronização local e reuso máximo de código.