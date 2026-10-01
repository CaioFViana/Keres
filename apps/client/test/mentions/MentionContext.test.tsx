import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  MentionBacklinksContext,
  MentionMatcherContext,
  MentionNavigationContext,
  useMentionBacklinks,
  useMentions,
} from '../../src/mentions/MentionContext';
import { EMPTY_MENTION_MATCHER } from '../../src/utils/entityMentions';

describe('useMentions', () => {
  it('defaults to an empty matcher and a no-op opener outside providers', async () => {
    const Probe = () => {
      const { matcher, openMention } = useMentions();
      openMention({ type: 'Character', id: 'alice' });
      return <Text testID="empty">{String(matcher.isEmpty)}</Text>;
    };
    const screen = await render(<Probe />);
    expect(screen.getByTestId('empty').props.children).toBe('true');
  });

  it('returns the provided matcher and opener', async () => {
    const matcher = { ...EMPTY_MENTION_MATCHER, isEmpty: false };
    const openMention = jest.fn();
    const Probe = () => {
      const mentions = useMentions();
      return (
        <Text testID="wired">{`${mentions.matcher === matcher}:${mentions.openMention === openMention}`}</Text>
      );
    };
    const screen = await render(
      <MentionMatcherContext.Provider value={matcher}>
        <MentionNavigationContext.Provider value={openMention}>
          <Probe />
        </MentionNavigationContext.Provider>
      </MentionMatcherContext.Provider>,
    );
    expect(screen.getByTestId('wired').props.children).toBe('true:true');
  });
});

describe('useMentionBacklinks', () => {
  it('returns an empty list when the index has no entry', async () => {
    const Probe = () => {
      const backlinks = useMentionBacklinks('Character', 'alice');
      return <Text testID="count">{String(backlinks.length)}</Text>;
    };
    const screen = await render(<Probe />);
    expect(screen.getByTestId('count').props.children).toBe('0');
  });

  it('returns the indexed backlinks for the requested entity', async () => {
    const entry = {
      source: { type: 'Scene', id: 'scene-1', name: 'A beginning' },
      fields: ['summary'],
      mentionCount: 2,
      excerpt: 'Alice arrives.',
    } as any;
    const index = new Map([['Character:alice', [entry]]]);
    const Probe = () => {
      const backlinks = useMentionBacklinks('Character', 'alice');
      const missing = useMentionBacklinks('Character', 'bob');
      return <Text testID="found">{`${backlinks.length}:${missing.length}`}</Text>;
    };
    const screen = await render(
      <MentionBacklinksContext.Provider value={index}>
        <Probe />
      </MentionBacklinksContext.Provider>,
    );
    expect(screen.getByTestId('found').props.children).toBe('1:0');
  });
});
