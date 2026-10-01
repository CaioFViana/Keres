import { fireEvent, render } from '@testing-library/react-native';
import WelcomeLanguagePicker from '../../src/components/features/welcome/WelcomeLanguagePicker';

const mockOpen = jest.fn();
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { surface: '#eee', text: '#111', textSecondary: '#666' } }),
}));
// The list is the app's own; here it only has to hand over the trigger and open when asked.
jest.mock('@/src/components/common', () => ({
  SingleSelectPill: ({ trigger }: { trigger: (open: () => void) => React.ReactNode }) =>
    trigger(() => mockOpen()),
}));

const OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Português', value: 'pt' },
];

describe('WelcomeLanguagePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for the language until one is chosen', async () => {
    const view = await render(
      <WelcomeLanguagePicker
        options={OPTIONS}
        value={null}
        onValueChange={() => {}}
        placeholder="Select language"
      />,
    );
    expect(view.getByText('Select language')).toBeTruthy();
  });

  it('shows the language that was chosen', async () => {
    const view = await render(
      <WelcomeLanguagePicker
        options={OPTIONS}
        value="pt"
        onValueChange={() => {}}
        placeholder="Select language"
      />,
    );
    expect(view.getByText('Português')).toBeTruthy();
  });

  it('opens the list from its own quiet chip, not from the form field', async () => {
    const view = await render(
      <WelcomeLanguagePicker
        options={OPTIONS}
        value="en"
        onValueChange={() => {}}
        placeholder="Select language"
      />,
    );

    await fireEvent.press(view.getByTestId('welcome-language-trigger'));

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});
