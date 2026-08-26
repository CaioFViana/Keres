import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DetailField from '../../src/components/common/display/DetailField/DetailField';
import { MentionMatcherContext, MentionNavigationContext } from '../../src/mentions/MentionContext';
import {
  buildMentionMatcher,
  EMPTY_MENTION_MATCHER,
  type MentionMatcher,
  type MentionRef,
} from '../../src/utils/entityMentions';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { text: '#000', textSecondary: '#666', primary: '#00f' } }),
}));

/**
 * The half of auto-linking that `entityMentions.test.ts` cannot reach: that a matched run really
 * becomes tappable, that it asks to open the right entity, and - the part that matters most - that
 * a story with the feature off pays nothing and renders plain text.
 */

const ALICE: MentionRef = { type: 'Character', id: 'c1' };

const renderField = (
  value: string,
  matcher: MentionMatcher,
  openMention: (ref: MentionRef) => void = () => {},
  props: { mentionSourceId?: string } = {},
) =>
  // RNTL 14's `render` resolves to the queries; without the `await` every query is undefined.
  render(
    <MentionMatcherContext.Provider value={matcher}>
      <MentionNavigationContext.Provider value={openMention}>
        <DetailField label="Biography" value={value} {...props} />
      </MentionNavigationContext.Provider>
    </MentionMatcherContext.Provider>,
  );

const matcherWithAlice = () =>
  buildMentionMatcher([{ type: 'Character', id: 'c1', name: 'Alice' }]);

describe('DetailField mentions', () => {
  it('renders the value as plain text when the story has auto-linking off', async () => {
    const screen = await renderField('Alice went home.', EMPTY_MENTION_MATCHER);
    expect(screen.getByText('Alice went home.')).toBeTruthy();
  });

  it('renders plain text when nothing in the value matches', async () => {
    const screen = await renderField('Nobody was there.', matcherWithAlice());
    expect(screen.getByText('Nobody was there.')).toBeTruthy();
  });

  it('opens the mentioned entity when the run is pressed', async () => {
    const openMention = jest.fn();
    const screen = await renderField('Alice went home.', matcherWithAlice(), openMention);

    fireEvent.press(screen.getByText('Alice'));

    expect(openMention).toHaveBeenCalledWith(ALICE);
  });

  it('does not link the entity to itself', async () => {
    const screen = await renderField('Alice went home.', matcherWithAlice(), () => {}, {
      mentionSourceId: 'c1',
    });
    expect(screen.getByText('Alice went home.')).toBeTruthy();
    expect(screen.queryByText('Alice')).toBeNull();
  });

  it('leaves a whole-value link alone', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <MentionMatcherContext.Provider value={matcherWithAlice()}>
        <DetailField label="Mentor" value="Alice" onPress={onPress} />
      </MentionMatcherContext.Provider>,
    );

    fireEvent.press(screen.getByText('Alice'));

    expect(onPress).toHaveBeenCalled();
  });
});
