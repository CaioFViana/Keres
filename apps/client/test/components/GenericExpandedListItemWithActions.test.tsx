import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import GenericExpandedListItemWithActions from '../../src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      surface: '#f5f5f5',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

describe('GenericExpandedListItemWithActions', () => {
  it('renders the shared appearance icon when an entity type is supplied', async () => {
    const screen = await render(
      <GenericExpandedListItemWithActions
        item={{ id: 'character-1' }}
        entityType="Character"
        renderHeaderContent={() => <Text>Lyra</Text>}
        renderExpandedContent={() => <Text>Explorer</Text>}
      />,
    );

    expect(screen.getByTestId('entity-list-item-icon')).toBeTruthy();
  });
});
