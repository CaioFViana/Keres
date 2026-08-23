/**
 * As funções de cor moram em `@keres/shared` desde que o painel admin passou a usar as mesmas
 * paletas do app: escolher o texto legível sobre uma cor é a mesma conta nos dois lados, e
 * duplicá-la faria as duas versões divergirem. Reexportado aqui para os imports do app não
 * precisarem mudar.
 */
export {
  getColorLuminance,
  getDistinctSeriesColor,
  getContrastTextColor,
  isColorLight,
  isValidHexColor,
} from '@keres/shared';
