import { getHelpPages } from '../../src/help/repository';

const forbidden =
  /\b(ULID|tombstone|polimórfic|FK|SQLite|Drizzle|JWT|endpoint|payload|isDeleted|deletedAt|storyId)\b/i;

describe('help language', () => {
  it('does not expose implementation terminology to readers', () => {
    for (const page of getHelpPages('pt')) {
      expect(JSON.stringify(page)).not.toMatch(forbidden);
    }
  });
});
