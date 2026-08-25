import * as fs from 'fs';
import * as path from 'path';
import { storyDevicePageIds, storyDeviceSections } from '../../src/storyDevices/catalog';
import { storyDeviceRegistry } from '../../src/storyDevices/generated/registry';
import { getStoryDevicePage } from '../../src/storyDevices/repository';

describe('story devices catalog', () => {
  it('has a page in both supported languages for every catalog entry', () => {
    for (const id of storyDevicePageIds) {
      expect(getStoryDevicePage(id, 'pt')).toBeDefined();
      expect(getStoryDevicePage(id, 'en')).toBeDefined();
    }
  });
  it('has no content folder outside the catalog', () => {
    const contentDirectory = path.join(__dirname, '../../src/storyDevices/content');
    const contentPageIds = fs
      .readdirSync(contentDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(contentPageIds).toEqual([...storyDevicePageIds].sort());
  });
  it('has a non-empty title and summary in each language', () => {
    for (const id of storyDevicePageIds) {
      for (const language of ['pt', 'en']) {
        const page = getStoryDevicePage(id, language);
        expect(page?.title.trim()).toBeTruthy();
        expect(page?.summary.trim()).toBeTruthy();
      }
    }
  });
  it('only links to devices that exist through see also', () => {
    for (const pageByLanguage of Object.values(storyDeviceRegistry)) {
      for (const page of Object.values(pageByLanguage)) {
        for (const block of page.blocks) {
          if (block.type === 'seeAlso') {
            for (const pageId of block.pages) {
              expect(storyDevicePageIds).toContain(pageId);
            }
          }
        }
      }
    }
  });
  it('contains no duplicate entries', () => {
    expect(new Set(storyDevicePageIds).size).toBe(storyDevicePageIds.length);
    expect(storyDeviceSections).toHaveLength(7);
  });
  it('gives every section an icon for the index', () => {
    expect(storyDeviceSections.every((section) => section.icon.length > 0)).toBe(true);
  });
  it('carries the disclaimer on the opening page in both languages', () => {
    for (const language of ['pt', 'en']) {
      const page = getStoryDevicePage('how-to-use-devices', language);
      expect(page?.blocks.some((block) => block.type === 'callout')).toBe(true);
    }
  });
  it('follows the craft explanation sequence on every device page', () => {
    const headings = {
      pt: ['O que é', 'Quando usar', 'Armadilhas'],
      en: ['What it is', 'When to use it', 'Pitfalls'],
    };
    // The opening page explains the list itself and uses the Help's shape, not the entries'.
    const devicePageIds = storyDevicePageIds.filter((id) => id !== 'how-to-use-devices');

    for (const id of devicePageIds) {
      for (const [language, expected] of Object.entries(headings)) {
        const page = getStoryDevicePage(id, language);
        const actual =
          page?.blocks.filter((block) => block.type === 'heading').map((block) => block.text) ?? [];
        expect(actual).toEqual(expected);
        expect(page?.blocks.some((block) => block.type === 'example')).toBe(true);
        expect(page?.blocks.some((block) => block.type === 'seeAlso')).toBe(true);
      }
    }
  });
  it('keeps every device searchable by its name in the other language', () => {
    for (const id of storyDevicePageIds) {
      for (const language of ['pt', 'en']) {
        expect(getStoryDevicePage(id, language)?.keywords.length).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
