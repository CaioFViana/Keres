const mockGetValuesForEntity = jest.fn();

jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useWorldRuleFormState } from '../../../src/screens/worldrules/useWorldRuleFormState';
import type { WorldRuleService } from '../../../src/services/storymanagement/WorldRuleService';

const createWorldRuleServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as WorldRuleService,
});
const drizzleDb = {} as never;

const renderState = async (options: {
  initialWorldRuleId?: string;
  storyId?: string;
  worldRule?: object | null;
  customFields?: StorySchemaField[];
  serviceRef?: { current: WorldRuleService | null };
}) => {
  const worldRuleServiceRef = options.serviceRef ?? createWorldRuleServiceRef();
  if (options.worldRule !== undefined && worldRuleServiceRef.current) {
    (worldRuleServiceRef.current.getById as jest.Mock).mockResolvedValue(options.worldRule);
  }
  const view = await renderHook(() =>
    useWorldRuleFormState({
      initialWorldRuleId: options.initialWorldRuleId,
      storyId: options.storyId ?? 'story-1',
      drizzleDb,
      worldRuleServiceRef,
      customFields: options.customFields ?? [],
    }),
  );
  return { worldRuleServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
});

it('starts a creation form in the rule section with custom defaults', async () => {
  const customFields = [{ id: 'field-1', defaultValue: 'fallback' }] as StorySchemaField[];
  const { worldRuleServiceRef, view } = await renderState({ customFields });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.section).toBe('rule');
  expect(view.result.current.customValues).toEqual({ 'field-1': 'fallback' });
  expect(worldRuleServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('retains a newly persisted world-rule id without refetching', async () => {
  const { worldRuleServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => {
    view.result.current.setTitle('Draft');
    view.result.current.retainPersistedWorldRuleId('rule-created');
  });

  expect(view.result.current.title).toBe('Draft');
  expect(view.result.current.currentWorldRuleId).toBe('rule-created');
  expect(view.result.current.isEditing).toBe(true);
  expect(worldRuleServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates every world-rule field and its stored custom values', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field-1', value: 'stored' }]);
  const { worldRuleServiceRef, view } = await renderState({
    initialWorldRuleId: 'rule-1',
    worldRule: {
      title: 'Iron tithe',
      description: 'Every forge pays',
      section: 'location',
      type: 'Law',
      category: 'Economy',
      behavior: 'Enforced',
      usability: 'Common',
      danger: 'Low',
      isFavorite: true,
      extraNotes: 'side',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(worldRuleServiceRef.current!.getById).toHaveBeenCalledWith('rule-1');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('rule-1');
  expect(view.result.current.title).toBe('Iron tithe');
  expect(view.result.current.section).toBe('location');
  expect(view.result.current.type).toBe('Law');
  expect(view.result.current.category).toBe('Economy');
  expect(view.result.current.behavior).toBe('Enforced');
  expect(view.result.current.usability).toBe('Common');
  expect(view.result.current.danger).toBe('Low');
  expect(view.result.current.customValues).toEqual({ 'field-1': 'stored' });
});

it('warns and finishes loading when the world rule is missing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ initialWorldRuleId: 'missing', worldRule: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(warn).toHaveBeenCalledWith('World rule not found:', 'missing');
  expect(view.result.current.title).toBe('');
  warn.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({ serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
});

it('logs and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const worldRuleServiceRef = createWorldRuleServiceRef();
  (worldRuleServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    useWorldRuleFormState({
      initialWorldRuleId: 'rule-1',
      storyId: 'story-1',
      drizzleDb,
      worldRuleServiceRef,
      customFields: [],
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load world rule:', expect.any(Error));
  error.mockRestore();
});
