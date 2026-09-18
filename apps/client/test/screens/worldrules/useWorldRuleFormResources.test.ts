const mockUseDrizzle = jest.fn();
const mockCreateWorldRuleService = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/WorldRuleService', () => ({
  createWorldRuleService: (...args: unknown[]) => mockCreateWorldRuleService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useWorldRuleFormResources } from '../../../src/screens/worldrules/useWorldRuleFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'world-rule-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateWorldRuleService.mockReturnValue(fakeService);
});

it('creates the world-rule service once from the drizzle client', async () => {
  const view = await renderHook(() => useWorldRuleFormResources());

  expect(view.result.current.drizzleDb).toBe(fakeDb);
  expect(mockCreateWorldRuleService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.worldRuleServiceRef.current).toBe(fakeService);

  view.rerender({});
  expect(mockCreateWorldRuleService).toHaveBeenCalledTimes(1);
});
