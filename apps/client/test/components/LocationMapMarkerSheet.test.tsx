import { MAX_LOCATION_MAP_NOTE_LENGTH, MAX_LOCATION_MAP_TITLE_LENGTH } from '@keres/shared';
import { render } from '@testing-library/react-native';
import React from 'react';
import LocationMapMarkerSheet, {
  LOCATION_MAP_MARKER_SHEET_INNER_PADDING,
  LOCATION_MAP_MARKER_SHEET_HORIZONTAL_INSET,
} from '../../src/components/features/location-maps/LocationMapMarkerSheet';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#111',
      text: '#fff',
      textSecondary: '#aaa',
      border: '#444',
      error: '#c33',
      primary: '#85f',
    },
  }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock(
  '../../src/components/layout/ResponsiveModal/ResponsiveModal',
  () =>
    function MockResponsiveModal({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    },
);
jest.mock('../../src/components/common/controls/Button/Button', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});
jest.mock('../../src/components/common/inputs/ColorPickerInput/ColorPickerInput', () => () => null);
jest.mock('../../src/components/common/inputs/IconPickerInput/IconPickerInput', () => () => null);
jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => ({
  SingleSelectPill: () => null,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

it('keeps inner padding around marker-sheet controls so input borders can render fully', async () => {
  const view = await render(
    <LocationMapMarkerSheet
      title="Gate"
      icon="flag"
      color="#8BC34A"
      destinationMapId="map-2"
      destinationName="Bonfire"
      destinationUnavailable={false}
      destinationOptions={[]}
      canEdit
      onChange={jest.fn()}
      onCreateDestination={jest.fn()}
      onOpenDestination={jest.fn()}
      onClearDestination={jest.fn()}
      onChangeDestination={jest.fn()}
      onRemove={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(
    view.getByTestId('location-map-marker-sheet-scroll').props.contentContainerStyle,
  ).toMatchObject({
    paddingHorizontal:
      LOCATION_MAP_MARKER_SHEET_HORIZONTAL_INSET + LOCATION_MAP_MARKER_SHEET_INNER_PADDING,
    paddingTop: LOCATION_MAP_MARKER_SHEET_INNER_PADDING,
  });
  expect(view.getByTestId('location-map-marker-destination-actions')).toHaveStyle({ gap: 8 });
});

it('clamps the title and note to the schema limits', async () => {
  const view = await render(
    <LocationMapMarkerSheet
      title="Gate"
      note="Knock twice"
      icon="flag"
      color="#8BC34A"
      destinationUnavailable={false}
      destinationOptions={[]}
      canEdit
      onChange={jest.fn()}
      onCreateDestination={jest.fn()}
      onOpenDestination={jest.fn()}
      onClearDestination={jest.fn()}
      onChangeDestination={jest.fn()}
      onRemove={jest.fn()}
      onClose={jest.fn()}
    />,
  );

  expect(view.getByDisplayValue('Gate').props.maxLength).toBe(MAX_LOCATION_MAP_TITLE_LENGTH);
  expect(view.getByDisplayValue('Knock twice').props.maxLength).toBe(MAX_LOCATION_MAP_NOTE_LENGTH);
});
