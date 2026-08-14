import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { getHelpPage } from '../../src/help/repository';
import { entityPropertyClassifications, fieldSources } from '../../src/help/fieldSources';

const entitiesDirectory = join(__dirname, '../../../../packages/shared/entities');

const sharedEntityProperties = Object.fromEntries(
  readdirSync(entitiesDirectory)
    .filter((fileName) => fileName.endsWith('.ts'))
    .flatMap((fileName) => {
      const source = ts.createSourceFile(
        fileName,
        readFileSync(join(entitiesDirectory, fileName), 'utf8'),
        ts.ScriptTarget.Latest,
      );

      return source.statements
        .filter(ts.isInterfaceDeclaration)
        .filter((declaration) =>
          declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
        )
        .map((declaration) => [
          declaration.name.text,
          declaration.members
            .filter(ts.isPropertySignature)
            .map((member) => member.name.getText(source)),
        ]);
    }),
);

describe('help field coverage', () => {
  it('documents every declared visible field', () => {
    for (const [pageId, fields] of Object.entries(fieldSources)) {
      const page = getHelpPage(pageId, 'pt');
      const documented =
        page?.blocks
          .filter((block) => block.type === 'fields')
          .flatMap((block) => block.rows.map((row) => row.key)) ?? [];
      expect(documented).toEqual(expect.arrayContaining(fields));
    }
  });

  it('classifies every property in every shared entity exactly once', () => {
    expect(Object.keys(entityPropertyClassifications).sort()).toEqual(
      Object.keys(sharedEntityProperties).sort(),
    );

    for (const [entityName, properties] of Object.entries(sharedEntityProperties)) {
      const classification = entityPropertyClassifications[entityName];
      const classified = [...classification.documented, ...classification.invisible];

      expect(new Set(classified).size).toBe(classified.length);
      expect(classified.sort()).toEqual([...properties].sort());
    }
  });
});
