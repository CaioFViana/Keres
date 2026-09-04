import type { BoardPinEntity } from '../schemas/BoardSchemas';
import type { EntitySolverRow } from './contracts';

/** Compact, host-neutral projection shown by a Board card for a linked entity. */
export interface BoardEntitySummary {
  title: string;
  details: string | null;
}

const stringValue = (row: EntitySolverRow, field: string) => {
  const value = row[field];
  return typeof value === 'string' ? value : null;
};

/**
 * Gives Board cards one canonical projection of every pin-able entity. Hosts choose how to load
 * the row; this shared layer decides which of its fields are title and supporting context.
 */
export function summarizeBoardEntity(
  entityType: BoardPinEntity,
  row: EntitySolverRow,
): BoardEntitySummary {
  switch (entityType) {
    case 'Character':
    case 'Location':
    case 'Item':
    case 'WorldRule':
    case 'Board':
      return {
        title: stringValue(row, entityType === 'WorldRule' ? 'title' : 'name') ?? '',
        details: stringValue(row, 'description'),
      };
    case 'Scene':
      return { title: stringValue(row, 'name') ?? '', details: stringValue(row, 'summary') };
    case 'Chapter':
      return {
        title: stringValue(row, 'name') ?? '',
        details: stringValue(row, 'summary') ?? stringValue(row, 'extraNotes'),
      };
    case 'Gallery':
      return {
        title: stringValue(row, 'title') ?? stringValue(row, 'fileName') ?? '',
        details: stringValue(row, 'extraNotes'),
      };
    case 'Note':
      return { title: stringValue(row, 'title') ?? '', details: stringValue(row, 'body') };
  }
}
