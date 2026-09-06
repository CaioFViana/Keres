import Button from '@/src/components/common/controls/Button/Button';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import TagList from '@/src/components/common/display/TagList/TagList';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import SceneCharacterManager from '@/src/components/features/characters/CharacterManager/SceneCharacterManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import ItemSceneManager from '@/src/components/features/items/ItemManager/ItemSceneManager';
import NoteRelationManager from '@/src/components/features/notes/NoteManager/NoteRelationManager';
import SceneNavigationControls from '@/src/components/features/scenes/SceneNavigationControls/SceneNavigationControls';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { formatSceneGap, formatSceneUniverseDuration } from '../../../utils/sceneTiming';

export function SceneDetailContent(props: any) {
  const {
    scene,
    navigation,
    t,
    styles,
    selectedStory,
    chapter,
    sceneTags,
    commentField,
    dateForScene,
    calendar,
    locationCopy,
    location,
    handleLocationPress,
    colors,
    openGalleryMediaViewer,
    canEdit,
    characterSceneRelations,
    characters,
    itemJourneys,
    allItems,
    sceneNoteRelations,
    allNotes,
    saveNoteRelation,
    deleteNoteRelation,
    sceneId,
    previousScene,
    nextScene,
    choicesForScene,
    incomingChoicesForScene,
    sceneNamesById,
    isBranching,
    sceneEffects,
    describeEffect,
  } = props;
  return (
    <DetailContainer
      title={scene.name}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      {chapter ? (
        <Text style={styles.subTitle}>
          {selectedStory?.type === 'linear' ? `${chapter.index}. ` : ''}
          {chapter.name}
        </Text>
      ) : scene && !scene.chapterId ? (
        <Text style={[styles.subTitle, { fontStyle: 'italic' }]}>{t('unchaptered_scenes')}</Text>
      ) : null}
      <TagList tags={sceneTags} variant="chip" emptyMessage={t('no_tags_found')} />
      <CommentableDetailField
        {...commentField('summary', scene.summary || t('common_na'))}
        label={t('summary')}
      />
      {dateForScene(scene) && (
        <DetailField label={t('calendar_scene_date')} value={dateForScene(scene)!.date} />
      )}
      <DetailField
        label={t('gap')}
        value={`${formatSceneGap(scene, t, {
          normalize: selectedStory?.normalizeSceneTiming,
          calendar,
        })}${dateForScene(scene)?.gapRange ? ` · ${dateForScene(scene)?.gapRange}` : ''}`}
      />
      <DetailField
        label={t('in_universe_duration')}
        value={`${formatSceneUniverseDuration(scene, t, {
          normalize: selectedStory?.normalizeSceneTiming,
          calendar,
        })}${dateForScene(scene)?.durationEnd ? ` · ${dateForScene(scene)?.durationEnd}` : ''}`}
      />

      <CustomAttributeDetailFields storyId={scene.storyId} entityType="Scene" entityId={sceneId} />

      <DetailField
        label={t('is_favorite')}
        value={scene.isFavorite ? t('common_yes') : t('common_no')}
      />
      <CommentableDetailField
        {...commentField('extraNotes', scene.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      {location && (
        <>
          <ScreenSection title={locationCopy.entity} />
          <TouchableOpacity
            onPress={handleLocationPress}
            style={styles.locationLink}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <DetailField label={t('name')} value={location.name} />
              <DetailField
                label={t('description')}
                value={location.description || t('common_na')}
              />
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </>
      )}

      <ScreenSection title={t('media_section_title')} />
      <EntityGalleryManager
        ownerId={sceneId}
        ownerType="Scene"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      <SceneCharacterManager
        characterRelations={characterSceneRelations}
        availableCharacters={characters.filter((char: any) => !char.isDeleted)}
        onSave={() => Promise.resolve()}
        onDelete={() => Promise.resolve()}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentSceneId={sceneId}
      />

      <ItemSceneManager
        itemJourneys={itemJourneys}
        allItems={allItems.filter((item: any) => !item.isDeleted)}
        allCharacters={characters.filter((char: any) => !char.isDeleted)}
        currentSceneId={sceneId}
      />

      <NoteRelationManager
        noteRelations={sceneNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={sceneId}
        currentEntityType="Scene"
      />

      <SceneNavigationControls
        storyType={selectedStory?.type}
        previousScene={previousScene}
        nextScene={nextScene}
        choicesForScene={choicesForScene}
        incomingChoicesForScene={incomingChoicesForScene}
        sceneNamesById={sceneNamesById}
        canEdit={canEdit}
        onAddChoice={() => navigation.navigate('ChoiceForm', { sceneId })}
      />

      {isBranching && (
        <>
          <ScreenSection title={t('effects_title')} />
          {sceneEffects.length === 0 && (
            <DetailField label={t('effects_title')} value={t('no_effects')} />
          )}
          {sceneEffects.length > 0 && (
            <View style={styles.card}>
              {sceneEffects.map((effect: any) => (
                <Text key={effect.id} style={styles.checkRow}>{`• ${describeEffect(effect)}`}</Text>
              ))}
            </View>
          )}
        </>
      )}

      <SeeAlsoManager
        storyId={scene.storyId}
        entityType="Scene"
        entityId={sceneId}
        editable={false}
      />

      <FavoritedByList storyId={scene.storyId} entityId={sceneId} entityType="Scene" />

      <EntityMetadata
        version={scene.version}
        createdAt={scene.createdAt}
        updatedAt={scene.updatedAt}
        entityType="Scene"
        entityId={scene.id}
      />
    </DetailContainer>
  );
}
