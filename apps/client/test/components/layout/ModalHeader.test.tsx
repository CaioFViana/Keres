import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../../src/theme', () => ({
  useTheme: () => ({ colors: { text: '#111111', textSecondary: '#666666' } }),
}));

import ModalHeader from '../../../src/components/layout/ModalHeader/ModalHeader';

describe('ModalHeader', () => {
  it('shows the title as a header, and a subtitle only when given', async () => {
    const plain = await render(<ModalHeader title="Export" />);
    expect(plain.getByText('Export').props.accessibilityRole).toBe('header');
    expect(plain.queryByText('Sketch')).toBeNull();

    const withSubtitle = await render(<ModalHeader title="Export" subtitle="Sketch" />);
    expect(withSubtitle.getByText('Sketch')).toBeTruthy();
  });

  it('closes from its button, which exists only when there is a way to close', async () => {
    const onClose = jest.fn();
    const closable = await render(<ModalHeader title="Export" onClose={onClose} />);
    await fireEvent.press(closable.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    const fixed = await render(<ModalHeader title="Export" />);
    expect(fixed.queryByLabelText('close')).toBeNull();
  });

  it('places its actions before the close button', async () => {
    const view = await render(
      <ModalHeader title="Export" onClose={() => {}} actions={<Text testID="extra">more</Text>} />,
    );
    expect(view.getByTestId('extra')).toBeTruthy();
  });

  it('lets a dialog name its close button, test it, disable it and colour the subtitle', async () => {
    const onClose = jest.fn();
    const view = await render(
      <ModalHeader
        title="Export"
        subtitle="Chapter"
        subtitleColor="#ff0000"
        onClose={onClose}
        closeLabel="cancel"
        closeTestID="export-close"
        closeDisabled
      />,
    );

    await fireEvent.press(view.getByTestId('export-close'));
    expect(onClose).not.toHaveBeenCalled();
    expect(view.getByLabelText('cancel').props.accessibilityState.disabled).toBe(true);
    expect(view.getByText('Chapter').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#ff0000' })]),
    );
  });
});
