import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../src/locales/en.json';
import pt from '../../src/locales/pt.json';
import { getHelpPages } from '../../src/help/repository';

/**
 * Help that still names menus the app no longer has.
 *
 * The drawer has been reorganised several times - chapters and scenes became Narrative Elements,
 * and the story schema, suggestions and stats became Customization - and each time the help kept
 * sending readers to an entry that had stopped existing. Nothing caught it, because a `path` block
 * is just an array of strings and prose is just prose.
 *
 * This reads the drawer's own labels out of the navigator and checks both against them. It is
 * deliberately narrow: only the segment *directly after* the story menu is verified, because that
 * is the one naming a drawer entry. Everything deeper is a screen's own control, which this cannot
 * see and should not guess at.
 */

const STORY_MENU = { en: 'Story menu', pt: 'Menu da história' };
const TRANSLATIONS: Record<string, Record<string, string>> = { en, pt };

/** Every label the drawer actually renders, in the given language. */
function drawerLabels(language: string): Set<string> {
  const source = readFileSync(join(__dirname, '../../src/navigation/MainSystemStack.tsx'), 'utf8');
  const drawer = source.slice(source.indexOf('<Drawer.Navigator'));
  const parts = drawer.split(/<Drawer\.Screen\s+name="[^"]+"/);
  const labels = new Set<string>();
  for (const body of parts.slice(1)) {
    const head = body.slice(0, 600);
    const key =
      /drawerLabel: t\('([^']+)'\)/.exec(head)?.[1] ?? /title: t\('([^']+)'\)/.exec(head)?.[1];
    const label = key ? TRANSLATIONS[language][key] : undefined;
    if (label) labels.add(label);
  }

  // These two labels are intentionally vocabulary-aware in the drawer.  With no story-specific
  // vocabulary selected, `term()` renders the translated defaults below; help authored for the
  // default interface must therefore continue to find them.
  for (const key of ['characters', 'locations', 'items', 'world_rules']) {
    const label = TRANSLATIONS[language][key];
    if (label) labels.add(label);
  }
  return labels;
}

/** The entry each page claims lives in the story menu, from `path` blocks and from prose. */
function claimedEntries(language: string): { page: string; entry: string }[] {
  const menu = STORY_MENU[language as 'en' | 'pt'];
  const claims: { page: string; entry: string }[] = [];

  for (const page of getHelpPages(language)) {
    for (const block of page.blocks) {
      if (block.type === 'path' && block.segments[0] === menu && block.segments[1]) {
        claims.push({ page: page.id, entry: block.segments[1] });
      }
    }
    /*
     * Prose spells the same journey as "Story menu › Notes". The separator is the only reliable
     * marker: "open Notes in the Story menu" is the same instruction written backwards, and
     * matching that would need to guess where the entry name ends.
     *
     * What follows the separator runs into the rest of the sentence, so the claim is the opening of
     * it and the check below asks whether it *starts with* a real entry rather than equals one.
     */
    for (const match of JSON.stringify(page.blocks).matchAll(
      new RegExp(`${menu} › ([^.,;"›]{1,60})`, 'g'),
    )) {
      claims.push({ page: page.id, entry: match[1].trim() });
    }
  }
  return claims;
}

describe('help navigation paths', () => {
  it.each(['en', 'pt'])('only sends the reader to drawer entries that exist (%s)', (language) => {
    const labels = drawerLabels(language);
    /*
     * Case is not checked. The help writes menu names in sentence case inside prose and the drawer
     * renders them in title case; a reader is not misled by that, and enforcing it would bury the
     * defect this exists for - an entry that is simply not there - under cosmetic noise.
     */
    const names = [...labels].map((label) => label.toLowerCase());
    const stale = claimedEntries(language)
      .filter((claim) => !names.some((name) => claim.entry.toLowerCase().startsWith(name)))
      .map((claim) => `${claim.page}: "${claim.entry}"`);

    expect([...new Set(stale)].sort()).toEqual([]);
  });

  it('finds the drawer labels at all, so an empty set cannot pass the check above', () => {
    expect(drawerLabels('en')).toContain('Narrative Elements');
    expect(drawerLabels('en')).toContain('Customization');
    expect(drawerLabels('pt')).toContain('Personalização');
  });
});
