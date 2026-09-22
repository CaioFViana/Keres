/** @jest-environment node */
import en from '../../src/locales/en.json';
import pt from '../../src/locales/pt.json';

describe('excerpt highlight locale keys', () => {
  it('defines the anchor notice in English and Portuguese', () => {
    expect(en.excerpt_anchor_notice).toBeTruthy();
    expect(pt.excerpt_anchor_notice).toBeTruthy();
  });

  it('tells the author to widen the excerpt to pin the passage', () => {
    expect(en.excerpt_anchor_notice).toContain('first');
    expect(en.excerpt_anchor_notice).toContain('longer excerpt');
    expect(pt.excerpt_anchor_notice).toContain('primeira');
  });
});
