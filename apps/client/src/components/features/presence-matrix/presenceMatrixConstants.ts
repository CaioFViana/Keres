import { getDistinctSeriesColor } from '@keres/shared';

const SERIES_COLORS = [
  '#0B6E99',
  '#D64545',
  '#6D4BC3',
  '#C87800',
  '#16803C',
  '#B23A7A',
  '#655CDB',
  '#A55A18',
  '#007C83',
  '#A94141',
  '#4D749E',
  '#8D6B13',
];

export const MAX_VISIBLE_SERIES = 12;
export const seriesColor = (index: number, total: number) =>
  getDistinctSeriesColor(index, total, SERIES_COLORS);
