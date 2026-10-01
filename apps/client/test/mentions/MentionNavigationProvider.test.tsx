import { render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: jest.fn(),
}));
jest.mock('../../src/utils/entityNavigation', () => ({
  __esModule: true,
  navigateToEntityDetail: jest.fn(),
}));

import { useNavigation } from '@react-navigation/native';
import { MentionNavigationContext } from '../../src/mentions/MentionContext';
import { MentionNavigationProvider } from '../../src/mentions/MentionNavigationProvider';
import { navigateToEntityDetail } from '../../src/utils/entityNavigation';

describe('MentionNavigationProvider', () => {
  it('opens a mention through the drawer navigation object', async () => {
    const navigation = { marker: 'drawer-navigation' };
    (useNavigation as jest.Mock).mockReturnValue(navigation);
    let open: ((ref: { type: any; id: string }) => void) | undefined;
    const Probe = () => {
      open = React.useContext(MentionNavigationContext);
      return null;
    };
    await render(
      <MentionNavigationProvider>
        <Probe />
      </MentionNavigationProvider>,
    );

    open?.({ type: 'Location', id: 'wonderland' });

    expect(navigateToEntityDetail).toHaveBeenCalledWith(navigation, 'Location', 'wonderland');
  });
});
