import { cleanup, render } from '@testing-library/react-native';
import ArcMediumChanges from '../../src/components/features/arcs/ArcMediumChanges';

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const base: Record<string, string> = { arc: 'Arc', chapter: 'Chapter' };
      if (key in base) return base[key];
      return options ? `${key}:${Object.values(options).join('|')}` : key;
    },
  }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { text: '#111', textSecondary: '#555' } }),
}));

afterEach(cleanup);

describe('ArcMediumChanges', () => {
  it('names the words a screenplay renames, from the table the app resolves them with', async () => {
    const view = await render(<ArcMediumChanges medium="screenplay" language="en" />);

    expect(view.getByTestId('arc-medium-terms').props.children).toBe(
      'arc_medium_changes_words:arc_medium_changes_term:Arc|Script; arc_medium_changes_term:Chapter|Act',
    );
  });

  it('speaks the words of the language of the interface', async () => {
    const view = await render(<ArcMediumChanges medium="campaign" language="pt" />);

    expect(JSON.stringify(view.getByTestId('arc-medium-terms').props.children)).toContain('Módulo');
    expect(JSON.stringify(view.getByTestId('arc-medium-terms').props.children)).toContain('Sessão');
  });

  it('names only the Arc for a comic, which leaves chapters alone', async () => {
    const view = await render(<ArcMediumChanges medium="comic" language="en" />);
    const text = JSON.stringify(view.getByTestId('arc-medium-terms').props.children);

    expect(text).toContain('Issue');
    expect(text).not.toContain('Chapter|');
  });

  it('says plainly that a plain work renames nothing', async () => {
    const view = await render(<ArcMediumChanges medium="generic" language="en" />);

    expect(view.getByTestId('arc-medium-terms').props.children).toBe('arc_medium_changes_no_words');
    expect(view.getByTestId('arc-medium-effects').props.children).toBe(
      'arc_medium_generic_changes',
    );
  });

  it('says what else each form turns on', async () => {
    for (const medium of ['screenplay', 'comic', 'storyboard', 'campaign'] as const) {
      const view = await render(<ArcMediumChanges medium={medium} language="en" />);
      expect(view.getByTestId('arc-medium-effects').props.children).toBe(
        `arc_medium_${medium}_changes`,
      );
      await view.unmount();
    }
  });

  it('leaves the list of what else out when only the words matter', async () => {
    const view = await render(<ArcMediumChanges medium="screenplay" language="en" termsOnly />);

    expect(view.queryByTestId('arc-medium-effects')).toBeNull();
    expect(view.getByTestId('arc-medium-terms')).toBeTruthy();
  });

  it('takes a form it does not know for a plain one', async () => {
    const view = await render(<ArcMediumChanges medium={'mystery' as never} language="en" />);

    expect(view.getByTestId('arc-medium-effects').props.children).toBe(
      'arc_medium_generic_changes',
    );
  });
});
