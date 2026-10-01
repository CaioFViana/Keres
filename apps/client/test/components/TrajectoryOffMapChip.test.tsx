import { render } from '@testing-library/react-native';
import TrajectoryOffMapChip from '../../src/components/features/location-maps/TrajectoryOffMapChip';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { surface: '#111', border: '#444', textSecondary: '#aaa' } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { count?: number }) => `${key}:${params?.count}`,
  }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('TrajectoryOffMapChip', () => {
  it('stays hidden without off-map stops and counts otherwise', async () => {
    const empty = await render(<TrajectoryOffMapChip count={0} />);
    expect(empty.queryByTestId('trajectory-off-map-chip')).toBeNull();

    const view = await render(<TrajectoryOffMapChip count={3} />);
    expect(view.getByTestId('trajectory-off-map-chip')).toBeTruthy();
    expect(view.getByText('trajectory_off_map_other:3')).toBeTruthy();

    const single = await render(<TrajectoryOffMapChip count={1} />);
    expect(single.getByText('trajectory_off_map_one:1')).toBeTruthy();
  });
});
