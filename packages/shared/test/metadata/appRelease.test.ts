import { describe, expect, it } from 'vitest';
import {
  APP_RELEASE,
  KERES_LICENSE,
  KERES_REPOSITORY_URL,
  THIRD_PARTY_CREDITS,
} from '../../metadata/AppRelease';
import { KERES_ICONS } from '../../metadata/keresIcons';

describe('appRelease', () => {
  it('identifies the release with a non-empty version, name and English phrase', () => {
    expect(APP_RELEASE.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/);
    expect(APP_RELEASE.name.trim()).toBeTruthy();
    expect(APP_RELEASE.phrase.trim()).toBeTruthy();
  });

  it('points at the repository and the MPL-2.0 license text', () => {
    expect(KERES_REPOSITORY_URL).toBe('https://github.com/CaioFViana/Keres');
    expect(KERES_LICENSE.shortName).toBe('MPL-2.0');
    expect(KERES_LICENSE.url).toMatch(/^https:\/\//);
  });

  it('credits every bundled third-party project with a license link', () => {
    expect(THIRD_PARTY_CREDITS.length).toBeGreaterThan(0);
    for (const credit of THIRD_PARTY_CREDITS) {
      expect(credit.project.trim()).toBeTruthy();
      expect(credit.projectUrl).toMatch(/^https?:\/\//);
      expect(credit.license.trim()).toBeTruthy();
      expect(credit.licenseUrl).toMatch(/^https:\/\//);
      expect(credit.authors.length).toBeGreaterThan(0);
      for (const author of credit.authors) {
        expect(author.name.trim()).toBeTruthy();
        expect(author.url).toMatch(/^https?:\/\//);
      }
    }
  });

  it('names exactly the authors the vendored game-icons pack carries', () => {
    const credit = THIRD_PARTY_CREDITS.find((entry) => entry.project === 'game-icons.net');
    expect(credit).toBeDefined();
    const credited = new Set(credit!.authors.map((author) => author.name));
    const vendored = new Set(KERES_ICONS.map((entry) => entry.author));
    expect(credited).toEqual(vendored);
  });
});
