/**
 * A marca do Keres é gerada em tempo de build a partir do ícone do app de desktop, então não
 * existe arquivo em disco para o TypeScript resolver - o plugin `keresLogo` (vite.keresIcon.ts)
 * publica este módulo com a URL final da imagem.
 */
declare module 'virtual:keres-logo' {
  const url: string;
  export default url;
}
