const mockAlert = jest.fn();

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useStatFormActions } from '../../../src/screens/stats/useStatFormActions';
import type { StatFormState } from '../../../src/screens/stats/useStatFormState';
import type { StatService } from '../../../src/services/storymanagement/StatService';

const createState = (overrides: Partial<StatFormState> = {}): StatFormState =>
  ({
    statId: undefined,
    name: 'Strength',
    setName: jest.fn(),
    isPrimary: true,
    setIsPrimary: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as StatFormState;

const statService = {
  createStat: jest.fn(),
  updateStat: jest.fn(),
} as unknown as StatService;
const navigation = {
  goBack: jest.fn(),
};

const renderActions = (state = createState()) =>
  renderHook(() =>
    useStatFormActions({
      state,
      statServiceRef: { current: statService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      statsCount: 2,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  (statService.createStat as jest.Mock).mockResolvedValue({ id: 'stat-1' });
  (statService.updateStat as jest.Mock).mockResolvedValue(undefined);
});

it('rejects an unnamed stat before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'stat_name_required');
  expect(statService.createStat).not.toHaveBeenCalled();
});

it('creates a stat with the next order and navigates back', async () => {
  const view = await renderActions();

  await act(async () => view.result.current.handleSave());

  expect(statService.createStat).toHaveBeenCalledWith('user-1', {
    storyId: 'story-1',
    name: 'Strength',
    isPrimary: true,
    order: 2,
  });
  expect(navigation.goBack).toHaveBeenCalled();
});

it('updates an existing stat and navigates back', async () => {
  const view = await renderActions(
    createState({ statId: 'stat-1', isEditing: true, isPrimary: false }),
  );

  await act(async () => view.result.current.handleSave());

  expect(statService.updateStat).toHaveBeenCalledWith('user-1', 'stat-1', {
    name: 'Strength',
    isPrimary: false,
  });
  expect(navigation.goBack).toHaveBeenCalled();
});

it('surfaces the thrown message when save fails', async () => {
  (statService.createStat as jest.Mock).mockRejectedValueOnce(new Error('too many primary'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const view = await renderActions();

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'too many primary');
  expect(navigation.goBack).not.toHaveBeenCalled();
  log.mockRestore();
});
