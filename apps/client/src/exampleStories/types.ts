/**
 * Uma história de exemplo empacotada com o app, num idioma específico.
 *
 * `story` fica como `unknown` de propósito: o conteúdo vem de `generated/registry.ts` (gerado
 * a partir de `content/<slug>/<lang>.json` por `scripts/generate-example-stories-index.js`,
 * sem validação nenhuma nesse passo). A validação de verdade (`FullStoryExportSchema`) só
 * acontece no momento da instalação, em `ExampleStoryService` - o mesmo ponto que já valida
 * um arquivo `.json` escolhido pelo usuário em `pickStoryExportFile`. Um arquivo de exemplo
 * mal formado deve falhar ali, com um erro claro, e não em algum cast silencioso aqui.
 */
export interface ExampleStoryLanguage {
  /** Código do idioma, no mesmo formato dos locales do app ('pt', 'en', ...) - vem do nome do arquivo. */
  language: string;
  story: unknown;
}

/**
 * Uma história de exemplo, em todos os idiomas em que foi empacotada.
 *
 * `slug` vem do nome da pasta em `content/` e identifica a história através dos idiomas -
 * cada idioma é o mesmo "roteiro", mas cada instalação ganha uma cópia com IDs novos e
 * vínculos internos remapeados. Essa regra vale apenas para o catálogo de exemplos.
 */
export interface ExampleStoryEntry {
  slug: string;
  languages: ExampleStoryLanguage[];
}
