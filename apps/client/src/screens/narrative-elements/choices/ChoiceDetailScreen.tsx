import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { Ionicons } from '@expo/vector-icons';
import type { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import type { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
import type { Effect } from '@keres/shared/entities/Effect';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../db';
import type { ChoiceSelect } from '../../../db/schema';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import { useEntityInitialLoad } from '../../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../../hooks/useEntityComments';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../../hooks/useFormScrollBottomPadding';
import { useStoryRole } from '../../../hooks/useStoryRole';
import { useNavigateToEntityDetail } from '../../../hooks/useNavigateToEntityDetail';
import { createChoiceCheckGroupService } from '../../../services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../../services/storymanagement/ChoiceCheckService';
import { createChoiceService } from '../../../services/storymanagement/ChoiceService';
import { createEffectService } from '../../../services/storymanagement/EffectService';
import { createItemService } from '../../../services/storymanagement/ItemService';
import { createSceneService } from '../../../services/storymanagement/SceneService';
import { useStoryStore } from '../../../state/storyStore';
import { useTheme } from '../../../theme';
import { commonDetailStyleDefs, getCommonContainerStyles } from '../../../theme/commonStyles';
import { describeChoiceCheck, describeEffect } from '../../../utils/choiceCheckEffectDescriptions';
import { setDocumentTitle } from '../../../utils/documentTitle';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../../vocabulary/useVocabularyEntityCopy';
import type { NarrativeElementsStackParamList } from '../../../navigation/MainSystemStack';

export type ChoiceDetailScreenParamList = {
  ChoiceDetail: { choiceId: string };
};

type ChoiceDetailScreenRouteProp = RouteProp<ChoiceDetailScreenParamList, 'ChoiceDetail'>;

const ChoiceDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<NarrativeElementsStackParamList, 'ChoiceDetail'>>();
  const route = useRoute<ChoiceDetailScreenRouteProp>();
  const { choiceId } = route.params;
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('Choice');
  const sceneCopy = useVocabularyEntityCopy('Scene');
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);
  const choiceCheckGroupServiceRef = useRef<ReturnType<
    typeof createChoiceCheckGroupService
  > | null>(null);
  const choiceCheckServiceRef = useRef<ReturnType<typeof createChoiceCheckService> | null>(null);
  const effectServiceRef = useRef<ReturnType<typeof createEffectService> | null>(null);
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const itemServiceRef = useRef<ReturnType<typeof createItemService> | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      if (!choiceServiceRef.current) {
        choiceServiceRef.current = createChoiceService(drizzleDb);
      }
      if (!choiceCheckGroupServiceRef.current) {
        choiceCheckGroupServiceRef.current = createChoiceCheckGroupService(drizzleDb);
      }
      if (!choiceCheckServiceRef.current) {
        choiceCheckServiceRef.current = createChoiceCheckService(drizzleDb);
      }
      if (!effectServiceRef.current) {
        effectServiceRef.current = createEffectService(drizzleDb);
      }
      if (!sceneServiceRef.current) {
        sceneServiceRef.current = createSceneService(drizzleDb);
      }
      if (!itemServiceRef.current) {
        itemServiceRef.current = createItemService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [choice, setChoice] = useState<ChoiceSelect | null>(null);
  const isBranching = selectedStory?.type === 'branching';
  const [checkGroups, setCheckGroups] = useState<ChoiceCheckGroup[]>([]);
  const [checks, setChecks] = useState<ChoiceCheck[]>([]);
  const [choiceEffects, setChoiceEffects] = useState<Effect[]>([]);
  const [sceneNamesById, setSceneNamesById] = useState<Record<string, string>>({});
  const [itemNamesById, setItemNamesById] = useState<Record<string, string>>({});
  const { canEdit } = useStoryRole(choice?.storyId);
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(choice?.storyId, 'Choice', choiceId);

  const {
    selectedTags: choiceTags,
    allNotes,
    noteRelations: choiceNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Choice', entityId: choiceId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    ...commonDetailStyleDefs(colors),
    sectionDescription: { color: colors.textSecondary, marginBottom: 10 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    choiceEffectContainer: { marginBottom: 20 },
    checkRow: { color: colors.text, marginTop: 4 },
    groupLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    sceneLink: { flexDirection: 'row', alignItems: 'center' },
  });

  const fetchChoice = useCallback(async () => {
    if (!choiceServiceRef.current) {
      console.warn('Choice service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedChoice = await choiceServiceRef.current.getById(choiceId);
      if (fetchedChoice && !fetchedChoice.isDeleted) {
        setChoice(fetchedChoice);
        setHeaderTitle(fetchedChoice.text || copy.detailsTitle);
      } else if (fetchedChoice && fetchedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setError(copy.notFound);
        setHeaderTitle(copy.notFound);
      }
    } catch (err) {
      console.error('Failed to fetch choice details:', err);
      setError(copy.failedToLoad);
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [choiceId, navigation, copy, t]);

  const handleChoiceChange = useCallback(
    async (changedStoryId: string, changedChoiceId: string) => {
      if (changedChoiceId === choiceId && choiceServiceRef.current) {
        const updatedChoice = await choiceServiceRef.current.getById(choiceId);
        if (!updatedChoice || updatedChoice.isDeleted) {
          navigation.goBack();
        } else {
          setChoice(updatedChoice);
          setHeaderTitle(updatedChoice.text || copy.detailsTitle);
        }
      }
    },
    [choiceId, navigation, copy],
  );

  const fetchChecksAndEffects = useCallback(async () => {
    if (
      !choiceCheckGroupServiceRef.current ||
      !choiceCheckServiceRef.current ||
      !effectServiceRef.current ||
      !choice?.storyId
    ) {
      return;
    }
    try {
      const groups = await choiceCheckGroupServiceRef.current.getChoiceCheckGroupsByChoiceId(
        choice.storyId,
        choiceId,
      );
      setCheckGroups(groups);
      const checksByGroupArrays = await Promise.all(
        groups.map((group) =>
          choiceCheckServiceRef.current!.getChoiceChecksByGroupId(choice.storyId, group.id),
        ),
      );
      setChecks(checksByGroupArrays.flat());
      const fetchedEffects = await effectServiceRef.current.getEffectsByEntity(
        choice.storyId,
        'Choice',
        choiceId,
      );
      setChoiceEffects(fetchedEffects);
    } catch (err) {
      console.error('Failed to fetch choice checks/effects:', err);
    }
  }, [choice?.storyId, choiceId]);

  const fetchNameLookups = useCallback(async () => {
    if (!sceneServiceRef.current || !itemServiceRef.current || !choice?.storyId) {
      return;
    }
    try {
      const [allScenes, allItems] = await Promise.all([
        sceneServiceRef.current.getAllByStoryId(choice.storyId),
        itemServiceRef.current.getItemsByStoryId(choice.storyId),
      ]);
      setSceneNamesById(Object.fromEntries(allScenes.map((scene) => [scene.id, scene.name])));
      setItemNamesById(Object.fromEntries(allItems.map((item) => [item.id, item.name])));
    } catch (err) {
      console.error('Failed to fetch scene/item name lookups:', err);
    }
  }, [choice?.storyId]);

  useEntityInitialLoad(fetchChoice);

  // The choice is loaded above; this effect owns only event subscriptions.
  useEffect(() => {
    entityEventEmitter.on('choice_changed', handleChoiceChange);
    return () => {
      entityEventEmitter.off('choice_changed', handleChoiceChange);
    };
  }, [handleChoiceChange]);

  useEffect(() => {
    if (choice && isBranching) {
      fetchChecksAndEffects();
      fetchNameLookups();
    }
  }, [choice, isBranching, fetchChecksAndEffects, fetchNameLookups]);

  const navigateToDetail = useNavigateToEntityDetail();

  const handleScenePress = useCallback(
    (targetSceneId: string) => {
      navigateToDetail('Scene', targetSceneId);
    },
    [navigateToDetail],
  );

  const renderHeaderRight = useCallback(
    () =>
      canEdit ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('ChoiceForm', { choiceId })}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="pencil-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : null,
    [navigation, choiceId, colors.text, canEdit],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight]),
  );

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!choice) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <TagList tags={choiceTags} variant="chip" emptyMessage={t('no_tags_found')} />

      <TouchableOpacity
        onPress={() => handleScenePress(choice.sceneId)}
        style={styles.sceneLink}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <DetailField
            label={sceneCopy.fromEntity}
            value={sceneNamesById[choice.sceneId] || t('common_na')}
          />
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleScenePress(choice.nextSceneId)}
        style={styles.sceneLink}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <DetailField
            label={t('next_scene')}
            value={sceneNamesById[choice.nextSceneId] || t('common_na')}
          />
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <CommentableDetailField
        storyId={choice.storyId}
        label={t('text')}
        value={choice.text || t('common_na')}
        comments={commentsByField['text'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'text' },
            { ...input, contentSnapshot: choice.text || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

      <CommentableDetailField
        storyId={choice.storyId}
        label={t('choice_notes')}
        value={choice.notes || t('common_na')}
        comments={commentsByField['notes'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'notes' },
            { ...input, contentSnapshot: choice.notes || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

      {isBranching && (
        <View style={styles.choiceEffectContainer}>
          <Text style={styles.sectionTitle}>{t('checks_title')}</Text>
          <Text style={styles.sectionDescription}>{t('checks_groups_and_note')}</Text>
          {checkGroups.length === 0 && (
            <DetailField label={t('checks_title')} value={t('no_check_groups')} />
          )}
          {checkGroups.map((group) => {
            const groupChecks = checks.filter((check) => check.groupId === group.id);
            return (
              <View key={group.id} style={styles.card}>
                <Text style={styles.groupLabel}>
                  {group.combinator === 'OR'
                    ? t('check_group_combinator_or_label')
                    : t('check_group_combinator_and_label')}
                </Text>
                {groupChecks.length === 0 && (
                  <Text style={{ color: colors.textSecondary }}>{t('no_checks_in_group')}</Text>
                )}
                {groupChecks.map((check) => (
                  <Text
                    key={check.id}
                    style={styles.checkRow}
                  >{`• ${describeChoiceCheck(check, sceneNamesById, itemNamesById, t)}`}</Text>
                ))}
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>{t('effects_title')}</Text>
          {choiceEffects.length === 0 && (
            <DetailField label={t('effects_title')} value={t('no_effects')} />
          )}
          {choiceEffects.length > 0 && (
            <View style={styles.card}>
              {choiceEffects.map((effect) => (
                <Text
                  key={effect.id}
                  style={styles.checkRow}
                >{`• ${describeEffect(effect, itemNamesById, t)}`}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      <NoteManager
        noteRelations={choiceNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={choiceId}
        currentEntityType="Choice"
      />

      <SeeAlsoManager
        storyId={choice.storyId}
        entityType="Choice"
        entityId={choiceId}
        editable={false}
      />

      <EntityMetadata
        version={choice.version}
        createdAt={choice.createdAt}
        updatedAt={choice.updatedAt}
      />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ChoiceDetailScreen;
