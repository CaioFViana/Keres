/**
 * Identidade da versão distribuída do Keres.
 *
 * Atualize com `bun run version:set <versão> <nome>` na raiz do repositório. Este módulo é
 * consumido tanto pelo cliente quanto pela API, portanto não há uma versão separada do servidor.
 */
export const APP_RELEASE = {
  name: "Galatea",
  version: "1.5.0",
} as const;
