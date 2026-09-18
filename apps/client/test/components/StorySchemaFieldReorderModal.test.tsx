import { act, render } from '@testing-library/react-native';
import React from 'react';
import { StorySchemaFieldReorderModal } from '../../src/components/features/storyschema/StorySchemaFieldReorderModal/StorySchemaFieldReorderModal';
import type { StorySchemaFieldSelect } from '../../src/db/schema';

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockReorderProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/common/modals/ReorderModal/ReorderModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockReorderProps.current = props as Record<string, any>;
      return ReactActual.createElement(View, { testID: 'reorder-modal' });
    },
  };
});

const field = (overrides: Partial<StorySchemaFieldSelect> = {}): StorySchemaFieldSelect =>
  ({
    id: 'field-1',
    storyId: 'story-1',
    name: 'Mood',
    order: 0,
    ...overrides,
  }) as StorySchemaFieldSelect;

beforeEach(() => {
  mockReorderProps.current = null;
});

describe('StorySchemaFieldReorderModal', () => {
  const modalProps = () => ({
    isVisible: true,
    fields: [
      field({ id: 'field-2', name: 'Pace', order: 1 }),
      field({ id: 'field-1', name: 'Mood', order: 0 }),
    ],
    onClose: jest.fn(),
    onReorderConfirm: jest.fn().mockResolvedValue(undefined),
  });

  it('hands the fields over sorted, with their identity and label', async () => {
    const props = modalProps();
    const screen = await render(<StorySchemaFieldReorderModal {...props} />);

    expect(screen.getByTestId('reorder-modal')).toBeTruthy();
    expect(mockReorderProps.current?.isVisible).toBe(true);
    expect(mockReorderProps.current?.title).toBe('reorder_attributes_title');
    const items = mockReorderProps.current?.items as StorySchemaFieldSelect[];
    expect(items.map((item) => item.id)).toEqual(['field-1', 'field-2']);
    expect(mockReorderProps.current?.getId(items[0])).toBe('field-1');
    expect(mockReorderProps.current?.getLabel(items[0])).toBe('Mood');
    expect(mockReorderProps.current?.onClose).toBe(props.onClose);
  });

  it('confirms the new order as id-and-position pairs', async () => {
    const props = modalProps();
    await render(<StorySchemaFieldReorderModal {...props} />);

    const items = mockReorderProps.current?.items as StorySchemaFieldSelect[];
    await act(async () => {
      await mockReorderProps.current?.onReorderConfirm([...items].reverse());
    });

    expect(props.onReorderConfirm).toHaveBeenCalledWith([
      { id: 'field-2', order: 0 },
      { id: 'field-1', order: 1 },
    ]);
  });
});
