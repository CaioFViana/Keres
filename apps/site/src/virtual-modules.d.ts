/// <reference types="vite/client" />

/**
 * A marca do Keres é gerada em tempo de build a partir do ícone do app de desktop, então
 * não existe arquivo em disco para o TypeScript resolver.
 */
declare module 'virtual:keres-logo' {
  const url: string;
  export default url;
}
