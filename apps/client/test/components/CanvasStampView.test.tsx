import { render } from '@testing-library/react-native';
import CanvasStampView from '../../src/components/features/graphs/CanvasOverlay/CanvasStampView';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { surface: '#111', text: '#fff', primary: '#85f', background: '#000' },
  }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID="stamp-glyph">{name}</Text>,
  };
});

describe('CanvasStampView', () => {
  it.each([
    ['flag', 'flag'],
    ['ion:flag', 'flag'],
    ['keres:castle', 'location'],
    ['fa:flag', 'location'],
    ['', 'location'],
  ])('resolves the icon %p to the glyph %p', async (icon, glyph) => {
    const view = await render(
      <CanvasStampView stamp={{ id: 'ov-1', kind: 'stamp', x: 10, y: 20, icon }} />,
    );
    expect(view.getByTestId('stamp-glyph').props.children).toBe(glyph);
  });

  it('renders the stamp label', async () => {
    const view = await render(
      <CanvasStampView
        stamp={{ id: 'ov-1', kind: 'stamp', x: 10, y: 20, icon: 'flag', label: 'Keep' }}
      />,
    );
    expect(view.getByText('Keep')).toBeTruthy();
  });
});
