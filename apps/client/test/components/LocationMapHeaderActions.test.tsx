import { fireEvent, render } from '@testing-library/react-native';
import LocationMapHeaderActions from '../../src/components/features/location-maps/LocationMapHeaderActions';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { primary: '#9b5cff', text: '#fff', textSecondary: '#888' } }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('LocationMapHeaderActions', () => {
  it('keeps both actions unavailable until a map changes', async () => {
    const onRevert = jest.fn();
    const onSave = jest.fn();
    const view = await render(
      <LocationMapHeaderActions dirty={false} saving={false} onRevert={onRevert} onSave={onSave} />,
    );

    await fireEvent.press(view.getByTestId('location-map-revert'));
    await fireEvent.press(view.getByTestId('location-map-save'));
    expect(onRevert).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps only the document actions, the mode toggles live in the tools bar', async () => {
    const view = await render(
      <LocationMapHeaderActions
        dirty
        saving={false}
        onRevert={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(view.getByTestId('location-map-revert')).toBeTruthy();
    expect(view.getByTestId('location-map-save')).toBeTruthy();
    expect(view.queryByLabelText('graph_connection_mode')).toBeNull();
    expect(view.queryByLabelText('trajectory_show')).toBeNull();
    expect(view.queryByLabelText('objects_edit')).toBeNull();
    expect(view.queryByLabelText('board_edit_layout')).toBeNull();
  });

  it('routes revert and save separately, while saving keeps the save action disabled', async () => {
    const onRevert = jest.fn();
    const onSave = jest.fn();
    const view = await render(
      <LocationMapHeaderActions dirty saving={false} onRevert={onRevert} onSave={onSave} />,
    );

    await fireEvent.press(view.getByTestId('location-map-revert'));
    await fireEvent.press(view.getByTestId('location-map-save'));
    expect(onRevert).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);

    await view.rerender(
      <LocationMapHeaderActions dirty saving onRevert={onRevert} onSave={onSave} />,
    );
    await fireEvent.press(view.getByTestId('location-map-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
