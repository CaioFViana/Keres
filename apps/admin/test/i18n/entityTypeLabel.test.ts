import { describe, expect, it } from 'vitest';
import { OperationLogEntityType } from '@keres/shared/metadata/OperationLogEntityType';
import i18n from '@/i18n';
import { entityTypeLabel } from '@/i18n/entityTypeLabel';

const t = (language: string) => (key: string, options?: Record<string, unknown>) =>
  i18n.getFixedT(language, 'admin')(key, options) as string;

describe('entityTypeLabel', () => {
  it('names a kind of story data in the language asked, not as the code does', () => {
    expect(entityTypeLabel(t('pt'), 'AttributeValue')).toBe('Valor de campo personalizado');
    expect(entityTypeLabel(t('en'), 'AttributeValue')).toBe('Custom field value');
  });

  it('has a name in both languages for every kind of data the server holds', () => {
    for (const type of Object.values(OperationLogEntityType)) {
      for (const lng of ['pt', 'en']) {
        expect([type, lng, i18n.exists(`entityTypes.${type}`, { lng, ns: 'admin' })]).toEqual([
          type,
          lng,
          true,
        ]);
      }
    }
  });

  it('shows a kind it has no name for as it came', () => {
    expect(entityTypeLabel(t('pt'), 'SomethingNew')).toBe('SomethingNew');
  });
});
