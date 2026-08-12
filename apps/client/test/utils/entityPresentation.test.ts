import { globalSearchFieldConfig } from '@keres/shared/metadata/globalSearchFields';
import { CRITICALITY_ICONS, CRITICALITY_LEVELS, DEFAULT_CRITICALITY } from '../../src/utils/commentCriticality';
import { ENTITY_TYPE_ICONS } from '../../src/utils/entityTypeIcons';

/**
 * As duas tabelas abaixo são pequenas, mas cada uma tem um invariante que só quebra em tela:
 * um tipo de entidade sem ícone aparece vazio na busca global, e um nível de criticidade sem
 * ícone deixa o comentário sem o sinal que distingue "ideia solta" de "corrigir agora".
 */
describe('ENTITY_TYPE_ICONS', () => {
  it('covers every entity type the global search can return', () => {
    const searchable = Object.keys(globalSearchFieldConfig).sort();

    expect(Object.keys(ENTITY_TYPE_ICONS).sort()).toEqual(searchable);
  });

  it.each(Object.keys(ENTITY_TYPE_ICONS))('gives %s a non-empty icon name', (entityType) => {
    const icon = ENTITY_TYPE_ICONS[entityType as keyof typeof ENTITY_TYPE_ICONS];

    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });

  it('does not reuse the same icon for two entity types', () => {
    const icons = Object.values(ENTITY_TYPE_ICONS);

    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe('comment criticality', () => {
  it('runs from 1 to 5, with no gaps', () => {
    expect([...CRITICALITY_LEVELS]).toEqual([1, 2, 3, 4, 5]);
  });

  it.each(CRITICALITY_LEVELS)('gives level %s an icon', (level) => {
    expect(typeof CRITICALITY_ICONS[level]).toBe('string');
    expect(CRITICALITY_ICONS[level].length).toBeGreaterThan(0);
  });

  it('gives each level its own icon, since the icon is the only thing that changes', () => {
    const icons = CRITICALITY_LEVELS.map((level) => CRITICALITY_ICONS[level]);

    expect(new Set(icons).size).toBe(icons.length);
  });

  it('defaults to the middle of the scale', () => {
    expect(DEFAULT_CRITICALITY).toBe(3);
    expect(CRITICALITY_LEVELS).toContain(DEFAULT_CRITICALITY);
  });
});
