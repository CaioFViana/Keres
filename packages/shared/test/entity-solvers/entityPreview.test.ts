import { describe, expect, it } from 'vitest';
import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import {
  summarizeBoardEntity,
  summarizeEntityPreview,
} from '../../entity-solvers/boardEntitySummary';

describe('entity previews', () => {
  it('keeps a chapter summary and notes available to a list', () => {
    expect(
      summarizeEntityPreview(OperationLogEntityType.Chapter, {
        name: 'Prólogo',
        summary: 'A chegada.',
        extraNotes: 'Revisar o ritmo.',
      }),
    ).toEqual({
      title: 'Prólogo',
      primaryDetail: 'A chegada.',
      secondaryDetail: 'Revisar o ritmo.',
    });
  });

  it('keeps the existing board fallback to notes when a chapter has no summary', () => {
    expect(
      summarizeBoardEntity('Chapter', {
        name: 'Prólogo',
        summary: null,
        extraNotes: 'Revisar o ritmo.',
      }),
    ).toEqual({ title: 'Prólogo', details: 'Revisar o ritmo.' });
  });

  it('uses the entity-owned preview for a list-only Plot', () => {
    expect(
      summarizeEntityPreview(OperationLogEntityType.Plot, {
        name: 'Conspiração',
        details: 'A trama política.',
      }),
    ).toEqual({
      title: 'Conspiração',
      primaryDetail: 'A trama política.',
      secondaryDetail: null,
    });
  });
});
