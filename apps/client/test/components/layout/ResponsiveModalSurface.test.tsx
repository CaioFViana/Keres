import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import ResponsiveModal from '../../../src/components/layout/ResponsiveModal/ResponsiveModal';

jest.mock('../../../src/theme', () => ({
  useTheme: () => ({ colors: { background: '#ffffff', surface: '#f0f0f0' } }),
}));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: true, isWide: false }),
}));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 0,
}));
jest.mock('../../../src/hooks/useKeyboardOverlap', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  return {
    __esModule: true,
    KeyboardHandledContext: React.createContext(false),
    useKeyboardOverlap: () => ({ ref: { current: null }, overlap: 0, onLayout: jest.fn() }),
  };
});

const surfaceStyle = async (props: Partial<React.ComponentProps<typeof ResponsiveModal>>) => {
  const screen = await render(
    <ResponsiveModal visible onClose={() => {}} {...props}>
      <Text>content</Text>
    </ResponsiveModal>,
  );
  return StyleSheet.flatten(screen.getByText('content').parent!.props.style);
};

describe('ResponsiveModal surface', () => {
  it('paints the screen colour with no padding unless asked to', async () => {
    const style = await surfaceStyle({});

    expect(style.backgroundColor).toBe('#ffffff');
    expect(style.padding).toBeUndefined();
    expect(style.paddingHorizontal).toBeUndefined();
    expect(style.borderRadius).toBe(12);
  });

  it('paints a raised surface one step above the screen', async () => {
    expect((await surfaceStyle({ tone: 'raised' })).backgroundColor).toBe('#f0f0f0');
  });

  it('offers the paddings as steps, with the sheet one shaped for a bottom sheet', async () => {
    expect((await surfaceStyle({ inset: 'compact' })).padding).toBe(12);
    expect((await surfaceStyle({ inset: 'regular' })).padding).toBe(16);
    expect((await surfaceStyle({ inset: 'roomy' })).padding).toBe(20);

    const sheet = await surfaceStyle({ inset: 'sheet', placement: 'bottom' });
    expect(sheet).toMatchObject({ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 });
  });

  it('rounds the top of a bottom sheet more than a centered dialog and squares its bottom', async () => {
    const sheet = await surfaceStyle({ placement: 'bottom' });
    expect(sheet).toMatchObject({
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    });
  });

  it('lets a modal still override any of it for a one-off', async () => {
    const style = await surfaceStyle({ inset: 'roomy', contentStyle: { padding: 4 } });
    expect(style.padding).toBe(4);
  });
});
