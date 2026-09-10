import { graphSeriesColor } from '@keres/shared';

export const MAX_VISIBLE_SERIES = 12;
export const seriesColor = (index: number, total: number) => graphSeriesColor(index, total);
