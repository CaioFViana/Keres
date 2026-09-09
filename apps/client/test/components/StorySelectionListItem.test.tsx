/**
 * @jest-environment jsdom
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { Story } from '@keres/shared/entities/Story';
import StorySelectionListItem from '../../src/components/features/list-items/StorySelectionListItem';

jest.mock('../../src/theme/useThemeColors', () => ({
  useThemeColors: () => ({
    primary: '#B58500',
    primaryContainer: '#FFE08A',
    onPrimaryContainer: '#241A00',
    text: '#171C22',
    textSecondary: '#52606E',
    card: '#E7F1FA',
    border: '#BFCBDA',
    star: '#8A6500',
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const story = {
  id: 'story-1',
  title: 'Sea Chronicle',
  type: 'linear',
  description: 'A long description that should be shown without a hard character cut.',
  genre: 'Fantasy',
  serverId: 'server-1',
  isFavorite: false,
  theme: 'seaOfStars',
} as Story;

describe('StorySelectionListItem', () => {
  it('opens the story from the card and keeps actions separate', async () => {
    const onSelectStory = jest.fn();
    const onToggleFavorite = jest.fn();
    const onEditStory = jest.fn();

    const view = await render(
      <StorySelectionListItem
        story={story}
        serverName="Local Atlas"
        onSelectStory={onSelectStory}
        onToggleFavorite={onToggleFavorite}
        onEditStory={onEditStory}
      />,
    );

    expect(view.getByText('Sea Chronicle')).toBeTruthy();
    expect(view.getByText('linear')).toBeTruthy();
    expect(view.getByText('Fantasy · Local Atlas')).toBeTruthy();
    expect(
      view.getByText('A long description that should be shown without a hard character cut.'),
    ).toBeTruthy();

    fireEvent.press(view.getByLabelText('Sea Chronicle'));
    expect(onSelectStory).toHaveBeenCalledWith(story);

    fireEvent.press(view.getByLabelText('favorite'));
    expect(onToggleFavorite).toHaveBeenCalledWith('story-1', false);
    expect(onSelectStory).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByLabelText('edit_story'));
    expect(onEditStory).toHaveBeenCalledWith('story-1');
    expect(onSelectStory).toHaveBeenCalledTimes(1);
  });
});
