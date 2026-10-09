import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import HighlightedText, {
  SearchHighlightContext,
} from '../../../src/components/common/lists/SearchHighlight/SearchHighlight';
import ListItemTitle from '../../../src/components/features/list-items/ListItemTitle';

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: { primaryContainer: '#ddddff', onPrimaryContainer: '#000088' },
    }),
  };
});

describe('HighlightedText', () => {
  it('is the plain text when nothing is searched', async () => {
    const view = await render(
      <Text>
        <HighlightedText text="The White Rabbit" />
      </Text>,
    );

    expect(view.getByText('The White Rabbit')).toBeTruthy();
  });

  it('marks the searched term inside the text', async () => {
    const view = await render(
      <SearchHighlightContext.Provider value="rab">
        <Text testID="title">
          <HighlightedText text="The White Rabbit" />
        </Text>
      </SearchHighlightContext.Provider>,
    );

    const mark = view.getByText('Rab');
    expect(mark.props.style).toEqual({ backgroundColor: '#ddddff', color: '#000088' });
    expect(view.getByTestId('title')).toHaveTextContent('The White Rabbit');
  });

  it('leaves text alone that does not contain the term', async () => {
    const view = await render(
      <SearchHighlightContext.Provider value="queen">
        <Text>
          <HighlightedText text="The Mad Hatter" />
        </Text>
      </SearchHighlightContext.Provider>,
    );

    expect(view.getByText('The Mad Hatter')).toBeTruthy();
  });
});

describe('ListItemTitle inside a searched list', () => {
  it('shows why the row matched', async () => {
    const view = await render(
      <SearchHighlightContext.Provider value="hat">
        <ListItemTitle text="The Mad Hatter" headerLeftStyle={{}} nameStyle={{}} />
      </SearchHighlightContext.Provider>,
    );

    expect(view.getByText('Hat')).toBeTruthy();
    expect(view.getByText('The Mad Hatter', { exact: false })).toBeTruthy();
  });
});
