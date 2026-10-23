import en from '@/src/locales/en.json';
import pt from '@/src/locales/pt.json';

/** The Settings switch that lets the person add servers other than the official one, and the two hints it shows. */
describe('community servers locale keys', () => {
  it.each(['allow_community_servers', 'allow_community_servers_on', 'allow_community_servers_off'])(
    'writes %s in both languages, and translates it',
    (key) => {
      const english = en[key as keyof typeof en];
      const portuguese = pt[key as keyof typeof pt];

      expect(english).toBeTruthy();
      expect(portuguese).toBeTruthy();
      expect(portuguese).not.toBe(english);
    },
  );
});
