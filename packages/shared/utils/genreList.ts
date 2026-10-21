/**
 * `stories.genre` is free text in the app - whoever writes separates it however they like.
 * Splitting on comma, slash and semicolon covers what people actually type without inventing a new
 * rule. The showcase lists these as chips and filters by each one, so both sides read it the same way.
 *
 * It is not translated: it is content written by the story's author.
 */
export function genreList(genre: string | null | undefined): string[] {
  if (!genre) return [];
  return genre
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
