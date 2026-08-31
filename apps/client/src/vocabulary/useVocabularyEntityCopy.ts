import type { StoryVocabularyEntityType } from '@keres/shared/entities/Story';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoryVocabulary } from './useStoryVocabulary';

const PARTICIPLE_ENDING = { masculine: 'o', feminine: 'a', neutral: 'o(a)' } as const;

/**
 * The create/edit/delete chrome every vocabulary-aware entity screen repeats, with the noun
 * already substituted so Portuguese participles can agree.
 */
export function useVocabularyEntityCopy(type: StoryVocabularyEntityType) {
  const { t } = useTranslation();
  const { agree, term } = useStoryVocabulary();
  const entity = term(type);
  const entities = term(type, true);
  const ending = agree(type, PARTICIPLE_ENDING);

  return useMemo(
    () => ({
      entity,
      entities,
      ending,
      createTitle: t('vocabulary_create_entity', { entity }),
      editTitle: t('vocabulary_edit_entity', { entity }),
      saveLabel: t('vocabulary_save_entity', { entity }),
      deleteLabel: t('vocabulary_delete_entity', { entity }),
      deleteMessage: t('vocabulary_delete_entity_message', { entity }),
      detailsTitle: t('vocabulary_entity_details', { entity }),
      notFound: t('vocabulary_entity_not_found', { entity, ending }),
      dataMissing: t('vocabulary_entity_data_missing', { entity }),
      created: t('vocabulary_entity_created', { entity, ending }),
      updated: t('vocabulary_entity_updated', { entity, ending }),
      deleted: t('vocabulary_entity_deleted', { entity, ending }),
      loading: t('vocabulary_loading_entities', { entities }),
      loadingDetails: t('vocabulary_loading_entity_details', { entity }),
      searchPlaceholder: t('search_entities', { entities }),
      select: t('vocabulary_select_entity', { entity }),
      selectOptional: t('vocabulary_select_entity_optional', { entity }),
      required: t('vocabulary_entity_required', { entity, ending }),
      unknown: t('vocabulary_unknown_entity', { entity, ending }),
      fromEntity: t('vocabulary_from_entity', { entity }),
      convertTo: t('vocabulary_convert_to_entity', { entity }),
      failedToLoad: t('vocabulary_failed_to_load_entity', { entity }),
      failedToSave: t('vocabulary_failed_to_save_entity', { entity }),
      failedToDelete: t('vocabulary_failed_to_delete_entity', { entity }),
    }),
    [ending, entities, entity, t],
  );
}
