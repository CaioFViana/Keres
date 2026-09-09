import Button from '@/src/components/common/controls/Button/Button';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CharacterSceneManager from '@/src/components/features/characters/CharacterManager/CharacterSceneManager';
import CommentableDetailField, {
  type CommentableDetailFieldProps,
} from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import ItemCharacterManager from '@/src/components/features/items/ItemManager/ItemCharacterManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import CharacterRelationManager from '@/src/components/features/relations/CharacterRelationManager/CharacterRelationManager';
import AppearsInArcsSection from '@/src/components/features/arcs/AppearsInArcsSection';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import ScenePresenceList, {
  type ScenePresenceEntry,
} from '@/src/components/features/scenes/ScenePresenceList/ScenePresenceList';
import { CharacterStatPanel } from '@/src/components/features/stats/CharacterStatPanel/CharacterStatPanel';
import { ModeManager } from '@/src/components/features/stats/ModeManager/ModeManager';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import TagList from '@/src/components/common/display/TagList/TagList';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import type { CharacterScene } from '@keres/shared/entities/CharacterScene';
import type { Note, NoteRelation } from '@keres/shared/entities/Note';
import type { StatNotation } from '@keres/shared/graphs/statLadder';
import type { TFunction } from 'i18next';
import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import type { CharacterSelect } from '../../db/schemas/characters';
import type { ModeSelect } from '../../db/schemas/modes';
import type {
  ItemJourneySelect,
  ItemSelect,
  SceneSelect,
  StoryArcSelect,
  TagSelect,
} from '../../db/schema';
import type { StoryStatsData } from '../../hooks/useStoryStats';
import type { SaveNoteRelation } from '../../services/storymanagement/NoteRelationService';

export type CharacterDetailContentProps = {
  character: CharacterSelect;
  navigation: {
    goBack: () => void;
    navigate: (stack: string, params: Record<string, unknown>) => void;
  };
  t: TFunction;
  characterTags: TagSelect[];
  styles: { subTitle: StyleProp<TextStyle> };
  commentField: (
    field: string,
    value: string,
  ) => Omit<CommentableDetailFieldProps, 'label'>;
  characterId: string;
  openGalleryMediaViewer: (galleryId: string) => void;
  canEdit: boolean;
  statSystemEnabled: boolean;
  statData: StoryStatsData;
  selectedStory: { statNotation?: string | null } | null | undefined;
  characterModes: ModeSelect[];
  noopModeWrite: (...args: never[]) => Promise<void>;
  characterRelations: CharacterRelation[];
  allCharacters: CharacterSelect[];
  handleSaveRelation: (relation: CharacterRelation) => Promise<void>;
  handleDeleteRelation: (relationId: string) => Promise<void>;
  characterSceneRelations: CharacterScene[];
  allScenes: SceneSelect[];
  handleSaveCharacterScene: (characterScene: CharacterScene) => Promise<void>;
  handleDeleteCharacterScene: (characterSceneId: string) => Promise<void>;
  allItems: ItemSelect[];
  allItemJourneys: ItemJourneySelect[];
  characterLocationEntries: ScenePresenceEntry<{ id: string; name: string }>[];
  locationCopy: { entities: string };
  sceneCopy: { entity: string };
  characterNoteRelations: NoteRelation[];
  allNotes: Note[];
  saveNoteRelation: (relation: SaveNoteRelation) => Promise<void>;
  deleteNoteRelation: (relationId: string) => Promise<void>;
  appearingArcs: StoryArcSelect[];
};

