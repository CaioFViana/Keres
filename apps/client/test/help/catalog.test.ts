import * as fs from 'fs';
import * as path from 'path';
import { helpPageIds, helpSections } from '../../src/help/catalog';
import { helpRegistry } from '../../src/help/generated/registry';
import { getHelpPage } from '../../src/help/repository';

describe('help catalog', () => {
  it('has a page in both supported languages for every catalog entry', () => {
    for (const id of helpPageIds) {
      expect(getHelpPage(id, 'pt')).toBeDefined();
      expect(getHelpPage(id, 'en')).toBeDefined();
    }
  });
  it('has no content folder outside the catalog', () => {
    const contentDirectory = path.join(__dirname, '../../src/help/content');
    const contentPageIds = fs
      .readdirSync(contentDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(contentPageIds).toEqual([...helpPageIds].sort());
  });
  it('has a non-empty title and summary in each language', () => {
    for (const id of helpPageIds) {
      for (const language of ['pt', 'en']) {
        const page = getHelpPage(id, language);
        expect(page?.title.trim()).toBeTruthy();
        expect(page?.summary.trim()).toBeTruthy();
      }
    }
  });
  it('only links to pages that exist through see also', () => {
    for (const pageByLanguage of Object.values(helpRegistry)) {
      for (const page of Object.values(pageByLanguage)) {
        for (const block of page.blocks) {
          if (block.type === 'seeAlso') {
            for (const pageId of block.pages) {
              expect(helpPageIds).toContain(pageId);
            }
          }
        }
      }
    }
  });
  it('contains no duplicate entries', () => {
    expect(new Set(helpPageIds).size).toBe(helpPageIds.length);
    expect(helpSections).toHaveLength(9);
  });
  it('gives every section an icon for the help index', () => {
    expect(helpSections.every((section) => section.icon.length > 0)).toBe(true);
  });
  it('follows the reader-facing explanation sequence in both languages', () => {
    const headings = {
      pt: ['O que é', 'Para que serve', 'Como fazer', 'O que isso afeta em outros lugares'],
      en: ['What it is', 'What it is for', 'How to do it', 'What it affects elsewhere'],
    };

    for (const id of helpPageIds) {
      for (const [language, expected] of Object.entries(headings)) {
        const page = getHelpPage(id, language);
        const actual =
          page?.blocks.filter((block) => block.type === 'heading').map((block) => block.text) ?? [];
        expect(actual).toEqual(expect.arrayContaining(expected));
        expect(actual.indexOf(expected[0])).toBeLessThan(actual.indexOf(expected[1]));
        expect(actual.indexOf(expected[1])).toBeLessThan(actual.indexOf(expected[2]));
        expect(actual.indexOf(expected[2])).toBeLessThan(actual.indexOf(expected[3]));
        expect(page?.blocks.some((block) => block.type === 'example')).toBe(true);
        expect(page?.blocks.some((block) => block.type === 'steps')).toBe(true);
      }
    }
  });
});
