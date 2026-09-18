import { act, render } from '@testing-library/react-native';
import React from 'react';
import PresenceMatrixViewerOverlay from '../../src/components/features/presence-matrix/PresenceMatrixViewerOverlay';

let mockRequest: unknown = null;
const mockClose = jest.fn();
jest.mock('../../src/state/presenceMatrixViewerStore', () => ({
  __esModule: true,
  usePresenceMatrixViewerStore: (selector: (state: unknown) => unknown) =>
    selector({ request: mockRequest, close: mockClose }),
}));

jest.mock('../../src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      visible,
      onRequestClose,
      children,
    }: {
      visible: boolean;
      onRequestClose: () => void;
      children: React.ReactNode;
    }) =>
      visible
        ? ReactActual.createElement(View, { testID: 'fs-modal', onRequestClose }, children)
        : null,
  };
});

const mockContentProps = { current: null as Record<string, any> | null };
jest.mock('../../src/components/features/presence-matrix/PresenceMatrixViewerContent', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockContentProps.current = props as Record<string, any>;
      return ReactActual.createElement(View, { testID: 'viewer-content' });
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequest = null;
  mockContentProps.current = null;
});

describe('PresenceMatrixViewerOverlay', () => {
  it('stays hidden without a request', async () => {
    const screen = await render(<PresenceMatrixViewerOverlay />);

    expect(screen.queryByTestId('fs-modal')).toBeNull();
    expect(screen.queryByTestId('viewer-content')).toBeNull();
  });

  it('shows the requested character matrix', async () => {
    mockRequest = { kind: 'character', characterId: 'c-1' };
    const screen = await render(<PresenceMatrixViewerOverlay />);

    expect(screen.getByTestId('viewer-content')).toBeTruthy();
    expect(mockContentProps.current?.request).toEqual({ kind: 'character', characterId: 'c-1' });
  });

  it('shows the requested item matrix', async () => {
    mockRequest = { kind: 'item', itemId: 'i-1' };
    const screen = await render(<PresenceMatrixViewerOverlay />);

    expect(screen.getByTestId('viewer-content')).toBeTruthy();
    expect(mockContentProps.current?.request).toEqual({ kind: 'item', itemId: 'i-1' });
  });

  it('closes the viewer from the modal', async () => {
    mockRequest = { kind: 'character' };
    const screen = await render(<PresenceMatrixViewerOverlay />);

    await act(async () => {
      screen.getByTestId('fs-modal').props.onRequestClose();
    });

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockContentProps.current?.onClose).toBe(mockClose);
  });
});
