import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockGoBack = jest.fn();
let mockContentProps: {
  galleryId: string;
  onClose: () => void;
  showCloseButton?: boolean;
} | null = null;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({
      goBack: mockGoBack,
      getParent: () => ({ setOptions: jest.fn() }),
    }),
    useRoute: () => ({ params: { galleryId: 'gallery-1' } }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/screens/gallery/GalleryDetailContent', () => ({
  __esModule: true,
  default: (props: { galleryId: string; onClose: () => void; showCloseButton?: boolean }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    mockContentProps = props;
    return react.createElement(
      native.Text,
      { testID: 'gallery-content-stub', onPress: props.onClose },
      `gallery ${props.galleryId}`,
    );
  },
}));
jest.mock('../../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: () => undefined,
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import GalleryDetailScreen from '../../../src/screens/gallery/GalleryDetailScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockContentProps = null;
});

it('mounts the shared detail content for the routed gallery', async () => {
  const screen = await render(<GalleryDetailScreen />);

  expect(screen.getByTestId('gallery-content-stub')).toBeTruthy();
  expect(mockContentProps).toMatchObject({ galleryId: 'gallery-1', showCloseButton: true });
});

it('closes back through navigation', async () => {
  const screen = await render(<GalleryDetailScreen />);

  fireEvent.press(screen.getByTestId('gallery-content-stub'));

  expect(mockGoBack).toHaveBeenCalled();
});
