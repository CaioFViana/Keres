import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import EntityMetadata from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import { ScreenError, ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import TagChipList from '@/src/components/common/display/TagChipList/TagChipList';
import { ChoiceCheckGroup } from '@keres/shared/entities/ChoiceCheckGroup';
import { ChoiceCheck } from '@keres/shared/entities/ChoiceCheck';
import { Effect } from '@keres/shared/entities/Effect';
import { useDrizzle } from '../../db';
import { ChoiceSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { createChoiceCheckGroupService } from '../../services/storymanagement/ChoiceCheckGroupService';
import { createChoiceCheckService } from '../../services/storymanagement/ChoiceCheckService';
import { createEffectService } from '../../services/storymanagement/EffectService';
import { createSceneService } from '../../services/storymanagement/SceneService';
import { createItemService } from '../../services/storymanagement/ItemService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { navigateToEntityDetail } from '../../utils/entityNavigation';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { ChoicesScreenNavigationProp } from './ChoiceListScreen';

export type ChoiceDetailScreenParamList = {
  ChoiceDetail: { choiceId: string };
};

type ChoiceDetailScreenRouteProp = RouteProp<ChoiceDetailScreenParamList, 'ChoiceDetail'>;

const ChoiceDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const route = useRoute<ChoiceDetailScreenRouteProp>();
  const { choiceId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

  const drizzleDb = useDrizzle();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);
  const choiceCheckGroupServiceRef = useRef<ReturnType<typeof createChoiceCheckGroupService> | null>(null);
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
    commentsByField, canComment, isStoryOwner, currentUserId, addComment, deleteComment, updateComment,
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
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    buttonContainer: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
    sectionDescription: { color: colors.textSecondary, marginBottom: 10 },
    card: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: colors.surface },
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
        setHeaderTitle(fetchedChoice.text || t('choice_details_title')); // Use text
      } else if (fetchedChoice && fetchedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('choice_not_found'));
        setHeaderTitle(t('choice_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch choice details:', err);
      setError(t('failed_to_load_choice'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [choiceId, navigation, t]);

  const handleChoiceChange = useCallback(async (changedStoryId: string, changedChoiceId: string) => {
    if (changedChoiceId === choiceId && choiceServiceRef.current) {
      const updatedChoice = await choiceServiceRef.current.getById(choiceId);
      if (!updatedChoice || updatedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setChoice(updatedChoice);
        setHeaderTitle(updatedChoice.text || t('choice_details_title')); // Use text
      }
    }
  }, [choiceId, navigation, t]);

  const fetchChecksAndEffects = useCallback(async () => {
    if (!choiceCheckGroupServiceRef.current || !choiceCheckServiceRef.current || !effectServiceRef.current || !choice?.storyId) {
      return;
    }
    try {
      const groups = await choiceCheckGroupServiceRef.current.getChoiceCheckGroupsByChoiceId(choice.storyId, choiceId);
      setCheckGroups(groups);
      const checksByGroupArrays = await Promise.all(
        groups.map(group => choiceCheckServiceRef.current!.getChoiceChecksByGroupId(choice.storyId, group.id))
      );
      setChecks(checksByGroupArrays.flat());
      const fetchedEffects = await effectServiceRef.current.getEffectsByEntity(choice.storyId, 'Choice', choiceId);
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
      setSceneNamesById(Object.fromEntries(allScenes.map(scene => [scene.id, scene.name])));
      setItemNamesById(Object.fromEntries(allItems.map(item => [item.id, item.name])));
    } catch (err) {
      console.error('Failed to fetch scene/item name lookups:', err);
    }
  }, [choice?.storyId]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    fetchChoice();
    entityEventEmitter.on('choice_changed', handleChoiceChange);
    return () => {
      entityEventEmitter.off('choice_changed', handleChoiceChange);
    };
  }, [choiceId, fetchChoice, handleChoiceChange]);

  useEffect(() => {
    if (choice && isBranching) {
      fetchChecksAndEffects();
      fetchNameLookups();
    }
  }, [choice, isBranching, fetchChecksAndEffects, fetchNameLookups]);


  const handleScenePress = useCallback((targetSceneId: string) => {
    const drawerNavigation = navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
    if (drawerNavigation) {
      navigateToEntityDetail(drawerNavigation, 'Scene', targetSceneId);
    }
  }, [navigation]);

  const renderHeaderRight = useCallback(() => (
    canEdit ? (
      <TouchableOpacity onPress={() => navigation.navigate('ChoiceForm', { choiceId })} style={{ marginRight: 15 }}>
        <Ionicons name="pencil-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    ) : null
  ), [navigation, choiceId, colors.text, canEdit]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_choice_details')} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!choice) {
    return <ScreenError padded message={t('choice_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  const describeCheckCondition = (check: ChoiceCheck): string => {
    switch (check.type) {
      case 'sceneCount': {
        const sceneName = (check.sceneId && sceneNamesById[check.sceneId]) || t('common_na');
        return t('check_condition_scene_count', { scene: sceneName, count: check.minVisits ?? 1 });
      }
      case 'inventory': {
        const itemName = (check.itemId && itemNamesById[check.itemId]) || t('common_na');
        return check.itemPresence === 'lacks'
          ? t('check_condition_inventory_lacks', { item: itemName })
          : t('check_condition_inventory_has', { item: itemName });
      }
      case 'trigger': {
        const triggerName = check.triggerName || t('common_na');
        return check.triggerState === 'unset'
          ? t('check_condition_trigger_unset', { trigger: triggerName })
          : t('check_condition_trigger_set', { trigger: triggerName });
      }
      default:
        return '';
    }
  };

  const describeCheck = (check: ChoiceCheck): string => {
    const prefix = check.mode === 'block' ? t('check_condition_prefix_block') : t('check_condition_prefix_enable');
    return `${prefix} ${describeCheckCondition(check)}`;
  };

  const describeEffect = (effect: Effect): string => {
    switch (effect.effectType) {
      case 'itemGrant':
        return t('effect_description_item_grant', { item: (effect.itemId && itemNamesById[effect.itemId]) || t('common_na') });
      case 'itemTake':
        return t('effect_description_item_take', { item: (effect.itemId && itemNamesById[effect.itemId]) || t('common_na') });
      case 'triggerSet':
        return t('effect_description_trigger_set', { trigger: effect.triggerName || t('common_na') });
      case 'triggerUnset':
        return t('effect_description_trigger_unset', { trigger: effect.triggerName || t('common_na') });
      default:
        return '';
    }
  };

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      <TagChipList tags={choiceTags} />

      <TouchableOpacity onPress={() => handleScenePress(choice.sceneId)} style={styles.sceneLink} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <DetailField label={t('from_scene')} value={sceneNamesById[choice.sceneId] || t('common_na')} />
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => handleScenePress(choice.nextSceneId)} style={styles.sceneLink} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <DetailField label={t('next_scene')} value={sceneNamesById[choice.nextSceneId] || t('common_na')} />
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
        onAddComment={(input) => addComment({ fieldKey: 'text' }, { ...input, contentSnapshot: choice.text || t('common_na') })}
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
        onAddComment={(input) => addComment({ fieldKey: 'notes' }, { ...input, contentSnapshot: choice.notes || t('common_na') })}
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

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

      <SeeAlsoManager storyId={choice.storyId} entityType="Choice" entityId={choiceId} editable={false} />

      {isBranching && (
        <>
          <Text style={styles.sectionTitle}>{t('checks_title')}</Text>
          <Text style={styles.sectionDescription}>{t('checks_groups_and_note')}</Text>
          {checkGroups.length === 0 && (
            <DetailField label={t('checks_title')} value={t('no_check_groups')} />
          )}
          {checkGroups.map(group => {
            const groupChecks = checks.filter(check => check.groupId === group.id);
            return (
              <View key={group.id} style={styles.card}>
                <Text style={styles.groupLabel}>
                  {group.combinator === 'OR' ? t('check_group_combinator_or_label') : t('check_group_combinator_and_label')}
                </Text>
                {groupChecks.length === 0 && (
                  <Text style={{ color: colors.textSecondary }}>{t('no_checks_in_group')}</Text>
                )}
                {groupChecks.map(check => (
                  <Text key={check.id} style={styles.checkRow}>{`• ${describeCheck(check)}`}</Text>
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
              {choiceEffects.map(effect => (
                <Text key={effect.id} style={styles.checkRow}>{`• ${describeEffect(effect)}`}</Text>
              ))}
            </View>
          )}
        </>
      )}

      <EntityMetadata version={choice.version} createdAt={choice.createdAt} updatedAt={choice.updatedAt} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ChoiceDetailScreen;
