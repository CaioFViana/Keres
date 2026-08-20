import avatarIconNames from './avatarIcons.json';

/**
 * O avatar de um usuário: os ícones que ele pode escolher e a cor que aparece quando ele ainda
 * não escolheu nenhuma.
 *
 * Mora aqui, e não no app, porque três lugares precisam concordar sobre isto: o app (onde a
 * pessoa escolhe), a API (que guarda `avatarColor`/`avatarIcon`) e o site público (que desenha
 * o mesmo avatar para quem publicou uma história). Com a lista duplicada, um ícone novo
 * escolhido no app viraria um quadrado vazio no site.
 */

/**
 * Conjunto pequeno e escolhido a dedo, não uma busca entre milhares de ícones - o pedido foi um
 * sistema "simples e leve", e o app usa só Ionicons em todo o resto.
 *
 * Os nomes são os do Ionicons: valem tanto como glifo da fonte (app) quanto como nome de
 * arquivo `.svg` (site). A lista mora num `.json` ao lado porque o build do site precisa lê-la
 * fora do TypeScript - o plugin do Vite roda em Node, que não carrega os `.ts` deste pacote.
 */
export const AVATAR_ICON_OPTIONS: readonly string[] = avatarIconNames;

export type AvatarIconName = string;

/** Ícone de quem ainda não escolheu um (perfil recém-criado). */
export const DEFAULT_AVATAR_ICON = 'person';

/**
 * Cores de reserva para quem não escolheu uma. É a mesma paleta que colore capítulos no Mapa da
 * História, escolhida para funcionar bem em fundo claro e escuro.
 */
export const AVATAR_FALLBACK_PALETTE = [
  '#4F8DF7',
  '#E4713C',
  '#39A867',
  '#B563D6',
  '#D8A22B',
  '#3FA9B8',
  '#D7566F',
  '#7C8CF0',
  '#6FA130',
  '#C4693F',
];

/**
 * Uma cor estável a partir de uma string (id ou nome de usuário).
 *
 * Determinística de propósito: a mesma pessoa tem sempre a mesma cor, no app e no site, sem
 * nada ser gravado no banco.
 */
export function avatarColorFromSeed(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return AVATAR_FALLBACK_PALETTE[Math.abs(hash) % AVATAR_FALLBACK_PALETTE.length];
}