export function CharacterDetailContent(props: CharacterDetailContentProps) {
  const {
    character,
    navigation,
    t,
    characterTags,
    styles,
    commentField,
    characterId,
    openGalleryMediaViewer,
    canEdit,
    statSystemEnabled,
    statData,
    selectedStory,
    characterModes,
    noopModeWrite,
    characterRelations,
    allCharacters,
    handleSaveRelation,
    handleDeleteRelation,
    characterSceneRelations,
    allScenes,
    handleSaveCharacterScene,
    handleDeleteCharacterScene,
    allItems,
    allItemJourneys,
    characterLocationEntries,
    locationCopy,
    sceneCopy,
    characterNoteRelations,
    allNotes,
    saveNoteRelation,
    deleteNoteRelation,
    appearingArcs,
  } = props;
  return (
    <DetailContainer
      title={character.name}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <TagList tags={characterTags} variant="chip" emptyMessage={t('no_tags_found')} />

      {character.title && <Text style={styles.subTitle}>{character.title}</Text>}

      <CommentableDetailField
        {...commentField('gender', character.gender || t('common_na'))}
        label={t('gender')}
      />
      <CommentableDetailField
        {...commentField('race', character.race || t('common_na'))}
        label={t('race')}
      />
      {character.subrace && (
        <CommentableDetailField
          {...commentField('subrace', character.subrace)}
          label={t('subrace')}
        />
      )}
      <CommentableDetailField
        {...commentField('description', character.description || t('common_na'))}
        label={t('description')}
      />
      <CommentableDetailField
        {...commentField('personality', character.personality || t('common_na'))}
        label={t('personality')}
      />
      <CommentableDetailField
        {...commentField('motivation', character.motivation || t('common_na'))}
        label={t('motivation')}
      />
      <CommentableDetailField
        {...commentField('qualities', character.qualities || t('common_na'))}
        label={t('qualities')}
      />
      <CommentableDetailField
        {...commentField('weaknesses', character.weaknesses || t('common_na'))}
        label={t('weaknesses')}
      />
      <CommentableDetailField
        {...commentField('biography', character.biography || t('common_na'))}
        label={t('biography')}
      />
      <CommentableDetailField
        {...commentField('plannedTimeline', character.plannedTimeline || t('common_na'))}
        label={t('planned_timeline')}
      />

      <CustomAttributeDetailFields
        storyId={character.storyId}
        entityType="Character"
        entityId={characterId}
      />

      <DetailField
        label={t('is_favorite')}
        value={character.isFavorite ? t('common_yes') : t('common_no')}
      />
      <CommentableDetailField
        {...commentField('extraNotes', character.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <ScreenSection title={t('media_section_title')} />
      <EntityGalleryManager
        ownerId={characterId}
        ownerType="Character"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      {statSystemEnabled ? (
        <>
          <ScreenSection title={t('stats_title')} />
          <CharacterStatPanel
            characterId={characterId}
            characterName={character.name}
            data={statData}
            notation={(selectedStory?.statNotation ?? 'letter') as StatNotation}
            onCompare={(modeId) =>
              navigation.navigate('CustomizationStack', {
                screen: 'StatComparison',
                params: { characterId, modeId: modeId ?? undefined },
              })
            }
          />
        </>
      ) : null}

      <ModeManager
        modes={characterModes}
        editable={false}
        onCreate={noopModeWrite as never}
        onUpdate={noopModeWrite as never}
        onDelete={noopModeWrite as never}
      />

      <CharacterRelationManager
        characterRelations={characterRelations}
        characters={allCharacters}
        onSave={handleSaveRelation}
        onDelete={handleDeleteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
      />

      <CharacterSceneManager
        characterSceneRelations={characterSceneRelations}
        availableScenes={allScenes}
        onSave={handleSaveCharacterScene}
        onDelete={handleDeleteCharacterScene}
        currentStoryId={character.storyId}
        currentCharacterId={characterId}
        editable={false}
      />

      <ItemCharacterManager
        allItems={allItems}
        allItemJourneys={allItemJourneys}
        allScenes={allScenes}
        currentCharacterId={characterId}
      />

      <ScenePresenceList
        entries={characterLocationEntries}
        title={locationCopy.entities}
        noItemsMessage="no_locations_assigned_to_character"
        entityType="Location"
        sceneLabel={sceneCopy.entity}
      />

      <NoteManager
        noteRelations={characterNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={character.storyId}
        currentEntityId={characterId}
        currentEntityType="Character"
      />

      <AppearsInArcsSection arcs={appearingArcs} />

      <SeeAlsoManager
        storyId={character.storyId}
        entityType="Character"
        entityId={characterId}
        editable={false}
      />

      <FavoritedByList storyId={character.storyId} entityId={characterId} entityType="Character" />

      <EntityMetadata
        version={character.version}
        createdAt={character.createdAt}
        updatedAt={character.updatedAt}
        entityType="Character"
        entityId={character.id}
      />
    </DetailContainer>
  );
}
