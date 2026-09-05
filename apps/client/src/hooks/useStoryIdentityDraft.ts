import type { FavoriteBehavior, Story } from '@keres/shared/entities/Story';
import { useCallback, useState } from 'react';

type StoryIdentitySource = Pick<
  Story,
  | 'title'
  | 'type'
  | 'description'
  | 'genre'
  | 'language'
  | 'author'
  | 'isFavorite'
  | 'favoriteBehavior'
  | 'extraNotes'
>;

/**
 * The nine identity fields both `StoryFormScreen` and `StorySettingsScreen` edit through
 * `StoryFieldsForm`. Conversion, packs, servers and reading preferences stay on each screen.
 */
export function useStoryIdentityDraft() {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'linear' | 'branching'>('linear');
  const [description, setDescription] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBehavior, setFavoriteBehavior] = useState<FavoriteBehavior>('individual');
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const applyStoryIdentity = useCallback((story: StoryIdentitySource) => {
    setTitle(story.title);
    setType(story.type);
    setDescription(story.description);
    setGenre(story.genre);
    setLanguage(story.language);
    setAuthor(story.author);
    setIsFavorite(story.isFavorite);
    setFavoriteBehavior(story.favoriteBehavior);
    setExtraNotes(story.extraNotes);
  }, []);

  return {
    title,
    setTitle,
    type,
    setType,
    description,
    setDescription,
    genre,
    setGenre,
    language,
    setLanguage,
    author,
    setAuthor,
    isFavorite,
    setIsFavorite,
    favoriteBehavior,
    setFavoriteBehavior,
    extraNotes,
    setExtraNotes,
    applyStoryIdentity,
    storyFieldsFormProps: {
      title,
      onTitleChange: setTitle,
      type,
      description,
      onDescriptionChange: setDescription,
      genre,
      onGenreChange: setGenre,
      author,
      onAuthorChange: setAuthor,
      language,
      onLanguageChange: setLanguage,
      isFavorite,
      onIsFavoriteChange: setIsFavorite,
      favoriteBehavior,
      onFavoriteBehaviorChange: setFavoriteBehavior,
      extraNotes,
      onExtraNotesChange: setExtraNotes,
    },
  };
}
