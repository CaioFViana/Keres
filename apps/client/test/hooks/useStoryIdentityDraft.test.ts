import { act, renderHook } from '@testing-library/react-native';
import { useStoryIdentityDraft } from '../../src/hooks/useStoryIdentityDraft';

describe('useStoryIdentityDraft', () => {
  it('starts with the form-safe defaults and lets each field be edited', async () => {
    const view = await renderHook(() => useStoryIdentityDraft());
    expect(view.result.current.storyFieldsFormProps).toMatchObject({
      title: '',
      type: 'linear',
      isFavorite: false,
      favoriteBehavior: 'individual',
    });

    await act(async () => {
      view.result.current.setTitle('The Long Night');
      view.result.current.setDescription('A winter tale');
      view.result.current.setType('branching');
    });
    expect(view.result.current.storyFieldsFormProps).toMatchObject({
      title: 'The Long Night',
      description: 'A winter tale',
      type: 'branching',
    });
  });

  it('copies every persisted identity field into the reusable form contract', async () => {
    const view = await renderHook(() => useStoryIdentityDraft());
    await act(async () =>
      view.result.current.applyStoryIdentity({
        title: 'The Archive',
        type: 'branching',
        description: 'Hidden histories',
        genre: 'Fantasy',
        language: 'pt-BR',
        author: 'Keres',
        isFavorite: true,
        favoriteBehavior: 'global',
        extraNotes: 'Keep the maps',
      }),
    );

    expect(view.result.current.storyFieldsFormProps).toMatchObject({
      title: 'The Archive',
      type: 'branching',
      description: 'Hidden histories',
      genre: 'Fantasy',
      language: 'pt-BR',
      author: 'Keres',
      isFavorite: true,
      favoriteBehavior: 'global',
      extraNotes: 'Keep the maps',
    });
  });
});
