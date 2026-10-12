import en from '../../src/locales/en.json';
import pt from '../../src/locales/pt.json';

/** The English and Portuguese catalogues must speak the same keys: a key missing in one shows the raw key to users. */
describe('locale parity', () => {
  it('has the same keys in English and Portuguese', () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  });

  // The card on the server screen that sends a pending account back to its age check.
  it.each(['finish_age_verification', 'finish_age_verification_hint'])(
    'writes %s in both languages',
    (key) => {
      expect(en[key as keyof typeof en]).toBeTruthy();
      expect(pt[key as keyof typeof pt]).toBeTruthy();
      expect(pt[key as keyof typeof pt]).not.toBe(en[key as keyof typeof en]);
    },
  );
});
