/** @jest-environment node */
import { getScreenGuide, screenGuides } from '../../src/guides/registry';

describe('screenGuides', () => {
  it('registers the pilot tours by route name', () => {
    expect(Object.keys(screenGuides).sort()).toEqual([
      'BoardCanvas',
      'BoardsStack',
      'CharactersStack',
      'CommentsStack',
      'EntityForm',
      'ExampleStories',
      'GalleryStack',
      'GlobalSearch',
      'ItemsStack',
      'LocationMap',
      'LocationsStack',
      'MainDashboard',
      'Manuscript',
      'MessageInbox',
      'NarrativeElementsStack',
      'NotesStack',
      'OperationLogStack',
      'PackList',
      'PlotsStack',
      'SceneDetail',
      'SceneEditor',
      'SceneMusic',
      'SketchCanvas',
      'SketchStack',
      'SongEditor',
      'SongStack',
      'SongTune',
      'StatList',
      'StoryAnalysis',
      'StoryArcList',
      'StoryCalendarList',
      'StoryEntityCount',
      'StoryForm',
      'StorySchemaList',
      'StorySelectionMain',
      'Suggestions',
      'TagsStack',
      'Vocabulary',
    ]);
    for (const [screenId, guide] of Object.entries(screenGuides)) {
      expect(guide.id).toBe(screenId);
    }
  });

  it('returns undefined for screens without a tour', () => {
    expect(getScreenGuide('Settings')).toBeUndefined();
    expect(getScreenGuide('ColdInstall')).toBeUndefined();
    expect(getScreenGuide('StoryFormEdit')).toBeUndefined();
  });

  it('keeps every guide within the article rules: 1-4 steps, one idea each', () => {
    for (const guide of Object.values(screenGuides)) {
      expect(guide.steps.length).toBeGreaterThanOrEqual(1);
      expect(guide.steps.length).toBeLessThanOrEqual(4);
      const stepIds = guide.steps.map((step) => step.id);
      expect(new Set(stepIds).size).toBe(stepIds.length);
      for (const step of guide.steps) {
        expect(step.titleKey).toBeTruthy();
        expect(step.bodyKey).toBeTruthy();
      }
      expect(guide.helpPageId).toBeTruthy();
    }
  });

  it('addresses drawer steps at the guide drawer, and other steps at screen regions or header actions', () => {
    for (const guide of Object.values(screenGuides)) {
      for (const step of guide.steps) {
        expect(step.anchors?.length ?? 0).toBeGreaterThan(0);
        for (const anchor of step.anchors ?? []) {
          if (step.drawerId) {
            expect(step.drawerId).toBe(guide.drawerId);
            expect(anchor.startsWith(`drawer:${guide.drawerId}:`)).toBe(true);
          } else {
            expect(/^(screen|header):/.test(anchor)).toBe(true);
          }
        }
      }
    }
  });

  it('skips the servers step of story selection in a serverless build', () => {
    const stepIds = (guides: typeof screenGuides) =>
      guides.StorySelectionMain.steps.map((step) => step.id);
    expect(stepIds(screenGuides)).toContain('drawer-servers');

    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    try {
      jest.isolateModules(() => {
        const serverless: typeof screenGuides = require('../../src/guides/registry').screenGuides;
        expect(stepIds(serverless)).toEqual(['stories', 'drawer-create', 'drawer-system']);
      });
    } finally {
      delete process.env.EXPO_PUBLIC_SERVERLESS;
    }
  });
});
