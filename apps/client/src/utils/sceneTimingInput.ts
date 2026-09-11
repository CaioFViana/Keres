export const isTimingInput = (value: string) => /^-?\d*$/.test(value);
export const MAX_SCENE_TIMING = 2147483647;

export const parseTimingInput = (value: string): number | null => {
  if (!value || value === '-') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && Math.abs(parsed) <= MAX_SCENE_TIMING ? parsed : null;
};
